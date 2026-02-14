import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBlueprintSearch } from '@/hooks/useBlueprintSearch';
import { useBlueprint, useToggleBlueprintLike } from '@/hooks/useBlueprints';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getCatalogChannelTagSlugs } from '@/lib/channelPostContext';
import { normalizeTag } from '@/lib/tagging';

const TAGS = ['morning', 'skincare', 'workout', 'productivity'] as const;
const CAROUSEL_LIMIT = 5;
const SWIPE_THRESHOLD_PX = 50;

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const toggleLike = useToggleBlueprintLike();
  const curatedChannelTagSlugs = useMemo(() => new Set(getCatalogChannelTagSlugs().map(normalizeTag)), []);

  const { data: blueprints, isLoading } = useBlueprintSearch('', 'popular');
  const [activeIndex, setActiveIndex] = useState(0);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const carouselBlueprints = useMemo(() => {
    return (blueprints || []).slice(0, CAROUSEL_LIMIT);
  }, [blueprints]);

  useEffect(() => {
    // Reset when data changes so we don't index out of bounds.
    setActiveIndex(0);
  }, [carouselBlueprints.length]);

  const featuredBlueprint = useMemo(() => {
    if (!carouselBlueprints || carouselBlueprints.length === 0) return null;
    const safeIndex = ((activeIndex % carouselBlueprints.length) + carouselBlueprints.length) % carouselBlueprints.length;
    return carouselBlueprints[safeIndex] || null;
  }, [carouselBlueprints, activeIndex]);

  const { data: featuredDetail, isLoading: detailLoading } = useBlueprint(featuredBlueprint?.id);

  const hasMany = carouselBlueprints.length > 1;
  const safeIndex = hasMany
    ? ((activeIndex % carouselBlueprints.length) + carouselBlueprints.length) % carouselBlueprints.length
    : 0;

  const goPrev = () => {
    if (!hasMany) return;
    setActiveIndex((i) => i - 1);
  };

  const goNext = () => {
    if (!hasMany) return;
    setActiveIndex((i) => i + 1);
  };

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

  const handleTagClick = (slug: string) => {
    navigate(`/explore?q=${encodeURIComponent(slug)}`);
  };

  return (
    <section className="space-y-4 animate-fade-in">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-primary uppercase tracking-wide">Discover neat routines</p>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Blueprints are here to help you
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Blueprints are small yet effective guides to help you get things done. Browse Blueprints from the community, then come back and build your own Blueprints.
        </p>
      </div>

      <div className="space-y-3">
        {isLoading || detailLoading ? (
          <Card>
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
          <div className="space-y-3">
            <div className="relative">
              {hasMany && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background border-border/60 hover:bg-muted/20"
                    onClick={goPrev}
                    aria-label="Previous blueprint"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background border-border/60 hover:bg-muted/20"
                    onClick={goNext}
                    aria-label="Next blueprint"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}

              <Link
                to={`/blueprint/${featuredBlueprint.id}`}
                className="block group"
                aria-label={`Open blueprint ${featuredBlueprint.title}`}
                onPointerDown={(e) => {
                  pointerStart.current = { x: e.clientX, y: e.clientY };
                }}
                onPointerUp={(e) => {
                  const start = pointerStart.current;
                  pointerStart.current = null;
                  if (!start || !hasMany) return;
                  const dx = e.clientX - start.x;
                  const dy = e.clientY - start.y;
                  if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
                  if (Math.abs(dx) <= Math.abs(dy)) return;

                  // Prevent navigation on swipe.
                  e.preventDefault();
                  if (dx < 0) goNext();
                  else goPrev();
                }}
              >
                <Card className="border-border/40 transition-colors hover:bg-muted/20 group-focus-visible:ring-2 group-focus-visible:ring-primary overflow-hidden">
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
                        {featuredBlueprint.tags
                          .filter((tag) => !curatedChannelTagSlugs.has(normalizeTag(tag.slug)))
                          .slice(0, 4)
                          .map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="text-xs cursor-pointer transition-colors border bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/60"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleTagClick(tag.slug);
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
                      <span className="opacity-60">Swipe or tap</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {hasMany && (
              <div className="flex items-center justify-center gap-1">
                {carouselBlueprints.map((bp, idx) => {
                  const isActive = idx === safeIndex;
                  return (
                    <button
                      key={bp.id}
                      type="button"
                      className={`h-1.5 w-1.5 rounded-full transition-colors ${isActive ? 'bg-primary' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'}`}
                      aria-label={`Go to blueprint ${idx + 1}`}
                      onClick={() => setActiveIndex(idx)}
                    />
                  );
                })}
              </div>
            )}
          </div>
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
