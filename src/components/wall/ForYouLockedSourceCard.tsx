import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRelativeShort } from '@/lib/timeFormat';

type ForYouLockedSourceCardProps = {
  title: string;
  sourceChannelTitle: string | null;
  createdAt: string;
  sourceUrl: string | null;
  unlockCost: number;
  isUnlocking: boolean;
  onUnlock: () => void;
};

export function ForYouLockedSourceCard({
  title,
  sourceChannelTitle,
  createdAt,
  sourceUrl,
  unlockCost,
  isUnlocking,
  onUnlock,
}: ForYouLockedSourceCardProps) {
  return (
    <div className="px-3 py-2.5 transition-colors hover:bg-muted/20">
      <div className="relative overflow-hidden rounded-md border border-border/40 bg-muted/20">
        <div className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold tracking-wide text-foreground/75">
                {sourceChannelTitle || 'Subscribed source'}
              </p>
              <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">{formatRelativeShort(createdAt)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{isUnlocking ? 'Unlocking...' : 'Unlock available'}</Badge>
            <span className="text-xs text-muted-foreground">Cost {unlockCost.toFixed(3)} cr</span>
            <Button size="sm" onClick={onUnlock} disabled={isUnlocking}>
              {isUnlocking ? 'Unlocking...' : 'Unlock blueprint'}
            </Button>
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground underline underline-offset-2"
              >
                Open source
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
