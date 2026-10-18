---
name: estado
description: Muestra tareas, actividad y ejecuciones que necesitan al arquitecto.
---

Ejecuta `node scripts/agent/board.mjs`. Explica brevemente qué está en curso y qué requiere atención: `ready_to_merge`, `needs_opus`, `blocked` e `interrupted`.

Una ejecución sin cambios en sus archivos durante `staleMinutes` se muestra interrumpida. No significa que se haya matado el proceso: compruébalo antes de relanzar. Los detalles están en `.agents/runs/<ID>/`. El usuario puede seguirlos con `/flota` o `scripts/agent/watch.ps1`.
