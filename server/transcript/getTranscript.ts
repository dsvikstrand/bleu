import { getTranscriptFromYtToText } from './providers/ytToTextProvider';
import { getTranscriptFromYouTubeTimedtext } from './providers/youtubeTimedtextProvider';
import { TranscriptProviderError, type TranscriptProvider, type TranscriptResult } from './types';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(new TranscriptProviderError('TIMEOUT', 'Transcript request timed out.')), ms);
    }),
  ]);
}

export function resolveTranscriptProvider(): TranscriptProvider {
  const raw = (process.env.TRANSCRIPT_PROVIDER || 'yt_to_text').toLowerCase();
  if (raw === 'youtube_timedtext') return 'youtube_timedtext';
  return 'yt_to_text';
}

export async function getTranscriptForVideo(videoId: string): Promise<TranscriptResult> {
  const provider = resolveTranscriptProvider();
  if (provider === 'youtube_timedtext') {
    return withTimeout(getTranscriptFromYouTubeTimedtext(videoId), 25_000);
  }
  return withTimeout(getTranscriptFromYtToText(videoId), 25_000);
}
