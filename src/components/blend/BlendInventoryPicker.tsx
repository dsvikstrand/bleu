import { useState, useMemo } from 'react';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<SupplementCategory>('foundations');

  const categories = Object.keys(SUPPLEMENT_CATALOG) as SupplementCategory[];

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    const customId = `custom-${Date.now()}`;
    onSelect(customId, customName.trim(), customCategory);
    setCustomName('');
    setCustomDialogOpen(false);
  };

  const filteredSupplements = useMemo(() => {
    const supplements = SUPPLEMENT_CATALOG[activeCategory];
    if (!search.trim()) return supplements;
    const lowerSearch = search.toLowerCase();
    return supplements.filter((s) => s.name.toLowerCase().includes(lowerSearch));
  }, [activeCategory, search]);

  return (
    <div className="space-y-4">
        {/* Search + Add Custom */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search supplements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Supplement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-supp-name">Supplement Name</Label>
                  <Input
                    id="custom-supp-name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Lion's Mane Extract"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={customCategory} onValueChange={(v) => setCustomCategory(v as SupplementCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddCustom} className="w-full">
                  Add to Blend
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
