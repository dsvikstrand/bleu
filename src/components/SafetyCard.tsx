import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SafetyFlags, CaffeineTolerance, SleepSensitivity } from '@/types/stacklab';

interface SafetyCardProps {
  safetyFlags: SafetyFlags;
  onUpdate: (flags: Partial<SafetyFlags>) => void;
}

export function SafetyCard({ safetyFlags, onUpdate }: SafetyCardProps) {
  const hasWarnings =
    safetyFlags.takesMedications ||
    safetyFlags.pregnantOrBreastfeeding ||
    safetyFlags.bloodPressureConcerns;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          Safety Profile
          {hasWarnings && <AlertTriangle className="h-4 w-4 text-warning" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {/* Toggle switches */}
          <div className="flex items-center justify-between">
            <Label htmlFor="medications" className="text-sm cursor-pointer">
              I take prescription medications
            </Label>
            <Switch
              id="medications"
              checked={safetyFlags.takesMedications}
              onCheckedChange={(v) => onUpdate({ takesMedications: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="pregnant" className="text-sm cursor-pointer">
              Pregnant or breastfeeding
            </Label>
            <Switch
              id="pregnant"
              checked={safetyFlags.pregnantOrBreastfeeding}
              onCheckedChange={(v) => onUpdate({ pregnantOrBreastfeeding: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="bp" className="text-sm cursor-pointer">
              Blood pressure concerns
            </Label>
            <Switch
              id="bp"
              checked={safetyFlags.bloodPressureConcerns}
              onCheckedChange={(v) => onUpdate({ bloodPressureConcerns: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="anxiety" className="text-sm cursor-pointer">
              Anxiety/panic sensitivity
            </Label>
            <Switch
              id="anxiety"
              checked={safetyFlags.anxietySensitivity}
              onCheckedChange={(v) => onUpdate({ anxietySensitivity: v })}
            />
          </div>

          {/* Dropdowns */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Caffeine tolerance</Label>
            <Select
              value={safetyFlags.caffeineTolerance}
              onValueChange={(v) => onUpdate({ caffeineTolerance: v as CaffeineTolerance })}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm">Sleep sensitivity</Label>
            <Select
              value={safetyFlags.sleepSensitivity}
              onValueChange={(v) => onUpdate({ sleepSensitivity: v as SleepSensitivity })}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Alert className="bg-muted/50 border-muted">
          <AlertDescription className="text-xs text-muted-foreground">
            <strong>Disclaimer:</strong> This is educational content only, not medical advice.
            Always consult a healthcare provider before starting supplements, especially if you
            have medical conditions, take medications, or are pregnant/breastfeeding.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
