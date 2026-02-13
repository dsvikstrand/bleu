import { Package, Sparkles, Users } from 'lucide-react';

const STEPS = [
  {
    icon: Package,
    title: 'Pick a Library',
    description: 'Collections of ingredients for any topic—supplements, recipes, routines. Pick one to start building.',
    color: 'bg-primary/10 text-primary',
  },
  {
    icon: Sparkles,
    title: 'Build & Review',
    description: 'Tap items you use, hit Review, and get instant AI feedback on your setup.',
    color: 'bg-accent/15 text-accent-foreground',
  },
  {
    icon: Users,
    title: 'Publish',
    description: "When you're happy with your blueprint, publish it so others can learn from it.",
    color: 'bg-secondary/15 text-secondary-foreground',
  },
];

export function HowItWorks() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">How It Works</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="border border-border/40 px-3 py-4 animate-fade-in"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${step.color}`}>
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
