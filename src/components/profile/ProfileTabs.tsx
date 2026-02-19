import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Inbox, MessageSquare, Heart, ArrowRight, Rss } from 'lucide-react';
import { useUserLikedBlueprints, useUserComments } from '@/hooks/useUserProfile';
import { useProfileFeed } from '@/hooks/useProfileFeed';
import { useMyFeed } from '@/hooks/useMyFeed';
import { MyFeedTimeline } from '@/components/feed/MyFeedTimeline';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ApiRequestError, deactivateSourceSubscription, listSourceSubscriptions, type SourceSubscription } from '@/lib/subscriptionsApi';
import { buildSourcePagePath } from '@/lib/sourcePagesApi';

interface ProfileTabsProps {
  userId: string;
  isOwnerView: boolean;
  profileIsPublic: boolean;
}

export function ProfileTabs({ userId, isOwnerView, profileIsPublic }: ProfileTabsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingRows, setPendingRows] = useState<Record<string, boolean>>({});
  const { data: myFeedItems, isLoading: myFeedLoading } = useMyFeed();
  const { data: profileFeed, isLoading: profileFeedLoading, isError: profileFeedIsError, error: profileFeedError } = useProfileFeed(userId, !isOwnerView);
  const { data: likedBlueprints, isLoading: likedLoading } = useUserLikedBlueprints(userId, 12);
  const { data: comments, isLoading: commentsLoading } = useUserComments(userId, 20);
  const subscriptionsQuery = useQuery({
    queryKey: ['source-subscriptions', user?.id],
    enabled: isOwnerView && !!user,
    queryFn: listSourceSubscriptions,
  });

  const activeSubscriptions = useMemo(
    () => (subscriptionsQuery.data || []).filter((row) => row.is_active),
    [subscriptionsQuery.data],
  );

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateSourceSubscription(id),
    onSuccess: () => {
      toast({ title: 'Unsubscribed', description: 'You will no longer receive new uploads from this channel.' });
      queryClient.invalidateQueries({ queryKey: ['source-subscriptions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-feed-items', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['profile-feed', userId] });
    },
    onError: (error) => {
      const description = error instanceof ApiRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Could not unsubscribe.';
      toast({ title: 'Unsubscribe failed', description, variant: 'destructive' });
    },
  });

  const feedItems = isOwnerView ? myFeedItems : (profileFeed?.items || []);
  const feedLoading = isOwnerView ? myFeedLoading : profileFeedLoading;

  const markRowPending = (subscriptionId: string, isPending: boolean) => {
    setPendingRows((previous) => {
      if (isPending) return { ...previous, [subscriptionId]: true };
      if (!previous[subscriptionId]) return previous;
      const next = { ...previous };
      delete next[subscriptionId];
      return next;
    });
  };

  const handleUnsubscribe = async (subscriptionId: string) => {
    if (!isOwnerView || pendingRows[subscriptionId]) return;
    markRowPending(subscriptionId, true);
    try {
      await deactivateMutation.mutateAsync(subscriptionId);
    } finally {
      markRowPending(subscriptionId, false);
    }
  };

  return (
    <Tabs defaultValue="feed" className="w-full">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="feed" className="gap-1.5">
          <Inbox className="h-4 w-4" />
          Feed
        </TabsTrigger>
        <TabsTrigger value="comments" className="gap-1.5">
          <MessageSquare className="h-4 w-4" />
          Comments
        </TabsTrigger>
        <TabsTrigger value="liked" className="gap-1.5">
          <Heart className="h-4 w-4" />
          Liked
        </TabsTrigger>
        {isOwnerView ? (
          <TabsTrigger value="subscriptions" className="gap-1.5">
            <Rss className="h-4 w-4" />
            Subscriptions
          </TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="feed" className="mt-4">
        {!isOwnerView && !profileIsPublic ? (
          <EmptyState icon={<Inbox className="h-8 w-8" />} message="This feed is private." />
        ) : !isOwnerView && profileFeedIsError ? (
          <EmptyState
            icon={<Inbox className="h-8 w-8" />}
            message={profileFeedError instanceof Error ? profileFeedError.message : 'Failed to load feed.'}
          />
        ) : (
          <MyFeedTimeline
            items={feedItems}
            isLoading={feedLoading}
            isOwnerView={isOwnerView}
            profileUserId={userId}
            emptyMessage="No feed items yet."
          />
        )}
      </TabsContent>

      <TabsContent value="comments" className="mt-4">
        {commentsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : comments && comments.length > 0 ? (
          <div className="space-y-3">
            {comments.map((row) => (
              <Card key={row.id} className="transition hover:border-primary/40">
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm text-muted-foreground line-clamp-2">{row.content}</p>
                    <Link to={`/blueprint/${row.blueprint_id}`} className="text-sm font-medium hover:underline break-words">
                      {row.blueprint_title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={<MessageSquare className="h-8 w-8" />} message="No comments yet." />
        )}
      </TabsContent>

      <TabsContent value="liked" className="mt-4">
        {likedLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : likedBlueprints && likedBlueprints.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {likedBlueprints.map((bp) => (
              <Link key={bp.id} to={`/blueprint/${bp.id}`}>
                <Card className="h-full transition hover:border-primary/40">
                  <CardContent className="p-4">
                    <h4 className="font-medium truncate">{bp.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      by {bp.creator_profile?.display_name || 'Anonymous'}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Heart className="h-3 w-3 fill-current text-destructive" />
                      <span>{bp.likes_count}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Heart className="h-8 w-8" />} message="No liked blueprints yet" />
        )}
      </TabsContent>

      {isOwnerView ? (
        <TabsContent value="subscriptions" className="mt-4">
          {subscriptionsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : activeSubscriptions.length > 0 ? (
            <div className="space-y-3">
              {activeSubscriptions.map((subscription) => {
                const sourcePagePath = getSubscriptionSourcePagePath(subscription);
                return (
                  <Card key={subscription.id} className="transition hover:border-primary/30">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-3">
                        {sourcePagePath ? (
                          <Link
                            to={sourcePagePath}
                            className="block shrink-0"
                            aria-label={`Open ${subscription.source_channel_title || subscription.source_channel_id} source page`}
                          >
                            {subscription.source_channel_avatar_url ? (
                              <img
                                src={subscription.source_channel_avatar_url}
                                alt={subscription.source_channel_title || 'Channel avatar'}
                                className="h-10 w-10 rounded-full border border-border/40 object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full border border-border/40 bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                {getSubscriptionInitials(subscription)}
                              </div>
                            )}
                          </Link>
                        ) : (
                          <div className="block shrink-0">
                            {subscription.source_channel_avatar_url ? (
                              <img
                                src={subscription.source_channel_avatar_url}
                                alt={subscription.source_channel_title || 'Channel avatar'}
                                className="h-10 w-10 rounded-full border border-border/40 object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full border border-border/40 bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                {getSubscriptionInitials(subscription)}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="min-w-0">
                          {sourcePagePath ? (
                            <Link to={sourcePagePath} className="text-sm font-medium truncate hover:underline block">
                              {subscription.source_channel_title || subscription.source_channel_id}
                            </Link>
                          ) : (
                            <p className="text-sm font-medium truncate">
                              {subscription.source_channel_title || subscription.source_channel_id}
                            </p>
                          )}
                          <a
                            href={getSubscriptionChannelUrl(subscription)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-muted-foreground underline underline-offset-2"
                          >
                            Open on YouTube
                          </a>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs"
                        onClick={() => handleUnsubscribe(subscription.id)}
                        disabled={Boolean(pendingRows[subscription.id])}
                      >
                        {pendingRows[subscription.id] ? 'Unsubscribing...' : 'Unsubscribe'}
                      </Button>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<Rss className="h-8 w-8" />} message="No subscriptions yet." />
          )}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

function EmptyState({ icon, message }: { icon: JSX.Element; message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            {icon}
          </div>
          <p className="text-muted-foreground">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function getSubscriptionChannelUrl(subscription: SourceSubscription) {
  if (subscription.source_channel_url) return subscription.source_channel_url;
  return `https://www.youtube.com/channel/${subscription.source_channel_id}`;
}

function getSubscriptionSourcePagePath(subscription: SourceSubscription) {
  if (subscription.source_page_path) return subscription.source_page_path;
  const channelId = String(subscription.source_channel_id || '').trim();
  if (!channelId) return null;
  return buildSourcePagePath('youtube', channelId);
}

function getSubscriptionInitials(subscription: SourceSubscription) {
  const raw = (subscription.source_channel_title || subscription.source_channel_id || '').trim();
  if (!raw) return 'YT';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}
