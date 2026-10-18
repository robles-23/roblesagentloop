# Contribuir

Abre una incidencia con el problema, el resultado esperado y un ejemplo pequeño sin datos privados. Para un cambio de código, crea una rama y una solicitud de cambios. Explica el comportamiento antes y después y cómo lo has comprobado.

## Reglas

- Mantén PowerShell 5.1: sin `&&`, ternarios ni APIs exclusivas de PowerShell 7. Guarda `.ps1` en UTF-8 con BOM y especifica UTF-8 en lecturas y escrituras.
- No debilites gates, revisión, sandbox ni vuelta atrás para hacer pasar una prueba.
- Mantén configurables los modelos y asigna el arte de la banda por rol.
- Conserva braille, `fit`, tarjetas de tamaño fijo y la columna del logo `ART_W + 2`.
- Usa español de España, ejemplos neutros y documentación que pueda seguir alguien nuevo.
- No añadas credenciales, rutas personales, logs privados ni material de `_source/`. Esa carpeta está ignorada y no forma parte de la distribución.

## Comprobaciones

Desde Windows PowerShell 5.1:

```powershell
powershell -NoProfile -File tests/check.ps1
powershell -NoProfile -File tests/loop.ps1
powershell -NoProfile -File tests/utils.ps1
claude plugin validate plugins/agentloop-flota --strict
claude plugin test plugins/agentloop-flota
claude plugin validate plugins/agentloop-guardas --strict
claude plugin test plugins/agentloop-guardas
claude plugin validate . --strict
claude plugin validate plugins --strict
```

Las pruebas del bucle usan una CLI simulada, crean repositorios Git temporales dentro de `.scratch/` y hacen commits solo en esos repositorios. No llaman a modelos ni modifican el historial del repositorio de trabajo. Permiten comprobar las ramas de éxito y fallo sin consumir créditos.

Revisa `git diff --check` y los archivos nuevos antes de enviar. Si no pudiste ejecutar alguna comprobación, dilo en la solicitud. No publiques `_source/` ni fuerces su inclusión con Git.
