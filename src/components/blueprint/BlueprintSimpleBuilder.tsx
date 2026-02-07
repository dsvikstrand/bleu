import { BlueprintItemPicker } from '@/components/blueprint/BlueprintItemPicker';
import { BlueprintRecipeAccordion } from '@/components/blueprint/BlueprintRecipeAccordion';

interface InventoryCategory {
  name: string;
  items: string[];
}

interface BlueprintSimpleBuilderProps {
  categories: InventoryCategory[];
  selectedItems: Record<string, string[]>;
  itemContexts: Record<string, string>;
  onToggleItem: (categoryName: string, item: string) => void;
  onAddCustomItem: (categoryName: string, item: string) => void;
  onRemoveItem: (categoryName: string, item: string) => void;
  onUpdateItemContext: (categoryName: string, item: string, context: string) => void;
  onClear: () => void;
  selectionTitle?: string;
}

export function BlueprintSimpleBuilder({
  categories,
  selectedItems,
  itemContexts,
  onToggleItem,
  onAddCustomItem,
  onRemoveItem,
  onUpdateItemContext,
  onClear,
  selectionTitle = 'Build Blueprint',
}: BlueprintSimpleBuilderProps) {
  return (
    <div className="space-y-4">
      <BlueprintItemPicker
        categories={categories}
        selectedItems={selectedItems}
        onToggleItem={onToggleItem}
        onAddCustomItem={onAddCustomItem}
      />

      <BlueprintRecipeAccordion
        title={selectionTitle}
        selectedItems={selectedItems}
        itemContexts={itemContexts}
        onRemoveItem={onRemoveItem}
        onUpdateContext={onUpdateItemContext}
        onClear={onClear}
      />
    </div>
  );
}

