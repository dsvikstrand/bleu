import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { AppHeader } from '@/components/shared/AppHeader';
import { AppFooter } from '@/components/shared/AppFooter';
import { Button } from '@/components/ui/button';
import { CommunityStats } from '@/components/home/CommunityStats';
import { TopBlueprints } from '@/components/home/TopBlueprints';
import { FeaturedTags } from '@/components/home/FeaturedTags';
import { HowItWorks } from '@/components/home/HowItWorks';
import { FeaturedLibrariesStarter } from '@/components/home/FeaturedLibrariesStarter';
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
    <div className="min-h-screen relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] bg-primary/10 rounded-full blur-3xl animate-drift" />
        <div className="absolute top-1/2 -left-32 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-20 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse-soft" />
      </div>

      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-12">
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
            Create & share recipes for life routines
          </p>
          <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            Build routines from shared libraries, get AI reviews, and publish your own when you're ready.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link to="/explore">
              <Button size="lg" className="gap-2">
                Start Exploring
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/wall">
              <Button size="lg" variant="outline" className="gap-2">
                Browse the Wall
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

        {/* Starter build experience (no LLM calls) */}
        <FeaturedLibrariesStarter />

        {/* Featured tags */}
        <FeaturedTags />

        <AppFooter />
      </main>
    </div>
  );
}
