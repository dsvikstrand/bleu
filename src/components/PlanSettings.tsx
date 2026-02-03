import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Settings, DoseStrength, FrequencyUnit } from '@/types/stacklab';

interface PlanSettingsProps {
  settings: Settings;
  onUpdate: (updates: Partial<Settings>) => void;
}

const DOSE_DESCRIPTIONS: Record<DoseStrength, string> = {
  low: 'Conservative, beginner-friendly',
  medium: 'Standard evidence-based',
  high: 'Stronger, experimental',
};

export function PlanSettings({ settings, onUpdate }: PlanSettingsProps) {
  const { doseStrength, frequencyN, frequencyUnit } = settings;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Plan Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Dose Strength */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Dose Strength</Label>
          <ToggleGroup
            type="single"
            value={doseStrength}
            onValueChange={(v) => v && onUpdate({ doseStrength: v as DoseStrength })}
            className="justify-start"
          >
            {(['low', 'medium', 'high'] as DoseStrength[]).map((level) => (
              <ToggleGroupItem
                key={level}
                value={level}
                className="capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {level}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">{DOSE_DESCRIPTIONS[doseStrength]}</p>
        </div>

        {/* Frequency */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Plan Frequency</Label>
          <div className="flex items-center gap-2">
            <Select
              value={String(frequencyN)}
              onValueChange={(v) => onUpdate({ frequencyN: parseInt(v) })}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">times per</span>
            <Select
              value={frequencyUnit}
              onValueChange={(v) => onUpdate({ frequencyUnit: v as FrequencyUnit })}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {frequencyUnit === 'day'
              ? 'You\'ll get Day A / Day B alternating templates'
              : 'You\'ll get a weekly schedule showing which days to take each stack'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
