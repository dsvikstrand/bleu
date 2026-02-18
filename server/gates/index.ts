import { ChannelFitGate, PiiGate, QualityGate, SafetyGate } from './builtins';
import { GatePipeline } from './pipeline';
import type { CandidateContext, CandidateEvaluationResult, GateMode } from './types';

const pipeline = new GatePipeline([
  new ChannelFitGate(),
  new QualityGate(),
  new SafetyGate(),
  new PiiGate(),
]);

function getGateMode(modeOverride?: GateMode): GateMode {
  if (modeOverride === 'shadow' || modeOverride === 'enforce' || modeOverride === 'bypass') {
    return modeOverride;
  }
  const raw = String(process.env.CHANNEL_GATES_MODE || 'bypass').trim().toLowerCase();
  if (raw === 'shadow') return 'shadow';
  if (raw === 'enforce') return 'enforce';
  return 'bypass';
}

function buildBypassResult(): CandidateEvaluationResult {
  const methodVersion = 'gate-bypass-v1';
  return {
    decisions: [
      { gate_id: 'channel_fit', outcome: 'pass', reason_code: 'EVAL_BYPASSED', score: 1, method_version: methodVersion },
      { gate_id: 'quality', outcome: 'pass', reason_code: 'EVAL_BYPASSED', score: 1, method_version: methodVersion },
      { gate_id: 'safety', outcome: 'pass', reason_code: 'EVAL_BYPASSED', score: 1, method_version: methodVersion },
      { gate_id: 'pii', outcome: 'pass', reason_code: 'EVAL_BYPASSED', score: 1, method_version: methodVersion },
    ],
    aggregate: 'pass',
    candidateStatus: 'passed',
    feedState: 'candidate_submitted',
    reasonCode: 'EVAL_BYPASSED',
    mode: 'bypass',
    diagnosticAggregate: 'pass',
    diagnosticReasonCode: 'EVAL_BYPASSED',
  };
}

export function evaluateCandidateForChannel(
  context: CandidateContext,
  options?: { modeOverride?: GateMode },
): CandidateEvaluationResult {
  const mode = getGateMode(options?.modeOverride);
  if (mode === 'bypass') {
    return buildBypassResult();
  }

  const evaluated = pipeline.evaluate(context);
  if (mode === 'enforce') {
    return {
      ...evaluated,
      mode,
      diagnosticAggregate: evaluated.aggregate,
      diagnosticReasonCode: evaluated.reasonCode,
    };
  }

  return {
    decisions: evaluated.decisions,
    aggregate: 'pass',
    candidateStatus: 'passed',
    feedState: 'candidate_submitted',
    reasonCode: evaluated.aggregate === 'pass' ? 'ALL_GATES_PASS' : `SHADOW_${evaluated.reasonCode}`,
    mode,
    diagnosticAggregate: evaluated.aggregate,
    diagnosticReasonCode: evaluated.reasonCode,
  };
}
