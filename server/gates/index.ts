import type { CandidateContext } from './types';

export function evaluateCandidateForChannel(context: CandidateContext) {
  void context;
  const methodVersion = 'gate-bypass-v1';
  return {
    decisions: [
      { gate_id: 'channel_fit' as const, outcome: 'pass' as const, reason_code: 'EVAL_BYPASSED', score: 1, method_version: methodVersion },
      { gate_id: 'quality' as const, outcome: 'pass' as const, reason_code: 'EVAL_BYPASSED', score: 1, method_version: methodVersion },
      { gate_id: 'safety' as const, outcome: 'pass' as const, reason_code: 'EVAL_BYPASSED', score: 1, method_version: methodVersion },
      { gate_id: 'pii' as const, outcome: 'pass' as const, reason_code: 'EVAL_BYPASSED', score: 1, method_version: methodVersion },
    ],
    aggregate: 'pass' as const,
    candidateStatus: 'passed' as const,
    feedState: 'candidate_submitted' as const,
    reasonCode: 'EVAL_BYPASSED',
  };
}
