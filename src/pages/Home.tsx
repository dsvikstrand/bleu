import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { AppHeader } from '@/components/shared/AppHeader';
import { AppFooter } from '@/components/shared/AppFooter';
import { Button } from '@/components/ui/button';
import { TopBlueprints } from '@/components/home/TopBlueprints';
import { FeaturedTags } from '@/components/home/FeaturedTags';
import { DiscoverRoutines } from '@/components/home/DiscoverRoutines';
import { LandingProofCard } from '@/components/home/LandingProofCard';
import { LandingUseCases } from '@/components/home/LandingUseCases';
import { ArrowRight, Inbox, Search, Users, Youtube } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { logMvpEvent } from '@/lib/logEvent';
import { Card, CardContent } from '@/components/ui/card';

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

  const logLandingEvent = (eventName: string, metadata?: Record<string, unknown>) => {
    void logMvpEvent({
      eventName,
      userId: user?.id,
      path: window.location.pathname,
      metadata,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-10 pb-24 space-y-12">
        <section className="text-center space-y-5 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-balance">
            Turn any YouTube video into an actionable blueprint.
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Save time by extracting clear steps from long videos, then reuse or share the best blueprints with your community.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {user ? (
              <Link to="/search" onClick={() => logLandingEvent('landing_cta_open_create_click')}>
                <Button size="lg" className="gap-2">
                  Open Create
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link to="/youtube" onClick={() => logLandingEvent('landing_cta_try_url_click')}>
                <Button size="lg" className="gap-2">
                  Try YouTube URL
                  <Youtube className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <Link
              to={user ? '/youtube' : '/auth'}
              onClick={() =>
                logLandingEvent(user ? 'landing_cta_try_url_click' : 'landing_cta_signin_click')
              }
            >
              <Button size="lg" variant="outline" className="gap-2">
                {user ? 'Use YouTube URL' : 'Sign in to save and follow channels'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {user ? (
              <Link to="/my-feed" onClick={() => logLandingEvent('landing_cta_open_my_feed_click')}>
                <Button size="lg" variant="outline" className="gap-2">
                  Open My Feed
                  <Inbox className="h-4 w-4" />
                </Button>
              </Link>
            ) : null}
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="gap-2"
              onClick={() => logLandingEvent('landing_example_open_click', { source: 'hero_link' })}
            >
              <a href="#landing-proof">See example blueprint</a>
            </Button>
          </div>
        </section>

        <LandingProofCard
          onOpenExample={(kind) =>
            logLandingEvent('landing_example_open_click', { source: kind })
          }
        />

        <LandingUseCases
          onSelect={(useCaseId) => logLandingEvent('landing_use_case_click', { use_case: useCaseId })}
        />

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">How it works</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-2">
                <Search className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">1) Choose a video</h3>
                <p className="text-sm text-muted-foreground">
                  Paste a YouTube URL or use Create to find one worth turning into a blueprint.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-2">
                <Inbox className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">2) Get clear action steps</h3>
                <p className="text-sm text-muted-foreground">
                  The app converts long content into a concise blueprint you can use immediately.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">3) Share what works</h3>
                <p className="text-sm text-muted-foreground">
                  Strong blueprints can appear in Home automatically, where others can discuss and improve them.
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
              <Button size="sm" variant="outline">Browse Home</Button>
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
