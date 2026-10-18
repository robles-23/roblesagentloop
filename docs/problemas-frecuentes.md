# Problemas frecuentes

## El instalador dice OMITE

El archivo ya existía y no se ha tocado. Compara la plantilla con tu archivo y combina las partes que necesites. No uses `-Force` por costumbre: sobrescribe archivos completos, incluidas reglas y configuración. Comprueba especialmente los hooks y las entradas de `.gitignore`.

## Git no encuentra main o no puede crear un commit

El proyecto necesita una rama `main` con un commit. Comprueba `git branch`, `git status` y tu identidad de Git. No hace falta publicar el repositorio. El ejecutor no crea los commits; los crea el script del bucle con tu configuración local.

## No hay comprobaciones para mi lenguaje

Añade comandos a `gates`. El detector cubre Python con uv y Node con npm en raíz, `backend/` y `frontend/`. No adivina cómo probar otros árboles. Si cambias código sin ejecutar ninguna comprobación, falla de forma deliberada.

## Faltan paquetes en el worktree

Git copia archivos versionados, no `node_modules` ni el entorno virtual. Instala las dependencias reproducibles de tu proyecto en el worktree. Puedes añadir una preparación explícita a `infrastructure`, por ejemplo `npm ci` para un proyecto Node con lock en la raíz. Decide tú si esa instalación es adecuada para cada ejecución; el bucle no la añade automáticamente.

## Docker falla en el ejecutor

El sandbox puede no tener acceso a Docker. El ejecutor debe anotarlo; los gates oficiales corren después fuera de ese sandbox. Si estos también devuelven 2, comprueba el motor y sus permisos en la terminal desde la que lanzaste la tarea. Relanza cuando responda. No quites los tests ni gastes rondas pidiendo al ejecutor que cambie código por un fallo del entorno.

## needs_opus o blocked

Lee `summary.md` y los archivos de la última ronda. `blocked` indica que falta una decisión o que no hay trabajo nuevo que revisar. `needs_opus` puede indicar rondas agotadas, un fallo de CLI, JSON inválido, Git o infraestructura. Los detalles importan más que el nombre del estado.

Corrige la causa y relanza el mismo ID. La numeración continúa. Cada invocación concede hasta `maxRounds` rondas; no hay relanzamientos automáticos sin límite.

## La revisión aprueba pero no se puede integrar

Los gates deben haber pasado, todos los criterios deben tener evidencia y la rama debe seguir en el commit revisado. Si editaste manualmente, guarda el cambio en la rama de tarea y ejecuta `-ReviewOnly`. Main y el worktree deben estar limpios. No hay un parámetro para saltarse esas condiciones.

## Falla el merge

Si hay conflicto o fallan las comprobaciones del resultado, el script aborta el merge. Lee `.agents/runs/<ID>/merge.gates.txt` si existe y decide cómo adaptar la tarea al main actual. Revisa `git status` si el aborto también falla; no hagas un reset destructivo a ciegas. Si el merge ya se confirmó pero falla la limpieza, el estado será `merged`: conserva los logs y limpia la rama o el worktree cuando estén libres.

## La tarea parece activa pero no hace nada

Mira los logs y los procesos. El tablero la mostrará interrumpida después de `staleMinutes` sin escrituras. Una comprobación larga y silenciosa también puede superar ese umbral: ajústalo si hace falta. El bloqueo se libera cuando termina el proceso; no borres archivos para forzar dos ejecuciones simultáneas.

## La banda no se ve o el logo se corta

Reinicia Claude Code, comprueba que los plugins están habilitados y que existe actividad. Prueba `/flota` y `/flota-modo`. La columna braille tiene dos caracteres de margen; si tu superficie aún recorta, usa modo línea y comunica la versión y la fuente. No incluyas logs privados al abrir una incidencia.

## El modelo no está disponible

Revisa tu acceso y cambia el ID en `agentloop.config.json`. No es un motivo para quitar las comprobaciones. Los modelos de la configuración son predeterminados del proyecto, no un compromiso del proveedor.

## Caracteres raros en PowerShell

Los scripts se guardan en UTF-8 con BOM para que PowerShell 5.1 los lea correctamente. Las lecturas y escrituras de texto usan UTF-8 explícito. Conserva esa codificación al editar. No uses `Get-Content` o `Set-Content` sin `-Encoding UTF8` en 5.1.
