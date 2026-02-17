export type GateId = 'channel_fit' | 'quality' | 'safety' | 'pii';
export type GateOutcome = 'pass' | 'warn' | 'block';

export type GateDecision = {
  gate_id: GateId;
  outcome: GateOutcome;
  reason_code: string;
  score?: number;
  method_version?: string;
};

export function evaluateCandidateGates(input: {
  title: string;
  description?: string | null;
  llmReview?: string | null;
  stepCount: number;
  tagSlugs: string[];
  channelSlug: string;
}): {
  decisions: GateDecision[];
  aggregate: 'pass' | 'warn' | 'block';
  nextState: 'candidate_submitted' | 'candidate_pending_manual_review' | 'channel_rejected';
  primaryReason: string;
} {
  void input;
  const methodVersion = 'gate-bypass-v1';
  const decisions: GateDecision[] = [
    { gate_id: 'channel_fit', outcome: 'pass', reason_code: 'EVAL_BYPASSED', score: 1, method_version: methodVersion },
    { gate_id: 'quality', outcome: 'pass', reason_code: 'EVAL_BYPASSED', score: 1, method_version: methodVersion },
    { gate_id: 'safety', outcome: 'pass', reason_code: 'EVAL_BYPASSED', score: 1, method_version: methodVersion },
    { gate_id: 'pii', outcome: 'pass', reason_code: 'EVAL_BYPASSED', score: 1, method_version: methodVersion },
  ];
  return {
    decisions,
    aggregate: 'pass',
    nextState: 'candidate_submitted',
    primaryReason: 'EVAL_BYPASSED',
  };
}
