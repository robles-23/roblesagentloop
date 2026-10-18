/** Un subagente de Claude lanzado en esta sesión. */
export type SubAgent = {
  id: string
  description: string
  type: string
  model: string
  /** AgentStatus del motor: running, waiting, idle, completed, failed, killed... */
  status: string
  activity: string
  tools: number
  startedAt: number
  endedAt?: number
}

/** Una ejecución del bucle de Codex (.agents/runs/<ID>/status.json). */
export type CodexRun = {
  id: string
  state: string
  model: string
  role: 'architect' | 'executor' | 'reviewer' | 'criticalReviewer' | 'checks'
  round: string
  activity: string
  isActive: boolean
  startedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    /** `now`: reloj de la vista; solo avanza mientras hay trabajo en curso. */
    /** `tick`: fotograma de la animación (cada 120 ms, solo con trabajo en curso). */
    /** `loopShown`: el diagrama /bucle ya se abrió solo una vez en esta sesión. */
    /** `mode`: banda con logos ASCII o una línea por agente (/flota-modo). */
    'agentloop-flota': { agents: SubAgent[]; runs: CodexRun[]; now: number; tick: number; loopShown: boolean; mode: 'arte' | 'linea' }
  }
}
