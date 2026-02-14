import { cn } from '@/lib/utils';

export function WallToWallGrid<T>({
  items,
  className,
  variant = 'table',
  renderItem,
}: {
  items: T[];
  className?: string;
  variant?: 'table' | 'tiles';
  renderItem: (item: T, info: { index: number }) => React.ReactNode;
}) {
  if (variant === 'tiles') {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-2', className)}>
        {items.map((item, index) => (
          <div
            key={index}
            className="border border-border/40 rounded-md p-3 hover:bg-muted/10 transition-colors"
          >
            {renderItem(item, { index })}
          </div>
        ))}
      </div>
    );
  }

  const len = items.length;
  const lastRowStart = len <= 1 ? 0 : Math.floor((len - 1) / 2) * 2;

  return (
    <div className={cn('border border-border/40', className)}>
      <div className="grid grid-cols-1 md:grid-cols-2">
        {items.map((item, index) => {
          const isLastMobile = index === len - 1;
          const isLastRowDesktop = index >= lastRowStart;
          const isLeftColDesktop = index % 2 === 0;

          return (
            <div
              key={index}
              className={cn(
                'px-3 py-3',
                !isLastMobile && 'border-b border-border/40',
                !isLastRowDesktop && 'md:border-b md:border-border/40',
                isLeftColDesktop && 'md:border-r md:border-border/40',
              )}
            >
              {renderItem(item, { index })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
