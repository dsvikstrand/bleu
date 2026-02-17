export type AdapterValidateResult =
  | { ok: true; sourceType: string; sourceNativeId: string; canonicalKey: string }
  | { ok: false; errorCode: 'INVALID_URL'; message: string };

export interface BaseAdapter {
  id: string;
  sourceType: string;
  canHandle(rawUrl: string): boolean;
  validate(rawUrl: string): AdapterValidateResult;
}
