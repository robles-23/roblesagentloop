import { readConfig } from "./agent/config.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = readConfig(root);
let content;
try { content = readFileSync(join(root, config.contextFile), "utf8"); }
catch { console.error(`No se puede leer ${config.contextFile}. Configura contextFile en agentloop.config.json.`); process.exit(2); }
const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
const HEAD = /^(#{2,6})\s+(?:(\d+(?:\.\d+)*)\.?\s+)?(.*)$/;

// Todos los encabezados cortan; solo los numerados se pueden pedir.
const all = [];
lines.forEach((l, i) => {
  const m = l.match(HEAD);
  if (m) all.push({ level: m[1].length, id: m[2] ?? null, title: m[3].trim(), line: i });
});
const heads = all.filter((h) => h.id);
// Un apartado acaba en el siguiente encabezado que no sea subapartado suyo (por número, no por nivel de #).
const endOf = (k) => {
  const h = heads[k];
  const from = all.indexOf(h);
  const next = all.slice(from + 1).find((x) => (x.id ? !x.id.startsWith(h.id + ".") : x.level <= h.level));
  return next ? next.line : lines.length;
};
const sectionAt = (i) => [...heads].reverse().find((h) => h.line <= i);
const tokens = (from, to) => Math.round(lines.slice(from, to).join("\n").length / 3.6);
const fold = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const args = process.argv.slice(2).map((a) => a.trim().replace(/^§\s*/, "").trim());
if (process.argv.length > 2 && args.some((a) => a === "")) {
  console.error("Argumento vacío: indica un apartado (1.2) o un término. Sin argumentos se muestra el índice.");
  process.exit(2);
}
if (args.length === 0) {
  for (const [k, h] of heads.entries()) {
    console.log(`${"  ".repeat(h.id.split(".").length - 1)}§${h.id} ${h.title}  (~${tokens(h.line, endOf(k))} tk)`);
  }
  process.exit(0);
}

let missing = 0;
for (const raw of args) {
  // «3.1.» y «03» se leen como apartados
  const a = /^\d+(\.\d+)*\.?$/.test(raw) ? raw.replace(/\.$/, "").split(".").map((n) => String(Number(n))).join(".") : raw;
  if (/^\d+(\.\d+)*$/.test(a)) {
    const k = heads.findIndex((h) => h.id === a);
    if (k < 0) {
      console.error(`No existe el apartado §${a}.`);
      missing++;
      continue;
    }
    console.log(lines.slice(heads[k].line, endOf(k)).join("\n").trimEnd() + "\n");
  } else {
    const term = fold(a);
    const hits = lines.map((l, i) => [l, i]).filter(([l]) => fold(l).includes(term));
    if (hits.length === 0) {
      console.error(`«${a}» no aparece en el contexto.`);
      missing++;
    }
    for (const [l, i] of hits) console.log(`§${sectionAt(i)?.id ?? "-"} L${i + 1}: ${l.trim()}`);
    console.log("");
  }
}
process.exit(missing ? 1 : 0);
