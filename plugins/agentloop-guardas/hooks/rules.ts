// Reglas de texto: una ayuda frente a errores, no un cortafuegos de red.
export type HostPolicy = { blockedHosts?: string[]; allowedHosts?: string[] }
const normalize = (host: string) => host.toLowerCase().replace(/\.$/, '')
const matches = (host: string, pattern: string) => {
  const p = normalize(pattern)
  return p.startsWith('*.') ? host.endsWith(p.slice(1)) && host !== p.slice(2) : host === p
}
export function hostProblem(text: string, policy: HostPolicy = {}): string | undefined {
  const blocked = policy.blockedHosts ?? []
  const allowed = policy.allowedHosts ?? []
  for (const list of [blocked, allowed]) {
    if (!Array.isArray(list) || list.some(x => typeof x !== 'string' || !/^(\*\.)?[a-z0-9.-]+$/i.test(x))) throw new Error('Hosts no válidos')
  }
  const hosts = new Set<string>()
  const rest = text.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s'"`<>]+/gi, raw => {
    try { hosts.add(normalize(new URL(raw).hostname)) } catch { throw new Error('URL no válida') }
    return ' '
  })
  for (const m of rest.matchAll(/\b(?:localhost|(?:[a-z0-9-]+\.)+[a-z0-9-]+)\.?\b/gi)) hosts.add(normalize(m[0]))
  for (const host of hosts) {
    if (blocked.some(p => matches(host, p))) return `Host bloqueado: ${host}`
    if (allowed.length && !allowed.some(p => matches(host, p))) return `Host fuera de allowedHosts: ${host}`
  }
  return undefined
}
export function encodingProblem(command: string): string | undefined {
  const operations = command.match(/\b(Get-Content|Set-Content|Add-Content|Out-File)\b/gi)?.length ?? 0
  const utf8 = command.match(/-Encoding\s+['"]?utf8(?:BOM|NoBOM)?\b/gi)?.length ?? 0
  if (utf8 < operations) return 'Indica -Encoding UTF8 en cada Get-Content, Set-Content, Add-Content y Out-File.'
  return undefined
}
export function boardLine(brief: string): string | undefined {
  return brief.split(/\r?\n/)[0]?.trim().replace(/^Bucle de agentes:\s*/, 'Bucle: ') || undefined
}
