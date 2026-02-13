import { cn } from '@/lib/utils';

export function PageRoot({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('min-h-screen bg-background', className)}>{children}</div>;
}

export function PageMain({
  className,
  children,
  padBottom = true,
}: {
  className?: string;
  children: React.ReactNode;
  padBottom?: boolean;
}) {
  return (
    <main className={cn('max-w-3xl mx-auto px-3 sm:px-4 py-6', padBottom && 'pb-24', className)}>
      {children}
    </main>
  );
}

export function PageSection({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn('space-y-3', className)}>{children}</section>;
}

export function PageDivider({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-border/40', className)} />;
}

