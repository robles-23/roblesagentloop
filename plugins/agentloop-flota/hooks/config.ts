import type { Role } from './ascii'
export const defaults = {
  executor: 'gpt-6.1-sol', reviewer: 'gpt-6-luna', criticalReviewer: 'gpt-6-astra',
  maxRounds: 3, staleMinutes: 30, worktreeRoot: '.agentloop-worktrees',
}
export function parseConfig(text?: string) {
  const value = { ...defaults, ...(text ? JSON.parse(text.replace(/^\uFEFF/, '')) : {}) }
  if (!Number.isInteger(value.staleMinutes) || value.staleMinutes < 1) throw new Error('staleMinutes no válido')
  return value as typeof defaults
}
export function runRole(state: string, critical: boolean): Role {
  if (state === 'gates') return 'checks'
  if (state === 'reviewing') return critical ? 'criticalReviewer' : 'reviewer'
  return 'executor'
}
