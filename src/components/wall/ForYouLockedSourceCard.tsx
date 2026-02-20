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
    <div className="px-3 py-2 transition-colors hover:bg-muted/20">
      <div className="relative overflow-hidden rounded-lg border border-border/50 bg-background/80 shadow-sm">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/50 via-primary/10 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />

        <div className="relative p-3.5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/70">
                {sourceChannelTitle || 'Subscribed source'}
              </p>
              <h3 className="text-sm font-semibold leading-snug line-clamp-2">{title}</h3>
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">{formatRelativeShort(createdAt)}</span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="secondary"
                className="h-6 rounded-full border border-primary/20 bg-primary/10 px-2.5 text-[11px] font-medium text-primary"
              >
                {isUnlocking ? 'Unlocking...' : 'Unlock available'}
              </Badge>
              <span className="inline-flex h-6 items-center rounded-full border border-border/60 bg-muted/40 px-2.5 text-[11px] text-muted-foreground">
                Cost {unlockCost.toFixed(3)} cr
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 px-2.5" onClick={onUnlock} disabled={isUnlocking}>
                {isUnlocking ? 'Unlocking...' : 'Unlock blueprint'}
              </Button>
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-muted-foreground underline underline-offset-2"
                >
                  Open source
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
