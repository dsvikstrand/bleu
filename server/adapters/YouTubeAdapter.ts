import type { AdapterValidateResult, BaseAdapter } from './BaseAdapter';

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{8,15}$/;

export class YouTubeAdapter implements BaseAdapter {
  id = 'youtube';
  sourceType = 'youtube';

  canHandle(rawUrl: string): boolean {
    try {
      const url = new URL(rawUrl.trim());
      const host = url.hostname.replace(/^www\./, '');
      return host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be';
    } catch {
      return false;
    }
  }

  validate(rawUrl: string): AdapterValidateResult {
    try {
      const url = new URL(rawUrl.trim());
      const host = url.hostname.replace(/^www\./, '');
      if (url.searchParams.has('list')) {
        return { ok: false, errorCode: 'INVALID_URL', message: 'Playlist URLs are not supported.' };
      }

      if (host === 'youtube.com' || host === 'm.youtube.com') {
        if (url.pathname !== '/watch') {
          return { ok: false, errorCode: 'INVALID_URL', message: 'Only single YouTube watch URLs are supported.' };
        }
        const videoId = url.searchParams.get('v')?.trim() || '';
        if (!YOUTUBE_ID_REGEX.test(videoId)) {
          return { ok: false, errorCode: 'INVALID_URL', message: 'Invalid YouTube video URL.' };
        }
        return {
          ok: true,
          sourceType: this.sourceType,
          sourceNativeId: videoId,
          canonicalKey: `${this.sourceType}:${videoId}`,
        };
      }

      if (host === 'youtu.be') {
        const videoId = url.pathname.replace(/^\/+/, '').split('/')[0]?.trim() || '';
        if (!YOUTUBE_ID_REGEX.test(videoId)) {
          return { ok: false, errorCode: 'INVALID_URL', message: 'Invalid YouTube short URL.' };
        }
        return {
          ok: true,
          sourceType: this.sourceType,
          sourceNativeId: videoId,
          canonicalKey: `${this.sourceType}:${videoId}`,
        };
      }

      return { ok: false, errorCode: 'INVALID_URL', message: 'Only YouTube URLs are supported.' };
    } catch {
      return { ok: false, errorCode: 'INVALID_URL', message: 'Invalid URL.' };
    }
  }
}
