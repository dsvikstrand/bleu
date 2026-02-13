import { cn } from '@/lib/utils';

export function WallToWallGrid<T>({
  items,
  className,
  renderItem,
}: {
  items: T[];
  className?: string;
  renderItem: (item: T, info: { index: number }) => React.ReactNode;
}) {
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

