import { useMemo, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { AppHeader } from '@/components/shared/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBlueprint } from '@/hooks/useBlueprints';
import { useInventory } from '@/hooks/useInventories';
import { BlueprintBuilder } from '@/components/blueprint/BlueprintBuilder';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { logMvpEvent } from '@/lib/logEvent';

function parseSelectedItems(selected: Json) {
  if (!selected || typeof selected !== 'object' || Array.isArray(selected)) return {} as Record<string, string[]>;
  return Object.fromEntries(
    Object.entries(selected as Record<string, string[]>).filter(([, items]) => Array.isArray(items))
  );
}

export default function BlueprintRemix() {
  const { blueprintId } = useParams();
  const { data: blueprint, isLoading: blueprintLoading } = useBlueprint(blueprintId);
  const { data: inventory, isLoading: inventoryLoading } = useInventory(blueprint?.inventory_id || undefined);
  const { user } = useAuth();
  const location = useLocation();
  const loggedBlueprintId = useRef<string | null>(null);

  const initialSelectedItems = useMemo(
    () => (blueprint ? parseSelectedItems(blueprint.selected_items) : {}),
    [blueprint]
  );

  const isLoading = blueprintLoading || inventoryLoading;

  useEffect(() => {
    if (!blueprint?.id) return;
    if (loggedBlueprintId.current === blueprint.id) return;
    loggedBlueprintId.current = blueprint.id;
    void logMvpEvent({
      eventName: 'click_remix',
      userId: user?.id,
      blueprintId: blueprint.id,
      path: location.pathname,
    });
  }, [blueprint?.id, location.pathname, user?.id]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-24 w-full mt-4" />
            </CardContent>
          </Card>
        ) : inventory && blueprint ? (
          <>
            <section className="space-y-2">
              <h1 className="text-3xl font-semibold">Remix Blueprint</h1>
              <p className="text-muted-foreground">Source: {blueprint.title}</p>
            </section>
            <BlueprintBuilder
              inventory={inventory}
              initialTitle={`${blueprint.title} Remix`}
              initialSelectedItems={initialSelectedItems}
              initialMixNotes={blueprint.mix_notes}
              initialReviewPrompt={blueprint.review_prompt}
              initialReview={blueprint.llm_review}
              sourceBlueprintId={blueprint.id}
            />
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">Blueprint or library not found.</CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
