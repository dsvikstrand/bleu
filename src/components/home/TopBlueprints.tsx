import { Link } from 'react-router-dom';
import { useTopBlueprints } from '@/hooks/useCommunityStats';
import { Badge } from '@/components/ui/badge';
import { Heart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { FALLBACK_TOP_BLUEPRINTS } from '@/lib/landingFallbacks';

export function TopBlueprints() {
  const { data: blueprints, isLoading, isError } = useTopBlueprints(4);

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Top Blueprints</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse border border-border/40 h-28" />
          ))}
        </div>
      </section>
    );
  }

  const hasLiveData = !!blueprints && blueprints.length > 0 && !isError;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Top Blueprints</h2>
        {!hasLiveData ? <Badge variant="outline" className="text-xs">Example set</Badge> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {hasLiveData
          ? blueprints.map((bp) => (
              <Link key={bp.id} to={`/blueprint/${bp.id}`}>
                <div className="group h-full border border-border/40 px-3 py-3 hover:bg-muted/20 transition-colors cursor-pointer space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {bp.title}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0 text-muted-foreground text-sm">
                      <Heart className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{bp.likes_count}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {bp.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag.slug} variant="secondary" className="text-xs">
                        {tag.slug}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    by {bp.creator_profile?.display_name || 'Anonymous'} ·{' '}
                    {formatDistanceToNow(new Date(bp.created_at), { addSuffix: true })}
                  </p>
                </div>
              </Link>
            ))
          : FALLBACK_TOP_BLUEPRINTS.map((bp) => (
              <Link key={bp.title} to={bp.href}>
                <div className="group h-full border border-border/40 px-3 py-3 hover:bg-muted/20 transition-colors cursor-pointer space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {bp.title}
                    </h3>
                    <Badge variant="outline" className="text-[10px]">Example</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{bp.summary}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {bp.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{bp.channel}</p>
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}
