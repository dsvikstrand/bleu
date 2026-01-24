import { useParams } from 'react-router-dom';
import { AppHeader } from '@/components/shared/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useInventory } from '@/hooks/useInventories';
import { BlueprintBuilder } from '@/components/blueprint/BlueprintBuilder';

export default function InventoryBuild() {
  const { inventoryId } = useParams();
  const { data: inventory, isLoading } = useInventory(inventoryId);

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
        ) : inventory ? (
          <>
            <section className="space-y-2">
              <h1 className="text-3xl font-semibold">Build a Blueprint</h1>
              <p className="text-muted-foreground">Inventory: {inventory.title}</p>
            </section>
            <BlueprintBuilder inventory={inventory} />
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">Inventory not found.</CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
