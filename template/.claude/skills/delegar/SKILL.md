---
name: delegar
description: Divide una implementación en fichas verificables y lanza Codex en worktrees independientes.
---

1. Lee las reglas del proyecto y los apartados necesarios con `node scripts/ctx.mjs`. Si no hay especificación, usa la petición y el código existente.
2. Copia `.agents/tasks/_TEMPLATE.md` a un ID libre `T-NNN.md`. Define un resultado de menos de unas 400 líneas, archivos, límites, criterios `AC1` y comandos de comprobación. Configura las comprobaciones no detectadas en `agentloop.config.json`.
3. Marca `critical: true` si toca permisos, dinero, envíos externos, secretos o reglas del bucle. Usa los modelos de la configuración, no nombres fijados en esta skill.
4. Comprueba `depends_on`: todas las dependencias deben estar integradas. Paraleliza solo archivos independientes; un contrato compartido se acuerda y guarda en `docs/` antes de lanzar.
5. Guarda ficha, configuración y reglas en un commit de main. Si el usuario ha prohibido commits, prepara la ficha y explica que el lanzamiento espera a que se guarde en main.
6. Ejecuta `powershell -NoProfile -File scripts/agent/run-task.ps1 -Id T-NNN`. En macOS/Linux usa `pwsh`. Puedes dejar el proceso en segundo plano con la herramienta del entorno; en Windows no abras ventanas visibles innecesarias.
7. Indica cómo seguirlo: `node scripts/agent/board.mjs`, `/flota` o la tarea de VS Code «Ver Codex en vivo».
8. No edites el trabajo delegado mientras corre. Al terminar usa `/revisar`.
