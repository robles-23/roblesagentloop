import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const defaults = Object.freeze({
  executor: 'gpt-6.1-sol', reviewer: 'gpt-6-luna', criticalReviewer: 'gpt-6-astra',
  maxRounds: 3, staleMinutes: 30, worktreeRoot: '.agentloop-worktrees',
  contextFile: 'docs/specification.md', gates: [], infrastructure: [],
});

export function readConfig(root) {
  const file = join(root, 'agentloop.config.json');
  const config = { ...defaults, ...(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : {}) };
  for (const k of ['maxRounds', 'staleMinutes']) {
    if (!Number.isInteger(config[k]) || config[k] < 1) throw new Error(`${k} debe ser un entero positivo`);
  }
  for (const k of ['executor', 'reviewer', 'criticalReviewer', 'worktreeRoot', 'contextFile']) {
    if (typeof config[k] !== 'string' || !config[k].trim()) throw new Error(`${k} no válido`);
  }
  return config;
}
