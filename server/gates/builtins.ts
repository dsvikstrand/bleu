import type { CandidateContext, CandidateGateDecision, Gate } from './types';
import { getChannelResolutionMeta } from '../services/deterministicChannelClassifier';

export class ChannelFitGate implements Gate {
  id = 'channel_fit' as const;

  evaluate(context: CandidateContext): CandidateGateDecision {
    if (context.classificationMode === 'llm_labeler_v1') {
      return {
        gate_id: this.id,
        outcome: 'pass',
        reason_code: 'FIT_LLM_LABEL_PASS',
        score: 1,
        method_version: 'fit-v3',
      };
    }

    const channelToken = context.channelSlug.toLowerCase();
    const fallbackSlug = String(process.env.AUTO_CHANNEL_FALLBACK_SLUG || 'general').trim().toLowerCase() || 'general';
    const resolved = getChannelResolutionMeta({
      tagSlugs: context.tagSlugs,
      fallbackSlug,
    });

    if (channelToken === resolved.resolvedSlug) {
      return {
        gate_id: this.id,
        outcome: 'pass',
        reason_code: 'FIT_PASS',
        score: 1,
        method_version: 'fit-v2',
      };
    }

    return {
      gate_id: this.id,
      outcome: 'warn',
      reason_code: 'FIT_AMBIGUOUS',
      score: 0.45,
      method_version: 'fit-v2',
    };
  }
}

export class QualityGate implements Gate {
  id = 'quality' as const;

  evaluate(context: CandidateContext): CandidateGateDecision {
    if (context.stepCount >= 3) {
      return {
        gate_id: this.id,
        outcome: 'pass',
        reason_code: 'QUALITY_PASS',
        score: Math.min(1, context.stepCount / 6),
        method_version: 'quality-v1',
      };
    }

    if (context.stepCount >= 1) {
      return {
        gate_id: this.id,
        outcome: 'warn',
        reason_code: 'QUALITY_TOO_SHALLOW',
        score: 0.4,
        method_version: 'quality-v1',
      };
    }

    return {
      gate_id: this.id,
      outcome: 'block',
      reason_code: 'QUALITY_STRUCTURE_FAIL',
      score: 0,
      method_version: 'quality-v1',
    };
  }
}

export class SafetyGate implements Gate {
  id = 'safety' as const;

  evaluate(context: CandidateContext): CandidateGateDecision {
    const fullText = `${context.title} ${context.llmReview || ''}`.toLowerCase();
    const safetyBlocked = /\b(kill yourself|self-harm|underage sex|child sex)\b/.test(fullText);

    return {
      gate_id: this.id,
      outcome: safetyBlocked ? 'block' : 'pass',
      reason_code: safetyBlocked ? 'SAFETY_FORBIDDEN_TOPIC' : 'SAFETY_PASS',
      score: safetyBlocked ? 0 : 1,
      method_version: 'safety-v1',
    };
  }
}

export class PiiGate implements Gate {
  id = 'pii' as const;

  evaluate(context: CandidateContext): CandidateGateDecision {
    const fullText = `${context.title} ${context.llmReview || ''}`.toLowerCase();
    const piiBlocked = /\b\d{3}-\d{2}-\d{4}\b|\b\d{16}\b|\b\d{10,}\b/.test(fullText);

    return {
      gate_id: this.id,
      outcome: piiBlocked ? 'block' : 'pass',
      reason_code: piiBlocked ? 'PII_HIGH_SIGNAL' : 'PII_PASS',
      score: piiBlocked ? 0 : 1,
      method_version: 'pii-v1',
    };
  }
}
