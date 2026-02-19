import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { logMvpEvent } from '@/lib/logEvent';

interface RuntimeConfigErrorProps {
  missingKeys: string[];
}

export function RuntimeConfigError({ missingKeys }: RuntimeConfigErrorProps) {
  useEffect(() => {
    void logMvpEvent({
      eventName: 'landing_runtime_config_error_view',
      path: window.location.pathname,
      metadata: {
        missing_keys: missingKeys,
      },
    });
  }, [missingKeys]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-xl border border-border/40 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-destructive/10 p-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">App configuration required</h1>
            <p className="text-sm text-muted-foreground">
              This build is missing required frontend environment values, so the app cannot connect to Supabase yet.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Missing keys</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            {missingKeys.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">
          Set these values in your deployment environment and redeploy. For local dev, add them to `.env`.
        </div>
      </div>
    </div>
  );
}
