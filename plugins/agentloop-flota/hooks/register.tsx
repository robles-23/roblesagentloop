import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CodexRun, SubAgent } from '../types'
import { ACTIVE_STATES, codexActivity, effectiveState, elapsed, fit, shortModel, stateEs, toolActivity } from './parse'
import { artForRole, renderBraille, spinner } from './ascii'
import { BG, buildLoop, toRuns } from './diagram'
import type { Art } from './ascii'
import { parseConfig, runRole } from './config'

const PANE = 'agentloop-flota'
const LOOP = 'agentloop-bucle'
const RUNS_DIR = '.agents/runs'
const BAND_MAX = 6
const CARD_MAX = 6
// Logo en braille: 8x3 caracteres = 16x12 puntos, alineado en cualquier fuente.
const ART_W = 8
const ART_H = 3
// Tarjeta fija: columna de logo (ART_W + 2) + hueco (1) + texto (TEXT_W). El texto se recorta
// aquí a TEXT_W para que nunca salte de línea y quede siempre en las mismas 3 filas que el logo.
// El texto se recorta a TEXT_FIT, algo menos que su columna: en VS Code la fuente es proporcional
// y las letras anchas pueden ocupar más espacio que el número de columnas declarado.
const CARD_W = 58
const TEXT_W = CARD_W - (ART_W + 2) - 1
const TEXT_FIT = TEXT_W - 7
const LINE_W = 110
const agentsAtom = atom({ plugin: 'agentloop-flota', key: 'agents' } as const, [])
const runsAtom = atom({ plugin: 'agentloop-flota', key: 'runs' } as const, [])
const nowAtom = atom({ plugin: 'agentloop-flota', key: 'now' } as const, 0)
const tickAtom = atom({ plugin: 'agentloop-flota', key: 'tick' } as const, 0)
const loopShownAtom = atom({ plugin: 'agentloop-flota', key: 'loopShown' } as const, false)
const modeAtom = atom({ plugin: 'agentloop-flota', key: 'mode' } as const, 'arte')

const LIVE = new Set(['pending', 'running', 'waiting'])
const isLive = (a: SubAgent) => LIVE.has(a.status)

// Solo hay animación mientras algún agente trabaja de verdad.
let busy = false

async function readRuns($: EngineInterface, prev: CodexRun[]): Promise<CodexRun[]> {
  if (!(await $.fs.exists(RUNS_DIR))) return []
  const config = parseConfig(await $.fs.exists('agentloop.config.json') ? await $.fs.read('agentloop.config.json') : undefined)
  const out: CodexRun[] = []
  const now = await $.clock.now()
  for (const dir of await $.fs.list(RUNS_DIR)) {
    if (dir.kind !== 'dir') continue
    const base = `${RUNS_DIR}/${dir.name}`
    let s: Record<string, unknown>
    try {
      s = JSON.parse((await $.fs.read(`${base}/status.json`)).replace(/^﻿/, ''))
    } catch {
      continue
    }
    let state = String(s.state ?? '')
    if (ACTIVE_STATES.has(state)) {
      const files = await $.fs.list(base).catch(() => [])
      state = effectiveState(state, Math.max(0, ...files.map(f => f.mtimeMs ?? 0)), now, config.staleMinutes * 60000)
    }
    const isActive = ACTIVE_STATES.has(state)
    const round = Number(s.round ?? 0)
    const role = runRole(state, Boolean(s.critical))
    const model = role === 'checks' ? 'checks' : role === 'reviewer' || role === 'criticalReviewer' ? String(s.reviewer ?? config[role]) : String(s.executor ?? config.executor)
    let activity = stateEs(state)
    if (state === 'executing' || state === 'reviewing') {
      const log = `${base}/round-${round}.${state === 'executing' ? 'exec' : 'review'}.log`
      try {
        if (await $.fs.exists(log)) activity = codexActivity(await $.fs.read(log)) ?? activity
      } catch {
        // log en escritura o demasiado grande: se queda el estado
      }
    }
    const started = Date.parse(String(s.started ?? '')) || prev.find(r => r.id === dir.name)?.startedAt || 0
    out.push({ id: dir.name, state, model, role, round: `${round}/${s.max_rounds ?? '?'}`, activity, isActive, startedAt: started })
  }
  return out.sort((a, b) => b.startedAt - a.startedAt)
}

async function poll($: EngineInterface) {
  const list = await $.agent.list()
  const now = await $.clock.now()
  await update($, agentsAtom, agents => {
    let changed = false
    const next = agents.map(a => {
      const info = list.find(x => x.id === a.id)
      const status = info?.status ?? (isLive(a) ? 'completed' : a.status)
      if (status === a.status) return a
      changed = true
      const activity = LIVE.has(status) ? a.activity : status === 'completed' ? 'terminado' : status
      return { ...a, status, endedAt: LIVE.has(status) ? undefined : now, activity }
    })
    return changed ? next : agents
  })
  const prev = await read($, runsAtom)
  const runs = await readRuns($, prev)
  if (JSON.stringify(runs) !== JSON.stringify(prev)) await update($, runsAtom, () => runs)
  busy = (await read($, agentsAtom)).some(isLive) || runs.some(r => r.isActive)
  if (busy) await update($, nowAtom, () => now)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'flota', description: 'Abre el detalle de subagentes y ejecuciones de Codex' })
    await $.command.register({ name: 'flota-modo', description: 'Cambia la banda de la flota entre logos en braille y una línea por agente' })
    await $.command.register({ name: 'bucle', description: 'Diagrama del bucle: arquitecto, ejecutor, comprobaciones y revisión' })
    // El diagrama se abre solo la primera vez en la sesión; después, con /bucle.
    if (!(await read($, loopShownAtom))) {
      await update($, loopShownAtom, () => true)
      void $.ui.open({ id: LOOP, title: 'Bucle de agentes' })
    }
    $.clock.every(2000, () => {
      void poll($).catch(() => undefined)
    })
    $.clock.every(120, () => {
      if (busy) void update($, tickAtom, t => t + 1).catch(() => undefined)
    })
    return started
  })

  on('command.run', { command: 'flota' }, async $ => {
    const { isPlaced } = await $.ui.open({ id: PANE, title: 'Flota de agentes' })
    return { text: isPlaced ? 'Panel de la flota abierto.' : 'Esta superficie no muestra paneles; la flota sigue encima del prompt.' }
  })

  on('command.run', { command: 'flota-modo' }, async $ => {
    const mode = (await read($, modeAtom)) === 'arte' ? 'linea' : 'arte'
    await update($, modeAtom, () => mode)
    return { text: mode === 'arte' ? 'Flota con logos en braille.' : 'Flota en una línea por agente.' }
  })

  on('command.run', { command: 'bucle' }, async $ => {
    const { isPlaced } = await $.ui.open({ id: LOOP, title: 'Bucle de agentes' })
    return { text: isPlaced ? 'Diagrama del bucle abierto.' : 'Esta superficie no muestra paneles.' }
  })

  on('ui.render', { component: 'Pane', requestId: LOOP }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" backgroundColor={BG} paddingX={2} paddingY={1}>
        {toRuns(buildLoop()).map((row, y) => (
          <Text key={`l${y}`} backgroundColor={BG}>
            {row.map((r, x) => (
              <Text key={`l${y}-${x}`} color={r.color} backgroundColor={r.bg ?? BG} weight={r.bold ? 'bold' : undefined}>
                {r.text}
              </Text>
            ))}
          </Text>
        ))}
      </Box>
    )
  })

  on('agent.spawn', async ($, e, next) => {
    const res = await next(e)
    if (res.agentId) try {
      const now = await $.clock.now()
      const agent: SubAgent = {
        id: res.agentId,
        description: e.description,
        type: e.subagentType,
        model: shortModel(res.model),
        status: 'running',
        activity: 'arrancando',
        tools: 0,
        startedAt: now,
      }
      await update($, agentsAtom, list => [...list.filter(a => isLive(a) || now - (a.endedAt ?? 0) < 10 * 60000), agent].slice(-20))
      await update($, nowAtom, () => now)
      busy = true
    } catch {
      // solo observa: un fallo aquí no afecta al subagente
    }
    return res
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId) try {
      const activity = toolActivity(e.tool, e as unknown as Record<string, unknown>)
      await update($, agentsAtom, list =>
        list.some(a => a.id === e.agentId) ? list.map(a => (a.id === e.agentId ? { ...a, activity, tools: a.tools + 1 } : a)) : list,
      )
    } catch {
      // solo observa
    }
    return next(e)
  })

  // Banda encima del prompt: un personaje animado por agente en curso
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const agents = (await read($, agentsAtom)).filter(isLive)
    const runs = (await read($, runsAtom)).filter(r => r.isActive)
    if (agents.length === 0 && runs.length === 0) return next(e)
    const now = await read($, nowAtom)
    const tick = await read($, tickAtom)
    const { Box, Text } = $.ui.resolve(e)

    const line = (key: string, art: Art, working: boolean, title: string, meta: string, activity: string) => {
      // Una línea por agente: título y meta enteros (cortos), la actividad se recorta a lo que quede.
      const t = fit(title, 40)
      const m = fit(meta, 50)
      const rest = Math.max(10, LINE_W - 2 - Array.from(t).length - Array.from(m).length - 6)
      return (
        <Text key={key} wrap="truncate-end">
          <Text color={art.color}>{spinner(art, tick, working)} </Text>
          <Text color={art.color} weight="bold">{t}</Text>
          <Text dimColor> · {m} · </Text>
          <Text dimColor={!working}>{fit(activity, rest)}</Text>
        </Text>
      )
    }

    const lines = [
      ...agents.map(a => {
        const working = a.status === 'running'
        return line(`a-${a.id}`, artForRole('architect'), working, a.description, `${a.model} · ${elapsed(a.startedAt, now)} · ${a.tools} herr.`, working ? a.activity : 'esperando')
      }),
      ...runs.map(r => line(`r-${r.id}`, artForRole(r.role), true, r.id, `codex ${r.model} · ronda ${r.round} · ${elapsed(r.startedAt, now)}`, r.activity)),
    ]
    if ((await read($, modeAtom)) === 'arte') {
      const card = (key: string, art: Art, working: boolean, title: string, meta: string, activity: string) => (
        // nowrap + overflow hidden: el logo y el texto nunca se apilan (VS Code los apilaba si el texto no cabía).
        <Box key={key} flexDirection="row" flexWrap="nowrap" gap={1} width={CARD_W} minWidth={CARD_W} height={ART_H} flexShrink={0} overflow="hidden" marginBottom={1}>
          <Box flexDirection="column" width={ART_W + 2} minWidth={ART_W + 2} height={ART_H} flexShrink={0}>
            {renderBraille(art, ART_W, ART_H, tick, working).map((row, y) => (
              <Text key={`${key}-${y}`} color={art.color} dimColor={!working} wrap="truncate-end">
                {row}
              </Text>
            ))}
          </Box>
          <Box flexDirection="column" width={TEXT_W} minWidth={0} height={ART_H} flexShrink={0} overflow="hidden">
            <Text color={art.color} weight="bold" wrap="truncate-end">{fit(title, TEXT_FIT)}</Text>
            <Text dimColor wrap="truncate-end">{fit(meta, TEXT_FIT)}</Text>
            <Text dimColor={!working} wrap="truncate-end">{fit(activity, TEXT_FIT)}</Text>
          </Box>
        </Box>
      )
      const cards = [
        ...agents.map(a => {
          const working = a.status === 'running'
          return card(`c-${a.id}`, artForRole('architect'), working, a.description, `${a.model} · ${elapsed(a.startedAt, now)} · ${a.tools} herr.`, working ? a.activity : 'esperando')
        }),
        ...runs.map(r => card(`c-${r.id}`, artForRole(r.role), true, r.id, `codex ${r.model} · ronda ${r.round} · ${elapsed(r.startedAt, now)}`, r.activity)),
      ]
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
            {cards.slice(0, CARD_MAX)}
          </Box>
          {cards.length > CARD_MAX && <Text dimColor>+{cards.length - CARD_MAX} más · /flota</Text>}
        </Box>
      )
    }

    const hidden = lines.length - BAND_MAX
    return (
      <Box flexDirection="column">
        {lines.slice(0, BAND_MAX)}
        {hidden > 0 && <Text dimColor>+{hidden} más · /flota</Text>}
      </Box>
    )
  })

  // Panel /flota: también lo terminado y lo que espera a Opus
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const agents = await read($, agentsAtom)
    const runs = await read($, runsAtom)
    const now = (await read($, nowAtom)) || (await $.clock.now())
    const tick = await read($, tickAtom)
    return (
      <Box flexDirection="column">
        <Text weight="bold">Subagentes de Claude</Text>
        {agents.length === 0 && <Text dimColor>  Ninguno en esta sesión.</Text>}
        {[...agents].reverse().map(a => {
          const sp = artForRole('architect')
          return (
            <Text key={`pa-${a.id}`} wrap="truncate-end" dimColor={!isLive(a)}>
              <Text color={sp.color}>{isLive(a) ? spinner(sp, tick, a.status === 'running') : '·'} </Text>
              {a.description} · {sp.name} · {a.model} · {elapsed(a.startedAt, a.endedAt ?? now)} · {a.tools} herr. · {a.activity}
            </Text>
          )
        })}
        <Text> </Text>
        <Text weight="bold">Bucle de Codex</Text>
        {runs.length === 0 && <Text dimColor>  Sin ejecuciones en {RUNS_DIR}.</Text>}
        {runs.slice(0, 12).map(r => {
          const sp = artForRole(r.role)
          return (
            <Text key={`pr-${r.id}`} wrap="truncate-end" dimColor={!r.isActive && r.state === 'merged'}>
              <Text color={sp.color}>{r.isActive ? spinner(sp, tick, true) : '·'} </Text>
              {r.id} · {r.model} · ronda {r.round} · {r.isActive ? r.activity : stateEs(r.state)}
            </Text>
          )
        })}
      </Box>
    )
  })
}
