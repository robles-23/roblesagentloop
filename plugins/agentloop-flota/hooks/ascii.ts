// Arte ASCII denso por rol, generado con funciones de sombreado (rampa de 10 niveles).
// Un color por rol. Se puede pintar a cualquier tamaño; la celda de la terminal mide ~1x2.
// Solo se anima mientras el agente trabaja: quieto, se dibuja el fotograma 0.

export type ArtKind = 'clawd' | 'sun' | 'moon' | 'galaxy' | 'gear' | 'planet'
export type Art = { name: string; color: string; kind: ArtKind }

// Rampa de densidad de 10 niveles, la de las vistas previas en Consolas.
const RAMP = ' .:-=+*#%@'
/** Segundos por tic de la animación. */
export const TICK_S = 0.12

export const ARTS: Record<string, Art> = {
  architect: { name: 'architect', color: '#D97757', kind: 'clawd' },
  executor: { name: 'executor', color: '#FFC531', kind: 'sun' },
  reviewer: { name: 'reviewer', color: '#B8C7FF', kind: 'moon' },
  criticalReviewer: { name: 'criticalReviewer', color: '#B07CFF', kind: 'galaxy' },
  checks: { name: 'checks', color: '#57D18A', kind: 'gear' },
  otro: { name: 'otro', color: '#9A9A9A', kind: 'planet' },
}

export type Role = 'architect' | 'executor' | 'reviewer' | 'criticalReviewer' | 'checks'
export function artForRole(role: string): Art {
  return ARTS[role] ?? ARTS.otro!
}

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const hash = (a: number, b: number) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return s - Math.floor(s)
}
const inBox = (x: number, y: number, x0: number, x1: number, y0: number, y1: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1

// Cada sombreador recibe coordenadas con el alto en [-1, 1] y devuelve la intensidad en [0, 1].
type Shader = (x: number, y: number, t: number) => number

// Clawd, la mascota de Claude Code: cuerpo de bloque, ojos verticales, brazos y cuatro patas que andan.
const clawd: Shader = (x, y, t) => {
  // La figura va de -0.62 (cabeza) a 0.9 (patas): se reparte en todo el alto para quedar centrada como el resto.
  y = -0.62 + ((y + 0.92) / 1.84) * 1.52
  const step = Math.floor(t / 0.35) % 2
  const blink = t % 3.2 > 3.02
  if (inBox(x, y, -0.78, 0.78, -0.62, 0.42)) {
    const eyeH = blink ? 0.06 : 0.34
    if ((inBox(x, y, -0.5, -0.28, -0.44, -0.44 + eyeH) || inBox(x, y, 0.28, 0.5, -0.44, -0.44 + eyeH))) return 0
    const edge = Math.min(0.78 - Math.abs(x), Math.min(y + 0.62, 0.42 - y))
    return clamp(0.78 + 0.18 * (-(x + y) / 2) - (edge < 0.06 ? 0.22 : 0))
  }
  if (inBox(x, y, -1.05, -0.78, -0.2, 0.08) || inBox(x, y, 0.78, 1.05, -0.2, 0.08)) return 0.62
  const legs = [-0.6, -0.24, 0.24, 0.6]
  for (const [k, lx] of legs.entries()) {
    const up = (k % 2 === step) ? 0.12 : 0
    if (inBox(x, y, lx - 0.08, lx + 0.08, 0.42, 0.9 - up)) return 0.55
  }
  return 0
}

// Sol: disco sólido y, separado por un hueco, un anillo de 8 rayos que gira.
const sun: Shader = (x, y, t) => {
  const r = Math.hypot(x, y)
  if (r < 0.46) return 1
  if (r < 0.6 || r > 0.98) return 0
  const a = Math.atan2(y, x)
  return Math.cos(8 * a + t * 1.6) > 0.55 ? 1 : 0
}

// Luna: creciente recortado por un segundo disco que se desplaza; la fase crece y mengua.
const moon: Shader = (x, y, t) => {
  const R = 0.9
  if (x * x + y * y > R * R) return 0
  const shift = R * (0.55 + 0.4 * Math.sin(t * 0.5)) // 0.15R..0.95R: de casi llena a creciente fino
  const inShadow = (x - shift) ** 2 + (y + 0.08) ** 2 < (R * 0.95) ** 2
  return inShadow ? 0.12 : 1
}

// Galaxia espiral de dos brazos, inclinada, que gira; estrellas de fondo que titilan.
const galaxy: Shader = (x, y, t) => {
  const xx = x * 0.95
  const yy = y * 1.45
  const r = Math.hypot(xx, yy)
  const a = Math.atan2(yy, xx)
  const core = 1.15 * Math.exp(-(r * r) / 0.045)
  // Dos brazos sobre una espiral logarítmica; la distancia angular al brazo da su brillo.
  let arm = 0
  for (const n of [0, Math.PI]) {
    let d = a - (2.0 * Math.log(r + 0.02) + n - t * 0.6)
    d = Math.atan2(Math.sin(d), Math.cos(d))
    arm = Math.max(arm, Math.exp(-(d * d) / 0.2))
  }
  const fade = clamp((r - 0.08) * 6) * clamp((1.3 - r) * 2)
  let v = core + 1.2 * arm * fade * (1.15 - r * 0.5) + 0.05 * Math.exp(-r * 2.5)
  const h = hash(Math.round(x * 12), Math.round(y * 12))
  if (r > 0.55 && h > 0.995) v = Math.max(v, 0.35 + 0.4 * Math.abs(Math.sin(t * 3 + h * 50)))
  return clamp(v)
}

// Engranaje que gira: comprobaciones (lint, tipos, tests).
const gear: Shader = (x, y, t) => {
  const r = Math.hypot(x, y)
  const a = Math.atan2(y, x)
  const teeth = Math.cos(10 * (a - t * 0.6)) > 0.2 ? 0.86 : 0.7
  if (r > teeth || r < 0.26) return 0
  return clamp(0.55 + 0.4 * (-(x + y) / 2) + (r < 0.36 ? 0.3 : 0))
}

// Planeta con anillo: cualquier otro rol.
const planet: Shader = (x, y, t) => {
  const ring = Math.abs(Math.hypot(x, y * 3.2) - 1.0) < 0.07 && !(y < 0 && Math.hypot(x, y) < 0.55)
  if (ring) return 0.7
  const d2 = x * x + y * y
  if (d2 > 0.3) return 0
  const nz = Math.sqrt(1 - d2 / 0.3)
  const band = 0.1 * Math.sin(y * 18 + t * 1.5)
  return clamp(0.25 + 0.65 * (nz * 0.8 - x * 0.4) + band)
}

const SHADERS: Record<ArtKind, Shader> = { clawd, sun, moon, galaxy, gear, planet }

/** Filas de texto del arte a `w` x `h` caracteres en el tic `tick`. */
export function renderArt(art: Art, w: number, h: number, tick: number, isWorking: boolean): string[] {
  const t = isWorking ? tick * TICK_S : 0
  const shade = SHADERS[art.kind]
  const aspect = w / (2 * h) // la celda mide el doble de alta que de ancha
  const S = 4 // supermuestreo por eje
  const rows: string[] = []
  for (let j = 0; j < h; j++) {
    let row = ''
    for (let i = 0; i < w; i++) {
      let sum = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = (((i + (sx + 0.5) / S) / w) * 2 - 1) * aspect
          const y = ((j + (sy + 0.5) / S) / h) * 2 - 1
          sum += shade(x, y, t)
        }
      }
      row += RAMP[Math.round(clamp(sum / (S * S)) * (RAMP.length - 1))]
    }
    rows.push(row.replace(/\s+$/, '').padEnd(w))
  }
  return rows
}

// Indicador de una línea: los mismos glifos que el indicador de Claude Code, en ida y vuelta.
// Cada rol a su ritmo (tics de 120 ms por fotograma); quieto, un punto.
const SPIN = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢']
const SPIN_EVERY: Record<ArtKind, number> = { clawd: 1, sun: 1, moon: 2, galaxy: 2, gear: 1, planet: 2 }

export function spinner(art: Art, tick: number, isWorking: boolean): string {
  if (!isWorking) return '·'
  return SPIN[Math.floor(tick / SPIN_EVERY[art.kind]) % SPIN.length] ?? '·'
}

// Arte en braille: cada carácter son 2x4 puntos y todos (también el vacío, U+2800) miden lo mismo,
// así que las filas no se descuadran aunque la superficie use una fuente proporcional (VS Code).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const DOT = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
]

export function renderBraille(art: Art, w: number, h: number, tick: number, isWorking: boolean, dither = false): string[] {
  const t = isWorking ? tick * TICK_S : 0
  const shade = SHADERS[art.kind]
  const pw = w * 2
  const ph = h * 4
  const aspect = pw / ph // los puntos braille son casi cuadrados
  const rows: string[] = []
  for (let cy = 0; cy < h; cy++) {
    let row = ''
    for (let cx = 0; cx < w; cx++) {
      let bits = 0
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const px = cx * 2 + dx
          const py = cy * 4 + dy
          let v = 0
          for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]] as const) {
            v += shade((((px + ox) / pw) * 2 - 1) * aspect, ((py + oy) / ph) * 2 - 1, t)
          }
          const threshold = dither ? ((BAYER[(py % 4) * 4 + (px % 4)] ?? 0) + 0.5) / 16 : 0.42
          if (Math.pow(v / 4, 0.75) > threshold) bits |= DOT[dy]![dx]!
        }
      }
      row += String.fromCharCode(0x2800 + bits)
    }
    rows.push(row)
  }
  return rows
}
