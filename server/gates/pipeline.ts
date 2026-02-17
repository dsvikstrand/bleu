import type { CandidateContext, CandidateGateDecision, Gate } from './types';

export class GatePipeline {
  constructor(private readonly gates: Gate[]) {}

  evaluate(context: CandidateContext) {
    const decisions: CandidateGateDecision[] = this.gates.map((gate) => gate.evaluate(context));

    const hasBlock = decisions.some((decision) => decision.outcome === 'block');
    if (hasBlock) {
      return {
        decisions,
        aggregate: 'block' as const,
        candidateStatus: 'rejected' as const,
        feedState: 'channel_rejected' as const,
        reasonCode: decisions.find((d) => d.outcome === 'block')?.reason_code || 'POLICY_BLOCK',
      };
    }

    const hasWarn = decisions.some((decision) => decision.outcome === 'warn');
    if (hasWarn) {
      return {
        decisions,
        aggregate: 'warn' as const,
        candidateStatus: 'pending_manual_review' as const,
        feedState: 'candidate_pending_manual_review' as const,
        reasonCode: decisions.find((d) => d.outcome === 'warn')?.reason_code || 'FIT_LOW_CONFIDENCE',
      };
    }

    return {
      decisions,
      aggregate: 'pass' as const,
      candidateStatus: 'passed' as const,
      feedState: 'candidate_submitted' as const,
      reasonCode: 'ALL_GATES_PASS',
    };
  }
}
