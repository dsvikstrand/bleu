import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getProfileFeed } from '@/lib/profileApi';

export function useProfileFeed(profileUserId: string | undefined, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile-feed', profileUserId, user?.id || 'anon'],
    enabled: !!profileUserId && enabled,
    queryFn: async () => {
      if (!profileUserId) return { profile_user_id: '', is_owner_view: false, items: [] };
      return getProfileFeed(profileUserId);
    },
  });
}
