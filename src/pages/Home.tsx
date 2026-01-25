import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/shared/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Layers, Sparkles, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] bg-primary/10 rounded-full blur-3xl animate-drift" />
        <div className="absolute top-1/2 -left-32 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-20 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute top-24 right-24 w-3 h-3 bg-primary/30 rounded-full blur-sm animate-float-delayed" />
        <div className="absolute bottom-32 left-12 w-2 h-2 bg-accent/30 rounded-full blur-sm animate-float-slow" />
      </div>

      <AppHeader />

      <main className="max-w-5xl mx-auto px-4 py-12 space-y-12">
        {/* Hero */}
        <section className="text-center space-y-6 animate-fade-in">
          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight relative inline-block">
            <span
              className="relative inline-block"
              style={{
                fontFamily: "'Impact', 'Haettenschweiler', 'Franklin Gothic Bold', 'Charcoal', 'Helvetica Inserat', sans-serif",
                letterSpacing: '0.08em',
              }}
            >
              <span className="absolute inset-0 text-border/40" style={{ transform: 'translate(4px, 4px)' }} aria-hidden="true">
                BLUEPRINTS
              </span>
              <span className="absolute inset-0 text-border/60" style={{ transform: 'translate(2px, 2px)' }} aria-hidden="true">
                BLUEPRINTS
              </span>
              <span className="text-gradient-themed animate-shimmer bg-[length:200%_auto] relative">
                BLUEPRINTS
              </span>
            </span>
            <span className="absolute -inset-6 bg-primary/10 blur-2xl rounded-full animate-pulse-soft -z-10" />
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A community pool of shareable blueprints. Follow topics, discover what works, and remix into your own.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/wall">
              <Button size="lg" className="gap-2">
                Browse Blueprints
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/inventory">
              <Button size="lg" variant="outline" className="gap-2">
                Create Inventory
                <Sparkles className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="grid gap-6 md:grid-cols-3">
          <Card className="bg-card/70 backdrop-blur-glass border-border/50 animate-fade-in">
            <CardContent className="p-6 space-y-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">1. Inventories</h3>
              <p className="text-sm text-muted-foreground">
                Start with a reusable inventory of items and categories. Search by tags or create your own.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/70 backdrop-blur-glass border-border/50 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-6 space-y-3">
              <div className="h-11 w-11 rounded-xl bg-accent/15 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-xl font-semibold">2. Build</h3>
              <p className="text-sm text-muted-foreground">
                Mix a setup from the inventory, add context, and generate a review with AI guidance.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/70 backdrop-blur-glass border-border/50 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardContent className="p-6 space-y-3">
              <div className="h-11 w-11 rounded-xl bg-secondary/15 flex items-center justify-center">
                <Users className="h-5 w-5 text-secondary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">3. Blueprint</h3>
              <p className="text-sm text-muted-foreground">
                Publish your blueprint, collect feedback, and let others remix your approach.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Community tease */}
        <section className="grid gap-6 md:grid-cols-2">
          <Card className="bg-card/60 backdrop-blur-glass border-border/50 animate-fade-in">
            <CardContent className="p-6 space-y-3">
              <h3 className="text-2xl font-semibold">Follow what you care about</h3>
              <p className="text-sm text-muted-foreground">
                Follow tags like sleep, recovery, or skincare. Your Wall updates with the latest blueprints.
              </p>
              <Link to="/tags">
                <Button variant="outline" size="sm">Explore Tags</Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur-glass border-border/50 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-6 space-y-3">
              <h3 className="text-2xl font-semibold">Remix and improve</h3>
              <p className="text-sm text-muted-foreground">
                See a blueprint you like? Remix it into your own version and share it back.
              </p>
              <Link to="/wall">
                <Button variant="outline" size="sm">Browse the Wall</Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
