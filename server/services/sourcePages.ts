import type { SupabaseClient } from '@supabase/supabase-js';

const SUPPORTED_PLATFORMS = new Set(['youtube']);

export type SourcePagePlatform = 'youtube';

type DbClient = SupabaseClient<any, 'public', any>;

export type SourcePageRow = {
  id: string;
  platform: string;
  external_id: string;
  external_url: string;
  title: string;
  avatar_url: string | null;
  banner_url: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function normalizeSourcePagePlatform(raw: string): SourcePagePlatform | null {
  const normalized = String(raw || '').trim().toLowerCase();
  if (SUPPORTED_PLATFORMS.has(normalized)) return normalized as SourcePagePlatform;
  return null;
}

export function buildSourcePagePath(platform: string, externalId: string) {
  return `/s/${encodeURIComponent(String(platform || '').trim().toLowerCase())}/${encodeURIComponent(String(externalId || '').trim())}`;
}

export async function getSourcePageByPlatformExternalId(
  db: DbClient,
  input: { platform: string; externalId: string },
) {
  const platform = normalizeSourcePagePlatform(input.platform);
  if (!platform) return null;
  const externalId = String(input.externalId || '').trim();
  if (!externalId) return null;

  const { data, error } = await db
    .from('source_pages')
    .select('id, platform, external_id, external_url, title, avatar_url, banner_url, metadata, is_active, created_at, updated_at')
    .eq('platform', platform)
    .eq('external_id', externalId)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as SourcePageRow | null;
}

export async function ensureSourcePageFromYouTubeChannel(
  db: DbClient,
  input: {
    channelId: string;
    channelUrl: string | null;
    title: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
  },
) {
  const channelId = String(input.channelId || '').trim();
  if (!channelId) throw new Error('SOURCE_PAGE_INVALID_EXTERNAL_ID');

  const payload = {
    platform: 'youtube',
    external_id: channelId,
    external_url: String(input.channelUrl || '').trim() || `https://www.youtube.com/channel/${channelId}`,
    title: String(input.title || '').trim() || channelId,
    avatar_url: input.avatarUrl || null,
    banner_url: input.bannerUrl || null,
    metadata: {
      provider: 'youtube',
      channel_id: channelId,
    },
  };

  const { data, error } = await db
    .from('source_pages')
    .upsert(payload, { onConflict: 'platform,external_id' })
    .select('id, platform, external_id, external_url, title, avatar_url, banner_url, metadata, is_active, created_at, updated_at')
    .single();
  if (error) throw error;
  return data as SourcePageRow;
}

export async function getUserSubscriptionStateForSourcePage(
  db: DbClient,
  input: { userId: string; sourcePageId: string },
) {
  const userId = String(input.userId || '').trim();
  const sourcePageId = String(input.sourcePageId || '').trim();
  if (!userId || !sourcePageId) {
    return {
      subscribed: false,
      subscription_id: null,
      is_active: false,
    };
  }

  const { data, error } = await db
    .from('user_source_subscriptions')
    .select('id, is_active')
    .eq('user_id', userId)
    .eq('source_page_id', sourcePageId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  return {
    subscribed: Boolean(data?.is_active),
    subscription_id: data?.id || null,
    is_active: Boolean(data?.is_active),
  };
}
