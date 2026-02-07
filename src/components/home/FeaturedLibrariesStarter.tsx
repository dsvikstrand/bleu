import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, ArrowRight, RotateCcw, Wand2 } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

type InventoryCategory = { name: string; items: string[] };

type BuilderStep = {
  id: string;
  title: string;
  description: string;
  itemKeys: string[];
};

type HomeDraftV1 = {
  version: 1;
  inventoryId: string;
  title: string;
  selectedItems: Record<string, string[]>;
  steps: BuilderStep[];
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

function uniqStrings(values: string[]) {
  return Array.from(new Set(values));
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

function buildExampleDraft(featureKey: (typeof FEATURED)[number]['key'], inventoryId: string, inventoryTitle: string, categories: InventoryCategory[]): HomeDraftV1 {
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
  const steps: BuilderStep[] = [];

  spec.forEach((step, index) => {
    const matches = findItemsByNeedle(categories, step.needles);
    const picked = (matches.length > 0 ? matches : fallback).slice(0, 3);
    const itemKeys = picked.map((p) => `${p.category}::${p.item}`);
    picked.forEach((p) => pushSelected(selectedItems, p.category, p.item));

    steps.push({
      id: `home-step-${index + 1}`,
      title: step.title,
      description: '',
      itemKeys: uniqStrings(itemKeys),
    });
  });

  const titleBase = featureKey === 'skincare' ? 'Skincare Routine Blueprint' : 'Morning Routine Blueprint';
  return {
    version: 1,
    inventoryId,
    title: titleBase,
    selectedItems,
    steps,
    source: 'home-example',
  };
}

export function FeaturedLibrariesStarter() {
  const navigate = useNavigate();
  const [activeKey, setActiveKey] = useState<(typeof FEATURED)[number]['key']>(FEATURED[0].key);
  const [selectedByInventoryId, setSelectedByInventoryId] = useState<Record<string, Record<string, string[]>>>({});

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

  const categories = useMemo(() => {
    if (!activeInventory) return [];
    return parseCategories(activeInventory.generated_schema as Json);
  }, [activeInventory]);

  const activeSelected = useMemo(() => {
    if (!activeInventory) return {};
    return selectedByInventoryId[activeInventory.id] || {};
  }, [activeInventory, selectedByInventoryId]);

  const selectedCount = useMemo(() => {
    return Object.values(activeSelected).reduce((sum, items) => sum + items.length, 0);
  }, [activeSelected]);

  const setActiveSelected = (next: Record<string, string[]>) => {
    if (!activeInventory) return;
    setSelectedByInventoryId((prev) => ({
      ...prev,
      [activeInventory.id]: next,
    }));
  };

  const toggleItem = (category: string, item: string) => {
    const next: Record<string, string[]> = { ...activeSelected };
    const list = new Set(next[category] || []);
    if (list.has(item)) list.delete(item);
    else list.add(item);
    next[category] = Array.from(list);
    setActiveSelected(next);
  };

  const resetSelections = () => {
    setActiveSelected({});
  };

  const openBuilderWithDraft = (draft: HomeDraftV1) => {
    sessionStorage.setItem(HOME_DRAFT_KEY, JSON.stringify(draft));
    navigate(`/inventory/${draft.inventoryId}/build`);
  };

  const handleOpenBuilder = () => {
    if (!activeInventory) return;
    const draft: HomeDraftV1 = {
      version: 1,
      inventoryId: activeInventory.id,
      title: activeInventory.title,
      selectedItems: activeSelected,
      steps: [],
      source: 'home-starter',
    };
    openBuilderWithDraft(draft);
  };

  const handleLoadExample = () => {
    if (!activeInventory) return;
    const draft = buildExampleDraft(activeInventory.featureKey, activeInventory.id, activeInventory.title, categories);
    openBuilderWithDraft(draft);
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
              <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={resetSelections} disabled={!activeInventory}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button type="button" size="sm" variant="outline" className="gap-2" onClick={handleLoadExample} disabled={!activeInventory}>
                <Wand2 className="h-4 w-4" />
                Load example blueprint
              </Button>
              <Button type="button" size="sm" className="gap-2" onClick={handleOpenBuilder} disabled={!activeInventory}>
                Open builder
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {activeInventory?.title || 'Loading…'}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {selectedCount} item{selectedCount === 1 ? '' : 's'} selected
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
            <div className="grid gap-4 sm:grid-cols-2">
              {categories.slice(0, 4).map((cat) => (
                <div key={cat.name} className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">{cat.name}</h4>
                  <div className="space-y-1.5">
                    {cat.items.slice(0, 6).map((item) => (
                      <label
                        key={item}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary transition-colors"
                      >
                        <Checkbox
                          checked={(activeSelected[cat.name] || []).includes(item)}
                          onCheckedChange={() => toggleItem(cat.name, item)}
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

