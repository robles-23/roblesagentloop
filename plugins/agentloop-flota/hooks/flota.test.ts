import { expect, test } from 'claude-code/testing'

import { codexActivity, effectiveState, elapsed, fit, shortModel, toolActivity } from './parse'
import { artForRole } from './ascii'
import { parseConfig, runRole } from './config'

test('configuración y personajes dependen del rol, no del modelo', () => {
  const config = parseConfig('{"executor":"custom-model","reviewer":"custom-model","staleMinutes":2}')
  expect(config.executor).toBe('custom-model')
  expect(config.maxRounds).toBe(3)
  expect(artForRole(runRole('executing', false)).kind).toBe('sun')
  expect(artForRole(runRole('reviewing', false)).kind).toBe('moon')
  expect(artForRole(runRole('reviewing', true)).kind).toBe('galaxy')
  expect(artForRole(runRole('gates', true)).kind).toBe('gear')
  expect(effectiveState('executing', 1, 180001, config.staleMinutes * 60000)).toBe('interrupted')
})

test('modelo legible', () => {
  expect(shortModel('claude-opus-5-5')).toBe('opus 5.5')
  expect(shortModel('claude-haiku-5-5')).toBe('haiku 5.5')
  expect(shortModel('gpt-6.1-sol')).toBe('gpt-6.1-sol')
  expect(shortModel(undefined)).toBe('?')
})

test('actividad de una herramienta', () => {
  expect(toolActivity('Bash', { command: 'git status', description: 'Show working tree status' })).toBe('Bash: Show working tree status')
  expect(toolActivity('Read', { file_path: 'C:\\dev\\x\\board.mjs' })).toBe('Read: board.mjs')
  expect(toolActivity('Grep', { pattern: 'archivos' })).toBe('Grep: archivos')
  expect(toolActivity('TodoWrite', {})).toBe('TodoWrite')
})

test('actividad del log de codex', () => {
  const log = ['hook: SessionStart', 'codex', 'Voy a leer las instrucciones.', '', 'exec', '"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command \'git status --short\' in C:\\dev\\wt', ' succeeded in 188ms:'].join('\n')
  expect(codexActivity(log)).toBe('ejecuta: git status --short')
  expect(codexActivity('codex\nPreparo el README.\n')).toBe('Preparo el README.')
  expect(codexActivity('codex\nhola\napply patch\n*** Begin Patch')).toBe('editando archivos')
  // Formato actual de codex: rutas con barras dobles y -NoProfile antes de -Command.
  const nuevo = ['exec', '"C:\\\\WINDOWS\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe" -NoProfile -Command \'docker version; git status --short\' in C:\\dev\\wt'].join('\n')
  expect(codexActivity(nuevo)).toBe('ejecuta: docker version; git status --short')
  expect(codexActivity('nada')).toBe(undefined)
})

test('tiempo transcurrido', () => {
  expect(elapsed(0, 65000)).toBe('1:05')
  expect(elapsed(0, 3720000)).toBe('1h02')
})

test('un subagente lanzado aparece encima del prompt', async ($, on) => {
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'ag-1' }))
  on('clock.now', () => ({ value: 1000 }))
  on('agent.list', () => ({ value: [] }))
  await $.agent.spawn({ prompt: 'busca archivos', description: 'Buscar archivos', subagentType: 'Explore' } as never)
  const ui = await $.ui.mount({ plugin: 'agentloop-flota', surface: 'terminal', component: 'AbovePrompt', props: {} as never })
  expect(await ui.find({ text: /Buscar archivos/ })).toBeTruthy()
  expect(await ui.find({ text: /haiku 5\.5/ })).toBeTruthy()
})

for (const surface of ['terminal', 'vscode', 'desktop'] as const) {
  test(`un agente de opus sale en una línea con su indicador en ${surface}`, async ($, on) => {
    on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'ag-2' }))
    on('clock.now', () => ({ value: 1000 }))
    on('agent.list', () => ({ value: [] }))
    await $.agent.spawn({ prompt: 'x', description: 'Revisar sprites', subagentType: 'Explore' } as never)
    const ui = await $.ui.mount({ plugin: 'agentloop-flota', surface, component: 'AbovePrompt', props: {} as never })
    expect(await ui.find({ text: /opus/ })).toBeTruthy()
    expect(await ui.find({ text: /Revisar sprites/ })).toBeTruthy()
  })
}

test('el diagrama del bucle se dibuja con los cinco roles', async ($, on) => {
  on('clock.now', () => ({ value: 1000 }))
  const ui = await $.ui.mount({ plugin: 'agentloop-flota', surface: 'terminal', component: 'Pane', requestId: 'agentloop-bucle', props: {} as never } as never)
  for (const name of [/ARQUITECTO/, /EJECUTOR/, /COMPROBACIONES/, /REVISOR/, /REVISOR CRÍTICO/]) {
    expect(await ui.find({ text: name })).toBeTruthy()
  }
})

test('en VS Code el logo va en braille, sin espacios que se descuadren', async ($, on) => {
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'ag-3' }))
  on('clock.now', () => ({ value: 1000 }))
  on('agent.list', () => ({ value: [] }))
  await $.agent.spawn({ prompt: 'x', description: 'Logo', subagentType: 'Explore' } as never)
  const ui = await $.ui.mount({ plugin: 'agentloop-flota', surface: 'vscode', component: 'AbovePrompt', props: {} as never })
  expect(await ui.find({ type: 'Text', text: /^[⠀-⣿]{8}$/ })).toBeTruthy()
})

test('recorta a una línea y con «…»', () => {
  expect(fit('corto', 10)).toBe('corto')
  expect(fit('una frase\nen dos líneas', 40)).toBe('una frase en dos líneas')
  expect(fit('abcdefghij', 5)).toBe('abcd…')
})

for (const surface of ['terminal', 'vscode'] as const) {
  test(`con texto largo la tarjeta no se descuadra en ${surface}`, async ($, on) => {
    on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'ag-4' }))
    on('clock.now', () => ({ value: 1000 }))
    on('agent.list', () => ({ value: [] }))
    const largo = 'Revisar la documentación del proyecto y comprobar todos los enlaces de instalación para usuarios nuevos'
    await $.agent.spawn({ prompt: 'x', description: largo, subagentType: 'Explore' } as never)
    const ui = await $.ui.mount({ plugin: 'agentloop-flota', surface, component: 'AbovePrompt', props: {} as never })
    // El título sale recortado con «…» y ninguna línea de la tarjeta supera el recorte de su columna (42).
    expect(await ui.find({ type: 'Text', text: /^Revisar la documentación.*…$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^.{43,}$/u })).toBeFalsy()
  })
}

test('una ejecución activa sin escribir nada en 30 minutos se da por interrumpida', () => {
  const now = 1_000_000_000_000
  expect(effectiveState('reviewing', now - 66 * 3600000, now)).toBe('interrupted')
  expect(effectiveState('executing', now - 5 * 60000, now)).toBe('executing')
  expect(effectiveState('ready_to_merge', now - 66 * 3600000, now)).toBe('ready_to_merge')
  expect(effectiveState('gates', 0, now)).toBe('gates')
})
