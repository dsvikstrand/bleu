export type GateId = 'channel_fit' | 'quality' | 'safety' | 'pii';
export type GateOutcome = 'pass' | 'warn' | 'block';
type GateMode = 'bypass' | 'shadow' | 'enforce';

export type GateDecision = {
  gate_id: GateId;
  outcome: GateOutcome;
  reason_code: string;
  score?: number;
  method_version?: string;
};

function getGateMode(): GateMode {
  const raw = String(import.meta.env.VITE_CHANNEL_GATES_MODE || 'bypass').trim().toLowerCase();
  if (raw === 'shadow') return 'shadow';
  if (raw === 'enforce') return 'enforce';
  return 'bypass';
}

function evaluateRealGates(input: {
  title: string;
  llmReview?: string | null;
  stepCount: number;
  tagSlugs: string[];
  channelSlug: string;
}) {
  const normalizedTags = input.tagSlugs.map((tag) => tag.toLowerCase());
  const channelToken = input.channelSlug.toLowerCase();
  const fullText = `${input.title} ${input.llmReview || ''}`.toLowerCase();

  const decisions: GateDecision[] = [];

  decisions.push(
    channelToken === 'general' || normalizedTags.includes(channelToken)
      ? {
          gate_id: 'channel_fit',
          outcome: 'pass',
          reason_code: 'FIT_PASS',
          score: 1,
          method_version: 'fit-v1',
        }
      : {
          gate_id: 'channel_fit',
          outcome: 'warn',
          reason_code: 'FIT_AMBIGUOUS',
          score: 0.45,
          method_version: 'fit-v1',
        }
  );

  if (input.stepCount >= 3) {
    decisions.push({
      gate_id: 'quality',
      outcome: 'pass',
      reason_code: 'QUALITY_PASS',
      score: Math.min(1, input.stepCount / 6),
      method_version: 'quality-v1',
    });
  } else if (input.stepCount >= 1) {
    decisions.push({
      gate_id: 'quality',
      outcome: 'warn',
      reason_code: 'QUALITY_TOO_SHALLOW',
      score: 0.4,
      method_version: 'quality-v1',
    });
  } else {
    decisions.push({
      gate_id: 'quality',
      outcome: 'block',
      reason_code: 'QUALITY_STRUCTURE_FAIL',
      score: 0,
      method_version: 'quality-v1',
    });
  }

  decisions.push({
    gate_id: 'safety',
    outcome: /\b(kill yourself|self-harm|underage sex|child sex)\b/.test(fullText) ? 'block' : 'pass',
    reason_code: /\b(kill yourself|self-harm|underage sex|child sex)\b/.test(fullText) ? 'SAFETY_FORBIDDEN_TOPIC' : 'SAFETY_PASS',
    score: /\b(kill yourself|self-harm|underage sex|child sex)\b/.test(fullText) ? 0 : 1,
    method_version: 'safety-v1',
  });

  decisions.push({
    gate_id: 'pii',
    outcome: /\b\d{3}-\d{2}-\d{4}\b|\b\d{16}\b|\b\d{10,}\b/.test(fullText) ? 'block' : 'pass',
    reason_code: /\b\d{3}-\d{2}-\d{4}\b|\b\d{16}\b|\b\d{10,}\b/.test(fullText) ? 'PII_HIGH_SIGNAL' : 'PII_PASS',
    score: /\b\d{3}-\d{2}-\d{4}\b|\b\d{16}\b|\b\d{10,}\b/.test(fullText) ? 0 : 1,
    method_version: 'pii-v1',
  });

  const blockDecision = decisions.find((d) => d.outcome === 'block');
  if (blockDecision) {
    return {
      decisions,
      aggregate: 'block' as const,
      nextState: 'channel_rejected' as const,
      primaryReason: blockDecision.reason_code,
    };
  }

  const warnDecision = decisions.find((d) => d.outcome === 'warn');
  if (warnDecision) {
    return {
      decisions,
      aggregate: 'warn' as const,
      nextState: 'candidate_pending_manual_review' as const,
      primaryReason: warnDecision.reason_code,
    };
  }

  return {
    decisions,
    aggregate: 'pass' as const,
    nextState: 'candidate_submitted' as const,
    primaryReason: 'ALL_GATES_PASS',
  };
}

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
  const mode = getGateMode();
  if (mode === 'bypass') {
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

  const evaluated = evaluateRealGates(input);
  if (mode === 'enforce') {
    return evaluated;
  }

  return {
    decisions: evaluated.decisions,
    aggregate: 'pass',
    nextState: 'candidate_submitted',
    primaryReason: evaluated.aggregate === 'pass' ? 'ALL_GATES_PASS' : `SHADOW_${evaluated.primaryReason}`,
  };
}
