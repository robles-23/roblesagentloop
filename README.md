# roblesagentloop
<img width="1638" height="650" alt="image" src="https://github.com/user-attachments/assets/ed0a11d0-0cac-447f-b63b-0760eb9e06df" />

Claude Code planifica y revisa; Codex CLI implementa cada tarea en su propia rama.
El bucle pasa comprobaciones, pide una revisión y devuelve los fallos al ejecutor antes de integrar en main.

```text
┌ Flota de agentes ───────────────────────────────────────────────────┐
│ [arquitecto] opus          Preparando la siguiente ficha            │
│ [ejecutor]   gpt-6.1-sol   T-001 · ronda 1/3 · ejecuta: git status  │
│ [revisor]    gpt-6-luna    T-002 · ronda 2/3 · revisando el diff    │
└─────────────────────────────────────────────────────────────────────┘
  /flota: detalle     /flota-modo: tarjetas o líneas     /bucle: diagrama
```

Representación textual de la banda. El mod dibuja personajes en braille y usa un color por rol.

## Instalación en cinco pasos

1. Instala [Git](https://git-scm.com/downloads), [Node.js](https://nodejs.org/en/download), [Claude Code](https://code.claude.com/docs/en/setup) y [Codex CLI](https://developers.openai.com/codex/cli). En Windows sirve PowerShell 5.1. Ejecuta `claude` y `codex` una vez para iniciar sesión. Necesitas suscripción compatible o acceso por API para ambos; el arquitecto consume tokens de Anthropic y cada ejecución/revisión consume uso de Codex.
2. Clona este repositorio y copia la plantilla a tu proyecto:

   ```powershell
   git clone https://github.com/robles-23/roblesagentloop.git
   cd roblesagentloop
   .\install.ps1 -Target C:\dev\mi-proyecto
   ```

   Verás `COPIA` u `OMITE` por archivo. Sin `-Force` se conserva todo archivo existente. Combina manualmente los archivos omitidos, en especial `.claude/settings.json` y `.gitignore`.
3. En `C:\dev\mi-proyecto`, completa los huecos de `AGENTS.md` y `CLAUDE.md`. Revisa `agentloop.config.json`, configura las comprobaciones e ignora `.agents/runs/` y `.agentloop-worktrees/`. El proyecto debe tener una rama `main` con al menos un commit. Guarda la plantilla, la configuración y la ficha en main antes de lanzar. Los pasos exactos están en [instalación](docs/instalacion.md).
4. Abre Claude Code desde tu proyecto e instala los mods:

   ```text
   /plugin marketplace add robles-23/roblesagentloop
   /plugin install agentloop-flota@roblesagentloop
   /plugin install agentloop-guardas@roblesagentloop
   ```

   Reinicia la sesión. La banda requiere una versión de Claude Code con soporte de mods; consulta [compatibilidad y uso](docs/mods.md).
5. Sigue [tu primera tarea](docs/primera-tarea.md). La ficha `T-001` crea un README y un comprobador. Tras configurar su gate, lánzala desde el proyecto:

   ```powershell
   powershell -NoProfile -File scripts/agent/run-task.ps1 -Id T-001
   node scripts/agent/board.mjs
   ```

## Qué incluye
<img width="340" height="168" alt="Captura de pantalla 2026-10-15 171350" src="https://github.com/user-attachments/assets/f95c2385-a57d-4b02-8ef7-0e3fe7ee983a" />

`template/` contiene los scripts, las reglas y las skills que copias a tu proyecto. `plugins/` contiene la banda de actividad y las guardas. No hace falta una base de datos ni un servicio web para el bucle.

Un *worktree* es otra carpeta del mismo repositorio, con su propia rama. Así cada tarea trabaja aislada. Los resultados y logs se guardan en `.agents/runs/<ID>/`; una revisión aprobada no sustituye a las comprobaciones ni a la decisión del arquitecto.

Los modelos predeterminados son `gpt-6.1-sol`, `gpt-6-luna` y `gpt-6-astra`. Se pueden cambiar. Comprueba que tu cuenta admite los IDs elegidos: el repositorio no garantiza su disponibilidad ni incluye créditos. Las rondas y el paralelismo aumentan el consumo; revisa tus límites antes de lanzar varias tareas.

## Guías

- [Cómo funciona, paso a paso](docs/como-funciona.md)
- [Principios y límites](docs/principios.md)
- [Instalación y sistemas operativos](docs/instalacion.md)
- [Primera tarea completa](docs/primera-tarea.md)
- [Configuración y comprobaciones por lenguaje](docs/configuracion.md)
- [Banda y guardas](docs/mods.md)
- [Problemas frecuentes](docs/problemas-frecuentes.md)
- [Contribuir](CONTRIBUTING.md) · [English](README.en.md) · [Cambios](CHANGELOG.md)

Licencia [MIT](LICENSE). Autor: [Óscar Robles](https://github.com/robles-23).
