import { ChannelFitGate, PiiGate, QualityGate, SafetyGate } from './builtins';
import { GatePipeline } from './pipeline';
import type { CandidateContext } from './types';

const pipeline = new GatePipeline([
  new ChannelFitGate(),
  new QualityGate(),
  new SafetyGate(),
  new PiiGate(),
]);

export function evaluateCandidateForChannel(context: CandidateContext) {
  return pipeline.evaluate(context);
}
