import { useState, useMemo } from 'react';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Check } from 'lucide-react';
import {
  SupplementCategory,
  SUPPLEMENT_CATALOG,
  CATEGORY_LABELS,
} from '@/types/stacklab';

interface BlendInventoryPickerProps {
  selectedIds: Set<string>;
  onSelect: (supplementId: string, name: string, category: SupplementCategory) => void;
}

export function BlendInventoryPicker({ selectedIds, onSelect }: BlendInventoryPickerProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<SupplementCategory>('sleep-recovery');

  const categories = Object.keys(SUPPLEMENT_CATALOG) as SupplementCategory[];

  const filteredSupplements = useMemo(() => {
    const supplements = SUPPLEMENT_CATALOG[activeCategory];
    if (!search.trim()) return supplements;
    const lowerSearch = search.toLowerCase();
    return supplements.filter((s) => s.name.toLowerCase().includes(lowerSearch));
  }, [activeCategory, search]);

  return (
    <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search supplements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as SupplementCategory)}>
          <TabsList className="w-full h-auto flex-wrap gap-1 bg-transparent p-0">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat}
                value={cat}
                className="text-xs px-2 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {CATEGORY_LABELS[cat].split(' ')[0]}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat} value={cat} className="mt-3">
              <div className="flex flex-wrap gap-2">
                {filteredSupplements.map((supplement) => {
                  const isSelected = selectedIds.has(supplement.id);
                  return (
                    <Badge
                      key={supplement.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary hover:bg-primary/90'
                          : 'hover:bg-accent hover:text-accent-foreground'
                      }`}
                      onClick={() => onSelect(supplement.id, supplement.name, supplement.category)}
                    >
                      {isSelected && <Check className="h-3 w-3 mr-1" />}
                      {supplement.name}
                    </Badge>
                  );
                })}
                {filteredSupplements.length === 0 && (
                  <p className="text-sm text-muted-foreground">No supplements found</p>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
    </div>
  );
}
