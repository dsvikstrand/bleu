import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppHeader } from '@/components/shared/AppHeader';
import { AppFooter } from '@/components/shared/AppFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useMyFeed } from '@/hooks/useMyFeed';
import { CHANNELS_CATALOG } from '@/lib/channelsCatalog';
import { resolvePrimaryChannelFromTags } from '@/lib/channelMapping';
import { buildFeedSummary } from '@/lib/feedPreview';
import { getMyFeedStateLabel, type MyFeedItemState } from '@/lib/myFeedState';
import { publishCandidate, rejectCandidate, submitCandidateAndEvaluate } from '@/lib/myFeedApi';
import {
  acceptMyFeedPendingItem,
  deactivateSourceSubscriptionByChannelId,
  skipMyFeedPendingItem,
} from '@/lib/subscriptionsApi';
import { PageMain, PageRoot, PageSection } from '@/components/layout/Page';
import { logMvpEvent } from '@/lib/logEvent';
import { formatRelativeShort } from '@/lib/timeFormat';
import { config } from '@/config/runtime';

const CHANNEL_OPTIONS = CHANNELS_CATALOG.filter((channel) => channel.status === 'active' && channel.isJoinEnabled);
const CHANNEL_NAME_BY_SLUG = new Map(CHANNELS_CATALOG.map((channel) => [channel.slug, channel.name]));

export default function MyFeed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useMyFeed();
  const autoChannelPipelineEnabled = config.features.autoChannelPipelineV1;
  const [selectedChannels, setSelectedChannels] = useState<Record<string, string>>({});
  const [submissionDialogItemId, setSubmissionDialogItemId] = useState<string | null>(null);
  const [subscriptionDialogItemId, setSubscriptionDialogItemId] = useState<string | null>(null);
  const [unsubscribeDialogItemId, setUnsubscribeDialogItemId] = useState<string | null>(null);

  const defaultChannelForItem = (itemId: string, tags: string[]) => {
    const picked = selectedChannels[itemId];
    if (picked) return picked;
    return resolvePrimaryChannelFromTags(tags);
  };

  const getChannelDisplayName = (channelSlug: string | null | undefined) => {
    if (!channelSlug) return 'channel';
    return CHANNEL_NAME_BY_SLUG.get(channelSlug) || channelSlug;
  };

  const submitMutation = useMutation({
    mutationFn: async (input: {
      itemId: string;
      sourceItemId: string | null;
      blueprintId: string;
      title: string;
      llmReview: string | null;
      tags: string[];
      stepCount: number;
      channelSlug: string;
    }) => {
      if (!user) throw new Error('Sign in required.');
      const result = await submitCandidateAndEvaluate({
        userId: user.id,
        userFeedItemId: input.itemId,
        blueprintId: input.blueprintId,
        channelSlug: input.channelSlug,
        title: input.title,
        llmReview: input.llmReview,
        stepCount: input.stepCount,
        tagSlugs: input.tags,
      });

      await logMvpEvent({
        eventName: 'candidate_submitted',
        userId: user.id,
        blueprintId: input.blueprintId,
        metadata: {
          user_feed_item_id: input.itemId,
          source_item_id: input.sourceItemId,
          candidate_id: result.candidateId,
          channel_slug: input.channelSlug,
          status: result.status,
          reason_code: result.reasonCode,
        },
      });

      await logMvpEvent({
        eventName: 'candidate_gate_result',
        userId: user.id,
        blueprintId: input.blueprintId,
        metadata: {
          user_feed_item_id: input.itemId,
          source_item_id: input.sourceItemId,
          candidate_id: result.candidateId,
          channel_slug: input.channelSlug,
          aggregate: result.status === 'passed' ? 'pass' : result.status === 'pending_manual_review' ? 'warn' : 'block',
          reason_code: result.reasonCode,
        },
      });

      if (result.status === 'pending_manual_review') {
        await logMvpEvent({
          eventName: 'candidate_manual_review_pending',
          userId: user.id,
          blueprintId: input.blueprintId,
          metadata: {
            user_feed_item_id: input.itemId,
            source_item_id: input.sourceItemId,
            candidate_id: result.candidateId,
            channel_slug: input.channelSlug,
            reason_code: result.reasonCode,
          },
        });
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['my-feed-items', user?.id] });
      setSubmissionDialogItemId(null);
      if (result.status === 'passed') {
        toast({ title: 'Candidate passed gates', description: 'You can publish this to channel now.' });
      } else if (result.status === 'pending_manual_review') {
        toast({ title: 'Needs review', description: 'Candidate needs manual review before publish.' });
      } else {
        toast({ title: 'Rejected for channel', description: `Reason: ${result.reasonCode}` });
      }
    },
    onError: (error) => {
      toast({ title: 'Submit failed', description: error instanceof Error ? error.message : 'Could not submit.', variant: 'destructive' });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (input: {
      itemId: string;
      sourceItemId: string | null;
      candidateId: string;
      blueprintId: string;
      channelSlug: string;
    }) => {
      if (!user) throw new Error('Sign in required.');
      await publishCandidate({
        userId: user.id,
        candidateId: input.candidateId,
        userFeedItemId: input.itemId,
        blueprintId: input.blueprintId,
        channelSlug: input.channelSlug,
      });
      await logMvpEvent({
        eventName: 'channel_publish_succeeded',
        userId: user.id,
        blueprintId: input.blueprintId,
        metadata: {
          user_feed_item_id: input.itemId,
          source_item_id: input.sourceItemId,
          candidate_id: input.candidateId,
          channel_slug: input.channelSlug,
          reason_code: 'ALL_GATES_PASS',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-feed-items', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['wall-blueprints'] });
      queryClient.invalidateQueries({ queryKey: ['channel-feed-base'] });
      queryClient.invalidateQueries({ queryKey: ['channel-feed-comments'] });
      setSubmissionDialogItemId(null);
      toast({ title: 'Published', description: 'Item is now live in channel feed.' });
    },
    onError: (error) => {
      toast({ title: 'Publish failed', description: error instanceof Error ? error.message : 'Could not publish.', variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (input: {
      itemId: string;
      sourceItemId: string | null;
      candidateId: string;
      reasonCode: string;
      blueprintId: string;
      channelSlug: string;
    }) => {
      if (!user) throw new Error('Sign in required.');
      await rejectCandidate({
        userId: user.id,
        candidateId: input.candidateId,
        userFeedItemId: input.itemId,
        reasonCode: input.reasonCode,
      });
      await logMvpEvent({
        eventName: 'channel_publish_rejected',
        userId: user.id,
        blueprintId: input.blueprintId,
        metadata: {
          user_feed_item_id: input.itemId,
          source_item_id: input.sourceItemId,
          candidate_id: input.candidateId,
          channel_slug: input.channelSlug,
          reason_code: input.reasonCode,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-feed-items', user?.id] });
      setSubmissionDialogItemId(null);
      toast({ title: 'Rejected', description: 'Kept in My Feed as personal content.' });
    },
    onError: (error) => {
      toast({ title: 'Reject failed', description: error instanceof Error ? error.message : 'Could not reject.', variant: 'destructive' });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (itemId: string) => acceptMyFeedPendingItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-feed-items', user?.id] });
      toast({ title: 'Accepted', description: 'Blueprint generated and added to your feed.' });
    },
    onError: (error) => {
      toast({ title: 'Accept failed', description: error instanceof Error ? error.message : 'Could not accept item.', variant: 'destructive' });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async (itemId: string) => skipMyFeedPendingItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-feed-items', user?.id] });
      toast({ title: 'Skipped', description: 'Item remains skipped in My Feed.' });
    },
    onError: (error) => {
      toast({ title: 'Skip failed', description: error instanceof Error ? error.message : 'Could not skip item.', variant: 'destructive' });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async (channelId: string) => {
      return deactivateSourceSubscriptionByChannelId(channelId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-feed-items', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['source-subscriptions', user?.id] });
      setSubscriptionDialogItemId(null);
      setUnsubscribeDialogItemId(null);
      toast({ title: 'Unsubscribed', description: 'Subscription removed from your feed.' });
    },
    onError: (error) => {
      toast({
        title: 'Unsubscribe failed',
        description: error instanceof Error ? error.message : 'Could not unsubscribe.',
        variant: 'destructive',
      });
    },
  });

  const hasItems = (items || []).length > 0;

  const pendingCount = useMemo(
    () => (items || []).filter((item) => item.state === 'candidate_pending_manual_review').length,
    [items],
  );

  const pendingAcceptCount = useMemo(
    () => (items || []).filter((item) => item.state === 'my_feed_pending_accept').length,
    [items],
  );

  const submissionDialogItem = useMemo(
    () => (items || []).find((item) => item.id === submissionDialogItemId) || null,
    [items, submissionDialogItemId],
  );
  const unsubscribeDialogItem = useMemo(
    () => (items || []).find((item) => item.id === unsubscribeDialogItemId) || null,
    [items, unsubscribeDialogItemId],
  );
  const subscriptionDialogItem = useMemo(
    () => (items || []).find((item) => item.id === subscriptionDialogItemId) || null,
    [items, subscriptionDialogItemId],
  );

  return (
    <PageRoot>
      <AppHeader />
      <PageMain className="space-y-6">
        <PageSection>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary uppercase tracking-wide">My Feed</p>
              <h1 className="text-2xl font-semibold mt-1">Your personal content lane</h1>
              <p className="text-sm text-muted-foreground mt-2">
                {autoChannelPipelineEnabled
                  ? 'New items appear here first. Channel publishing runs automatically in the background.'
                  : 'New items appear here first. You can post selected blueprints to channels after review.'}
              </p>
              {pendingCount > 0 && <p className="text-xs text-amber-600">{pendingCount} item(s) need manual review.</p>}
              {pendingAcceptCount > 0 && <p className="text-xs text-sky-600">{pendingAcceptCount} pending item(s) waiting for Accept.</p>}
            </div>

            {user ? (
              <div className="flex items-center gap-2">
                <Button asChild size="sm" className="h-8 px-2">
                  <Link to="/subscriptions?add=1">Add Subscription</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 px-2">
                  <Link to="/subscriptions">Manage subscriptions</Link>
                </Button>
              </div>
            ) : null}
          </div>
        </PageSection>

        {!user ? (
          <Card className="border-border/40">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Sign in to access your personal feed.</p>
              <Button asChild size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : !hasItems ? (
          <Card className="border-border/40">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">No pulled content yet. Start with a YouTube URL.</p>
              <Button asChild size="sm" variant="outline">
                <Link to="/youtube">Pull from YouTube</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {(items || []).map((item) => {
              const blueprint = item.blueprint;
              const source = item.source;
              const isSubscriptionNotice = item.state === 'subscription_notice';
              const hasBlueprintBanner = !isSubscriptionNotice && !!blueprint?.bannerUrl;
              const title = isSubscriptionNotice
                ? (source?.title || 'You are now subscribed')
                : (blueprint?.title || source?.title || 'Pending source import');
              const subtitle = isSubscriptionNotice
                ? 'New uploads from this channel will appear automatically.'
                : (source?.sourceChannelTitle || source?.title || 'Imported source');
              const tags = blueprint?.tags || [];
              const canAccept = item.state === 'my_feed_pending_accept' || item.state === 'my_feed_skipped';
              const preview = buildFeedSummary({
                primary: blueprint?.llmReview || null,
                fallback: source?.title || 'Open to view the full blueprint.',
                maxChars: 220,
              });
              const createdLabel = formatRelativeShort(item.createdAt);

              return (
                <Card
                  key={item.id}
                  className={`border-border/50 ${isSubscriptionNotice || hasBlueprintBanner ? 'relative overflow-hidden' : ''} ${isSubscriptionNotice ? 'cursor-pointer transition-colors hover:border-border' : ''} ${blueprint ? 'cursor-pointer transition-colors hover:border-border' : ''}`}
                  onClick={
                    isSubscriptionNotice
                      ? () => setSubscriptionDialogItemId(item.id)
                      : blueprint
                        ? () => navigate(`/blueprint/${blueprint.id}`)
                        : undefined
                  }
                  onKeyDown={
                    (isSubscriptionNotice || blueprint)
                      ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          if (isSubscriptionNotice) {
                            setSubscriptionDialogItemId(item.id);
                            return;
                          }
                          if (blueprint) {
                            navigate(`/blueprint/${blueprint.id}`);
                          }
                        }
                      }
                      : undefined
                  }
                  role={isSubscriptionNotice || blueprint ? 'button' : undefined}
                  tabIndex={isSubscriptionNotice || blueprint ? 0 : undefined}
                >
                  {isSubscriptionNotice && !!source?.channelBannerUrl && (
                    <>
                      <img
                        src={source.channelBannerUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-30"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background/85" />
                    </>
                  )}
                  {hasBlueprintBanner && (
                    <>
                      <img
                        src={blueprint.bannerUrl || ''}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-35"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-background/35 via-background/60 to-background/80" />
                    </>
                  )}
                  <CardContent className={`p-4 space-y-3 ${isSubscriptionNotice || hasBlueprintBanner ? 'relative' : ''}`}>
                    {isSubscriptionNotice ? (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex items-start gap-3">
                            {source?.thumbnailUrl ? (
                              <img
                                src={source.thumbnailUrl}
                                alt={source.sourceChannelTitle || 'Channel avatar'}
                                className="h-10 w-10 rounded-full border border-border/40 object-cover shrink-0"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full border border-border/40 bg-muted shrink-0" />
                            )}
                            <div className="min-w-0 space-y-1">
                              <p className="font-medium leading-tight">{title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{subtitle}</p>
                            </div>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{createdLabel}</span>
                        </div>
                      </>
                    ) : !blueprint ? (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="font-medium leading-tight">{title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{subtitle}</p>
                          </div>
                          <Badge variant="secondary">{getMyFeedStateLabel(item.state as MyFeedItemState)}</Badge>
                        </div>
                        {!isSubscriptionNotice && item.lastDecisionCode && (
                          <p className="text-xs text-muted-foreground">Reason: {item.lastDecisionCode}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => acceptMutation.mutate(item.id)}
                            disabled={acceptMutation.isPending || !canAccept}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => skipMutation.mutate(item.id)}
                            disabled={skipMutation.isPending || item.state !== 'my_feed_pending_accept'}
                          >
                            Skip
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold tracking-wide text-foreground/75">{subtitle}</p>
                            <span className="text-[11px] text-muted-foreground">{createdLabel}</span>
                          </div>
                          <p className="text-base font-semibold leading-tight">{title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-3">{preview}</p>
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {tags.slice(0, 4).map((tag) => (
                                <Badge key={tag} variant="outline">#{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {!isSubscriptionNotice && !blueprint && (
                      <div className="flex justify-end">
                        {source?.sourceUrl ? (
                          <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="underline text-xs text-muted-foreground">
                            Open source
                          </a>
                        ) : null}
                      </div>
                    )}

                    {!autoChannelPipelineEnabled && !isSubscriptionNotice && blueprint && item.lastDecisionCode && item.state !== 'channel_published' && (
                      <p className="text-xs text-muted-foreground">Reason: {item.lastDecisionCode}</p>
                    )}

                    {!isSubscriptionNotice && (
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>
                          {item.state === 'channel_published' ? (
                            `Posted to ${getChannelDisplayName(item.candidate?.channelSlug || null)}`
                          ) : autoChannelPipelineEnabled ? (
                            item.state === 'my_feed_generating' || item.state === 'candidate_submitted'
                              ? 'Publishing...'
                              : 'In My Feed'
                          ) : (
                            <button
                              type="button"
                              className="underline underline-offset-2 hover:text-foreground"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSubmissionDialogItemId(item.id);
                              }}
                            >
                              {item.state === 'channel_rejected' ? 'In My Feed' : 'Post to Channel'}
                            </button>
                          )}
                        </span>
                        {item.state === 'channel_published' ? (
                          <Badge variant="secondary">Published to Channel</Badge>
                        ) : item.state === 'my_feed_published' || (autoChannelPipelineEnabled && item.state === 'channel_rejected') ? (
                          <Badge variant="secondary">In My Feed</Badge>
                        ) : (
                          <span>{getMyFeedStateLabel(item.state as MyFeedItemState)}</span>
                        )}
                      </div>
                    )}

                    {isSubscriptionNotice && (
                      <div className="flex justify-end">
                        <Badge variant="secondary">Subscription</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            <Dialog
              open={!!subscriptionDialogItem}
              onOpenChange={(open) => {
                if (!open) setSubscriptionDialogItemId(null);
              }}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Subscription details</DialogTitle>
                  <DialogDescription>
                    Manage this channel subscription from one place.
                  </DialogDescription>
                </DialogHeader>
                {subscriptionDialogItem?.source ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-tight">
                        {subscriptionDialogItem.source.sourceChannelTitle || subscriptionDialogItem.source.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Status: {getMyFeedStateLabel(subscriptionDialogItem.state as MyFeedItemState)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Added: {formatRelativeShort(subscriptionDialogItem.createdAt)}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setUnsubscribeDialogItemId(subscriptionDialogItem.id)}
                        disabled={unsubscribeMutation.isPending}
                      >
                        Unsubscribe
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Subscription details are unavailable.</p>
                )}
              </DialogContent>
            </Dialog>

            {!autoChannelPipelineEnabled && (
              <Dialog open={!!submissionDialogItem} onOpenChange={(open) => {
                if (!open) setSubmissionDialogItemId(null);
              }}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Submit to Channel</DialogTitle>
                    <DialogDescription>
                      Choose a channel for this blueprint and submit it for channel review.
                    </DialogDescription>
                  </DialogHeader>
                  {submissionDialogItem?.blueprint ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium leading-tight">{submissionDialogItem.blueprint.title}</p>
                      <Select
                        value={defaultChannelForItem(submissionDialogItem.id, submissionDialogItem.blueprint.tags || [])}
                        onValueChange={(value) => setSelectedChannels((prev) => ({ ...prev, [submissionDialogItem.id]: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select channel" />
                        </SelectTrigger>
                        <SelectContent>
                          {CHANNEL_OPTIONS.map((channel) => (
                            <SelectItem key={channel.slug} value={channel.slug}>
                              {channel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!submissionDialogItem.candidate ? (
                        <Button
                          className="w-full"
                          onClick={() => {
                            const tags = submissionDialogItem.blueprint?.tags || [];
                            const selected = defaultChannelForItem(submissionDialogItem.id, tags);
                            const stepCount = Array.isArray(submissionDialogItem.blueprint?.steps)
                              ? submissionDialogItem.blueprint.steps.length
                              : 0;
                            submitMutation.mutate({
                              itemId: submissionDialogItem.id,
                              sourceItemId: submissionDialogItem.source?.id || null,
                              blueprintId: submissionDialogItem.blueprint.id,
                              title: submissionDialogItem.blueprint.title,
                              llmReview: submissionDialogItem.blueprint.llmReview,
                              tags,
                              stepCount,
                              channelSlug: selected,
                            });
                          }}
                          disabled={submitMutation.isPending}
                        >
                          Submit to Channel
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => {
                                const tags = submissionDialogItem.blueprint?.tags || [];
                                const selected = defaultChannelForItem(submissionDialogItem.id, tags);
                                const stepCount = Array.isArray(submissionDialogItem.blueprint?.steps)
                                  ? submissionDialogItem.blueprint.steps.length
                                  : 0;
                                submitMutation.mutate({
                                  itemId: submissionDialogItem.id,
                                  sourceItemId: submissionDialogItem.source?.id || null,
                                  blueprintId: submissionDialogItem.blueprint.id,
                                  title: submissionDialogItem.blueprint.title,
                                  llmReview: submissionDialogItem.blueprint.llmReview,
                                  tags,
                                  stepCount,
                                  channelSlug: selected,
                                });
                              }}
                              disabled={submitMutation.isPending}
                            >
                              Re-evaluate
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() =>
                                publishMutation.mutate({
                                  itemId: submissionDialogItem.id,
                                  sourceItemId: submissionDialogItem.source?.id || null,
                                  candidateId: submissionDialogItem.candidate!.id,
                                  blueprintId: submissionDialogItem.blueprint!.id,
                                  channelSlug: submissionDialogItem.candidate?.channelSlug || defaultChannelForItem(submissionDialogItem.id, submissionDialogItem.blueprint?.tags || []),
                                })
                              }
                              disabled={publishMutation.isPending || !(submissionDialogItem.candidate?.status === 'passed' || submissionDialogItem.state === 'candidate_pending_manual_review')}
                            >
                              Publish
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full"
                            onClick={() =>
                              rejectMutation.mutate({
                                itemId: submissionDialogItem.id,
                                sourceItemId: submissionDialogItem.source?.id || null,
                                candidateId: submissionDialogItem.candidate!.id,
                                reasonCode: 'MANUAL_REJECT',
                                blueprintId: submissionDialogItem.blueprint!.id,
                                channelSlug: submissionDialogItem.candidate?.channelSlug || defaultChannelForItem(submissionDialogItem.id, submissionDialogItem.blueprint?.tags || []),
                              })
                            }
                            disabled={rejectMutation.isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No blueprint available for submission.</p>
                  )}
                </DialogContent>
              </Dialog>
            )}

            <AlertDialog
              open={!!unsubscribeDialogItem}
              onOpenChange={(open) => {
                if (!open) setUnsubscribeDialogItemId(null);
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unsubscribe from this channel?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will stop new uploads from appearing and remove this subscription notice from My Feed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={unsubscribeMutation.isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={
                      unsubscribeMutation.isPending
                      || !unsubscribeDialogItem?.source?.sourceChannelId
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      const channelId = unsubscribeDialogItem?.source?.sourceChannelId;
                      if (!channelId) return;
                      unsubscribeMutation.mutate(channelId);
                    }}
                  >
                    {unsubscribeMutation.isPending ? 'Unsubscribing...' : 'Unsubscribe'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
        <AppFooter />
      </PageMain>
    </PageRoot>
  );
}
