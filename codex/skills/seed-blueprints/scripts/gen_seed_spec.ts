#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { loadPersonaV0, type PersonaV0 } from './lib/persona_v0';
import { composePromptPackV0 } from './lib/prompt_pack_v0';

function die(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function usage(): string {
  return [
    'gen_seed_spec.ts',
    '',
    'Generate a seed spec JSON deterministically (no LLM).',
    '',
    'Usage:',
    '  TMPDIR=/tmp npx -y tsx ./codex/skills/seed-blueprints/scripts/gen_seed_spec.ts \\',
    '    --goal "Simple home skincare routine for beginners" \\',
    '    --persona skincare_diet_female_v0 \\',
    '    --blueprints 2 \\',
    '    --out seed/seed_spec_generated.local',
    '',
    'Flags:',
    '  --goal <text>         Required. High-level intent for what to build.',
    '  --persona <id>        Optional. Persona id under personas/v0.',
    '  --blueprints <n>      Optional. Number of blueprint variants (default: 2).',
    '  --out <path>          Optional. Output JSON path (default: seed/seed_spec_generated.local).',
    '  --run-id <id>         Optional. Spec run_id (default: gen-<timestamp>).',
    '  --help                Show help',
  ].join('\n');
}

function parseArgs(argv: string[]) {
  const out: Record<string, string | number | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--goal') out.goal = argv[++i] ?? '';
    else if (a === '--persona') out.persona = argv[++i] ?? '';
    else if (a === '--blueprints') out.blueprints = Number(argv[++i] ?? 0);
    else if (a === '--out') out.out = argv[++i] ?? '';
    else if (a === '--run-id') out.runId = argv[++i] ?? '';
    else if (a.startsWith('--')) die(`Unknown flag: ${a}`);
  }
  return out;
}

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes()
  )}${pad(d.getUTCSeconds())}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage() + '\n');
    return;
  }

  const goal = String(args.goal || '').trim();
  if (!goal) die('Missing required flag: --goal "<text>"');

  const personaId = String(args.persona || '').trim();
  const p = personaId ? loadPersonaV0(personaId).persona : null;

  const blueprintCount = Math.max(1, Number(args.blueprints || 0) || 2);
  const outPath = String(args.out || 'seed/seed_spec_generated.local');
  const runId = String(args.runId || `gen-${nowStamp()}`).trim();

  const pack = composePromptPackV0({ runType: 'seed', goal, persona: p as PersonaV0 | null, blueprintCount });

  const spec = {
    run_id: runId,
    ...(personaId ? { asp: { id: personaId } } : {}),
    library: pack.library,
    blueprints: pack.blueprints,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(spec, null, 2) + '\n', 'utf-8');
  process.stdout.write(`Wrote ${outPath}\n`);
}

main().catch((e) => {
  const err = e instanceof Error ? e : new Error(String(e));
  die(err.message);
});
