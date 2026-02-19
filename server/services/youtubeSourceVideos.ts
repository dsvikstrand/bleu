export type YouTubeSourceVideo = {
  video_id: string;
  video_url: string;
  title: string;
  description: string;
  channel_id: string;
  channel_title: string;
  thumbnail_url: string | null;
  published_at: string | null;
  duration_seconds: number | null;
};

export type YouTubeSourceVideoPage = {
  results: YouTubeSourceVideo[];
  nextPageToken: string | null;
};

export type YouTubeSourceVideoKind = 'all' | 'full' | 'shorts';

type YouTubeSourceVideoErrorCode =
  | 'SEARCH_DISABLED'
  | 'INVALID_CHANNEL'
  | 'PROVIDER_FAIL'
  | 'RATE_LIMITED';

export class YouTubeSourceVideosError extends Error {
  code: YouTubeSourceVideoErrorCode;

  constructor(code: YouTubeSourceVideoErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function clampYouTubeSourceVideoLimit(rawLimit: number | undefined, defaultLimit = 12) {
  if (typeof rawLimit !== 'number' || !Number.isFinite(rawLimit)) return defaultLimit;
  return Math.max(1, Math.min(25, Math.floor(rawLimit)));
}

export function normalizeYouTubeSourceVideoKind(rawKind: string | undefined, fallback: YouTubeSourceVideoKind = 'all') {
  const kind = String(rawKind || '').trim().toLowerCase();
  if (kind === 'full' || kind === 'shorts' || kind === 'all') return kind;
  return fallback;
}

function parseIsoDurationToSeconds(rawDuration: string | undefined) {
  const value = String(rawDuration || '').trim();
  if (!value) return null;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const total = (hours * 3600) + (minutes * 60) + seconds;
  return Number.isFinite(total) ? total : null;
}

function normalizeYouTubeSourceVideoItem(raw: unknown): YouTubeSourceVideo | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as {
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      description?: string;
      channelId?: string;
      channelTitle?: string;
      publishedAt?: string;
      liveBroadcastContent?: string;
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
  };

  const videoId = String(item.id?.videoId || '').trim();
  const channelId = String(item.snippet?.channelId || '').trim();
  if (!videoId || !channelId) return null;

  // Skip upcoming placeholders that are not importable yet.
  if (String(item.snippet?.liveBroadcastContent || '').toLowerCase() === 'upcoming') {
    return null;
  }

  return {
    video_id: videoId,
    video_url: `https://www.youtube.com/watch?v=${videoId}`,
    title: String(item.snippet?.title || `Video ${videoId}`).trim(),
    description: String(item.snippet?.description || '').trim(),
    channel_id: channelId,
    channel_title: String(item.snippet?.channelTitle || channelId).trim(),
    thumbnail_url:
      item.snippet?.thumbnails?.high?.url
      || item.snippet?.thumbnails?.medium?.url
      || item.snippet?.thumbnails?.default?.url
      || null,
    published_at: item.snippet?.publishedAt ? String(item.snippet.publishedAt) : null,
    duration_seconds: null,
  };
}

async function fetchYouTubeDurationMap(input: {
  apiKey: string;
  videoIds: string[];
}) {
  const apiKey = String(input.apiKey || '').trim();
  const uniqueVideoIds = Array.from(new Set(
    input.videoIds.map((videoId) => String(videoId || '').trim()).filter(Boolean),
  ));
  const durationMap = new Map<string, number | null>();

  if (!apiKey || uniqueVideoIds.length === 0) {
    return durationMap;
  }

  const batchSize = 50;
  for (let offset = 0; offset < uniqueVideoIds.length; offset += batchSize) {
    const ids = uniqueVideoIds.slice(offset, offset + batchSize);
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'contentDetails');
    url.searchParams.set('id', ids.join(','));
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'bleuv1-youtube-source-videos/1.0 (+https://bapi.vdsai.cloud)',
        Accept: 'application/json',
      },
    });

    if (response.status === 403 || response.status === 429) {
      throw new YouTubeSourceVideosError('RATE_LIMITED', 'YouTube provider quota is currently limited.');
    }
    if (!response.ok) {
      throw new YouTubeSourceVideosError('PROVIDER_FAIL', `YouTube source duration provider failed (${response.status}).`);
    }

    const json = (await response.json().catch(() => null)) as {
      items?: Array<{ id?: string; contentDetails?: { duration?: string } }>;
      error?: { code?: number; message?: string };
    } | null;
    if (!json) {
      throw new YouTubeSourceVideosError('PROVIDER_FAIL', 'Invalid response from YouTube duration provider.');
    }
    if (json.error) {
      if (json.error.code === 403 || json.error.code === 429) {
        throw new YouTubeSourceVideosError('RATE_LIMITED', json.error.message || 'YouTube provider quota is currently limited.');
      }
      throw new YouTubeSourceVideosError('PROVIDER_FAIL', json.error.message || 'YouTube duration provider returned an error.');
    }

    for (const row of json.items || []) {
      const videoId = String(row.id || '').trim();
      if (!videoId) continue;
      durationMap.set(videoId, parseIsoDurationToSeconds(row.contentDetails?.duration));
    }
  }

  return durationMap;
}

export async function listYouTubeSourceVideos(input: {
  apiKey: string;
  channelId: string;
  limit?: number;
  pageToken?: string;
  kind?: YouTubeSourceVideoKind;
  shortsMaxSeconds?: number;
}): Promise<YouTubeSourceVideoPage> {
  const apiKey = String(input.apiKey || '').trim();
  if (!apiKey) {
    throw new YouTubeSourceVideosError('SEARCH_DISABLED', 'YouTube source video listing is not configured.');
  }

  const channelId = String(input.channelId || '').trim();
  if (!channelId) {
    throw new YouTubeSourceVideosError('INVALID_CHANNEL', 'A valid source channel id is required.');
  }

  const limit = clampYouTubeSourceVideoLimit(input.limit, 12);
  const pageToken = String(input.pageToken || '').trim();
  const kind = normalizeYouTubeSourceVideoKind(input.kind, 'all');
  const shortsMaxSeconds = Math.max(10, Math.min(600, Number(input.shortsMaxSeconds || 60)));

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('order', 'date');
  url.searchParams.set('channelId', channelId);
  url.searchParams.set('maxResults', String(limit));
  url.searchParams.set('key', apiKey);
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'bleuv1-youtube-source-videos/1.0 (+https://bapi.vdsai.cloud)',
      Accept: 'application/json',
    },
  });

  if (response.status === 403 || response.status === 429) {
    throw new YouTubeSourceVideosError('RATE_LIMITED', 'YouTube provider quota is currently limited.');
  }

  if (!response.ok) {
    throw new YouTubeSourceVideosError('PROVIDER_FAIL', `YouTube source video provider failed (${response.status}).`);
  }

  const json = (await response.json().catch(() => null)) as {
    items?: unknown[];
    nextPageToken?: string;
    error?: { code?: number; message?: string };
  } | null;
  if (!json) {
    throw new YouTubeSourceVideosError('PROVIDER_FAIL', 'Invalid response from YouTube source video provider.');
  }
  if (json.error) {
    if (json.error.code === 403 || json.error.code === 429) {
      throw new YouTubeSourceVideosError('RATE_LIMITED', json.error.message || 'YouTube provider quota is currently limited.');
    }
    throw new YouTubeSourceVideosError('PROVIDER_FAIL', json.error.message || 'YouTube provider returned an error.');
  }

  const items = Array.isArray(json.items) ? json.items : [];
  let results = items
    .map((item) => normalizeYouTubeSourceVideoItem(item))
    .filter((item): item is YouTubeSourceVideo => Boolean(item));

  if (results.length > 0) {
    const durationMap = await fetchYouTubeDurationMap({
      apiKey,
      videoIds: results.map((item) => item.video_id),
    });
    results = results.map((item) => ({
      ...item,
      duration_seconds: durationMap.get(item.video_id) ?? null,
    }));
  }

  if (kind !== 'all') {
    results = results.filter((item) => {
      if (item.duration_seconds == null) return kind === 'full';
      const isShort = item.duration_seconds <= shortsMaxSeconds;
      return kind === 'shorts' ? isShort : !isShort;
    });
  }

  return {
    results,
    nextPageToken: typeof json.nextPageToken === 'string' ? json.nextPageToken : null,
  };
}
