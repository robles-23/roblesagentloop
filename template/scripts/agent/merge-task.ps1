param([Parameter(Mandatory)][ValidatePattern('^T-[0-9]{3,}$')][string]$Id)
. (Join-Path $PSScriptRoot 'common.ps1')
$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$Config = Read-LoopConfig $Root
$RunDir = Join-Path $Root ".agents/runs/$Id"
$sFile = Join-Path $RunDir 'status.json'
if (-not (Test-Path -LiteralPath $sFile)) { throw "No hay ejecución para $Id" }
$lock = Open-LoopLock (Join-Path $RunDir 'run.lock')
$mergeLock = $null; $merging = $false
try {
    $mergeLock = Open-LoopLock (Join-Path $Root '.agents/runs/merge.lock')
    $status = Get-Content -LiteralPath $sFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $Branch = "task/$Id"
    $Wt = Get-WorktreePath $Root $Config $Id
    if ($status.state -ne 'ready_to_merge' -or $status.gates -ne 'pass' -or $status.verdict -ne 'approve') { throw 'La tarea no está aprobada. Usa run-task.ps1 -ReviewOnly después de corregirla.' }
    if ((Invoke-Git $Root @('branch', '--show-current')) -ne 'main') { throw 'Cambia a main antes de integrar.' }
    if (Invoke-Git $Root @('status', '--porcelain')) { throw 'main tiene cambios sin commit. Guárdalos antes de integrar.' }
    if (Invoke-Git $Wt @('status', '--porcelain')) { throw 'El worktree tiene cambios sin commit.' }
    if ((Invoke-Git $Wt @('branch', '--show-current')) -ne $Branch) { throw 'Rama inesperada en el worktree.' }
    if ((Invoke-Git $Root @('rev-parse', $Branch)) -ne $status.reviewed_head) { throw 'La rama cambió después de revisarse. Ejecuta -ReviewOnly.' }
    $mergeHead = Invoke-Git $Root @('rev-parse', '--git-path', 'MERGE_HEAD')
    if (-not [IO.Path]::IsPathRooted($mergeHead)) { $mergeHead = Join-Path $Root $mergeHead }
    $merging = $true
    $null = Invoke-Git $Root @('merge', '--no-ff', '--no-commit', $Branch)
    if (-not (Test-Path -LiteralPath $mergeHead)) { $merging = $false; throw 'No hay merge pendiente; comprueba si la rama ya se integró.' }
    $gCode = Invoke-Gates $Root $Root (Join-Path $RunDir 'merge.gates.txt')
    if ($gCode -ne 0) {
        $null = Invoke-Git $Root @('merge', '--abort'); $merging = $false
        if ($gCode -eq 2) { Write-Warning 'Infraestructura no disponible; merge deshecho.'; exit 2 }
        throw 'Las comprobaciones fallan sobre main + tarea; merge deshecho. Consulta merge.gates.txt.'
    }
    if (Invoke-Git $Root @('diff', '--name-only')) { throw 'Una comprobación modificó archivos versionados; revisa el gate antes de integrar.' }
    $null = Invoke-Git $Root @('commit', '-m', "Integra $Id", '-m', "Revisión: $($status.reviewer). Comprobaciones aprobadas en rama y main.")
    $merging = $false
    $status.state = 'merged'; $status.updated = (Get-Date).ToUniversalTime().ToString('o')
    Write-Json $sFile $status
    Add-Content -LiteralPath (Join-Path $RunDir 'summary.md') -Value "`nIntegrada en main: $($status.updated)" -Encoding UTF8
    # Nunca eliminar con --force: conservar cualquier cambio aparecido durante las comprobaciones.
    $null = Invoke-Git $Root @('worktree', 'remove', $Wt)
    $null = Invoke-Git $Root @('branch', '-d', $Branch)
    Write-Host "$Id integrada en main. Sin push ni despliegue."
} catch {
    if ($merging) {
        try { $null = Invoke-Git $Root @('merge', '--abort') } catch { Write-Warning 'Revisa git status: no se pudo abortar el merge.' }
    }
    Write-Error $_ -ErrorAction Continue
    exit 1
} finally {
    if ($mergeLock) { $mergeLock.Dispose() }
    $lock.Dispose()
}
