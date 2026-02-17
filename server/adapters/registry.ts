import type { BaseAdapter } from './BaseAdapter';
import { YouTubeAdapter } from './YouTubeAdapter';

const adapters: BaseAdapter[] = [new YouTubeAdapter()];

export function getAdapterForUrl(rawUrl: string): BaseAdapter | null {
  return adapters.find((adapter) => adapter.canHandle(rawUrl)) || null;
}

export function getAdapterBySourceType(sourceType: string): BaseAdapter | null {
  return adapters.find((adapter) => adapter.sourceType === sourceType) || null;
}
