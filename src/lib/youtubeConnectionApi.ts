import { supabase } from '@/integrations/supabase/client';
import { config } from '@/config/runtime';
import { ApiRequestError } from '@/lib/subscriptionsApi';

type ApiEnvelope<T> = {
  ok: boolean;
  error_code: string | null;
  message: string;
  data: T;
};

export type YouTubeConnectionStatus = {
  connected: boolean;
  needs_reauth: boolean;
  channel_title: string | null;
  channel_url: string | null;
  channel_avatar_url: string | null;
  last_import_at: string | null;
};

export type YouTubeImportPreviewItem = {
  channel_id: string;
  channel_title: string | null;
  channel_url: string;
  thumbnail_url: string | null;
  already_active: boolean;
  already_exists_inactive: boolean;
};

export type YouTubeImportResult = {
  requested_count: number;
  imported_count: number;
  reactivated_count: number;
  already_active_count: number;
  failed_count: number;
  failures: Array<{
    channel_id: string;
    error_code: string;
    error: string;
  }>;
};

function getApiBase() {
  if (!config.agenticBackendUrl) return null;
  return `${config.agenticBackendUrl.replace(/\/$/, '')}/api`;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiRequestError(401, 'Sign in required.', 'AUTH_REQUIRED');
  return { Authorization: `Bearer ${token}` };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const base = getApiBase();
  if (!base) {
    throw new ApiRequestError(503, 'Backend API is not configured.', 'API_NOT_CONFIGURED');
  }

  const authHeader = await getAuthHeader();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(init?.headers || {}),
    },
  });

  const json = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !json) {
    throw new ApiRequestError(
      response.status,
      json?.message || `Request failed (${response.status})`,
      json?.error_code || null,
      json?.data ?? null,
    );
  }
  if (!json.ok) {
    throw new ApiRequestError(
      response.status,
      json.message || 'Request failed.',
      json.error_code || null,
      json.data ?? null,
    );
  }
  return json;
}

export async function getYouTubeConnectionStatus() {
  const response = await apiRequest<YouTubeConnectionStatus>('/youtube/connection/status', { method: 'GET' });
  return response.data;
}

export async function startYouTubeConnection(input?: { returnTo?: string }) {
  const response = await apiRequest<{ auth_url: string }>('/youtube/connection/start', {
    method: 'POST',
    body: JSON.stringify({
      return_to: input?.returnTo,
    }),
  });
  return response.data;
}

export async function previewYouTubeSubscriptionsImport() {
  const response = await apiRequest<{
    results: YouTubeImportPreviewItem[];
    truncated: boolean;
  }>('/youtube/subscriptions/preview', {
    method: 'GET',
  });
  return response.data;
}

export async function importYouTubeSubscriptions(input: {
  channels: Array<{ channel_id: string; channel_url?: string; channel_title?: string | null }>;
}) {
  const response = await apiRequest<YouTubeImportResult>('/youtube/subscriptions/import', {
    method: 'POST',
    body: JSON.stringify({
      channels: input.channels,
    }),
  });
  return response.data;
}

export async function disconnectYouTubeConnection() {
  const response = await apiRequest<{ disconnected: boolean }>('/youtube/connection', {
    method: 'DELETE',
  });
  return response.data;
}
