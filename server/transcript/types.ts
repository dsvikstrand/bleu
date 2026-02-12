export type TranscriptProvider = 'yt_to_text' | 'youtube_timedtext';

export type TranscriptSegment = {
  text: string;
  startSec?: number;
  endSec?: number;
};

export type TranscriptResult = {
  text: string;
  source: string;
  confidence: number | null;
  segments?: TranscriptSegment[];
};

export class TranscriptProviderError extends Error {
  code: 'NO_CAPTIONS' | 'TRANSCRIPT_FETCH_FAIL' | 'TRANSCRIPT_EMPTY' | 'TIMEOUT';
  constructor(code: 'NO_CAPTIONS' | 'TRANSCRIPT_FETCH_FAIL' | 'TRANSCRIPT_EMPTY' | 'TIMEOUT', message: string) {
    super(message);
    this.code = code;
  }
}

export function normalizeTranscriptWhitespace(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}
