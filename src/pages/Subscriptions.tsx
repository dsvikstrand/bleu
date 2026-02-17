import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppHeader } from '@/components/shared/AppHeader';
import { AppFooter } from '@/components/shared/AppFooter';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  ApiRequestError,
  createSourceSubscription,
  deactivateSourceSubscription,
  listSourceSubscriptions,
  reactivateSourceSubscription,
  syncSourceSubscription,
  type SourceSubscription,
} from '@/lib/subscriptionsApi';
import { PageMain, PageRoot, PageSection } from '@/components/layout/Page';
import { config } from '@/config/runtime';

function getChannelUrl(subscription: SourceSubscription) {
  if (subscription.source_channel_url) return subscription.source_channel_url;
  return `https://www.youtube.com/channel/${subscription.source_channel_id}`;
}

function formatDateTime(value: string | null) {
  if (!value) return 'Never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString();
}

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    switch (error.errorCode) {
      case 'NOT_FOUND':
        return 'Subscription not found. Refresh and try again.';
      case 'INACTIVE_SUBSCRIPTION':
        return 'This subscription is inactive. Reactivate it first.';
      case 'WRITE_FAILED':
        return 'Could not update subscription. Please try again.';
      case 'SYNC_FAILED':
        return 'Sync failed. Please try again in a moment.';
      default:
        return error.message || fallback;
    }
  }
  return error instanceof Error ? error.message : fallback;
}

export default function Subscriptions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const subscriptionsEnabled = Boolean(config.agenticBackendUrl);

  const [channelInput, setChannelInput] = useState('');
  const [pendingRows, setPendingRows] = useState<Record<string, boolean>>({});
  const [deactivateTarget, setDeactivateTarget] = useState<SourceSubscription | null>(null);

  const invalidateSubscriptionViews = () => {
    queryClient.invalidateQueries({ queryKey: ['source-subscriptions', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['my-feed-items', user?.id] });
  };

  const isRowPending = (subscriptionId: string) => Boolean(pendingRows[subscriptionId]);
  const markRowPending = (subscriptionId: string, isPending: boolean) => {
    setPendingRows((previous) => {
      if (isPending) return { ...previous, [subscriptionId]: true };
      if (!previous[subscriptionId]) return previous;
      const next = { ...previous };
      delete next[subscriptionId];
      return next;
    });
  };

  const withRowPending = async <T,>(subscriptionId: string, operation: () => Promise<T>) => {
    if (isRowPending(subscriptionId)) return null;
    markRowPending(subscriptionId, true);
    try {
      return await operation();
    } catch {
      return null;
    } finally {
      markRowPending(subscriptionId, false);
    }
  };

  const subscriptionsQuery = useQuery({
    queryKey: ['source-subscriptions', user?.id],
    enabled: Boolean(user) && subscriptionsEnabled,
    queryFn: listSourceSubscriptions,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const input = channelInput.trim();
      if (!subscriptionsEnabled) throw new Error('Backend API is not configured.');
      if (!input) throw new Error('Enter a YouTube channel URL, channel ID, or @handle.');
      return createSourceSubscription({ channelInput: input });
    },
    onSuccess: () => {
      setChannelInput('');
      invalidateSubscriptionViews();
      toast({
        title: 'Subscription saved',
        description: 'You are now subscribed. New uploads will appear in your feed.',
      });
    },
    onError: (error) => {
      const description = error instanceof ApiRequestError && error.errorCode === 'INVALID_CHANNEL'
        ? 'Could not resolve that YouTube channel. Try a valid channel URL or @handle.'
        : error instanceof Error
          ? error.message
          : 'Could not create subscription.';
      toast({ title: 'Subscribe failed', description, variant: 'destructive' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateSourceSubscription(id),
    onSuccess: () => {
      invalidateSubscriptionViews();
      toast({ title: 'Subscription deactivated.' });
    },
    onError: (error) => {
      toast({
        title: 'Deactivate failed',
        description: getActionErrorMessage(error, 'Could not deactivate subscription.'),
        variant: 'destructive',
      });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => reactivateSourceSubscription(id),
    onSuccess: () => {
      invalidateSubscriptionViews();
      toast({ title: 'Subscription reactivated.' });
    },
    onError: (error) => {
      toast({
        title: 'Reactivate failed',
        description: getActionErrorMessage(error, 'Could not reactivate subscription.'),
        variant: 'destructive',
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => syncSourceSubscription(id),
    onSuccess: (result) => {
      invalidateSubscriptionViews();
      toast({
        title: 'Sync complete',
        description: `Inserted ${result.inserted}, skipped ${result.skipped}, processed ${result.processed}.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Sync failed',
        description: getActionErrorMessage(error, 'Could not sync subscription.'),
        variant: 'destructive',
      });
    },
  });

  const handleSyncNow = (subscription: SourceSubscription) => {
    void withRowPending(subscription.id, () => syncMutation.mutateAsync(subscription.id));
  };

  const handleReactivate = (subscription: SourceSubscription) => {
    void withRowPending(subscription.id, () => reactivateMutation.mutateAsync(subscription.id));
  };

  const handleConfirmDeactivate = () => {
    if (!deactivateTarget) return;
    void withRowPending(deactivateTarget.id, async () => {
      await deactivateMutation.mutateAsync(deactivateTarget.id);
      setDeactivateTarget(null);
    });
  };

  const subscriptions = subscriptionsQuery.data || [];
  const activeSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => subscription.is_active),
    [subscriptions],
  );
  const inactiveSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => !subscription.is_active),
    [subscriptions],
  );

  return (
    <PageRoot>
      <AppHeader />

      <PageMain className="space-y-6">
        <PageSection>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide">Subscriptions</p>
            <h1 className="text-2xl font-semibold">Manage YouTube source subscriptions</h1>
            <p className="text-sm text-muted-foreground">
              Add channels here. New uploads will land in My Feed automatically.
            </p>
            <Button asChild size="sm" variant="outline" className="h-8 px-2">
              <Link to="/my-feed">Back to My Feed</Link>
            </Button>
          </div>
        </PageSection>

        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={channelInput}
              onChange={(event) => setChannelInput(event.target.value)}
              placeholder="YouTube channel URL, channel ID, or @handle"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !subscriptionsEnabled}
              >
                Subscribe
              </Button>
            </div>
            {!subscriptionsEnabled ? (
              <p className="text-xs text-muted-foreground">
                Subscription APIs require `VITE_AGENTIC_BACKEND_URL`.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {subscriptionsQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : subscriptionsQuery.error ? (
          <Card className="border-border/40">
            <CardContent className="p-4 text-sm text-destructive">
              Could not load subscriptions. Please refresh and try again.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Active subscriptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeSubscriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active subscriptions yet.</p>
                ) : (
                  activeSubscriptions.map((subscription) => (
                    <div key={subscription.id} className="rounded-md border border-border/40 p-3 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-medium">
                          {subscription.source_channel_title || subscription.source_channel_id}
                        </p>
                        <div className="flex gap-2">
                          <Badge variant="secondary">Active</Badge>
                          <Badge variant="outline">{subscription.mode}</Badge>
                        </div>
                      </div>
                      <a
                        href={getChannelUrl(subscription)}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs underline text-muted-foreground break-all"
                      >
                        {getChannelUrl(subscription)}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        Last polled: {formatDateTime(subscription.last_polled_at)}
                      </p>
                      {subscription.last_sync_error ? (
                        <p className="text-xs text-red-600/90">Sync issue: {subscription.last_sync_error}</p>
                      ) : null}
                      <div className="flex flex-wrap justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSyncNow(subscription)}
                          disabled={!subscriptionsEnabled || isRowPending(subscription.id)}
                        >
                          {isRowPending(subscription.id) ? 'Syncing...' : 'Sync now'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeactivateTarget(subscription)}
                          disabled={!subscriptionsEnabled || isRowPending(subscription.id)}
                        >
                          Deactivate
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Inactive subscriptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {inactiveSubscriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No inactive subscriptions.</p>
                ) : (
                  inactiveSubscriptions.map((subscription) => (
                    <div key={subscription.id} className="rounded-md border border-border/40 p-3 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-medium">
                          {subscription.source_channel_title || subscription.source_channel_id}
                        </p>
                        <div className="flex gap-2">
                          <Badge variant="secondary">Inactive</Badge>
                          <Badge variant="outline">{subscription.mode}</Badge>
                        </div>
                      </div>
                      <a
                        href={getChannelUrl(subscription)}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs underline text-muted-foreground break-all"
                      >
                        {getChannelUrl(subscription)}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        Last polled: {formatDateTime(subscription.last_polled_at)}
                      </p>
                      {subscription.last_sync_error ? (
                        <p className="text-xs text-red-600/90">Sync issue: {subscription.last_sync_error}</p>
                      ) : null}
                      <div className="flex justify-end pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleReactivate(subscription)}
                          disabled={!subscriptionsEnabled || isRowPending(subscription.id)}
                        >
                          {isRowPending(subscription.id) ? 'Reactivating...' : 'Reactivate'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <AlertDialog
          open={Boolean(deactivateTarget)}
          onOpenChange={(open) => {
            if (!open) setDeactivateTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate subscription?</AlertDialogTitle>
              <AlertDialogDescription>
                New uploads from this channel will stop appearing automatically until you reactivate.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(deactivateTarget && isRowPending(deactivateTarget.id))}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDeactivate}
                disabled={Boolean(deactivateTarget && isRowPending(deactivateTarget.id))}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AppFooter />
      </PageMain>
    </PageRoot>
  );
}
