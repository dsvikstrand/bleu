import { resolvePrimaryChannelFromTags } from '@/lib/channelMapping';

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
  const decisions: GateDecision[] = [];

  const mappedChannel = resolvePrimaryChannelFromTags(input.tagSlugs);
  if (mappedChannel === input.channelSlug || input.channelSlug === 'general') {
    decisions.push({
      gate_id: 'channel_fit',
      outcome: 'pass',
      reason_code: 'FIT_PASS',
      score: 1,
      method_version: 'fit-v1',
    });
  } else {
    decisions.push({
      gate_id: 'channel_fit',
      outcome: 'warn',
      reason_code: 'FIT_AMBIGUOUS',
      score: 0.45,
      method_version: 'fit-v1',
    });
  }

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

  const fullText = `${input.title} ${input.description || ''} ${input.llmReview || ''}`.toLowerCase();
  const safetyBlocked = /\b(kill yourself|self-harm|underage sex|child sex)\b/.test(fullText);
  decisions.push({
    gate_id: 'safety',
    outcome: safetyBlocked ? 'block' : 'pass',
    reason_code: safetyBlocked ? 'SAFETY_FORBIDDEN_TOPIC' : 'SAFETY_PASS',
    score: safetyBlocked ? 0 : 1,
    method_version: 'safety-v1',
  });

  const piiBlocked = /\b\d{3}-\d{2}-\d{4}\b|\b\d{16}\b|\b\d{10,}\b/.test(fullText);
  decisions.push({
    gate_id: 'pii',
    outcome: piiBlocked ? 'block' : 'pass',
    reason_code: piiBlocked ? 'PII_HIGH_SIGNAL' : 'PII_PASS',
    score: piiBlocked ? 0 : 1,
    method_version: 'pii-v1',
  });

  const hasBlock = decisions.some((d) => d.outcome === 'block');
  if (hasBlock) {
    const firstBlock = decisions.find((d) => d.outcome === 'block');
    return {
      decisions,
      aggregate: 'block',
      nextState: 'channel_rejected',
      primaryReason: firstBlock?.reason_code || 'POLICY_BLOCK',
    };
  }

  const hasWarn = decisions.some((d) => d.outcome === 'warn');
  if (hasWarn) {
    const firstWarn = decisions.find((d) => d.outcome === 'warn');
    return {
      decisions,
      aggregate: 'warn',
      nextState: 'candidate_pending_manual_review',
      primaryReason: firstWarn?.reason_code || 'FIT_LOW_CONFIDENCE',
    };
  }

  return {
    decisions,
    aggregate: 'pass',
    nextState: 'candidate_submitted',
    primaryReason: 'ALL_GATES_PASS',
  };
}
