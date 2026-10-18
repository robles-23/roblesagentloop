// Solo para tests: recibe los mismos argumentos que codex exec y no llama a ninguna IA.
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2);
const output = args[args.indexOf('-o') + 1];
const review = args[args.indexOf('--sandbox') + 1] === 'read-only';
const mode = process.env.AGENTLOOP_TEST_MODE ?? 'approve';
const prompt = readFileSync(0, 'utf8');
appendFileSync(process.env.AGENTLOOP_TEST_CALLS, JSON.stringify({ args, review, prompt }) + '\n');
if (mode === 'cli-fail') process.exit(7);
if (review && mode === 'invalid') { writeFileSync(output, '{}'); process.exit(0); }
if (!review) writeFileSync(join(process.cwd(), 'README.md'), '# Proyecto de prueba\n\nCambio verificable.\n');
const acceptance = [{ id: 'AC1', met: true, evidence: 'README existe' }];
const value = review ? {
  verdict: mode === 'reject' ? 'changes_requested' : 'approve', summary: 'Revisión simulada',
  issues: mode === 'reject' ? [{ severity: 'major', file: 'README.md', line: 1, problem: 'Falta el detalle solicitado', fix: 'Añade el detalle de uso' }] : [],
  acceptance: mode === 'missing-ac' ? [] : acceptance,
} : { status: 'done', summary: 'README actualizado', changes: ['README.md'], tests: ['simulado'], acceptance, missing: [], notes: [] };
writeFileSync(output, JSON.stringify(value));
console.log(review ? 'codex\nRevisando el README.' : 'codex\nEscribiendo el README.');
