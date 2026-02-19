import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppHeader } from '@/components/shared/AppHeader';
import { AppFooter } from '@/components/shared/AppFooter';
import { PageMain, PageRoot, PageSection } from '@/components/layout/Page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { config } from '@/config/runtime';
import { ApiRequestError } from '@/lib/subscriptionsApi';
import {
  getSourcePage,
  subscribeToSourcePage,
  unsubscribeFromSourcePage,
} from '@/lib/sourcePagesApi';

function getInitials(title: string, fallback: string) {
  const raw = title.trim() || fallback.trim();
  if (!raw) return 'SP';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function formatFollowerCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 followers';
  if (value === 1) return '1 follower';
  return `${value.toLocaleString()} followers`;
}

function getSourcePageErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    switch (error.errorCode) {
      case 'SOURCE_PAGE_NOT_FOUND':
        return 'Source page not found.';
      case 'SOURCE_PAGE_PLATFORM_UNSUPPORTED':
        return 'This source platform is not supported yet.';
      case 'AUTH_REQUIRED':
        return 'Sign in required.';
      default:
        return error.message || fallback;
    }
  }
  return error instanceof Error ? error.message : fallback;
}

export default function SourcePage() {
  const params = useParams<{ platform: string; externalId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const backendEnabled = Boolean(config.agenticBackendUrl);
  const platform = String(params.platform || '').trim().toLowerCase();
  const externalId = String(params.externalId || '').trim();
  const isValidRoute = Boolean(platform && externalId);

  const sourcePageQuery = useQuery({
    queryKey: ['source-page', platform, externalId, user?.id],
    enabled: backendEnabled && isValidRoute,
    queryFn: () => getSourcePage({ platform, externalId }),
    retry: false,
  });

  const subscribeMutation = useMutation({
    mutationFn: () => subscribeToSourcePage({ platform, externalId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['source-page', platform, externalId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['source-subscriptions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-feed-items', user?.id] });
      toast({
        title: 'Subscribed',
        description: 'New uploads from this source will appear automatically.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Subscribe failed',
        description: getSourcePageErrorMessage(error, 'Could not subscribe to this source page.'),
        variant: 'destructive',
      });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: () => unsubscribeFromSourcePage({ platform, externalId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['source-page', platform, externalId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['source-subscriptions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-feed-items', user?.id] });
      toast({
        title: 'Unsubscribed',
        description: 'You will no longer receive new uploads from this source.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Unsubscribe failed',
        description: getSourcePageErrorMessage(error, 'Could not unsubscribe from this source page.'),
        variant: 'destructive',
      });
    },
  });

  const sourcePage = sourcePageQuery.data?.source_page || null;
  const viewer = sourcePageQuery.data?.viewer || null;
  const subscribed = Boolean(viewer?.subscribed);
  const actionPending = subscribeMutation.isPending || unsubscribeMutation.isPending;

  const handleSubscribeToggle = () => {
    if (!user) return;
    if (subscribed) {
      unsubscribeMutation.mutate();
      return;
    }
    subscribeMutation.mutate();
  };

  return (
    <PageRoot>
      <AppHeader />
      <PageMain className="space-y-6">
        <PageSection className="space-y-4">
          <p className="text-sm font-semibold text-primary uppercase tracking-wide">Source Page</p>

          {!backendEnabled ? (
            <Card className="border-border/40">
              <CardContent className="p-4 text-sm text-muted-foreground">
                Source pages require `VITE_AGENTIC_BACKEND_URL`.
              </CardContent>
            </Card>
          ) : null}

          {!backendEnabled || !isValidRoute ? (
            <Card className="border-border/40">
              <CardContent className="p-4 text-sm text-muted-foreground">
                Invalid source page route.
              </CardContent>
            </Card>
          ) : null}

          {backendEnabled && isValidRoute && sourcePageQuery.isLoading ? (
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ) : null}

          {backendEnabled && isValidRoute && sourcePageQuery.error ? (
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm text-destructive">
                  {getSourcePageErrorMessage(sourcePageQuery.error, 'Could not load source page.')}
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/subscriptions">Back to Subscriptions</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {backendEnabled && isValidRoute && sourcePage ? (
            <>
              <Card className="overflow-hidden border-border/40">
                {sourcePage.banner_url ? (
                  <div
                    className="h-24 w-full bg-cover bg-center border-b border-border/40"
                    style={{ backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.35), rgba(0,0,0,0.15)), url(${sourcePage.banner_url})` }}
                  />
                ) : null}
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {sourcePage.avatar_url ? (
                        <img
                          src={sourcePage.avatar_url}
                          alt={sourcePage.title}
                          className="h-12 w-12 rounded-full border border-border/40 object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full border border-border/40 bg-muted text-xs font-semibold flex items-center justify-center shrink-0">
                          {getInitials(sourcePage.title || sourcePage.external_id, sourcePage.external_id)}
                        </div>
                      )}
                      <div className="min-w-0 space-y-1">
                        <h1 className="text-xl font-semibold leading-tight truncate">{sourcePage.title || sourcePage.external_id}</h1>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{sourcePage.platform}</Badge>
                          <span className="text-xs text-muted-foreground">{formatFollowerCount(sourcePage.follower_count)}</span>
                        </div>
                      </div>
                    </div>
                    {user ? (
                      <Button
                        size="sm"
                        variant={subscribed ? 'destructive' : 'default'}
                        onClick={handleSubscribeToggle}
                        disabled={actionPending}
                      >
                        {actionPending
                          ? (subscribed ? 'Unsubscribing...' : 'Subscribing...')
                          : (subscribed ? 'Unsubscribe' : 'Subscribe')}
                      </Button>
                    ) : (
                      <Button asChild size="sm">
                        <Link to="/auth">Sign in to subscribe</Link>
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <a href={sourcePage.external_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      Open on source platform
                    </a>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Source blueprints</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Blueprint list for this source page is coming in the next step.
                  </p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </PageSection>
        <AppFooter />
      </PageMain>
    </PageRoot>
  );
}
