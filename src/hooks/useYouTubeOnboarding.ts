import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type YouTubeOnboardingStatus = 'pending' | 'skipped' | 'completed';

export type UserYouTubeOnboardingRow = {
  id: string;
  user_id: string;
  status: YouTubeOnboardingStatus;
  first_prompted_at: string | null;
  completed_at: string | null;
  reminder_dismissed_at: string | null;
  created_at: string;
  updated_at: string;
};

type OnboardingUpdateInput = Partial<Pick<
  UserYouTubeOnboardingRow,
  'status' | 'first_prompted_at' | 'completed_at' | 'reminder_dismissed_at'
>>;

const ONBOARDING_FIELDS = 'id, user_id, status, first_prompted_at, completed_at, reminder_dismissed_at, created_at, updated_at';

export function useYouTubeOnboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['youtube-onboarding', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return null as UserYouTubeOnboardingRow | null;
      const { data, error } = await supabase
        .from('user_youtube_onboarding')
        .select(ONBOARDING_FIELDS)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as UserYouTubeOnboardingRow | null;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: OnboardingUpdateInput) => {
      if (!user?.id) throw new Error('Auth required.');
      const payload = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined),
      );
      const { data, error } = await supabase
        .from('user_youtube_onboarding')
        .update(payload)
        .eq('user_id', user.id)
        .select(ONBOARDING_FIELDS)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as UserYouTubeOnboardingRow | null;
    },
    onSuccess: (row) => {
      queryClient.setQueryData(['youtube-onboarding', user?.id], row);
    },
  });

  return {
    ...query,
    updateOnboarding: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
