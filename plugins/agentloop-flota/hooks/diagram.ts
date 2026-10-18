// Diagrama del bucle de agentes (CLAUDE.md, «Bucle de agentes»): recuadros sobre fondo negro.
import { ARTS } from './ascii'

export type Cell = { ch: string; color?: string; bold?: boolean; bg?: string }
export type Run = { text: string; color?: string; bold?: boolean; bg?: string }

export const BG = '#000000'
const W = 102
const H = 21
const BW = 28
const BH = 5
const COLS = [0, 37, 74] as const
const TEXT = '#F2F2F2'
const LINE = '#C8C8C8'
const RED = '#FF6B6B'
const GREEN = '#5BE38C'
const INK = '#000000'

export function buildLoop(): Cell[][] {
  const g: Cell[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => ({ ch: ' ' })))
  const put = (x: number, y: number, s: string, color = TEXT, bold = false, bg?: string) => {
    ;[...s].forEach((ch, i) => {
      const row = g[y]
      if (row && x + i >= 0 && x + i < W) row[x + i] = { ch, color, bold, bg: bg ?? row[x + i]?.bg }
    })
  }
  const fill = (x: number, y: number, w: number, h: number, bg: string) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(i, j, ' ', INK, false, bg)
  }
  const box = (x: number, y: number, w: number, h: number, title: string, color: string) => {
    put(x, y, '┌' + '─'.repeat(w - 2) + '┐', color)
    put(x + 2, y, ' ' + title + ' ', color, true)
    for (let j = 1; j < h - 1; j++) {
      put(x, y + j, '│', color)
      put(x + w - 1, y + j, '│', color)
    }
    put(x, y + h - 1, '└' + '─'.repeat(w - 2) + '┘', color)
  }
  // Recuadro relleno del color del rol, con marco y texto en negro.
  const node = (x: number, y: number, title: string, color: string, lines: string[]) => {
    fill(x, y, BW, BH, color)
    box(x, y, BW, BH, title, INK)
    lines.forEach((l, j) => put(x + 2, y + 1 + j, l, INK))
  }

  const [c0, c1, c2] = COLS
  const top = 0
  const bottom = 10
  const opus = ARTS.architect!.color, sol = ARTS.executor!.color, luna = ARTS.reviewer!.color, astra = ARTS.criticalReviewer!.color

  // Fila 1: planificar → implementar → comprobar
  node(c0, top, 'ARQUITECTO', opus, ['planifica la tarea', 'lee §§ con ctx.mjs', 'escribe T-xxx.md'])
  node(c1, top, 'EJECUTOR', sol, ['implementa + tests', 'en su propio worktree', 'run-task.ps1'])
  node(c2, top, 'COMPROBACIONES', GREEN, ['lint · tipos · tests', 'gates.ps1', 'mandan sobre revisión'])
  put(c0 + BW, top + 1, ' T-xxx.md', LINE)
  put(c0 + BW, top + 2, '────────►', LINE)
  put(c1 + BW, top + 1, '   diff', LINE)
  put(c1 + BW, top + 2, '────────►', LINE)
  put(c1 + BW, top + 3, '◄────────', RED)
  put(c1 + BW, top + 4, '  falla', RED)

  // Si pasa: revisión habitual o crítica
  const down = c2 + 14
  const toLuna = c1 + 20
  put(down, top + BH, '│', LINE)
  put(toLuna, top + BH + 1, '┌' + '─'.repeat(down - toLuna - 1) + '┤', LINE)
  put(toLuna + 5, top + BH + 1, ' pasa ', GREEN, true)
  put(toLuna, top + BH + 2, '│', LINE)
  put(toLuna + 2, top + BH + 2, 'normal', LINE)
  put(down - 9, top + BH + 2, 'critical', LINE)
  put(down, top + BH + 2, '│', LINE)
  put(toLuna, top + BH + 3, '│', LINE)
  put(down, top + BH + 3, '│', LINE)
  put(toLuna, top + BH + 4, '▼', LINE)
  put(down, top + BH + 4, '▼', LINE)

  // Cambios pedidos: vuelve a Sol (rondas configurables)
  const back = c1 + 6
  put(back, top + BH, '▲', RED)
  for (let y = top + BH + 1; y < bottom; y++) put(back, y, '│', RED)
  put(back - 17, top + BH + 2, 'cambios pedidos', RED, true)
  put(back - 15, top + BH + 3, 'rondas configurables', RED)

  // Fila 2: revisar → decidir e integrar
  node(c0, bottom, 'ARQUITECTO · decide', opus, ['resumen + veredicto', '+ git diff --stat', 'merge → main'])
  node(c1, bottom, 'REVISOR', luna, ['revisión habitual', 'solo lectura', 'veredicto JSON'])
  node(c2, bottom, 'REVISOR CRÍTICO', astra, ['permisos', 'envíos · dinero', 'secretos'])
  put(c0 + BW, bottom + 1, 'veredicto', LINE)
  put(c0 + BW, bottom + 2, '◄────────', LINE)
  put(c1 + BW, bottom + 1, 'veredicto', LINE)
  put(c1 + BW, bottom + 2, '◄────────', LINE)

  // Pie: lo que rodea al bucle
  box(0, bottom + BH + 1, W, 5, 'alrededor', LINE)
  put(2, bottom + BH + 2, '.agents/runs/T-xxx/   status.json · summary.md · logs de cada ronda')
  put(2, bottom + BH + 3, '/flota  quién trabaja y qué hace          /bucle  este diagrama')
  put(2, bottom + BH + 4, 'agentloop-guardas  hosts configurables · UTF-8 en PowerShell · subagentes en Opus')
  return g
}

/** Filas en tramos del mismo estilo, para pintarlas en la terminal. */
export function toRuns(g: Cell[][]): Run[][] {
  return g.map(row => {
    const runs: Run[] = []
    for (const c of row) {
      const last = runs[runs.length - 1]
      if (last && last.bg === c.bg && ((last.color === c.color && last.bold === c.bold) || c.ch === ' ')) last.text += c.ch
      else runs.push({ text: c.ch, color: c.color, bold: c.bold, bg: c.bg })
    }
    return runs
  })
}

export const toText = (g: Cell[][]) => g.map(r => r.map(c => c.ch).join('').replace(/\s+$/, '')).join('\n')
