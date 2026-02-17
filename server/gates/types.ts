export type GateId = 'channel_fit' | 'quality' | 'safety' | 'pii';
export type GateOutcome = 'pass' | 'warn' | 'block';

export type CandidateContext = {
  title: string;
  llmReview?: string | null;
  channelSlug: string;
  tagSlugs: string[];
  stepCount: number;
};

export type CandidateGateDecision = {
  gate_id: GateId;
  outcome: GateOutcome;
  reason_code: string;
  score?: number;
  method_version?: string;
};

export interface Gate {
  id: GateId;
  evaluate(context: CandidateContext): CandidateGateDecision;
}
