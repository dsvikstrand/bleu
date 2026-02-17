import { supabase } from '@/integrations/supabase/client';
import { config } from '@/config/runtime';

export type SubscriptionMode = 'auto' | 'manual';

export type SourceSubscription = {
  id: string;
  source_type: string;
  source_channel_id: string;
  source_channel_url: string | null;
  source_channel_title: string | null;
  mode: SubscriptionMode;
  is_active: boolean;
  last_polled_at: string | null;
  last_seen_published_at: string | null;
  last_seen_video_id: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
};

type ApiEnvelope<T> = {
  ok: boolean;
  error_code: string | null;
  message: string;
  data: T;
};

class ApiRequestError extends Error {
  status: number;
  errorCode: string | null;

  constructor(status: number, message: string, errorCode: string | null = null) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }
}

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
    throw new ApiRequestError(response.status, json?.message || `Request failed (${response.status})`, json?.error_code || null);
  }
  if (!json.ok) {
    throw new ApiRequestError(response.status, json.message || 'Request failed.', json.error_code || null);
  }
  return json;
}

export async function listSourceSubscriptions() {
  const response = await apiRequest<SourceSubscription[]>('/source-subscriptions', { method: 'GET' });
  return response.data;
}

export async function createSourceSubscription(input: { channelInput: string; mode?: SubscriptionMode }) {
  const response = await apiRequest<{
    subscription: SourceSubscription;
    sync: {
      processed: number;
      inserted: number;
      skipped: number;
      newestVideoId: string | null;
      newestPublishedAt: string | null;
      channelTitle: string | null;
    } | null;
  }>('/source-subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      channel_input: input.channelInput,
      mode: input.mode || 'auto',
    }),
  });

  return response.data;
}

export async function updateSourceSubscription(input: { id: string; mode?: SubscriptionMode; isActive?: boolean }) {
  const response = await apiRequest<SourceSubscription>(`/source-subscriptions/${input.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      mode: input.mode,
      is_active: input.isActive,
    }),
  });
  return response.data;
}

export async function deactivateSourceSubscription(id: string) {
  const response = await apiRequest<{ id: string }>(`/source-subscriptions/${id}`, { method: 'DELETE' });
  return response.data;
}

export async function syncSourceSubscription(id: string) {
  const response = await apiRequest<{
    job_id: string;
    processed: number;
    inserted: number;
    skipped: number;
    newestVideoId: string | null;
    newestPublishedAt: string | null;
    channelTitle: string | null;
  }>(`/source-subscriptions/${id}/sync`, { method: 'POST', body: JSON.stringify({}) });
  return response.data;
}

export async function acceptMyFeedPendingItem(id: string) {
  const response = await apiRequest<{
    user_feed_item_id: string;
    blueprint_id: string;
    state: string;
  }>(`/my-feed/items/${id}/accept`, { method: 'POST', body: JSON.stringify({}) });
  return response.data;
}

export async function skipMyFeedPendingItem(id: string) {
  const response = await apiRequest<{
    user_feed_item_id: string;
    state: string;
  }>(`/my-feed/items/${id}/skip`, { method: 'POST', body: JSON.stringify({}) });
  return response.data;
}

export { ApiRequestError };
