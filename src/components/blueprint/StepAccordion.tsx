import { useState, useCallback } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Check, GripVertical, Pencil, Plus, Trash2, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BlueprintStep {
  id: string;
  title: string;
  description: string;
  itemKeys: string[];
}

interface ItemEntry {
  key: string;
  category: string;
  item: string;
}

interface StepAccordionProps {
  steps: BlueprintStep[];
  activeStepId: string | null;
  onSetActive: (stepId: string) => void;
  onUpdateStep: (stepId: string, updates: Partial<BlueprintStep>) => void;
  onRemoveStep: (stepId: string) => void;
  onAddStep: () => void;
  onReorderSteps: (fromIndex: number, toIndex: number) => void;
  onRemoveItem: (category: string, item: string) => void;
  onUpdateItemContext: (category: string, item: string, context: string) => void;
  itemContexts: Record<string, string>;
  showQuickAdd?: boolean;
}

export function StepAccordion({
  steps,
  activeStepId,
  onSetActive,
  onUpdateStep,
  onRemoveStep,
  onAddStep,
  onReorderSteps,
  onRemoveItem,
  onUpdateItemContext,
  itemContexts,
  showQuickAdd = true,
}: StepAccordionProps) {
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const parseItemKey = useCallback((key: string): ItemEntry | null => {
    const [category, item] = key.split('::');
    if (!category || !item) return null;
    return { key, category, item };
  }, []);

  const startEditing = useCallback((step: BlueprintStep) => {
    setEditingStepId(step.id);
    setTitleDraft(step.title);
  }, []);

  const saveTitle = useCallback((stepId: string) => {
    onUpdateStep(stepId, { title: titleDraft.trim() });
    setEditingStepId(null);
    setTitleDraft('');
  }, [onUpdateStep, titleDraft]);

  const cancelEditing = useCallback(() => {
    setEditingStepId(null);
    setTitleDraft('');
  }, []);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((targetIndex: number) => {
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      onReorderSteps(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
  }, [draggedIndex, onReorderSteps]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  return (
    <div className="space-y-1">
      {/* Quick Add Step Button */}
      {showQuickAdd && (
        <Button
          type="button"
          variant="outline"
          onClick={onAddStep}
          className="w-full gap-2 border-dashed"
          data-help-id="add-step"
        >
          <Plus className="h-4 w-4" />
          Add Step
        </Button>
      )}

      {steps.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-4 text-center">
          <p className="text-sm text-muted-foreground leading-snug">
            No steps yet. Select items from the library above — they'll appear in your first step automatically.
          </p>
        </div>
      ) : (
        <Accordion
          type="single"
          collapsible
          value={activeStepId || undefined}
          onValueChange={(value) => value && onSetActive(value)}
          className="space-y-0"
          data-help-id="steps"
        >
          {steps.map((step, index) => {
            const displayTitle = step.title.trim() || `Step ${index + 1}`;
            const itemEntries = step.itemKeys
              .map(parseItemKey)
              .filter((entry): entry is ItemEntry => entry !== null);
            const isActive = activeStepId === step.id;
            const isEditing = editingStepId === step.id;

            return (
              <AccordionItem
                key={step.id}
                value={step.id}
                className={cn(
                  'border border-border/40 rounded-none overflow-hidden transition-colors',
                  isActive
                    ? 'border-primary/30 bg-muted/15'
                    : 'border-border/40 bg-background hover:bg-muted/10'
                )}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
              >
                <AccordionTrigger className="px-3 py-2 hover:no-underline [&>svg]:hidden">
                  <div className="flex w-full items-center gap-3">
                    {/* Drag Handle */}
                    <GripVertical className="h-4 w-4 text-muted-foreground/70 cursor-grab shrink-0" />

                    {/* Title (editable) */}
                    {isEditing ? (
                      <div
                        className="flex items-center gap-2 flex-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Input
                          value={titleDraft}
                          onChange={(e) => setTitleDraft(e.target.value)}
                          placeholder={`Step ${index + 1}`}
                          className="h-8 flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              saveTitle(step.id);
                            } else if (e.key === 'Escape') {
                              cancelEditing();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            saveTitle(step.id);
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelEditing();
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-semibold text-sm truncate">{displayTitle}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(step);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Badges & Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {itemEntries.length > 0 && (
                        <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                          {itemEntries.length} {itemEntries.length === 1 ? 'item' : 'items'}
                        </Badge>
                      )}
                      {isActive && (
                        <Badge variant="outline" className="gap-1 text-[11px] px-2 py-0.5 border-primary/30 text-primary">
                          <Zap className="h-3 w-3" />
                          Active
                        </Badge>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveStep(step.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-0 pb-0">
                  <div className="space-y-0">
                    {/* Description */}
                    <Textarea
                      value={step.description}
                      onChange={(e) => onUpdateStep(step.id, { description: e.target.value })}
                      placeholder="Add step notes or instructions..."
                      rows={2}
                      className="resize-none text-sm min-h-[56px] rounded-none border-x-0 border-t border-b-0 px-3"
                    />

                    {/* Active step hint */}
                    {isActive && itemEntries.length === 0 && (
                      <div className="border-t border-border/40 px-3 py-2 text-center" data-help-id="active-step">
                        <p className="text-sm text-muted-foreground">
                          Items you select will be added here automatically
                        </p>
                      </div>
                    )}

                    {/* Items list */}
                    {itemEntries.length > 0 && (
                      <div className="border-t border-border/40 divide-y divide-border/40">
                        {itemEntries.map((entry) => (
                          <div
                            key={entry.key}
                            className="px-3 py-2 space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate leading-tight">{entry.item}</p>
                                <p className="text-[11px] text-muted-foreground leading-tight">{entry.category}</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => onRemoveItem(entry.category, entry.item)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <Input
                              value={itemContexts[entry.key] || ''}
                              onChange={(e) => onUpdateItemContext(entry.category, entry.item, e.target.value)}
                              placeholder="Add context (e.g., 0.5 mg, morning, with food...)"
                              className="h-7 text-xs rounded-none border-x-0 px-3"
                              data-help-id="context"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
