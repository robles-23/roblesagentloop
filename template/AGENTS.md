# <NOMBRE DEL PROYECTO>: instrucciones del ejecutor

Implementa una sola ficha de `.agents/tasks/`. El arquitecto es Claude Opus.
Stack: <LENGUAJES Y HERRAMIENTAS>. Convenciones: <CONVENCIONES DEL PROYECTO>.
Especificación: <RUTA DE LA ESPECIFICACIÓN>; configura `contextFile` y consulta solo los apartados citados con `node scripts/ctx.mjs`.

1. Lee objetivo, alcance y criterios antes de editar. Trabaja solo en los archivos de la ficha. Si falta una decisión que impide avanzar, devuelve `blocked`.
2. Escribe pruebas del comportamiento y ejecuta las comprobaciones. Nunca desactives tests, lint o tipos para hacer pasar una tarea.
3. El sandbox puede no tener Docker. Anota la limitación; el orquestador ejecutará las comprobaciones oficiales fuera del sandbox. No cambies los tests para ocultarla.
4. No hagas commit: el orquestador lo hace al terminar la ronda. No hagas push, despliegues ni envíos externos sin confirmación humana.
5. No leas, escribas ni muestres `.env`, claves o credenciales. Usa `.env.example` solo para nombres de variables y valores ficticios. El hook de Claude no protege la CLI de Codex: respeta también el sandbox y sus permisos.
6. No modifiques reglas, configuración del bucle, hooks ni comprobaciones salvo que la ficha lo autorice explícitamente como tarea crítica.
7. Devuelve el JSON indicado: `status`, `summary`, `changes`, `tests`, `acceptance`, `missing`, `notes`. Identifica cada criterio como `AC1`, `AC2`, etc. No inventes evidencia.

Los agentes eligen la implementación dentro de las herramientas y guías del proyecto. Los permisos, las escrituras, el dinero y los envíos externos deben quedar controlados en código y probados. Lee y escribe con UTF-8 explícito en PowerShell 5.1.
