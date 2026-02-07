import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BlueprintSimpleBuilder } from '@/components/blueprint/BlueprintSimpleBuilder';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, RotateCcw, Wand2, Lock } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

type InventoryCategory = { name: string; items: string[] };

type HomeDraftV1 = {
  version: 1;
  inventoryId: string;
  title: string;
  selectedItems: Record<string, string[]>;
  itemContexts?: Record<string, string>;
  modeHint?: 'simple' | 'full';
  source: 'home-starter' | 'home-example';
};

const HOME_DRAFT_KEY = 'blueprints_home_draft_v1';

const FEATURED = [
  { key: 'morning', title: 'HOME MORNING ROUTINE LIBRARY', fallbackIlike: '%morning routine%library%' },
  { key: 'skincare', title: 'Home Skincare Routine Library', fallbackIlike: '%skincare%routine%library%' },
] as const;

function parseCategories(schema: Json): InventoryCategory[] {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return [];
  const categories = (schema as { categories?: Array<{ name?: string; items?: string[] }> }).categories;
  if (!Array.isArray(categories)) return [];

  return categories
    .map((category) => ({
      name: typeof category.name === 'string' ? category.name : 'Untitled',
      items: Array.isArray(category.items)
        ? category.items.filter((item): item is string => typeof item === 'string')
        : [],
    }))
    .filter((category) => category.name.trim().length > 0 && category.items.length > 0);
}

function pushSelected(map: Record<string, string[]>, category: string, item: string) {
  const existing = new Set(map[category] || []);
  existing.add(item);
  map[category] = Array.from(existing);
}

function findItemsByNeedle(categories: InventoryCategory[], needles: string[]) {
  const hits: Array<{ category: string; item: string }> = [];
  const normalizedNeedles = needles.map((n) => n.toLowerCase());

  categories.forEach((cat) => {
    cat.items.forEach((item) => {
      const lower = item.toLowerCase();
      if (normalizedNeedles.some((needle) => lower.includes(needle))) {
        hits.push({ category: cat.name, item });
      }
    });
  });

  return hits;
}

function buildExampleSelection(
  featureKey: (typeof FEATURED)[number]['key'],
  inventoryId: string,
  inventoryTitle: string,
  categories: InventoryCategory[]
) {
  // Best-effort: prefer meaningful items, but fall back to "first N items" if nothing matches.
  const allItems = categories.flatMap((c) => c.items.map((item) => ({ category: c.name, item })));
  const fallback = allItems.slice(0, 10);

  const morningSteps = [
    { title: 'Wake up & reset', needles: ['alarm', 'light', 'water', 'curtain', 'lamp'] },
    { title: 'Hygiene', needles: ['tooth', 'floss', 'cleanser', 'deodor', 'shower', 'sunscreen'] },
    { title: 'Move a bit', needles: ['yoga', 'mat', 'shoe', 'run', 'band', 'dumbbell', 'stretch'] },
    { title: 'Plan the day', needles: ['journal', 'planner', 'calendar', 'notebook', 'todo', 'timer'] },
  ];

  const skincareSteps = [
    { title: 'Cleanse', needles: ['cleanser', 'wash', 'gel', 'foam'] },
    { title: 'Treat', needles: ['serum', 'vitamin', 'retinol', 'niacin', 'acid', 'bha', 'aha'] },
    { title: 'Moisturize', needles: ['moist', 'cream', 'lotion'] },
    { title: 'Protect (AM)', needles: ['sunscreen', 'spf'] },
  ];

  const spec = featureKey === 'skincare' ? skincareSteps : morningSteps;

  const selectedItems: Record<string, string[]> = {};

  spec.forEach((step) => {
    const matches = findItemsByNeedle(categories, step.needles);
    const picked = (matches.length > 0 ? matches : fallback).slice(0, 3);
    picked.forEach((p) => pushSelected(selectedItems, p.category, p.item));
  });

  const titleBase = featureKey === 'skincare' ? 'Skincare Routine Blueprint' : 'Morning Routine Blueprint';
  return { version: 1 as const, inventoryId, title: titleBase, selectedItems, source: 'home-example' as const };
}

export function FeaturedLibrariesStarter() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [activeKey, setActiveKey] = useState<(typeof FEATURED)[number]['key']>(FEATURED[0].key);
  const [stateByInventoryId, setStateByInventoryId] = useState<
    Record<
      string,
      {
        categories: InventoryCategory[];
        selectedItems: Record<string, string[]>;
        itemContexts: Record<string, string>;
        title: string;
      }
    >
  >({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ['home-featured-inventories-v1'],
    queryFn: async () => {
      const results = await Promise.all(
        FEATURED.map(async (f) => {
          const baseQuery = supabase
            .from('inventories')
            .select('id, title, generated_schema, is_public')
            .eq('is_public', true)
            .limit(1);

          const exact = await baseQuery.ilike('title', f.title);
          const exactRow = exact.data?.[0];
          if (exactRow) return { featureKey: f.key, ...exactRow };

          const fallback = await baseQuery.ilike('title', f.fallbackIlike);
          const fallbackRow = fallback.data?.[0];
          if (fallbackRow) return { featureKey: f.key, ...fallbackRow };

          return null;
        })
      );

      return results.filter((r): r is NonNullable<typeof r> => !!r);
    },
  });

  const activeInventory = useMemo(() => {
    if (!data || data.length === 0) return null;
    return data.find((row) => row.featureKey === activeKey) ?? data[0];
  }, [data, activeKey]);

  const activeInventoryCategories = useMemo(() => {
    if (!activeInventory) return [] as InventoryCategory[];
    return parseCategories(activeInventory.generated_schema as Json);
  }, [activeInventory]);

  useEffect(() => {
    if (!activeInventory) return;
    setStateByInventoryId((prev) => {
      if (prev[activeInventory.id]) return prev;
      return {
        ...prev,
        [activeInventory.id]: {
          categories: activeInventoryCategories,
          selectedItems: {},
          itemContexts: {},
          title: activeInventory.title,
        },
      };
    });
  }, [activeInventory?.id, activeInventoryCategories, activeInventory?.title]);

  const activeState = useMemo(() => {
    if (!activeInventory) return null;
    return stateByInventoryId[activeInventory.id] || null;
  }, [activeInventory, stateByInventoryId]);

  const categories = activeState?.categories || activeInventoryCategories;
  const selectedItems = activeState?.selectedItems || {};
  const itemContexts = activeState?.itemContexts || {};

  const selectedCount = useMemo(() => {
    return Object.values(selectedItems).reduce((sum, items) => sum + items.length, 0);
  }, [selectedItems]);

  const setActiveState = (updates: Partial<NonNullable<typeof activeState>>) => {
    if (!activeInventory) return;
    setStateByInventoryId((prev) => ({
      ...prev,
      [activeInventory.id]: {
        ...(prev[activeInventory.id] || {
          categories: parseCategories(activeInventory.generated_schema as Json),
          selectedItems: {},
          itemContexts: {},
          title: activeInventory.title,
        }),
        ...updates,
      },
    }));
  };

  const getItemKey = (categoryName: string, item: string) => `${categoryName}::${item}`;

  const toggleItem = (categoryName: string, item: string) => {
    const itemKey = getItemKey(categoryName, item);
    const nextSelected: Record<string, string[]> = { ...selectedItems };
    const existing = new Set(nextSelected[categoryName] || []);
    const wasSelected = existing.has(item);
    if (wasSelected) existing.delete(item);
    else existing.add(item);
    nextSelected[categoryName] = Array.from(existing);
    const nextContexts = { ...itemContexts };
    if (wasSelected) delete nextContexts[itemKey];
    setActiveState({ selectedItems: nextSelected, itemContexts: nextContexts });
  };

  const addCustomItem = (categoryName: string, itemName: string) => {
    const nextCategories = categories.map((c) =>
      c.name === categoryName
        ? { ...c, items: c.items.includes(itemName) ? c.items : [...c.items, itemName] }
        : c
    );
    const nextSelected: Record<string, string[]> = {
      ...selectedItems,
      [categoryName]: [...(selectedItems[categoryName] || []), itemName],
    };
    setActiveState({ categories: nextCategories, selectedItems: nextSelected });
  };

  const removeItem = (categoryName: string, item: string) => {
    const itemKey = getItemKey(categoryName, item);
    const nextSelected: Record<string, string[]> = {
      ...selectedItems,
      [categoryName]: (selectedItems[categoryName] || []).filter((i) => i !== item),
    };
    const nextContexts = { ...itemContexts };
    delete nextContexts[itemKey];
    setActiveState({ selectedItems: nextSelected, itemContexts: nextContexts });
  };

  const updateItemContext = (categoryName: string, item: string, context: string) => {
    setActiveState({
      itemContexts: {
        ...itemContexts,
        [getItemKey(categoryName, item)]: context,
      },
    });
  };

  const clearSelection = () => {
    setActiveState({
      selectedItems: {},
      itemContexts: {},
    });
  };

  const applyExampleToLocal = () => {
    if (!activeInventory) return;
    const draft = buildExampleSelection(
      activeInventory.featureKey,
      activeInventory.id,
      activeInventory.title,
      activeInventoryCategories
    );
    setActiveState({
      title: draft.title,
      categories: activeInventoryCategories,
      selectedItems: draft.selectedItems,
      itemContexts: {},
    });
    toast({
      title: 'Example loaded',
      description: 'Your blueprint has been pre-filled with selected items.',
    });
  };

  const openBuilderWithDraft = (source: HomeDraftV1['source']) => {
    if (!activeInventory) return;
    if (!session?.access_token) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to use the full builder.',
      });
      navigate('/auth');
      return;
    }
    const draft: HomeDraftV1 = {
      version: 1,
      inventoryId: activeInventory.id,
      title: activeState?.title || activeInventory.title,
      selectedItems,
      itemContexts,
      modeHint: 'full',
      source,
    };
    sessionStorage.setItem(HOME_DRAFT_KEY, JSON.stringify(draft));
    navigate(`/inventory/${draft.inventoryId}/build`);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-primary uppercase tracking-wide">Start building</p>
          <h2 className="text-xl font-semibold tracking-tight">Featured libraries</h2>
          <p className="text-sm text-muted-foreground">
            Pick a library, select a few items, or load an example blueprint. You will need to sign in to use AI review, banners, and publishing.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit text-xs">Starter</Badge>
      </div>

      <Card className="bg-card/60 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {FEATURED.map((f) => (
                <Button
                  key={f.key}
                  type="button"
                  size="sm"
                  variant={activeKey === f.key ? 'default' : 'outline'}
                  onClick={() => setActiveKey(f.key)}
                  disabled={!data?.some((row) => row.featureKey === f.key)}
                >
                  {f.key === 'morning' ? 'Morning routine' : 'Skincare'}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-2"
                onClick={clearSelection}
                disabled={!activeInventory}
              >
                <RotateCcw className="h-4 w-4" />
                Clear all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={applyExampleToLocal}
                disabled={!activeInventory}
              >
                <Wand2 className="h-4 w-4" />
                Auto-generate Blueprint
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={() => openBuilderWithDraft('home-starter')}
                disabled={!activeInventory}
              >
                <Lock className="h-4 w-4" />
                Use full builder
              </Button>
            </div>
          </div>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {activeInventory?.title || 'Loading…'}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{selectedCount} item{selectedCount === 1 ? '' : 's'} selected</p>
          <p className="text-xs text-muted-foreground/80">
            This loads a prebuilt example (no AI). Sign in to unlock AI review, banners, and publishing.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError || !activeInventory ? (
            <div className="text-sm text-muted-foreground">
              Featured libraries are not available right now. Try browsing the Library page instead.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-card/60 backdrop-blur-glass rounded-2xl border border-border/50 overflow-hidden">
                <div className="p-4 border-b border-border/30 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-primary uppercase tracking-wide">
                      {activeKey === 'morning' ? 'Morning routine' : 'Skincare'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Search items, tap to add them, and build your selection.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={applyExampleToLocal}
                  >
                    <Sparkles className="h-4 w-4" />
                    Auto-generate Blueprint
                  </Button>
                </div>
                <div className="p-4">
                  <BlueprintSimpleBuilder
                    categories={categories}
                    selectedItems={selectedItems}
                    itemContexts={itemContexts}
                    onToggleItem={toggleItem}
                    onAddCustomItem={addCustomItem}
                    onRemoveItem={removeItem}
                    onUpdateItemContext={updateItemContext}
                    onClear={clearSelection}
                    selectionTitle="Build Blueprint"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-card/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span>Sign in to unlock AI review, banner generation, and publishing.</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => openBuilderWithDraft('home-starter')}
                >
                  <Lock className="h-4 w-4" />
                  Use full builder
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
