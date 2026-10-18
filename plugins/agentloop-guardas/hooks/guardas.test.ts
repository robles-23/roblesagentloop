import { expect, test } from 'claude-code/testing'
import { boardLine, encodingProblem, hostProblem } from './rules'
test('hosts exactos, subdominios y prioridad del bloqueo', () => {
  const p = { blockedHosts: ['production.example.com'], allowedHosts: ['*.example.com'] }
  expect(hostProblem('curl https://dev.example.com/api', p)).toBe(undefined)
  expect(hostProblem('curl https://PRODUCTION.example.com./api', p)).toContain('bloqueado')
  expect(hostProblem('curl https://example.com.evil.test', p)).toContain('allowedHosts')
  expect(hostProblem('curl https://dev.example.com@production.example.com', p)).toContain('bloqueado')
  expect(hostProblem('curl production.example.com', p)).toContain('bloqueado')
  expect(hostProblem('git status', p)).toBe(undefined)
  expect(hostProblem('curl https://example.com')).toBe(undefined)
})
test('PowerShell requiere UTF8 también en lecturas', () => {
  expect(encodingProblem('Get-ChildItem')).toBe(undefined)
  expect(encodingProblem('Get-Content a.md')).toContain('-Encoding')
  expect(encodingProblem("Set-Content a.md 'x' -Encoding ASCII")).toContain('-Encoding')
  expect(encodingProblem('(Get-Content a.md -Encoding UTF8) | Set-Content b.md -Encoding UTF8')).toBe(undefined)
})
test('bloquea antes de ejecutar el comando', async ($, on) => {
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: JSON.stringify({ guardas: { blockedHosts: ['production.example.com'] } }) }))
  let ran = false
  on('tool.call', ($, e, next) => { ran = true; return next(e) })
  const res = await $.tool.call({ tool: 'Bash', command: 'curl https://production.example.com/api' })
  expect(ran).toBe(false)
  expect(res.deny).toContain('Host bloqueado')
})
test('configuración ilegible falla cerrada', async ($, on) => {
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: '{' }))
  const res = await $.tool.call({ tool: 'Bash', command: 'git status' })
  expect(res.deny).toContain('configuración')
})
test('los subagentes usan el modelo de arquitecto configurado', async ($, on) => {
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: JSON.stringify({ guardas: { claudeModel: 'opus' } }) }))
  let model: string | undefined
  on('agent.spawn', ($, e) => { model = e.model; return { model: e.model ?? '?', agentId: 'x' } })
  await $.agent.spawn({ prompt: 'p', description: 'd', subagentType: 'Explore', model: 'haiku' } as never)
  expect(model).toBe('opus')
})
test('línea del tablero', () => {
  expect(boardLine('Bucle de agentes: 1 tareas\n')).toBe('Bucle: 1 tareas')
  expect(boardLine('')).toBe(undefined)
})
