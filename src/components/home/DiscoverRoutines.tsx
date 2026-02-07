import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Sparkles } from 'lucide-react';

const TAGS = ['morning', 'skincare', 'workout', 'productivity'] as const;

export function DiscoverRoutines() {
  return (
    <section className="space-y-4 animate-fade-in">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-primary uppercase tracking-wide">Discover routines</p>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Learn from the community
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Browse what other people publish, follow tags you care about, then come back and build your own Blueprint.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link to="/explore">
          <Button className="gap-2">
            Explore
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link to="/wall">
          <Button variant="outline" className="gap-2">
            Wall
            <Sparkles className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <span className="text-xs text-muted-foreground">Popular tags:</span>
          {TAGS.map((tag) => (
            <Link key={tag} to={`/explore?tag=${encodeURIComponent(tag)}`}>
              <Badge
                variant="outline"
                className="text-xs bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/60 cursor-pointer transition-colors"
              >
                #{tag}
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

