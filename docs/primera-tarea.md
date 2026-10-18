# Primera tarea: README con comprobación

Este ejemplo añade un README útil y un pequeño comprobador con Node. No necesita una aplicación previa ni dependencias de npm. Parte de la plantilla instalada en un repositorio con rama main.

## 1. Leer y ajustar la ficha

Abre `.agents/tasks/T-001.md`. Ya contiene objetivo, archivos permitidos y cuatro criterios. Puedes adaptar el propósito del proyecto; conserva criterios comprobables y los IDs `AC1` a `AC4`.

El ejecutor puede cambiar `README.md` y crear `scripts/check-readme.mjs`. El comprobador debe aceptar una ruta opcional, detectar tres encabezados y devolver un código distinto de cero si falta alguno.

## 2. Configurar la comprobación

Edita `agentloop.config.json`: sustituye `"gates": []` por:

```json
"gates": [
  { "name": "README", "run": "node scripts/check-readme.mjs" }
]
```

Es un fragmento del JSON, no un archivo completo. Mantén las comas entre propiedades. El script aún no existe: lo creará el ejecutor antes de los gates. Si tu proyecto ya tiene comprobaciones, conserva sus entradas.

Guarda ficha y configuración en main:

```powershell
git add .agents/tasks/T-001.md agentloop.config.json
git commit -m "Define la primera tarea"
```

Si ya entraron en el commit de instalación y no has cambiado nada, no necesitas otro commit.

## 3. Lanzar

```powershell
powershell -NoProfile -File scripts/agent/run-task.ps1 -Id T-001
```

Verás estados parecidos a estos:

```text
[T-001] executing (ronda 1)
[T-001] gates (ronda 1)
[T-001] reviewing (ronda 1)
[T-001] ready_to_merge (ronda 1)
```

Si el revisor pide cambios, la siguiente ronda recibe el detalle. El proceso sale con 0 cuando está listo, 1 si necesita atención o 2 si falta infraestructura. No integra por sí solo.

Mientras corre, en otra terminal:

```powershell
node scripts/agent/board.mjs
powershell -NoProfile -File scripts/agent/watch.ps1 -Id T-001
```

Detén el seguimiento con Ctrl+C. También puedes usar `/flota` o las tareas de VS Code.

## 4. Revisar

Pide `/revisar T-001` a Claude o lee estos archivos:

```powershell
Get-Content .agents/runs/T-001/summary.md -Encoding UTF8
Get-Content .agents/runs/T-001/round-1.review.json -Encoding UTF8
git diff --stat main...task/T-001
```

Usa el número de la última ronda que muestre el resumen. Comprueba la evidencia del caso negativo: un archivo sin encabezados debe devolver 1. Un revisor que diga «bien» sin cubrir los criterios no basta.

Para hacer un arreglo manual, entra en `.agentloop-worktrees/T-001`, guarda allí un commit y vuelve a la raíz del proyecto. Después ejecuta:

```powershell
powershell -NoProfile -File scripts/agent/run-task.ps1 -Id T-001 -ReviewOnly
```

No crea otro worktree ni vuelve a implementar la primera ronda. Si luego pide cambios, las rondas siguientes sí usan el ejecutor.

## 5. Integrar

Con main limpio y la decisión del arquitecto tomada:

```powershell
powershell -NoProfile -File scripts/agent/merge-task.ps1 -Id T-001
git log -1 --oneline
node scripts/agent/board.mjs
```

El script mezcla sin commit, ejecuta otra vez la comprobación del README sobre main y solo entonces crea el commit. Si falla, aborta el merge. Si pasa, verás `T-001 integrada en main`, el worktree y la rama de tarea se eliminan, y los logs quedan disponibles.

No se hace push. Para la siguiente tarea copia `_TEMPLATE.md` con otro ID libre; no reutilices una tarea integrada.
