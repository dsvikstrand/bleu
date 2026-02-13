import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AppHeader } from '@/components/shared/AppHeader';
import { AppFooter } from '@/components/shared/AppFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTagFollows } from '@/hooks/useTagFollows';
import { useTagsDirectory } from '@/hooks/useTags';
import { getChannelBySlug } from '@/lib/channelsCatalog';
import { useState } from 'react';

export default function ChannelPage() {
  const { channelSlug } = useParams<{ channelSlug: string }>();
  const slug = channelSlug || '';
  const channel = getChannelBySlug(slug);
  const { user } = useAuth();
  const { toast } = useToast();
  const { tags } = useTagsDirectory();
  const { getFollowState, joinChannel, leaveChannel } = useTagFollows();
  const [showSigninPrompt, setShowSigninPrompt] = useState(false);

  if (!channel) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Channel not found</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This channel slug is not part of the curated MVP channel list.
              </p>
              <div className="flex gap-2">
                <Button asChild>
                  <Link to="/channels">Back to Channels</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/wall">Go to Feed</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const tagRow = tags.find((tag) => tag.slug === channel.tagSlug);
  const joinAvailable = channel.isJoinEnabled && channel.status === 'active' && !!tagRow?.id;

  const handleJoinLeave = async () => {
    if (!user) {
      setShowSigninPrompt(true);
      toast({
        title: 'Sign in required',
        description: 'Please sign in to join channels.',
      });
      return;
    }
    if (!tagRow?.id || !joinAvailable) return;

    const state = getFollowState({ id: tagRow.id });
    if (state === 'joining' || state === 'leaving') return;

    try {
      if (state === 'joined') {
        await leaveChannel({ id: tagRow.id, slug: channel.slug });
      } else {
        await joinChannel({ id: tagRow.id, slug: channel.slug });
      }
    } catch (error) {
      toast({
        title: 'Channel update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const state = tagRow?.id ? getFollowState({ id: tagRow.id }) : 'not_joined';
  const isPending = state === 'joining' || state === 'leaving';
  const isJoined = state === 'joined' || state === 'leaving';
  const joinLabel = state === 'joining'
    ? 'Joining...'
    : state === 'leaving'
      ? 'Leaving...'
      : state === 'joined'
        ? 'Joined'
        : 'Join';

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <section className="space-y-2">
          <p className="text-sm font-semibold text-primary">b/{channel.slug}</p>
          <h1 className="text-2xl font-semibold">{channel.name}</h1>
          <p className="text-sm text-muted-foreground">{channel.description}</p>
          <div className="pt-2 flex items-center gap-2">
            <Button
              size="sm"
              variant={isJoined ? 'outline' : 'default'}
              disabled={isPending || !joinAvailable}
              onClick={handleJoinLeave}
            >
              {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              {joinLabel}
            </Button>
            {!joinAvailable && (
              <span className="text-xs text-muted-foreground">Channel activation pending</span>
            )}
          </div>
        </section>

        {!user && showSigninPrompt && (
          <Card className="border-border/60 bg-card/60">
            <CardContent className="pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Sign in to join channels</p>
                <p className="text-xs text-muted-foreground">Join channels to personalize your feed experience.</p>
              </div>
              <Button asChild size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
              <p className="text-xs text-muted-foreground pt-2">Channel feed view is coming in Phase 2.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-1/2" />
              <p className="text-xs text-muted-foreground pt-2">Recent channel activity appears in Phase 2.</p>
            </CardContent>
          </Card>
        </section>
        <AppFooter />
      </main>
    </div>
  );
}
