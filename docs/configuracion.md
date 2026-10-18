# Configuración

El instalador crea `agentloop.config.json` en la raíz de tu proyecto. Debe ser JSON válido, sin comentarios. Guarda las opciones compartidas en Git, sin credenciales. Si no existe, se usan los valores predeterminados; un JSON inválido no se ignora en silencio.

| Campo | Valor predeterminado | Uso |
|---|---|---|
| `executor` | `gpt-6.1-sol` | Implementa la tarea |
| `reviewer` | `gpt-6-luna` | Revisa tareas habituales |
| `criticalReviewer` | `gpt-6-astra` | Revisa tareas críticas |
| `maxRounds` | `3` | Máximo de rondas por lanzamiento |
| `staleMinutes` | `30` | Tiempo sin cambios para mostrar una ejecución interrumpida |
| `worktreeRoot` | `.agentloop-worktrees` | Carpeta de trabajo, relativa a la raíz o absoluta |
| `contextFile` | `docs/specification.md` | Especificación para `ctx.mjs` |
| `gates` | `[]` | Comprobaciones propias, añadidas a las detectadas |
| `infrastructure` | `[]` | Precomprobaciones; cualquier fallo devuelve 2 |

Los nombres de modelo son valores de configuración, no una garantía de acceso. No cambies `worktreeRoot` mientras tengas tareas activas: el bucle necesita encontrar sus carpetas.

Puedes ajustar una invocación con `-Model`, `-ReviewModel`, `-MaxRounds` y `-Critical`. Los parámetros prevalecen sobre el archivo. El arquitecto se elige en Claude Code; `guardas.claudeModel` controla sus subagentes, por defecto `opus`.

## Comprobaciones detectadas

Se buscan `pyproject.toml` y `package.json` en la raíz, `backend/` y `frontend/`. Para otros directorios usa comandos propios. Si existen varios proyectos detectados, se ejecutan todos.

| Proyecto | Comandos |
|---|---|
| Python con uv | `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy .`, `uv run pytest -q` |
| Node con npm | `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, si esos scripts existen |

Cada comando corre desde la carpeta del manifiesto. Declara las herramientas Python en las dependencias de desarrollo. Instala las dependencias Node en el worktree antes de los gates o añade una preparación reproducible a `infrastructure`. El script no añade paquetes ni cambia locks automáticamente. Con pnpm o yarn puedes usar gates explícitos; el detector Node sigue usando npm para los scripts existentes.

## Comandos propios

Los siguientes son fragmentos para el campo `gates`. Se ejecutan desde la raíz del worktree y, al integrar, desde la raíz de main. Son código PowerShell de confianza con tus permisos locales. Una comprobación debe devolver 0 al pasar y otro valor al fallar; para varios comandos es más claro crear un script que propague los errores.

```json
"gates": [
  { "name": "README", "run": "node scripts/check-readme.mjs" },
  { "name": "Go", "run": "go test ./..." }
]
```

Para otro árbol Python, por ejemplo:

```json
"gates": [
  { "name": "API tests", "run": "uv run --directory services/api pytest -q" }
]
```

No copies ejemplos de lenguajes que no uses. Los comandos de la ficha deben corresponder a los detectados o a estas entradas. Un código de salida 2 de un test normal sigue siendo fallo de código: solo `infrastructure` y las precomprobaciones del bucle se clasifican como infraestructura.

## Infraestructura

Si un `pyproject.toml` detectado menciona `testcontainers`, se comprueba Docker antes de ejecutar los tests. Puedes declarar otros requisitos:

```json
"infrastructure": [
  { "name": "Docker disponible", "run": "docker info" }
]
```

Si falla, `gates.ps1` devuelve 2 y el arquitecto repara el entorno. No pongas pruebas de comportamiento aquí: ocultarías errores de código como incidencias del entorno. No se consumen rondas de corrección por infraestructura; el siguiente lanzamiento repite gates y revisión.

## Revisión crítica

En el encabezado de la ficha:

```yaml
critical: true
```

Úsala para permisos, dinero, envíos externos, secretos y cambios en las reglas del bucle. Activa `criticalReviewer` y exige al arquitecto leer el diff completo. El script no puede inferir todos los riesgos del contenido: clasifica la tarea al escribirla.

## Contexto por apartados

Crea la especificación en la ruta de `contextFile` con encabezados numerados, por ejemplo `## 1 Objetivo` y `### 1.1 Alcance`:

```powershell
node scripts/ctx.mjs
node scripts/ctx.mjs 1
node scripts/ctx.mjs permisos
```

Sin argumentos muestra el índice y una estimación de tokens. Con un número extrae ese apartado y sus hijos; con una palabra busca líneas sin distinguir tildes o mayúsculas. Una ruta inexistente o un apartado ausente devuelve error. No hace falta una especificación larga para la primera tarea.
