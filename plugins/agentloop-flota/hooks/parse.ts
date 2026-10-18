// Funciones puras: modelo legible, actividad de una herramienta y de un log de Codex.

export function shortModel(id: string | undefined): string {
  if (!id) return '?'
  return id.replace(/^claude-/, '').replace(/-(\d+)-(\d+)$/, ' $1.$2').replace(/-(\d{8})$/, '')
}

/** Una sola línea de como mucho `n` caracteres (con «…» si se corta). No depende de que la superficie recorte. */
export const fit = (s: string, n: number) => {
  const one = s.replace(/\s+/g, ' ').trim()
  const chars = Array.from(one)
  return chars.length > n ? chars.slice(0, n - 1).join('') + '…' : one
}
const clip = fit

/** «Bash: git status», «Read: board.mjs», «Grep: archivos»… a partir de los argumentos de la llamada. */
export function toolActivity(tool: string, args: Record<string, unknown>): string {
  const pick = (k: string) => (typeof args[k] === 'string' ? (args[k] as string) : undefined)
  const path = pick('file_path') ?? pick('path') ?? pick('notebook_path')
  const what =
    pick('description') ??
    pick('command') ??
    (path ? path.split(/[\\/]/).pop() : undefined) ??
    pick('pattern') ??
    pick('url') ??
    pick('query') ??
    pick('prompt') ??
    ''
  return what ? `${tool}: ${clip(what, 60)}` : tool
}

const STATE_ES: Record<string, string> = {
  starting: 'arrancando',
  executing: 'implementando',
  gates: 'comprobaciones (lint, tipos, tests)',
  reviewing: 'revisando el diff',
  ready_to_merge: 'lista para integrar',
  needs_opus: 'necesita a Opus',
  blocked: 'bloqueada',
  merged: 'integrada',
  interrupted: 'interrumpida (sin actividad; hay que relanzarla)',
}
export const stateEs = (s: string) => STATE_ES[s] ?? s
export const ACTIVE_STATES = new Set(['starting', 'executing', 'gates', 'reviewing'])
export const STALE_MS = 30 * 60000

/** Una ejecución cortada (sesión cerrada, reinicio) deja status.json activo para siempre: si ningún
 *  archivo de su carpeta cambia en STALE_MS, se trata como interrumpida. Sin fecha conocida, no se toca. */
export function effectiveState(state: string, lastWriteMs: number, nowMs: number, staleMs = STALE_MS): string {
  if (!ACTIVE_STATES.has(state) || lastWriteMs <= 0) return state
  return nowMs - lastWriteMs > staleMs ? 'interrupted' : state
}

/** Último paso del log de `codex exec`: mensaje, comando o edición. */
export function codexActivity(log: string): string | undefined {
  const lines = log.split(/\r?\n/).slice(-600)
  for (let i = lines.length - 1; i >= 0; i--) {
    const mark = (lines[i] ?? '').trim()
    if (mark === 'apply patch') return 'editando archivos'
    if (mark !== 'codex' && mark !== 'exec' && mark !== 'thinking') continue
    const body = lines.slice(i + 1).find(l => l.trim() !== '')
    if (!body) continue
    if (mark === 'exec') {
      const cmd = body.replace(/^"[^"]*powershell\.exe"\s+(?:-(?!Command\b)\w+\s+)*-Command\s+/i, '').replace(/\s+in\s+\S+$/, '').replace(/^['"]|['"]$/g, '')
      return `ejecuta: ${clip(cmd, 60)}`
    }
    return clip(body, 70)
  }
  return undefined
}

export function elapsed(fromMs: number, toMs: number): string {
  const s = Math.max(0, Math.round((toMs - fromMs) / 1000))
  const m = Math.floor(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`
}
