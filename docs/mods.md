# Banda y guardas

Los mods son plugins de Claude Code con módulos TypeScript. El bucle de scripts funciona sin ellos; la banda permite ver actividad y las guardas aplican algunas reglas antes de ejecutar herramientas.

## Instalación

En Claude Code, desde tu proyecto:

```text
/plugin marketplace add robles-23/roblesagentloop
/plugin install agentloop-flota@roblesagentloop
/plugin install agentloop-guardas@roblesagentloop
```

Reinicia la sesión. Para probar una copia local del repositorio puedes añadir el marketplace con `/plugin marketplace add C:/dev/roblesagentloop`.

Se ha usado Claude Code 2.1.299 para validar los mods. No se garantiza que una versión anterior acepte módulos TS ni las superficies de interfaz. Comprueba `claude plugin test --help`. Si no está disponible, actualiza tu CLI según su documentación o usa el tablero y `watch.ps1` mientras verificas compatibilidad.

## agentloop-flota

La banda aparece encima del prompt cuando hay subagentes de Claude o ejecuciones activas de Codex. Muestra modelo, ronda y última actividad del log. Consulta el archivo de configuración en la raíz del proyecto en cada lectura de ejecuciones.

- `/flota`: abre el detalle, incluidas tareas terminadas o interrumpidas.
- `/flota-modo`: alterna tarjetas de braille y una línea por agente.
- `/bucle`: abre el diagrama de los pasos del bucle.

Los personajes y colores representan roles: arquitecto, ejecutor, revisor, revisor crítico y comprobaciones. Cambiar el nombre del modelo no cambia su papel visual. El diagrama usa roles para no quedarse obsoleto al cambiar la configuración.

Las tarjetas tienen anchura y altura fijas. `fit` recorta el texto antes de dibujarlo. El logo mide ocho caracteres braille por tres filas; su columna mide `ART_W + 2` para que no se corte con la fuente proporcional de VS Code. Solo se anima cuando hay actividad.

Una ejecución sin escrituras durante `staleMinutes` aparece como interrumpida y deja de animarse. Eso no mata el proceso. En superficies sin paneles puede seguir apareciendo la banda; usa el tablero para ver todos los estados.

## agentloop-guardas

Añade a `agentloop.config.json` una política como esta:

```json
"guardas": {
  "blockedHosts": ["production.example.com"],
  "allowedHosts": [],
  "claudeModel": "opus"
}
```

`blockedHosts` bloquea hosts exactos o patrones `*.example.com`. `allowedHosts` vacío no impone una lista de permitidos; si tiene entradas, rechaza cualquier host detectado que no coincida. El bloqueo prevalece sobre el permiso. `*.example.com` permite subdominios, no el host `example.com` ni un nombre que solo contenga ese texto.

La regla inspecciona argumentos de Bash, PowerShell y WebFetch. No resuelve DNS, no sigue redirecciones y no ve hosts construidos dinámicamente dentro de un programa. También puede confundir un nombre de archivo con un host si activas la lista de permitidos. Usa controles de red reales cuando necesites una garantía de aislamiento.

Las guardas exigen UTF-8 explícito al leer o escribir con los cmdlets habituales de PowerShell y fijan el modelo de los nuevos subagentes de Claude. Las bifurcaciones heredan el modelo del padre. El modelo de la sesión principal se elige en Claude Code.

No se debe guardar credenciales en la configuración. Un fallo al leer la política bloquea la herramienta; corrige el JSON antes de continuar.

## Hook de secretos

La plantilla instala `.claude/hooks/protect-secrets.mjs` y lo conecta en `.claude/settings.json`. Bloquea referencias directas a `.env` y archivos de claves; permite `.env.example`. Si ya tenías settings, combina los hooks manualmente: el instalador los habrá omitido.

Este hook pertenece a Claude Code. No intercepta los procesos de Codex CLI ni sustituye a permisos del sistema o al sandbox. Evita exponer secretos en los directorios accesibles al agente.

## Comprobar los mods al desarrollar

```powershell
claude plugin validate plugins/agentloop-flota --strict
claude plugin test plugins/agentloop-flota
claude plugin validate plugins/agentloop-guardas --strict
claude plugin test plugins/agentloop-guardas
```

Los tests cubren el renderizado en varias superficies, el recorte, la interrupción, los roles y las guardas. Un test de renderizado no sustituye a comprobar la apariencia en tu VS Code y su fuente.
