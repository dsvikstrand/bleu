import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DoseUnit, DEFAULT_DOSES } from '@/types/stacklab';

interface BlendDoseModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number, unit: DoseUnit) => void;
  supplementId: string;
  supplementName: string;
}

const UNITS: DoseUnit[] = ['mg', 'g', 'mcg', 'IU', 'ml', 'scoop'];

export function BlendDoseModal({
  open,
  onClose,
  onConfirm,
  supplementId,
  supplementName,
}: BlendDoseModalProps) {
  const defaultDose = DEFAULT_DOSES[supplementId] || { amount: 100, unit: 'mg' as DoseUnit };
  const [amount, setAmount] = useState(defaultDose.amount);
  const [unit, setUnit] = useState<DoseUnit>(defaultDose.unit);

  // Reset to defaults when supplement changes
  useEffect(() => {
    const dose = DEFAULT_DOSES[supplementId] || { amount: 100, unit: 'mg' as DoseUnit };
    setAmount(dose.amount);
    setUnit(dose.unit);
  }, [supplementId]);

  const handleConfirm = () => {
    if (amount > 0) {
      onConfirm(amount, unit);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {supplementName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="flex-1"
              />
              <Select value={unit} onValueChange={(v) => setUnit(v as DoseUnit)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Common dose pre-filled based on typical usage. Adjust as needed.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={amount <= 0}>
            Add to Blend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
