import { useState, useMemo } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  InventoryItem,
  SupplementCategory,
  SUPPLEMENT_CATALOG,
  CATEGORY_LABELS,
} from '@/types/stacklab';

interface InventoryPickerProps {
  inventory: InventoryItem[];
  onAdd: (item: InventoryItem) => void;
  onRemove: (itemId: string) => void;
}

export function InventoryPicker({ inventory, onAdd, onRemove }: InventoryPickerProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<SupplementCategory>('sleep-recovery');
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<SupplementCategory>('foundations');
  const [dialogOpen, setDialogOpen] = useState(false);

  const categories = Object.keys(SUPPLEMENT_CATALOG) as SupplementCategory[];
  const inventoryIds = useMemo(() => new Set(inventory.map((i) => i.id)), [inventory]);

  const filteredSupplements = useMemo(() => {
    const categoryItems = SUPPLEMENT_CATALOG[activeCategory];
    if (!search.trim()) return categoryItems;
    return categoryItems.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [activeCategory, search]);

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    const customItem: InventoryItem = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      category: customCategory,
      isCustom: true,
    };
    onAdd(customItem);
    setCustomName('');
    setDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Inventory</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Custom
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Supplement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-name">Supplement Name</Label>
                  <Input
                    id="custom-name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. My custom supplement"
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
                  Add to Inventory
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supplements..."
            className="pl-9"
          />
        </div>

        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as SupplementCategory)}>
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto gap-1">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat}
                value={cat}
                className="text-xs px-2 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {CATEGORY_LABELS[cat].split(' ')[0]}
              </TabsTrigger>
            ))}
          </TabsList>
          {categories.map((cat) => (
            <TabsContent key={cat} value={cat} className="mt-3">
              <div className="flex flex-wrap gap-2">
                {filteredSupplements.map((item) => {
                  const isSelected = inventoryIds.has(item.id);
                  return (
                    <Badge
                      key={item.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary hover:bg-primary/90'
                          : 'hover:bg-accent hover:text-accent-foreground'
                      }`}
                      onClick={() => {
                        if (isSelected) {
                          onRemove(item.id);
                        } else {
                          onAdd({ ...item, isCustom: false });
                        }
                      }}
                    >
                      {item.name}
                      {isSelected && <X className="ml-1 h-3 w-3" />}
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

        {inventory.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2 text-muted-foreground">
              My Inventory ({inventory.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {inventory.map((item) => (
                <Badge
                  key={item.id}
                  variant="secondary"
                  className="gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  onClick={() => onRemove(item.id)}
                >
                  {item.name}
                  {item.isCustom && <span className="opacity-60">*</span>}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
