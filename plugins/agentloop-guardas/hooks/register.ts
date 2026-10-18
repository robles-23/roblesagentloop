import type { EngineInterface, Register, ToolCallResult } from 'claude-code'
import { boardLine, encodingProblem, hostProblem } from './rules'
import type { HostPolicy } from './rules'
async function policy($: EngineInterface): Promise<HostPolicy & { claudeModel?: string }> {
  if (!(await $.fs.exists('agentloop.config.json'))) return {}
  const value = JSON.parse((await $.fs.read('agentloop.config.json')).replace(/^\uFEFF/, ''))
  return value.guardas ?? {}
}
async function refreshBoard($: EngineInterface) {
  try {
    const { exitCode, stdout } = await $.process.run(['node', 'scripts/agent/board.mjs', '--brief'], { timeoutMs: 10000 })
    if (exitCode === 0) $.ui.status(boardLine(stdout))
  } catch { /* Un proyecto sin tablero no necesita línea de estado. */ }
}
async function shell($: EngineInterface, command: string, ps: boolean, run: () => Promise<ToolCallResult>): Promise<ToolCallResult> {
  const problem = hostProblem(command, await policy($)) ?? (ps ? encodingProblem(command) : undefined)
  if (problem) return { deny: `agentloop-guardas: ${problem}` }
  const result = await run()
  if (/run-task|merge-task/.test(command)) void refreshBoard($)
  return result
}
const failed = 'agentloop-guardas: no se pudo comprobar la regla; revisa la configuración.'
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e); void refreshBoard($); return result
  })
  on('tool.call', { tool: 'Bash' }, ($, e, next) => shell($, e.command, false, () => next(e)))
    .catch(($, e, next) => next.called ? next(e) : { deny: failed })
  on('tool.call', { tool: 'PowerShell' }, ($, e, next) => shell($, e.command, true, () => next(e)))
    .catch(($, e, next) => next.called ? next(e) : { deny: failed })
  on('tool.call', { tool: 'WebFetch' }, async ($, e, next) => {
    const problem = hostProblem(e.url, await policy($))
    return problem ? { deny: `agentloop-guardas: ${problem}` } : next(e)
  }).catch(($, e, next) => next.called ? next(e) : { deny: failed })
  // Las bifurcaciones heredan el modelo; los agentes de workflow no admiten cambiarlo.
  on('agent.spawn', async ($, e, next) => {
    if (e.fork || e.workflow) return next(e)
    return next({ ...e, model: (await policy($)).claudeModel ?? 'opus' })
  }).catch(($, e, next) => next.called ? next(e) : { deny: failed })
}
