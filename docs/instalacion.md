# Instalación

## Requisitos en Windows

- Git disponible en la terminal, con nombre y correo configurados por ti para crear commits.
- Node.js 22 o posterior para los scripts `.mjs`.
- Windows PowerShell 5.1; también puedes usar PowerShell 7.
- Claude Code y Codex CLI instalados y autenticados. Abre cada CLI una vez y completa su inicio de sesión sin pegar credenciales en el repositorio.
- Para Python: uv y ruff, mypy y pytest declarados en el proyecto. Para Node: npm y las dependencias instaladas. Docker solo es necesario si tus pruebas lo usan.

Comprueba desde PowerShell:

```powershell
git --version
node --version
$PSVersionTable.PSVersion
claude --version
codex --version
claude plugin test --help
```

La banda usa el runtime de mods TypeScript de Claude Code. Se ha validado con Claude Code 2.1.299; no se ha establecido una versión mínima. Si tu CLI no admite `plugin test` o módulos de hooks, consulta [mods](mods.md). Los scripts del bucle se pueden usar sin la banda.

Necesitas suscripción compatible o API de Claude Code y Codex. El arquitecto usa tokens de Anthropic; ejecutar y revisar usa consumo de Codex. Las cuentas, modelos y límites disponibles dependen de tu acceso. Este repositorio no paga llamadas ni gestiona tus claves.

## Copiar al proyecto

```powershell
git clone https://github.com/robles-23/roblesagentloop.git
cd roblesagentloop
.\install.ps1 -Target C:\dev\mi-proyecto
```

Si Windows impide ejecutar el archivo descargado, revisa primero su contenido y ejecuta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Target C:\dev\mi-proyecto
```

La excepción solo afecta a ese proceso. No necesitas cambiar la política global.

El instalador copia `template/` y crea `agentloop.config.json` a partir del ejemplo. Dice `COPIA` para los archivos nuevos y `OMITE` para los existentes. No combina JSON ni reemplaza reglas existentes sin `-Force`. Usa ese parámetro solo después de revisar los cambios y guardar una copia: sobrescribe también tus instrucciones y configuración.

Si ya tenías `.claude/settings.json`, combina a mano los hooks y permisos de la plantilla con los tuyos. Si se omitió `.gitignore`, añade:

```gitignore
.agents/runs/
.agentloop-worktrees/
```

Ignora también los secretos y los directorios de dependencias. Si cambias `worktreeRoot` a otra carpeta dentro del proyecto, ignórala. Los logs pueden contener código privado: no los publiques.

## Preparar main

Para un proyecto nuevo:

```powershell
cd C:\dev\mi-proyecto
git init -b main
```

En un proyecto existente, comprueba `git status` y `git branch`. El bucle integra en `main`; si tu rama principal tiene otro nombre, acuerda su cambio antes de usarlo. No renombres ramas compartidas a ciegas.

Completa los huecos `<ASÍ>` de `AGENTS.md` y `CLAUDE.md`. Ajusta modelos y comprobaciones en `agentloop.config.json`. Para T-001 sigue la configuración del [tutorial](primera-tarea.md).

Revisa lo que vas a guardar y haz el commit inicial:

```powershell
git status --short
git add AGENTS.md CLAUDE.md agentloop.config.json .gitignore .agents/tasks .claude .vscode scripts
git diff --cached --stat
git commit -m "Configura el bucle de agentes"
```

El worktree nace de main. Las reglas, las dependencias y la ficha deben estar en esa rama antes de lanzar. No copies credenciales al worktree. En cada worktree instala las dependencias que requiera tu proyecto; `gates.ps1` no ejecuta `npm ci` automáticamente. Puedes declarar una preparación reproducible como precomprobación de infraestructura si tu entorno la necesita, sin secretos.

## Instalar los mods

Desde Claude Code abierto en tu proyecto:

```text
/plugin marketplace add robles-23/roblesagentloop
/plugin install agentloop-flota@roblesagentloop
/plugin install agentloop-guardas@roblesagentloop
```

Reinicia la sesión. Prueba `/bucle` y `/flota`. Los comandos de tareas están en [primera tarea](primera-tarea.md).

## macOS y Linux

Los scripts Node y los mods no dependen de rutas personales ni de `cmd.exe`. Los scripts PowerShell usan rutas relativas y lanzan las comprobaciones con el mismo motor de PowerShell que los ejecuta. Con PowerShell 7 puedes usar:

```powershell
pwsh -NoProfile -File ./install.ps1 -Target /ruta/mi-proyecto
pwsh -NoProfile -File scripts/agent/run-task.ps1 -Id T-001
```

No se ha probado el bucle completo en macOS ni Linux. Debes verificar permisos de ejecución, sandbox de Codex y tus herramientas de pruebas. Las tareas de VS Code incluidas llaman a `powershell`: cambia `command` a `pwsh`. Los comandos propios de `gates` se interpretan como PowerShell también en esos sistemas.

La CLI acepta `--sandbox`, `--output-schema` y salida a archivo en ejecución no interactiva; puedes contrastar las opciones de tu versión con `codex exec --help` y la [documentación oficial de ejecución no interactiva](https://developers.openai.com/codex/noninteractive). La distribución del catálogo sigue el [formato oficial de marketplaces de Claude Code](https://code.claude.com/docs/en/plugin-marketplaces).
