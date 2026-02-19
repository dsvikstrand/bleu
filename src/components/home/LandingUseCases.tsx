import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { LANDING_USE_CASES } from '@/lib/landingFallbacks';

interface LandingUseCasesProps {
  onSelect?: (useCaseId: string) => void;
}

export function LandingUseCases({ onSelect }: LandingUseCasesProps) {
  return (
    <section className="space-y-4 animate-fade-in">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Why people use this</h2>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Convert long videos into practical, reusable steps so you can act faster and skip repetitive rewatching.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {LANDING_USE_CASES.map((entry) => (
          <Link
            key={entry.id}
            to={entry.href}
            onClick={() => onSelect?.(entry.id)}
            className="group"
          >
            <Card className="h-full border-border/40 transition-colors hover:bg-muted/20">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{entry.title}</h3>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{entry.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3 text-sm">
        <div className="border border-border/40 rounded-md px-3 py-2 text-muted-foreground">
          Save time by skipping replay loops.
        </div>
        <div className="border border-border/40 rounded-md px-3 py-2 text-muted-foreground">
          Extract clear steps from long-form videos.
        </div>
        <div className="border border-border/40 rounded-md px-3 py-2 text-muted-foreground">
          Reuse and share useful playbooks in Home.
        </div>
      </div>
    </section>
  );
}
