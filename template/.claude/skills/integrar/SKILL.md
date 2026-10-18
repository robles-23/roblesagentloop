---
name: integrar
description: Integra una tarea aprobada en main con comprobaciones y vuelta atrás si fallan.
---

1. Usa `/revisar` antes de integrar. En tareas críticas revisa todo el diff.
2. Comprueba que main y el worktree están limpios y que la rama no cambió desde el veredicto.
3. Ejecuta `powershell -NoProfile -File scripts/agent/merge-task.ps1 -Id T-NNN` (o `pwsh` en macOS/Linux).
4. El script hace merge sin commit, comprueba el resultado y solo entonces crea el commit. Si hay conflictos o falla una comprobación, aborta el merge. Lee `merge.gates.txt` antes de devolver la tarea al ejecutor.
5. No hay `-Force` para saltarse la aprobación. Tras arreglos manuales, guarda un commit en la rama y usa `-ReviewOnly`.
6. Comprueba si se desbloquea otra ficha. No hagas push ni despliegues sin confirmación humana.
