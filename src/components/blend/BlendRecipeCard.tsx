import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BlendRecipe, BlendItem, DoseUnit, CATEGORY_LABELS } from '@/types/stacklab';
import { Beaker, X, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BlendRecipeCardProps {
  blend: BlendRecipe;
  onUpdateName: (name: string) => void;
  onUpdateItem: (itemId: string, amount: number, unit: DoseUnit) => void;
  onRemoveItem: (itemId: string) => void;
  onClear: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

const UNITS: DoseUnit[] = ['mg', 'g', 'mcg', 'IU', 'ml', 'scoop'];

export function BlendRecipeCard({
  blend,
  onUpdateName,
  onUpdateItem,
  onRemoveItem,
  onClear,
  onAnalyze,
  isAnalyzing,
}: BlendRecipeCardProps) {
  const [editingItem, setEditingItem] = useState<BlendItem | null>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editUnit, setEditUnit] = useState<DoseUnit>('mg');

  const handleStartEdit = (item: BlendItem) => {
    setEditingItem(item);
    setEditAmount(item.amount);
    setEditUnit(item.unit);
  };

  const handleSaveEdit = () => {
    if (editingItem && editAmount > 0) {
      onUpdateItem(editingItem.id, editAmount, editUnit);
      setEditingItem(null);
    }
  };

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Beaker className="h-4 w-4 text-primary-foreground" />
              </div>
              <Input
                value={blend.name}
                onChange={(e) => onUpdateName(e.target.value)}
                className="h-8 text-lg font-semibold border-none bg-transparent p-0 focus-visible:ring-0"
                placeholder="Blend Name"
              />
            </div>
            <Badge variant="secondary">{blend.items.length} items</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {blend.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Beaker className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Your blend is empty</p>
              <p className="text-sm">Add supplements from the picker</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blend.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-accent/50 group"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[item.category]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {item.amount} {item.unit}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleStartEdit(item)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onClear}
              disabled={blend.items.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={onAnalyze}
              disabled={blend.items.length === 0 || isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing...' : '🍸 Analyze Blend'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={!!editingItem} onOpenChange={(o) => !o && setEditingItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editingItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-amount"
                  type="number"
                  min="0"
                  step="any"
                  value={editAmount}
                  onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                  className="flex-1"
                />
                <Select value={editUnit} onValueChange={(v) => setEditUnit(v as DoseUnit)}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editAmount <= 0}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
