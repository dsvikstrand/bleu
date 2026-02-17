import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppHeader } from '@/components/shared/AppHeader';
import { AppFooter } from '@/components/shared/AppFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useMyFeed } from '@/hooks/useMyFeed';
import { CHANNELS_CATALOG } from '@/lib/channelsCatalog';
import { resolvePrimaryChannelFromTags } from '@/lib/channelMapping';
import { getMyFeedStateLabel, type MyFeedItemState } from '@/lib/myFeedState';
import { publishCandidate, rejectCandidate, submitCandidateAndEvaluate } from '@/lib/myFeedApi';
import {
  acceptMyFeedPendingItem,
  ApiRequestError,
  createSourceSubscription,
  skipMyFeedPendingItem,
} from '@/lib/subscriptionsApi';
import { PageMain, PageRoot, PageSection } from '@/components/layout/Page';
import { logMvpEvent } from '@/lib/logEvent';
import { config } from '@/config/runtime';

const CHANNEL_OPTIONS = CHANNELS_CATALOG.filter((channel) => channel.status === 'active' && channel.isJoinEnabled);

export default function MyFeed() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useMyFeed();
  const [selectedChannels, setSelectedChannels] = useState<Record<string, string>>({});

  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [newSubscriptionInput, setNewSubscriptionInput] = useState('');

  const subscriptionsEnabled = Boolean(config.agenticBackendUrl);

  const defaultChannelForItem = (itemId: string, tags: string[]) => {
    const picked = selectedChannels[itemId];
    if (picked) return picked;
    return resolvePrimaryChannelFromTags(tags);
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

  const createSubscriptionMutation = useMutation({
    mutationFn: async () => {
      if (!newSubscriptionInput.trim()) throw new Error('Enter a YouTube channel URL, channel ID, or @handle.');
      return createSourceSubscription({ channelInput: newSubscriptionInput.trim() });
    },
    onSuccess: () => {
      setNewSubscriptionInput('');
      setSubscriptionModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['my-feed-items', user?.id] });
      toast({ title: 'Subscription saved', description: 'You are now subscribed. New uploads will appear in your feed.' });
    },
    onError: (error) => {
      const message = error instanceof ApiRequestError && error.errorCode === 'INVALID_CHANNEL'
        ? 'Could not resolve that YouTube channel. Try a valid channel URL or @handle.'
        : error instanceof Error
          ? error.message
          : 'Could not subscribe.';
      toast({ title: 'Subscribe failed', description: message, variant: 'destructive' });
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

  return (
    <PageRoot>
      <AppHeader />
      <PageMain className="space-y-6">
        <PageSection>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary uppercase tracking-wide">My Feed</p>
              <h1 className="text-2xl font-semibold mt-1">Your personal pulled-content lane</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Pulled content lands here first. You can submit selected items to channels after gates.
              </p>
              {pendingCount > 0 && <p className="text-xs text-amber-600">{pendingCount} item(s) need manual review.</p>}
              {pendingAcceptCount > 0 && <p className="text-xs text-sky-600">{pendingAcceptCount} pending item(s) waiting for Accept.</p>}
            </div>

            {user ? (
              <Button
                size="sm"
                onClick={() => setSubscriptionModalOpen(true)}
                disabled={!subscriptionsEnabled}
              >
                Add Subscription
              </Button>
            ) : null}
          </div>

          {user && !subscriptionsEnabled ? (
            <p className="text-xs text-muted-foreground mt-2">
              Subscription APIs require `VITE_AGENTIC_BACKEND_URL`. Configure backend URL to enable channel subscriptions.
            </p>
          ) : null}
        </PageSection>

        <Dialog open={subscriptionModalOpen} onOpenChange={setSubscriptionModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add YouTube Subscription</DialogTitle>
              <DialogDescription>
                Subscribe once. We will only pull new uploads from this channel.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Input
                value={newSubscriptionInput}
                onChange={(event) => setNewSubscriptionInput(event.target.value)}
                placeholder="YouTube channel URL, channel ID, or @handle"
              />

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSubscriptionModalOpen(false)}
                  disabled={createSubscriptionMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createSubscriptionMutation.mutate()}
                  disabled={createSubscriptionMutation.isPending || !subscriptionsEnabled}
                >
                  Subscribe
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
              const title = isSubscriptionNotice
                ? (source?.title || 'You are now subscribed')
                : (blueprint?.title || source?.title || 'Pending source import');
              const subtitle = isSubscriptionNotice
                ? 'New uploads from this channel will appear automatically.'
                : (source?.sourceChannelTitle || source?.title || 'Imported source');
              const tags = blueprint?.tags || [];

              const channelSlug = blueprint ? defaultChannelForItem(item.id, tags) : '';
              const stepCount = blueprint && Array.isArray(blueprint.steps) ? blueprint.steps.length : 0;
              const canPublish = item.candidate?.status === 'passed' || item.state === 'candidate_pending_manual_review';
              const canAccept = item.state === 'my_feed_pending_accept' || item.state === 'my_feed_skipped';

              return (
                <Card key={item.id} className="border-border/50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium leading-tight">{title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{subtitle}</p>
                      </div>
                      <Badge variant="secondary">{getMyFeedStateLabel(item.state as MyFeedItemState)}</Badge>
                    </div>

                    {!isSubscriptionNotice && tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tags.slice(0, 4).map((tag) => (
                          <Badge key={tag} variant="outline">#{tag}</Badge>
                        ))}
                      </div>
                    )}

                    {!isSubscriptionNotice && item.lastDecisionCode && (
                      <p className="text-xs text-muted-foreground">Reason: {item.lastDecisionCode}</p>
                    )}

                    {isSubscriptionNotice ? (
                      <div className="flex justify-end">
                        {source?.sourceUrl ? (
                          <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="text-xs underline text-muted-foreground">
                            Open channel
                          </a>
                        ) : null}
                      </div>
                    ) : !blueprint ? (
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
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-[1fr,auto]">
                        <Select
                          value={channelSlug}
                          onValueChange={(value) => setSelectedChannels((prev) => ({ ...prev, [item.id]: value }))}
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

                        {!item.candidate ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              submitMutation.mutate({
                                itemId: item.id,
                                sourceItemId: source?.id || null,
                                blueprintId: blueprint.id,
                                title: blueprint.title,
                                llmReview: blueprint.llmReview,
                                tags,
                                stepCount,
                                channelSlug,
                              })
                            }
                            disabled={submitMutation.isPending}
                          >
                            Submit to Channel
                          </Button>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                submitMutation.mutate({
                                  itemId: item.id,
                                  sourceItemId: source?.id || null,
                                  blueprintId: blueprint.id,
                                  title: blueprint.title,
                                  llmReview: blueprint.llmReview,
                                  tags,
                                  stepCount,
                                  channelSlug,
                                })
                              }
                              disabled={submitMutation.isPending}
                            >
                              Re-evaluate
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                publishMutation.mutate({
                                  itemId: item.id,
                                  sourceItemId: source?.id || null,
                                  candidateId: item.candidate!.id,
                                  blueprintId: blueprint.id,
                                  channelSlug: item.candidate?.channelSlug || channelSlug,
                                })
                              }
                              disabled={publishMutation.isPending || !canPublish}
                            >
                              Publish
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                rejectMutation.mutate({
                                  itemId: item.id,
                                  sourceItemId: source?.id || null,
                                  candidateId: item.candidate!.id,
                                  reasonCode: 'MANUAL_REJECT',
                                  blueprintId: blueprint.id,
                                  channelSlug: item.candidate?.channelSlug || channelSlug,
                                })
                              }
                              disabled={rejectMutation.isPending}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {!isSubscriptionNotice && (
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>{item.candidate ? `Candidate: ${item.candidate.status}` : 'Not submitted yet'}</span>
                        {blueprint ? (
                          <Link to={`/blueprint/${blueprint.id}`} className="underline">Open blueprint</Link>
                        ) : source?.sourceUrl ? (
                          <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="underline">Open source</a>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        <AppFooter />
      </PageMain>
    </PageRoot>
  );
}
