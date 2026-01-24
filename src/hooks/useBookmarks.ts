import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PostBookmark {
  post_id: string;
  created_at: string;
}

export function useBookmarks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const bookmarksQuery = useQuery({
    queryKey: ['post-bookmarks', user?.id],
    queryFn: async () => {
      if (!user) return [] as PostBookmark[];
      const { data, error } = await supabase
        .from('post_bookmarks')
        .select('post_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PostBookmark[];
    },
    enabled: !!user,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ postId, bookmarked }: { postId: string; bookmarked: boolean }) => {
      if (!user) throw new Error('Must be logged in');
      if (bookmarked) {
        const { error } = await supabase
          .from('post_bookmarks')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_bookmarks')
          .insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['wall-posts'] });
    },
  });

  return {
    bookmarks: bookmarksQuery.data || [],
    isLoading: bookmarksQuery.isLoading,
    toggleBookmark: toggleMutation.mutateAsync,
    isUpdating: toggleMutation.isPending,
  };
}