export type GateId = 'channel_fit' | 'quality' | 'safety' | 'pii';
export type GateOutcome = 'pass' | 'warn' | 'block';
export type GateMode = 'bypass' | 'shadow' | 'enforce';

export type CandidateContext = {
  title: string;
  llmReview?: string | null;
  channelSlug: string;
  tagSlugs: string[];
  stepCount: number;
  classificationMode?: 'deterministic_v1' | 'general_placeholder' | 'llm_labeler_v1';
};

export type CandidateGateDecision = {
  gate_id: GateId;
  outcome: GateOutcome;
  reason_code: string;
  score?: number;
  method_version?: string;
};

export type CandidateStatus = 'passed' | 'pending_manual_review' | 'rejected';
export type CandidateFeedState = 'candidate_submitted' | 'candidate_pending_manual_review' | 'channel_rejected';

export type CandidateEvaluationResult = {
  decisions: CandidateGateDecision[];
  aggregate: GateOutcome;
  candidateStatus: CandidateStatus;
  feedState: CandidateFeedState;
  reasonCode: string;
  mode: GateMode;
  diagnosticAggregate?: GateOutcome;
  diagnosticReasonCode?: string;
};

export interface Gate {
  id: GateId;
  evaluate(context: CandidateContext): CandidateGateDecision;
}
