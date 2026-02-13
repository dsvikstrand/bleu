import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function FeedList({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('divide-y divide-border/40', className)}>{children}</div>;
}

export function FeedRowLink({
  className,
  children,
  ...props
}: LinkProps & { className?: string; children: React.ReactNode }) {
  return (
    <Link
      {...props}
      className={cn('block px-3 py-2.5 transition-colors hover:bg-muted/20', className)}
    >
      {children}
    </Link>
  );
}

