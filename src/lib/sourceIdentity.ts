export type SourceIdentity = {
  sourceType: 'youtube';
  sourceNativeId: string;
  canonicalKey: string;
};

export function extractYouTubeVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname !== '/watch') return null;
      const videoId = url.searchParams.get('v')?.trim() || '';
      return /^[a-zA-Z0-9_-]{8,15}$/.test(videoId) ? videoId : null;
    }

    if (host === 'youtu.be') {
      const videoId = url.pathname.replace(/^\/+/, '').split('/')[0]?.trim() || '';
      return /^[a-zA-Z0-9_-]{8,15}$/.test(videoId) ? videoId : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function toYouTubeIdentity(videoId: string): SourceIdentity {
  return {
    sourceType: 'youtube',
    sourceNativeId: videoId,
    canonicalKey: `youtube:${videoId}`,
  };
}
