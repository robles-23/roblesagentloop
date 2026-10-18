param([Parameter(Mandatory)][string]$Path, [string]$ConfigRoot = '')
. (Join-Path $PSScriptRoot 'common.ps1')
if (-not $ConfigRoot) { $ConfigRoot = $Path }
$failed = @(); $ran = 0
function Step([string]$Name, [string]$Command, [switch]$Infrastructure) {
    Write-Output "=== $Name"
    # Un proceso separado aísla exit, LASTEXITCODE y errores de cada comando.
    $body = '$ErrorActionPreference = ''Stop''; [Console]::OutputEncoding = [Text.Encoding]::UTF8; $OutputEncoding = [Text.Encoding]::UTF8; $global:LASTEXITCODE = 0; try { ' + $Command + '; if (-not $?) { exit 1 }; exit $LASTEXITCODE } catch { Write-Error $_ -ErrorAction Continue; exit 1 }'
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($body))
    & $script:Shell -NoProfile -EncodedCommand $encoded
    $code = $LASTEXITCODE
    if ($Infrastructure) {
        if ($code -ne 0) { Write-Output "RESULTADO: INFRA -> $Name"; exit 2 }
    } else {
        $script:ran++
        if ($code -ne 0) { $script:failed += $Name; Write-Output "FALLA ($code): $Name" }
        else { Write-Output "OK: $Name" }
    }
}
try {
    $config = Read-LoopConfig $ConfigRoot
    Push-Location -LiteralPath $Path
    try {
        # Root, backend y frontend cubren los casos habituales. Otros directorios: gates propios.
        $pythonDirs = @('.', 'backend', 'frontend' | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'pyproject.toml') })
        $nodeDirs = @('.', 'backend', 'frontend' | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'package.json') })
        if ($pythonDirs.Count -gt 0 -and -not (Get-Command uv -ErrorAction SilentlyContinue)) { Write-Output 'RESULTADO: INFRA -> falta uv'; exit 2 }
        if ($nodeDirs.Count -gt 0 -and -not (Get-Command npm -ErrorAction SilentlyContinue)) { Write-Output 'RESULTADO: INFRA -> falta npm'; exit 2 }
        foreach ($dir in $pythonDirs) {
            $py = Get-Content -LiteralPath (Join-Path $dir 'pyproject.toml') -Raw -Encoding UTF8
            if ($py -match 'testcontainers') { Step 'Docker' 'docker info' -Infrastructure }
        }
        foreach ($pre in $config.infrastructure) { Step $pre.name $pre.run -Infrastructure }
        foreach ($dir in $pythonDirs) {
            Push-Location -LiteralPath $dir
            try {
                Step "$dir ruff" 'uv run ruff check .'
                Step "$dir formato" 'uv run ruff format --check .'
                Step "$dir tipos" 'uv run mypy .'
                Step "$dir tests" 'uv run pytest -q'
            } finally { Pop-Location }
        }
        foreach ($dir in $nodeDirs) {
            $pkg = Get-Content -LiteralPath (Join-Path $dir 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
            Push-Location -LiteralPath $dir
            try {
                # Instala dependencias explícitamente antes de lanzar el bucle; gates no modifica locks.
                foreach ($name in @('lint', 'typecheck', 'test', 'build')) {
                    if ($pkg.scripts -and $pkg.scripts.PSObject.Properties.Name -contains $name) { Step "$dir npm $name" "npm run $name" }
                }
            } finally { Pop-Location }
        }
        foreach ($gate in $config.gates) { Step $gate.name $gate.run }
        if ($ran -eq 0) {
            # diff main incluye el índice de un merge --no-commit, además de la rama y el directorio.
            $changed = (Invoke-Git $Path @('diff', '--name-only', 'main')) -split '\r?\n'
            $changed += (Invoke-Git $Path @('ls-files', '--others', '--exclude-standard')) -split '\r?\n'
            $code = @($changed | Where-Object { $_ -and $_ -notmatch '(?i)(^|/)[^/]*\.(md|txt|rst|adoc|png|jpe?g|gif|svg|webp|ico)$' })
            if ($code.Count -gt 0) { Write-Output "RESULTADO: FALLA -> cambios sin comprobaciones: $($code -join ', ')"; exit 1 }
            Write-Output 'Solo documentación o imágenes; no hay comprobaciones configuradas.'
        }
    } finally { Pop-Location }
} catch { Write-Output "RESULTADO: INFRA -> $($_.Exception.Message)"; exit 2 }
if ($failed.Count -gt 0) { Write-Output "RESULTADO: FALLAN -> $($failed -join ', ')"; exit 1 }
Write-Output "RESULTADO: TODO OK ($ran comprobaciones)"
exit 0
