import { describe, expect, it } from 'vitest';
import { ChannelFitGate } from '../../server/gates/builtins';

describe('ChannelFitGate deterministic alignment (backend)', () => {
  it('passes when channel matches deterministic classifier output', () => {
    const gate = new ChannelFitGate();
    const result = gate.evaluate({
      title: 'Meal prep basics',
      llmReview: null,
      channelSlug: 'nutrition-meal-planning',
      tagSlugs: ['shake'],
      stepCount: 4,
    });

    expect(result.outcome).toBe('pass');
    expect(result.reason_code).toBe('FIT_PASS');
  });

  it('warns when selected channel differs from deterministic result', () => {
    const gate = new ChannelFitGate();
    const result = gate.evaluate({
      title: 'Meal prep basics',
      llmReview: null,
      channelSlug: 'general',
      tagSlugs: ['shake'],
      stepCount: 4,
    });

    expect(result.outcome).toBe('warn');
    expect(result.reason_code).toBe('FIT_AMBIGUOUS');
  });

  it('passes by design for llm labeler classification mode', () => {
    const gate = new ChannelFitGate();
    const result = gate.evaluate({
      title: 'LLM quantization guide',
      llmReview: 'Overview of 4-bit quantization and deployment pitfalls.',
      channelSlug: 'general',
      tagSlugs: ['unknown-tag'],
      stepCount: 4,
      classificationMode: 'llm_labeler_v1',
    });

    expect(result.outcome).toBe('pass');
    expect(result.reason_code).toBe('FIT_LLM_LABEL_PASS');
  });
});
