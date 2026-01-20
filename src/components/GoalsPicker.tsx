import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Goal, PRESET_GOALS } from '@/types/stacklab';

interface GoalsPickerProps {
  selectedGoals: Goal[];
  customGoals: Goal[];
  onToggleGoal: (goal: Goal) => void;
  onAddCustomGoal: (label: string) => void;
  onRemoveCustomGoal: (goalId: string) => void;
}

export function GoalsPicker({
  selectedGoals,
  customGoals,
  onToggleGoal,
  onAddCustomGoal,
  onRemoveCustomGoal,
}: GoalsPickerProps) {
  const [customInput, setCustomInput] = useState('');
  const selectedIds = new Set(selectedGoals.map((g) => g.id));
  const canAddMore = selectedGoals.length < 5;
  const canAddCustom = customGoals.length < 5;

  const handleAddCustom = () => {
    if (!customInput.trim() || !canAddCustom) return;
    onAddCustomGoal(customInput.trim());
    setCustomInput('');
  };

  const presetGoals: Goal[] = PRESET_GOALS.map((g) => ({ ...g, isCustom: false }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Goals</CardTitle>
          <Badge variant={canAddMore ? 'outline' : 'secondary'} className="font-normal">
            {selectedGoals.length}/5 selected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {presetGoals.map((goal) => {
            const isSelected = selectedIds.has(goal.id);
            const isDisabled = !isSelected && !canAddMore;
            return (
              <label
                key={goal.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary bg-accent'
                    : isDisabled
                    ? 'opacity-50 cursor-not-allowed border-border'
                    : 'border-border hover:border-primary/50 hover:bg-accent/50'
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  disabled={isDisabled}
                  onCheckedChange={() => onToggleGoal(goal)}
                />
                <span className="text-sm">{goal.label}</span>
              </label>
            );
          })}
        </div>

        {/* Custom Goals */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2 text-muted-foreground">
            Custom Goals ({customGoals.length}/5)
          </p>
          
          {customGoals.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {customGoals.map((goal) => {
                const isSelected = selectedIds.has(goal.id);
                return (
                  <Badge
                    key={goal.id}
                    variant={isSelected ? 'default' : 'outline'}
                    className="gap-1 cursor-pointer"
                  >
                    <span onClick={() => onToggleGoal(goal)}>{goal.label}</span>
                    <X
                      className="h-3 w-3 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveCustomGoal(goal.id);
                      }}
                    />
                  </Badge>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Add custom goal..."
              disabled={!canAddCustom}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleAddCustom}
              disabled={!canAddCustom || !customInput.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
