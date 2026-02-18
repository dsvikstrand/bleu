import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { AppHeader } from '@/components/shared/AppHeader';
import { AppFooter } from '@/components/shared/AppFooter';
import { Button } from '@/components/ui/button';
import { TopBlueprints } from '@/components/home/TopBlueprints';
import { FeaturedTags } from '@/components/home/FeaturedTags';
import { DiscoverRoutines } from '@/components/home/DiscoverRoutines';
import { ArrowRight, Inbox, Search, Users, Youtube } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { logMvpEvent } from '@/lib/logEvent';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  const { user } = useAuth();
  const hasLoggedVisit = useRef(false);

  useEffect(() => {
    if (hasLoggedVisit.current) return;
    hasLoggedVisit.current = true;

    const now = Date.now();
    const lastVisitRaw = localStorage.getItem('mvp_last_visit');
    const lastVisit = lastVisitRaw ? Number(lastVisitRaw) : null;

    if (lastVisit && !Number.isNaN(lastVisit)) {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (now - lastVisit <= sevenDaysMs) {
        void logMvpEvent({
          eventName: 'return_visit_7d',
          userId: user?.id,
          path: window.location.pathname,
        });
      }
    }

    localStorage.setItem('mvp_last_visit', String(now));

    void logMvpEvent({
      eventName: 'visit_home',
      userId: user?.id,
      path: window.location.pathname,
    });
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-10 pb-24 space-y-12">
        <section className="text-center space-y-5 animate-fade-in">
          <Badge variant="outline" className="text-xs tracking-wide uppercase px-3 py-1">
            Source-first MVP
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-balance">
            Automated YouTube to blueprint feed, with community publishing.
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Search videos or paste a URL, generate a blueprint into My Feed, then post the best ones to channel feeds.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link to={user ? '/search' : '/auth'}>
              <Button size="lg" className="gap-2">
                {user ? 'Search YouTube' : 'Sign in to Start'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/youtube">
              <Button size="lg" variant="outline" className="gap-2">
                Use YouTube URL
                <Youtube className="h-4 w-4" />
              </Button>
            </Link>
            {user ? (
              <Link to="/my-feed">
                <Button size="lg" variant="outline" className="gap-2">
                  Open My Feed
                  <Inbox className="h-4 w-4" />
                </Button>
              </Link>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">How the app works now</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-2">
                <Search className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">1) Pull content</h3>
                <p className="text-sm text-muted-foreground">
                  Subscribe to YouTube channels or find a video via Search/URL.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-2">
                <Inbox className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">2) Land in My Feed</h3>
                <p className="text-sm text-muted-foreground">
                  New blueprints arrive in your personal feed first.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">3) Post to channels</h3>
                <p className="text-sm text-muted-foreground">
                  Share selected items to channel feeds for votes, comments, and discussion.
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="flex flex-wrap gap-2">
            {user ? (
              <Link to="/subscriptions">
                <Button size="sm" variant="outline">Manage Subscriptions</Button>
              </Link>
            ) : null}
            <Link to="/wall">
              <Button size="sm" variant="outline">Browse Channel Feed</Button>
            </Link>
            <Link to="/channels">
              <Button size="sm" variant="outline">Explore Channels</Button>
            </Link>
          </div>
        </section>

        <DiscoverRoutines />

        <TopBlueprints />
        <FeaturedTags />

        <AppFooter />
      </main>
    </div>
  );
}
