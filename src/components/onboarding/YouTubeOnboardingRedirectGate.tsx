import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useYouTubeOnboarding } from '@/hooks/useYouTubeOnboarding';

export function YouTubeOnboardingRedirectGate() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onboardingQuery = useYouTubeOnboarding();

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) return;
    if (onboardingQuery.isLoading || onboardingQuery.isFetching) return;

    const path = location.pathname;
    if (path === '/auth' || path === '/welcome') return;

    const row = onboardingQuery.data;
    if (!row) return;
    if (row.status !== 'pending') return;
    if (row.first_prompted_at) return;

    navigate('/welcome', { replace: true });
  }, [
    authLoading,
    location.pathname,
    navigate,
    onboardingQuery.data,
    onboardingQuery.isFetching,
    onboardingQuery.isLoading,
    user?.id,
  ]);

  return null;
}
