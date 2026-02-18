import { supabase } from '@/integrations/supabase/client';
import { config } from '@/config/runtime';
import type { MyFeedItemView } from '@/hooks/useMyFeed';

type ApiEnvelope<T> = {
  ok: boolean;
  error_code: string | null;
  message: string;
  data: T;
};

export class ProfileApiError extends Error {
  status: number;
  errorCode: string | null;

  constructor(status: number, message: string, errorCode: string | null = null) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }
}

export type ProfileFeedResponse = {
  profile_user_id: string;
  is_owner_view: boolean;
  items: MyFeedItemView[];
};

function getApiBase() {
  if (!config.agenticBackendUrl) return null;
  return `${config.agenticBackendUrl.replace(/\/$/, '')}/api`;
}

async function getOptionalAuthHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function getProfileFeed(userId: string) {
  const base = getApiBase();
  if (!base) {
    throw new ProfileApiError(503, 'Backend API is not configured.', 'API_NOT_CONFIGURED');
  }

  const authHeader = await getOptionalAuthHeader();
  const response = await fetch(`${base}/profile/${encodeURIComponent(userId)}/feed`, {
    method: 'GET',
    headers: {
      ...authHeader,
    },
  });

  const json = (await response.json().catch(() => null)) as ApiEnvelope<ProfileFeedResponse> | null;
  if (!response.ok || !json) {
    throw new ProfileApiError(
      response.status,
      json?.message || `Request failed (${response.status})`,
      json?.error_code || null,
    );
  }
  if (!json.ok) {
    throw new ProfileApiError(response.status, json.message || 'Request failed.', json.error_code || null);
  }

  return json.data;
}
