import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Heart, FileStack } from 'lucide-react';
import type { InventoryListItem } from '@/hooks/useInventories';
import { cn } from '@/lib/utils';
import { isPostableChannelSlug } from '@/lib/channelPostContext';

interface InventoryCardProps {
  inventory: InventoryListItem;
  onLike: (inventoryId: string, liked: boolean) => void;
  linkSearch?: string;
  variant?: 'grid_flat' | 'list_row';
}

export function InventoryCard({ inventory, onLike, linkSearch, variant = 'grid_flat' }: InventoryCardProps) {
  const channelSlug =
    inventory.tags.map((t) => t.slug).find((slug) => isPostableChannelSlug(slug)) || null;

  return (
    <Link
      to={`/inventory/${inventory.id}/build${linkSearch || ''}`}
      className={cn('block group', variant === 'grid_flat' && 'h-full')}
    >
      <div
        className={cn(
          'h-full bg-transparent transition-colors',
          'group-focus-visible:ring-2 group-focus-visible:ring-primary',
          'hover:bg-muted/10',
        )}
      >
        <div className={cn('p-1 flex flex-col h-full', variant === 'grid_flat' ? '' : 'p-0')}>
          {channelSlug && (
            <p className="text-[11px] font-semibold tracking-wide text-foreground/75 mb-1">b/{channelSlug}</p>
          )}
          <h3 className="font-semibold text-lg line-clamp-1 mb-1">{inventory.title}</h3>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-grow">
            {inventory.prompt_inventory}
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1" title="Blueprints using this library">
                <FileStack className="h-3.5 w-3.5" />
                <span>{inventory.blueprint_count}</span>
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-2 ${inventory.user_liked ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onLike(inventory.id, inventory.user_liked);
              }}
              aria-label={inventory.user_liked ? 'Unlike library' : 'Like library'}
            >
              <Heart className={`h-4 w-4 ${inventory.user_liked ? 'fill-current' : ''}`} />
              <span className="ml-1 text-xs">{inventory.likes_count}</span>
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
