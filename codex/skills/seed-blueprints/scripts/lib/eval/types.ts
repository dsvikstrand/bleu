import type { PersonaV0 } from '../persona_v0';

export type EvalControlsTaxonomyV1 = {
  version: 1;
  domain: {
    allowCustom: boolean;
    values: Array<{ id: string; label?: string }>;
  };
  audience: {
    values: Array<{ id: string; label?: string; expects?: string[] }>;
  };
  style: {
    values: Array<{ id: string; label?: string; expects?: string[] }>;
  };
  strictness: {
    values: Array<{ id: string; label?: string; expects?: string[] }>;
  };
  length_hint: {
    values: Array<{ id: string; label?: string; expects?: string[] }>;
  };
};

export type EvalBoundsInventoryV0 = {
  version: 0;
  maxCategories: number;
  maxCategoryNameLen: number;
  maxItemsPerCategory: number;
  maxItemNameLen: number;
};

export type EvalBoundsBlueprintsV0 = {
  version: 0;
  maxSteps: number;
  maxStepTitleLen: number;
  maxStepDescriptionLen: number;
  maxItemsPerStep: number;
};

export type EvalBoundsPromptPackV0 = {
  version: 0;
  maxGoalLen: number;
  maxTitleLen: number;
  maxDescriptionLen: number;
  maxNotesLen: number;
  maxTags: number;
  maxTagLen: number;
  maxBlueprints: number;
};

export type EvalBoundsControlPackV0 = {
  version: 0;
  maxGoalLen: number;
  maxNameLen: number;
  maxNotesLen: number;
  maxTags: number;
  maxTagLen: number;
  maxBlueprints: number;
};

export type EvalBoundsV0 = {
  version: 0;
  inventory: EvalBoundsInventoryV0;
  blueprints: EvalBoundsBlueprintsV0;
  prompt_pack: EvalBoundsPromptPackV0;
  control_pack: EvalBoundsControlPackV0;
};

export type EvalSeverity = 'info' | 'warn' | 'hard_fail';

export type EvalResult = {
  gate_id: string;
  ok: boolean;
  severity: EvalSeverity;
  score: number;
  reason: string;
  data?: Record<string, unknown>;
};

export type UnknownEvalPolicy = 'hard_fail' | 'warn' | 'skip';

export type EvalContext = {
  run_id: string;
  node_id: string;
  run_type: string;
  attempt: number;
  candidate: number;
  persona: PersonaV0 | null;
  mode: 'seed' | 'user';
  domain_id: string | null;
  controls_taxonomy: EvalControlsTaxonomyV1 | null;
  bounds: EvalBoundsV0 | null;
};

export type EvalClass<Input = unknown, Params = Record<string, unknown>> = {
  id: string;
  run: (input: Input, params: Params, ctx: EvalContext) => EvalResult;
};

export type EvalInstance = {
  eval_id: string;
  params?: Record<string, unknown>;
  severity?: EvalSeverity;
  score_weight?: number;
  retry_budget?: number;
};

export type AssEvalConfigV2 = {
  version: 2;
  unknown_eval_policy?: UnknownEvalPolicy;
  nodes: Record<
    string,
    {
      evals: EvalInstance[];
    }
  >;
};
