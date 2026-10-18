// Validador del subconjunto de JSON Schema usado por los dos contratos del bucle.
import { readFileSync } from 'node:fs';
const read = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
function check(value, schema, path = '$') {
  const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  if (schema.type === 'integer' ? !Number.isInteger(value) : type !== schema.type) throw new Error(`${path}: tipo incorrecto`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path}: valor no permitido`);
  if (type === 'object') {
    for (const key of schema.required ?? []) if (!(key in value)) throw new Error(`${path}.${key}: falta`);
    for (const key of Object.keys(value)) {
      if (!schema.properties[key]) throw new Error(`${path}.${key}: campo inesperado`);
      check(value[key], schema.properties[key], `${path}.${key}`);
    }
  }
  if (type === 'array') value.forEach((v, i) => check(v, schema.items, `${path}[${i}]`));
}
try { check(read(process.argv[3]), read(process.argv[2])); }
catch (error) { console.error(error.message); process.exit(1); }
