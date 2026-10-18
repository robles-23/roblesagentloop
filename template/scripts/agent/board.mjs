// Tablero del bucle de agentes: tareas definidas y estado de sus ejecuciones.
// Uso: node scripts/agent/board.mjs [--brief]   (--brief lo usa el hook de inicio de sesión)
import { readConfig } from "./config.mjs";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tasksDir = join(root, ".agents", "tasks");
const runsDir = join(root, ".agents", "runs");
const brief = process.argv.includes("--brief");
const ACTIVE = ["starting", "executing", "gates", "reviewing"];
const config = readConfig(root);
const STALE_MS = config.staleMinutes * 60000;

// Una ejecución cortada (sesión cerrada, reinicio) deja status.json activo: si ningún archivo
// de su carpeta cambia durante staleMinutes, se muestra como «interrupted» para relanzarla.
function effectiveState(state, dir) {
  if (!ACTIVE.includes(state)) return state;
  let last = 0;
  try { for (const f of readdirSync(dir)) last = Math.max(last, statSync(join(dir, f)).mtimeMs); } catch {}
  return last > 0 && Date.now() - last > STALE_MS ? "interrupted" : state;
}

const tasks = existsSync(tasksDir)
  ? readdirSync(tasksDir).filter((f) => /^T-\d+.*\.md$/.test(f)).sort()
  : [];

const rows = tasks.map((f) => {
  const id = f.replace(/\.md$/, "");
  const text = readFileSync(join(tasksDir, f), "utf8");
  const title = (text.match(/^title:\s*(.+)$/m) || [])[1]?.trim() ?? "";
  const critical = /^critical:\s*true/m.test(text);
  let s = null;
  const sf = join(runsDir, id, "status.json");
  if (existsSync(sf)) {
    try { s = JSON.parse(readFileSync(sf, "utf8").replace(/^﻿/, "")); } catch {}
  }
  return {
    id, title, critical,
    state: s ? effectiveState(s.state, join(runsDir, id)) : "pendiente",
    round: s ? `${s.round}/${s.max_rounds}` : "-",
    gates: s?.gates ?? "-",
    verdict: s?.verdict ?? "-",
    updated: s?.updated ?? "",
  };
});

if (brief) {
  if (rows.length === 0) {
    console.log("Bucle de agentes: no hay tareas todavía (.agents/tasks/).");
  } else {
    const attention = rows.filter((r) => ["ready_to_merge", "needs_opus", "blocked", "interrupted"].includes(r.state));
    const running = rows.filter((r) => ACTIVE.includes(r.state));
    console.log(`Bucle de agentes: ${rows.length} tareas · ${running.length} en curso · ${attention.length} requieren a Opus.`);
    for (const r of attention) console.log(`  - ${r.id} [${r.state}] ${r.title}`);
  }
  process.exit(0);
}

if (rows.length === 0) {
  console.log("No hay tareas. Crea .agents/tasks/T-001.md a partir de _TEMPLATE.md.");
  process.exit(0);
}
console.log("| ID | Estado | Ronda | Checks | Veredicto | Crít. | Título |");
console.log("|---|---|---|---|---|---|---|");
for (const r of rows) {
  console.log(`| ${r.id} | ${r.state} | ${r.round} | ${r.gates} | ${r.verdict} | ${r.critical ? "sí" : ""} | ${r.title} |`);
}
