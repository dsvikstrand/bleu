import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { AppHeader } from '@/components/shared/AppHeader';
import { AppFooter } from '@/components/shared/AppFooter';
import { Button } from '@/components/ui/button';
import { CommunityStats } from '@/components/home/CommunityStats';
import { TopBlueprints } from '@/components/home/TopBlueprints';
import { FeaturedTags } from '@/components/home/FeaturedTags';
import { HowItWorks } from '@/components/home/HowItWorks';
import { DiscoverRoutines } from '@/components/home/DiscoverRoutines';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { logMvpEvent } from '@/lib/logEvent';

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
        {/* Hero - simplified, community-first */}
        <section className="text-center space-y-5 animate-fade-in">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight">
            <span
              className="text-gradient-themed"
              style={{
                fontFamily: "'Impact', 'Haettenschweiler', 'Franklin Gothic Bold', 'Charcoal', sans-serif",
                letterSpacing: '0.06em',
              }}
            >
              BLUEPRINTS
            </span>
          </h1>
          <p className="text-sm uppercase tracking-widest text-primary/80 font-medium">
            Pull, refine, and share bite-sized blueprints
          </p>
          <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            Pull from YouTube into My Feed first, then submit the best items to Channels.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link to="/explore">
              <Button size="lg" className="gap-2">
                Start Exploring
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/my-feed">
              <Button size="lg" variant="outline" className="gap-2">
                Open My Feed
                <Sparkles className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Community stats bar */}
        <CommunityStats />

        {/* How it works (moved up for immediate clarity) */}
        <HowItWorks />

        {/* Discover routines (consumer-first bridge) */}
        <DiscoverRoutines />

        {/* Top blueprints */}
        <TopBlueprints />

        {/* Featured tags */}
        <FeaturedTags />

        <AppFooter />
      </main>
    </div>
  );
}
