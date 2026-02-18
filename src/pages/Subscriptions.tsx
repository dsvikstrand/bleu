import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppHeader } from '@/components/shared/AppHeader';
import { AppFooter } from '@/components/shared/AppFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  ApiRequestError,
  createSourceSubscription,
  deactivateSourceSubscription,
  getIngestionJob,
  generateSubscriptionRefreshBlueprints,
  listSourceSubscriptions,
  scanSubscriptionRefreshCandidates,
  type IngestionJobStatus,
  type SubscriptionRefreshCandidate,
  type SourceSubscription,
} from '@/lib/subscriptionsApi';
import { evaluateSubscriptionHealth } from '@/lib/subscriptionHealth';
import { PageMain, PageRoot, PageSection } from '@/components/layout/Page';
import { config } from '@/config/runtime';
import {
  ApiRequestError as ChannelSearchApiRequestError,
  searchYouTubeChannels,
  type YouTubeChannelSearchResult,
} from '@/lib/youtubeChannelSearchApi';

function getChannelUrl(subscription: SourceSubscription) {
  if (subscription.source_channel_url) return subscription.source_channel_url;
  return `https://www.youtube.com/channel/${subscription.source_channel_id}`;
}

function getChannelInitials(subscription: SourceSubscription) {
  const raw = (subscription.source_channel_title || subscription.source_channel_id || '').trim();
  if (!raw) return 'YT';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function formatDateTime(value: string | null) {
  if (!value) return 'Never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString();
}

function getRefreshCandidateKey(item: SubscriptionRefreshCandidate) {
  return `${item.subscription_id}:${item.video_id}`;
}

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    switch (error.errorCode) {
      case 'NOT_FOUND':
        return 'Subscription not found. Refresh and try again.';
      case 'WRITE_FAILED':
        return 'Could not update subscription. Please try again.';
      default:
        return error.message || fallback;
    }
  }
  return error instanceof Error ? error.message : fallback;
}

function getChannelSearchErrorMessage(error: unknown) {
  if (error instanceof ChannelSearchApiRequestError) {
    switch (error.errorCode) {
      case 'INVALID_QUERY':
        return 'Enter at least 2 characters to search for channels.';
      case 'SEARCH_DISABLED':
        return 'Channel search is currently unavailable.';
      case 'RATE_LIMITED':
        return 'Search quota is currently limited. Please try again shortly.';
      case 'API_NOT_CONFIGURED':
        return 'Search requires VITE_AGENTIC_BACKEND_URL.';
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : 'Channel search failed.';
}

export default function Subscriptions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const subscriptionsEnabled = Boolean(config.agenticBackendUrl);

  const [searchParams, setSearchParams] = useSearchParams();
  const [isAddSubscriptionOpen, setIsAddSubscriptionOpen] = useState(false);
  const [channelSearchQuery, setChannelSearchQuery] = useState('');
  const [channelSearchSubmittedQuery, setChannelSearchSubmittedQuery] = useState('');
  const [channelSearchResults, setChannelSearchResults] = useState<YouTubeChannelSearchResult[]>([]);
  const [channelSearchNextToken, setChannelSearchNextToken] = useState<string | null>(null);
  const [channelSearchError, setChannelSearchError] = useState<string | null>(null);
  const [subscribingChannelIds, setSubscribingChannelIds] = useState<Record<string, boolean>>({});
  const [pendingRows, setPendingRows] = useState<Record<string, boolean>>({});
  const [isRefreshDialogOpen, setIsRefreshDialogOpen] = useState(false);
  const [refreshCandidates, setRefreshCandidates] = useState<SubscriptionRefreshCandidate[]>([]);
  const [refreshSelected, setRefreshSelected] = useState<Record<string, boolean>>({});
  const [refreshScanErrors, setRefreshScanErrors] = useState<Array<{ subscription_id: string; error: string }>>([]);
  const [refreshErrorText, setRefreshErrorText] = useState<string | null>(null);
  const [activeRefreshJobId, setActiveRefreshJobId] = useState<string | null>(null);
  const [queuedRefreshCount, setQueuedRefreshCount] = useState<number>(0);
  const [terminalHandledJobId, setTerminalHandledJobId] = useState<string | null>(null);

  const invalidateSubscriptionViews = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['source-subscriptions', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['my-feed-items', user?.id] });
  }, [queryClient, user?.id]);

  const resetSearchDialogState = () => {
    setChannelSearchQuery('');
    setChannelSearchSubmittedQuery('');
    setChannelSearchResults([]);
    setChannelSearchNextToken(null);
    setChannelSearchError(null);
  };

  const handleAddSubscriptionDialogChange = (nextOpen: boolean) => {
    setIsAddSubscriptionOpen(nextOpen);
    if (!nextOpen) {
      resetSearchDialogState();
    }
  };

  useEffect(() => {
    if (searchParams.get('add') !== '1') return;
    setIsAddSubscriptionOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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

  const channelSearchMutation = useMutation({
    mutationFn: async (input: { query: string; pageToken?: string | null; append?: boolean }) => {
      const data = await searchYouTubeChannels({
        q: input.query,
        limit: 10,
        pageToken: input.pageToken || undefined,
      });
      return {
        query: input.query,
        append: Boolean(input.append),
        ...data,
      };
    },
    onSuccess: (payload) => {
      setChannelSearchSubmittedQuery(payload.query);
      setChannelSearchError(null);
      setChannelSearchResults((previous) => (payload.append ? [...previous, ...payload.results] : payload.results));
      setChannelSearchNextToken(payload.next_page_token);
    },
    onError: (error) => {
      setChannelSearchError(getChannelSearchErrorMessage(error));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (inputRaw: string) => {
      const input = inputRaw.trim();
      if (!subscriptionsEnabled) throw new Error('Backend API is not configured.');
      if (!input) throw new Error('Enter a channel to subscribe.');
      return createSourceSubscription({ channelInput: input });
    },
    onSuccess: () => {
      invalidateSubscriptionViews();
    },
    onError: (error) => {
      const description = error instanceof ApiRequestError && error.errorCode === 'INVALID_CHANNEL'
        ? 'Could not resolve that YouTube channel. Try another result.'
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
      toast({ title: 'Unsubscribed', description: 'You will no longer receive new uploads from this channel.' });
    },
    onError: (error) => {
      toast({
        title: 'Unsubscribe failed',
        description: getActionErrorMessage(error, 'Could not unsubscribe from this channel.'),
        variant: 'destructive',
      });
    },
  });

  const refreshScanMutation = useMutation({
    mutationFn: async () => {
      if (!subscriptionsEnabled) throw new Error('Backend API is not configured.');
      return scanSubscriptionRefreshCandidates();
    },
    onSuccess: (payload) => {
      setRefreshErrorText(null);
      setRefreshCandidates(payload.candidates || []);
      setRefreshScanErrors(payload.scan_errors || []);
      const next: Record<string, boolean> = {};
      for (const candidate of payload.candidates || []) {
        next[getRefreshCandidateKey(candidate)] = true;
      }
      setRefreshSelected(next);
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.errorCode === 'RATE_LIMITED') {
        setRefreshErrorText(error.message || 'Refresh scan is cooling down. Please retry shortly.');
      } else {
        setRefreshErrorText(error instanceof Error ? error.message : 'Could not scan subscriptions.');
      }
      setRefreshCandidates([]);
      setRefreshScanErrors([]);
      setRefreshSelected({});
    },
  });

  const refreshGenerateMutation = useMutation({
    mutationFn: async (items: SubscriptionRefreshCandidate[]) => {
      if (!subscriptionsEnabled) throw new Error('Backend API is not configured.');
      return generateSubscriptionRefreshBlueprints({ items });
    },
    onSuccess: (payload) => {
      invalidateSubscriptionViews();
      setActiveRefreshJobId(payload.job_id);
      setQueuedRefreshCount(payload.queued_count);
      setTerminalHandledJobId(null);
      toast({
        title: 'Background generation started',
        description: `Queued ${payload.queued_count} video(s). You can keep using the app while blueprints are generated.`,
      });
      setIsRefreshDialogOpen(false);
    },
    onError: (error) => {
      if (error instanceof ApiRequestError) {
        if (error.errorCode === 'JOB_ALREADY_RUNNING') {
          const jobId = (error.data as { job_id?: string } | null)?.job_id || null;
          if (jobId) {
            setActiveRefreshJobId(jobId);
            setTerminalHandledJobId(null);
          }
          toast({
            title: 'Generation already in progress',
            description: 'Please wait for the current background generation to finish.',
          });
          return;
        }
        if (error.errorCode === 'MAX_ITEMS_EXCEEDED') {
          toast({
            title: 'Selection too large',
            description: 'Select up to 20 videos per generation run.',
            variant: 'destructive',
          });
          return;
        }
        if (error.errorCode === 'RATE_LIMITED') {
          toast({
            title: 'Please wait before generating again',
            description: error.message || 'Generation is temporarily rate-limited.',
            variant: 'destructive',
          });
          return;
        }
      }
      toast({
        title: 'Generate failed',
        description: error instanceof Error ? error.message : 'Could not start background generation.',
        variant: 'destructive',
      });
    },
  });

  const refreshJobQuery = useQuery({
    queryKey: ['ingestion-job', activeRefreshJobId, user?.id],
    enabled: Boolean(activeRefreshJobId) && Boolean(user) && subscriptionsEnabled,
    queryFn: () => getIngestionJob(activeRefreshJobId as string),
    refetchInterval: (query) => {
      const status = query.state.data?.status as IngestionJobStatus | undefined;
      if (!status || status === 'queued' || status === 'running') return 4000;
      return false;
    },
  });

  const handleUnsubscribe = (subscription: SourceSubscription) => {
    void withRowPending(subscription.id, () => deactivateMutation.mutateAsync(subscription.id));
  };

  const setSubscribing = (channelId: string, value: boolean) => {
    setSubscribingChannelIds((previous) => {
      if (value) return { ...previous, [channelId]: true };
      if (!previous[channelId]) return previous;
      const next = { ...previous };
      delete next[channelId];
      return next;
    });
  };

  const handleChannelSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    const query = channelSearchQuery.trim();
    if (!query) {
      setChannelSearchError('Enter a channel query.');
      return;
    }
    channelSearchMutation.mutate({ query, append: false });
  };

  const handleChannelSearchLoadMore = () => {
    if (!channelSearchNextToken || channelSearchMutation.isPending) return;
    channelSearchMutation.mutate({
      query: channelSearchSubmittedQuery || channelSearchQuery.trim(),
      pageToken: channelSearchNextToken,
      append: true,
    });
  };

  const runSubscribe = async (input: string, successTitle = 'Subscription saved') => {
    await createMutation.mutateAsync(input);
    toast({
      title: successTitle,
      description: 'You are now subscribed. New uploads will appear in your feed.',
    });
  };

  const handleSubscribeFromSearch = async (result: YouTubeChannelSearchResult) => {
    if (!subscriptionsEnabled) return;
    if (subscribingChannelIds[result.channel_id]) return;
    setSubscribing(result.channel_id, true);
    try {
      await runSubscribe(result.channel_url || result.channel_id, 'Subscribed');
      handleAddSubscriptionDialogChange(false);
    } catch {
      // error toast handled in mutation
    } finally {
      setSubscribing(result.channel_id, false);
    }
  };

  const subscriptions = subscriptionsQuery.data || [];
  const activeSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => subscription.is_active),
    [subscriptions],
  );
  const nowMs = useMemo(() => Date.now(), [activeSubscriptions]);
  const healthBySubscriptionId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateSubscriptionHealth>>();
    activeSubscriptions.forEach((subscription) => {
      map.set(subscription.id, evaluateSubscriptionHealth(subscription, nowMs));
    });
    return map;
  }, [activeSubscriptions, nowMs]);

  const selectedRefreshItems = useMemo(
    () => refreshCandidates.filter((item) => refreshSelected[getRefreshCandidateKey(item)]),
    [refreshCandidates, refreshSelected],
  );
  const refreshJobStatus = (refreshJobQuery.data?.status || (activeRefreshJobId ? 'queued' : null)) as IngestionJobStatus | null;
  const refreshJobProcessed = refreshJobQuery.data?.processed_count || 0;
  const refreshJobInserted = refreshJobQuery.data?.inserted_count || 0;
  const refreshJobSkipped = refreshJobQuery.data?.skipped_count || 0;
  const refreshJobFailed = Math.max(0, refreshJobProcessed - refreshJobInserted - refreshJobSkipped);
  const refreshJobRunning = refreshJobStatus === 'queued' || refreshJobStatus === 'running';
  const refreshJobLabel = refreshJobStatus === 'succeeded'
    ? 'Succeeded'
    : refreshJobStatus === 'failed'
      ? 'Failed'
      : refreshJobStatus === 'running'
        ? 'Running'
        : refreshJobStatus === 'queued'
          ? 'Queued'
          : null;

  useEffect(() => {
    const job = refreshJobQuery.data;
    if (!job?.job_id) return;
    if (job.status !== 'succeeded' && job.status !== 'failed') return;
    if (terminalHandledJobId === job.job_id) return;

    setTerminalHandledJobId(job.job_id);
    invalidateSubscriptionViews();

    if (job.status === 'succeeded') {
      const failedCount = Math.max(0, Number(job.processed_count || 0) - Number(job.inserted_count || 0) - Number(job.skipped_count || 0));
      toast({
        title: 'Background generation finished',
        description: `Inserted ${job.inserted_count}, skipped ${job.skipped_count}, failed ${failedCount}.`,
      });
      return;
    }

    toast({
      title: 'Background generation failed',
      description: job.error_message || 'Could not complete background generation.',
      variant: 'destructive',
    });
  }, [invalidateSubscriptionViews, refreshJobQuery.data, terminalHandledJobId, toast]);

  const handleRefreshDialogChange = (nextOpen: boolean) => {
    setIsRefreshDialogOpen(nextOpen);
    setRefreshErrorText(null);
    setRefreshCandidates([]);
    setRefreshSelected({});
    setRefreshScanErrors([]);
    refreshScanMutation.reset();
  };

  const toggleRefreshCandidate = (item: SubscriptionRefreshCandidate, nextChecked: boolean) => {
    const key = getRefreshCandidateKey(item);
    setRefreshSelected((previous) => ({
      ...previous,
      [key]: nextChecked,
    }));
  };

  const handleRefreshSelectAll = (nextChecked: boolean) => {
    const next: Record<string, boolean> = {};
    for (const candidate of refreshCandidates) {
      next[getRefreshCandidateKey(candidate)] = nextChecked;
    }
    setRefreshSelected(next);
  };

  const handleStartBackgroundGeneration = () => {
    if (selectedRefreshItems.length === 0) return;
    refreshGenerateMutation.mutate(selectedRefreshItems);
  };

  return (
    <PageRoot>
      <AppHeader />

      <PageMain className="space-y-6">
        <PageSection>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide">Subscriptions</p>
            <h1 className="text-2xl font-semibold">Manage YouTube source subscriptions</h1>
            <p className="text-sm text-muted-foreground">
              Add channels here. New uploads from active subscriptions will land in My Feed automatically.
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => handleAddSubscriptionDialogChange(true)}
                disabled={!subscriptionsEnabled}
              >
                Add Subscription
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRefreshDialogChange(true)}
                disabled={!subscriptionsEnabled}
              >
                Refresh
              </Button>
              <Button asChild size="sm" variant="outline" className="h-8 px-2">
                <Link to="/my-feed">Back to My Feed</Link>
              </Button>
            </div>
            {!subscriptionsEnabled ? (
              <p className="text-xs text-muted-foreground">
                Subscription APIs require `VITE_AGENTIC_BACKEND_URL`.
              </p>
            ) : null}
          </div>
        </PageSection>

        {activeRefreshJobId ? (
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Background generation</CardTitle>
                {refreshJobLabel ? (
                  <Badge variant={refreshJobStatus === 'failed' ? 'destructive' : 'secondary'}>
                    {refreshJobLabel}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-xs text-muted-foreground break-all">Job: {activeRefreshJobId}</p>
              {refreshJobStatus === 'queued' && !refreshJobQuery.data ? (
                <p className="text-muted-foreground">
                  Queued {queuedRefreshCount} video(s). This can take a bit depending on transcript and model latency.
                </p>
              ) : null}
              {refreshJobQuery.data ? (
                <p className="text-muted-foreground">
                  Inserted {refreshJobInserted}, skipped {refreshJobSkipped}, failed {refreshJobFailed}.
                </p>
              ) : null}
              {refreshJobQuery.data?.error_message ? (
                <p className="text-xs text-destructive">
                  {refreshJobQuery.data.error_code ? `${refreshJobQuery.data.error_code}: ` : ''}{refreshJobQuery.data.error_message}
                </p>
              ) : null}
              {refreshJobQuery.error ? (
                <p className="text-xs text-destructive">
                  Could not fetch latest job status. Try refreshing status.
                </p>
              ) : null}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refreshJobQuery.refetch()}
                  disabled={refreshJobQuery.isFetching}
                >
                  {refreshJobQuery.isFetching ? 'Refreshing...' : 'Refresh status'}
                </Button>
                {refreshJobRunning ? <p className="text-xs text-muted-foreground">Updates every ~4 seconds.</p> : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Dialog open={isAddSubscriptionOpen} onOpenChange={handleAddSubscriptionDialogChange}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Subscription</DialogTitle>
              <DialogDescription>
                Search YouTube channels and subscribe in one click.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <form onSubmit={handleChannelSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={channelSearchQuery}
                  onChange={(event) => setChannelSearchQuery(event.target.value)}
                  placeholder="Try: skincare, fitness, productivity"
                />
                <Button type="submit" size="sm" disabled={channelSearchMutation.isPending || !subscriptionsEnabled}>
                  {channelSearchMutation.isPending ? 'Searching...' : 'Search channels'}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                Suggestions are transient. Nothing changes until you click Subscribe.
              </p>
              {channelSearchError ? <p className="text-sm text-destructive">{channelSearchError}</p> : null}

              {channelSearchResults.length === 0 && channelSearchSubmittedQuery ? (
                <p className="text-sm text-muted-foreground">No channels found for your query.</p>
              ) : null}

              {channelSearchResults.length > 0 ? (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {channelSearchResults.map((result) => {
                    const isSubscribing = Boolean(subscribingChannelIds[result.channel_id]);
                    return (
                      <div key={result.channel_id} className="rounded-md border border-border/40 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.channel_title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {result.description || 'No channel description available.'}
                            </p>
                          </div>
                          {result.thumbnail_url ? (
                            <img
                              src={result.thumbnail_url}
                              alt={result.channel_title}
                              className="h-10 w-10 rounded-md object-cover border border-border/40 shrink-0"
                            />
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSubscribeFromSearch(result)}
                            disabled={!subscriptionsEnabled || isSubscribing || createMutation.isPending}
                          >
                            {isSubscribing ? 'Subscribing...' : 'Subscribe'}
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <a href={result.channel_url} target="_blank" rel="noreferrer">
                              Open on YouTube
                            </a>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {channelSearchNextToken ? (
                    <div className="flex justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleChannelSearchLoadMore}
                        disabled={channelSearchMutation.isPending}
                      >
                        {channelSearchMutation.isPending ? 'Loading...' : 'Load more'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isRefreshDialogOpen} onOpenChange={handleRefreshDialogChange}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Refresh subscriptions</DialogTitle>
              <DialogDescription>
                Scan your active subscriptions for new videos, then choose what to generate in the background.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refreshScanMutation.mutate()}
                  disabled={refreshScanMutation.isPending || refreshGenerateMutation.isPending || refreshJobRunning || !subscriptionsEnabled}
                >
                  {refreshScanMutation.isPending ? 'Scanning...' : 'Scan'}
                </Button>
                {refreshCandidates.length > 0 ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRefreshSelectAll(true)}
                      disabled={refreshGenerateMutation.isPending}
                    >
                      Select all
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRefreshSelectAll(false)}
                      disabled={refreshGenerateMutation.isPending}
                    >
                      Clear
                    </Button>
                  </>
                ) : null}
              </div>

              {refreshErrorText ? (
                <p className="text-sm text-destructive">{refreshErrorText}</p>
              ) : null}

              {refreshScanErrors.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Some channels could not be scanned right now ({refreshScanErrors.length}).
                </p>
              ) : null}

              {refreshScanMutation.isPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 rounded-md" />
                  <Skeleton className="h-16 rounded-md" />
                </div>
              ) : null}

              {!refreshScanMutation.isPending && !refreshErrorText && refreshCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {refreshScanMutation.status === 'success'
                    ? 'No new videos found.'
                    : 'Click Scan to check your subscriptions for new videos.'}
                </p>
              ) : null}

              {refreshCandidates.length > 0 ? (
                <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
                  {refreshCandidates.map((item) => {
                    const key = getRefreshCandidateKey(item);
                    const checked = Boolean(refreshSelected[key]);
                    return (
                      <div key={key} className="rounded-md border border-border/40 p-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleRefreshCandidate(item, value === true)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.source_channel_title || item.source_channel_id}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatDateTime(item.published_at)}</span>
                              <a
                                href={item.video_url}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                              >
                                Open video
                              </a>
                            </div>
                          </div>
                          {item.thumbnail_url ? (
                            <img
                              src={item.thumbnail_url}
                              alt={item.title}
                              className="h-12 w-20 rounded-md object-cover border border-border/40 shrink-0"
                            />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 pt-2">
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedRefreshItems.length} / {refreshCandidates.length}
                </p>
                <Button
                  size="sm"
                  onClick={handleStartBackgroundGeneration}
                  disabled={selectedRefreshItems.length === 0 || refreshGenerateMutation.isPending || refreshScanMutation.isPending || refreshJobRunning}
                >
                  {refreshGenerateMutation.isPending ? 'Starting...' : 'Generate blueprints'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
                <CardTitle className="text-base">Your subscriptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeSubscriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
                ) : (
                  activeSubscriptions.map((subscription) => {
                    const health = healthBySubscriptionId.get(subscription.id) || evaluateSubscriptionHealth(subscription, nowMs);
                    return (
                      <div key={subscription.id} className="rounded-md border border-border/40 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            {subscription.source_channel_avatar_url ? (
                              <img
                                src={subscription.source_channel_avatar_url}
                                alt={subscription.source_channel_title || subscription.source_channel_id}
                                className="h-10 w-10 rounded-full object-cover border border-border/40 shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full border border-border/40 bg-muted text-xs font-semibold flex items-center justify-center shrink-0">
                                {getChannelInitials(subscription)}
                              </div>
                            )}
                            <p className="text-sm font-medium truncate">
                              {subscription.source_channel_title || subscription.source_channel_id}
                            </p>
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
                        <p className="text-xs text-muted-foreground">{health.detail}</p>
                        <p className="text-xs text-muted-foreground">
                          Last polled: {formatDateTime(subscription.last_polled_at)}
                        </p>
                        {subscription.last_sync_error ? (
                          <p className="text-xs text-red-600/90">Sync issue: {subscription.last_sync_error}</p>
                        ) : null}
                        <div className="flex flex-wrap justify-end gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleUnsubscribe(subscription)}
                            disabled={!subscriptionsEnabled || isRowPending(subscription.id)}
                          >
                            {isRowPending(subscription.id) ? 'Unsubscribing...' : 'Unsubscribe'}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        )}
        <AppFooter />
      </PageMain>
    </PageRoot>
  );
}
