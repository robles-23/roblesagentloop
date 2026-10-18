---
name: revisar
description: Lee el resumen y el veredicto de una tarea y decide el siguiente paso.
---

Lee `.agents/runs/<ID>/summary.md`, el último `round-N.review.json`, el resultado y `git diff --stat main...task/<ID>`. Abre el diff completo si es crítica, hay criterios sin evidencia, cambios fuera de alcance o dudas del revisor. Las comprobaciones fallidas siempre bloquean la integración.

- `ready_to_merge`: comprueba que cumple la ficha y usa `/integrar`.
- `needs_opus` con `gates: infra`: repara el entorno. Al relanzar se repiten comprobaciones y revisión sin volver a ejecutar la implementación inicial. La incidencia no consume una ronda de corrección.
- `needs_opus` por rondas agotadas: diagnostica la causa. Añade instrucciones a la ficha antes de conceder otro bloque de rondas. El relanzamiento mantiene la numeración y el feedback anterior.
- `blocked`: resuelve la decisión o dependencia que falta.
- `interrupted` en el tablero: comprueba que el proceso ha terminado antes de relanzar. El umbral no mata procesos.

Para revisar cambios ya guardados en la rama: `powershell -NoProfile -File scripts/agent/run-task.ps1 -Id T-NNN -ReviewOnly`. Omite solo la primera implementación; si la revisión pide cambios, las siguientes rondas sí ejecutan Codex. Nunca desactives tests para que pasen.
