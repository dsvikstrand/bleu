import type { SupabaseClient } from '@supabase/supabase-js';

type EnsureSourceItemInput = {
  sourceType: string;
  sourceNativeId: string;
  canonicalKey: string;
  sourceUrl: string;
  title: string;
  metadata?: Record<string, unknown>;
};

export async function ensureSourceItem(supabase: SupabaseClient, input: EnsureSourceItemInput) {
  const { data, error } = await supabase
    .from('source_items')
    .upsert(
      {
        source_type: input.sourceType,
        source_native_id: input.sourceNativeId,
        canonical_key: input.canonicalKey,
        source_url: input.sourceUrl,
        title: input.title,
        metadata: input.metadata || {},
        ingest_status: 'ready',
      },
      { onConflict: 'canonical_key' },
    )
    .select('id, canonical_key')
    .single();

  if (error) throw error;
  return data;
}
