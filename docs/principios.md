# Principios

## Las comprobaciones mandan

Un revisor puede equivocarse. Un test también puede estar mal diseñado, pero su resultado es reproducible y se puede investigar. Si el revisor aprueba y los tests fallan, no se integra. Corrige el código o demuestra y corrige el error del test; nunca desactives tests, lint o tipos para conseguir un resultado verde.

Un cambio de código sin ninguna comprobación falla. Se permite pasar sin gates solo si los archivos cambiados son documentación o imágenes. Esto evita dar por comprobado un lenguaje que el detector no conoce. Tener un gate no demuestra por sí solo que cubra todo: la ficha y el revisor deben comprobar la cobertura del resultado.

## Una tarea, un resultado verificable

Una tarea debe caber en una ejecución y rondar menos de 400 líneas de cambio. No es un límite mecánico de líneas: es una señal para dividir el trabajo. «Mejora la aplicación» no permite verificar nada. «El comando devuelve 1 cuando falta un encabezado y explica cuál» sí.

Define archivos, criterios y comprobaciones antes de ejecutar. El ejecutor elige cómo implementarlo, pero no amplía el alcance por su cuenta.

## Paralelismo sin pisarse

Un worktree aísla los archivos de trabajo, pero no resuelve decisiones incompatibles. Lanza en paralelo solo tareas que no compartan archivos. Si deben colaborar, acuerda primero un contrato en `docs/`, guárdalo en main y asigna archivos distintos a cada tarea. Si ambas necesitan editar el mismo archivo, ejecútalas en serie.

## Integrar también es una comprobación

Una rama puede pasar sus tests y fallar al juntarse con otra. Por eso la integración usa `git merge --no-ff --no-commit`: deja el resultado en main pendiente de commit, repite las comprobaciones y solo después confirma el merge. Si fallan o hay conflicto, `git merge --abort` restaura la situación anterior. Se exige un directorio limpio para no poner en riesgo cambios ajenos.

El commit aprobado queda guardado en `reviewed_head`. Si alguien cambia la rama después, hay que revisarla otra vez. No hay una opción para saltarse las comprobaciones ni un `-Force` que convierta un fallo en aprobación.

## Las rondas conservan la memoria útil

Cada ronda escribe sus propios archivos. Al relanzar, la numeración continúa y el ejecutor recibe el último veredicto y, si fallaron, las comprobaciones. No se pisa la evidencia anterior.

`maxRounds` limita cada lanzamiento. Una nueva invocación concede otro bloque explícito de rondas; no se relanza sola indefinidamente. `rounds_used` cuenta las rondas de corrección consumidas. El número de archivo sigue creciendo incluso tras incidencias de infraestructura para conservar el diagnóstico.

`-ReviewOnly` sirve después de un arreglo manual guardado en la rama: empieza por comprobaciones y revisión. Si piden cambios, las rondas siguientes vuelven a ejecutar Codex. No aprueba archivos sin commit ni omite los gates.

## Infraestructura no es código

Un motor de contenedores parado no se arregla reescribiendo tests. `gates.ps1` usa salida 2 para esas incidencias, incluidas las precomprobaciones configuradas en `infrastructure`. El bucle las devuelve al arquitecto sin consumir una ronda de corrección. Tras arreglar el entorno, el relanzamiento comienza por gates y revisión, sin repetir la primera implementación.

El sandbox del ejecutor puede no tener Docker aunque el usuario sí lo tenga. El ejecutor debe declarar esa limitación. Las comprobaciones oficiales se ejecutan después, fuera de ese sandbox, con los permisos del proceso que lanzó el bucle. No hay que quitar el sandbox para ocultar el problema.

## Una ejecución puede quedar interrumpida

Cerrar la terminal o reiniciar la máquina puede dejar `status.json` en un estado activo. El tablero y la banda miran la fecha de los archivos: tras 30 minutos sin actividad, por defecto, muestran `interrupted`. El umbral es configurable. Es una sospecha de interrupción, no una prueba de que el proceso murió; comprueba el proceso y sus logs antes de relanzar. Un bloqueo por tarea impide dos escritores simultáneos.

## Gastar contexto donde aporta

El arquitecto consume tokens de Anthropic. Para revisar una tarea normal, lee primero `summary.md`, el veredicto y `git diff --stat`. Abre el diff completo si hay dudas, criterios sin evidencia o una tarea crítica. `ctx.mjs` permite extraer apartados de una especificación larga sin pasarla entera a los modelos.

## Autonomía acotada

Los agentes eligen el camino dentro de las herramientas y guías. Lo fijo es lo que produce efectos: permisos, escrituras, dinero y acciones externas. Esos límites deben estar aplicados en el código del producto, con pruebas. Un texto en el prompt no sustituye a un control de permisos.

Marca como críticas las tareas de permisos, dinero, envíos externos y secretos. Usan `criticalReviewer`, y el arquitecto lee el diff completo. Cambiar las propias reglas del bucle también requiere ese trato.

## Los secretos no son contexto

El hook `protect-secrets.mjs` bloquea referencias directas a `.env` y archivos de claves en las herramientas de Claude. `.env.example` admite ejemplos sin credenciales. Los secretos los gestiona la persona en local.

El hook no intercepta Codex CLI ni puede reconocer todos los programas que construyen una ruta indirectamente. Las guardas de hosts tampoco inspeccionan el tráfico de red ni resuelven DNS. Complementa estas ayudas con permisos de lectura, sandbox, cuentas de desarrollo y controles de red según tu proyecto.

Nada de push, despliegues o envíos reales sin confirmación humana. Los commits locales del bucle sirven para revisar e integrar; no autorizan publicar.
