import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight } from 'lucide-react';
import { BlueprintCard } from '@/components/blueprint/BlueprintCard';
import { useBlueprintSearch } from '@/hooks/useBlueprintSearch';
import { useToggleBlueprintLike } from '@/hooks/useBlueprints';
import { useTagFollows } from '@/hooks/useTagFollows';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const TAGS = ['morning', 'skincare', 'workout', 'productivity'] as const;

export function DiscoverRoutines() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { followedIds, toggleFollow } = useTagFollows();
  const toggleLike = useToggleBlueprintLike();

  const { data: blueprints, isLoading } = useBlueprintSearch('', 'popular');

  const featuredBlueprint = useMemo(() => {
    return blueprints && blueprints.length > 0 ? blueprints[0] : null;
  }, [blueprints]);

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
        {isLoading ? (
          <Card className="bg-card/60 backdrop-blur-sm border-border/50">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-10 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-14" />
              </div>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ) : featuredBlueprint ? (
          <BlueprintCard
            blueprint={featuredBlueprint}
            onLike={handleLike}
            followedTagIds={followedIds}
            onToggleTag={handleTagToggle}
          />
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
