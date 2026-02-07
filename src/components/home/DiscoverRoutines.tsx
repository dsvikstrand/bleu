import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight } from 'lucide-react';
import { useBlueprintSearch } from '@/hooks/useBlueprintSearch';
import { useBlueprint, useToggleBlueprintLike } from '@/hooks/useBlueprints';
import { useTagFollows } from '@/hooks/useTagFollows';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const TAGS = ['morning', 'skincare', 'workout', 'productivity'] as const;

function reviewPreview(text: string) {
  const cleaned = (text || '').trim();
  if (!cleaned) return '';

  // Prefer the Overview section if the review is markdown with headings.
  const lines = cleaned.split('\n');
  const startIdx = lines.findIndex((l) => l.trim().toLowerCase().startsWith('## ') || l.trim().toLowerCase().startsWith('### '));
  if (startIdx >= 0) {
    const isOverview = (l: string) => l.toLowerCase().includes('overview');
    const overviewIdx = lines.findIndex((l) => (l.trim().startsWith('## ') || l.trim().startsWith('### ')) && isOverview(l));
    if (overviewIdx >= 0) {
      const out: string[] = [];
      for (let i = overviewIdx + 1; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t) continue;
        if (t.startsWith('## ') || t.startsWith('### ')) break;
        if (t.startsWith('- ') || t.startsWith('* ')) out.push(t.replace(/^[-*]\s+/, '').trim());
        else out.push(t.replace(/\*\*/g, '').trim());
        if (out.length >= 4) break;
      }
      return out.join('\n');
    }
  }

  // Fallback: first 4 non-empty lines.
  const picked: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    picked.push(t.replace(/\*\*/g, '').replace(/^[-*]\s+/, '').trim());
    if (picked.length >= 4) break;
  }
  return picked.join('\n');
}

export function DiscoverRoutines() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { followedIds, toggleFollow } = useTagFollows();
  const toggleLike = useToggleBlueprintLike();

  const { data: blueprints, isLoading } = useBlueprintSearch('', 'popular');

  const featuredBlueprint = useMemo(() => {
    return blueprints && blueprints.length > 0 ? blueprints[0] : null;
  }, [blueprints]);

  const { data: featuredDetail, isLoading: detailLoading } = useBlueprint(featuredBlueprint?.id);

  const handleLike = async (blueprintId: string, liked: boolean) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to like blueprints.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await toggleLike.mutateAsync({ blueprintId, liked });
    } catch (error) {
      toast({
        title: 'Action failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleTagToggle = async (tag: { id: string; slug: string }) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to follow tags.',
      });
      return;
    }
    try {
      await toggleFollow(tag);
    } catch (error) {
      toast({
        title: 'Tag update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

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

      <div className="space-y-3">
        {isLoading || detailLoading ? (
          <Card className="bg-card/60 backdrop-blur-sm border-border/50">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-14" />
              </div>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ) : featuredBlueprint && featuredDetail ? (
          <Link
            to={`/blueprint/${featuredBlueprint.id}`}
            className="block group"
            aria-label={`Open blueprint ${featuredBlueprint.title}`}
          >
            <Card className="bg-card/60 backdrop-blur-sm border-border/50 transition-all duration-300 hover:border-border/80 hover:shadow-md hover:shadow-black/5 group-focus-visible:ring-2 group-focus-visible:ring-primary overflow-hidden">
              {featuredDetail.banner_url && (
                <div className="aspect-[4/1] w-full bg-muted/20">
                  <img
                    src={featuredDetail.banner_url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <h3 className="text-lg font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {featuredBlueprint.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {featuredBlueprint.inventory_title ? `From ${featuredBlueprint.inventory_title}` : 'Community blueprint'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 px-2 shrink-0 ${featuredBlueprint.user_liked ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleLike(featuredBlueprint.id, featuredBlueprint.user_liked);
                    }}
                    aria-label={featuredBlueprint.user_liked ? 'Unlike blueprint' : 'Like blueprint'}
                  >
                    <span className="text-xs tabular-nums">{featuredBlueprint.likes_count}</span>
                  </Button>
                </div>

                {featuredBlueprint.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {featuredBlueprint.tags.slice(0, 4).map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className={`text-xs cursor-pointer transition-colors border ${
                          followedIds?.has(tag.id)
                            ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/20'
                            : 'bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/60'
                        }`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleTagToggle({ id: tag.id, slug: tag.slug });
                        }}
                      >
                        #{tag.slug}
                      </Badge>
                    ))}
                  </div>
                )}

                {featuredDetail.llm_review && (
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Review snapshot
                    </p>
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed line-clamp-4">
                      {reviewPreview(featuredDetail.llm_review)}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Open full blueprint</span>
                  <span className="opacity-60">Tap to view details</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link to="/explore">
          <Button className="gap-2">
            Explore
            <ArrowRight className="h-4 w-4" />
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
