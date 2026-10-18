param(
    [Parameter(Mandatory)][ValidatePattern('^T-[0-9]{3,}$')][string]$Id,
    [string]$Model = '', [string]$ReviewModel = '',
    [ValidateRange(1, 100)][int]$MaxRounds,
    [switch]$Critical, [switch]$ReviewOnly
)
. (Join-Path $PSScriptRoot 'common.ps1')
$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$Config = Read-LoopConfig $Root
if (-not $Model) { $Model = $Config.executor }
if (-not $PSBoundParameters.ContainsKey('MaxRounds')) { $MaxRounds = $Config.maxRounds }
$Task = Join-Path $Root ".agents/tasks/$Id.md"
$RunDir = Join-Path $Root ".agents/runs/$Id"
$Wt = Get-WorktreePath $Root $Config $Id
$Branch = "task/$Id"
$Schemas = Join-Path $PSScriptRoot 'schemas'
if (-not (Test-Path -LiteralPath $Task)) { throw "No existe $Task" }
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) { throw 'Instala y autentica Codex CLI antes de lanzar tareas.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Falta Node.js.' }
$taskText = Get-Content -LiteralPath $Task -Raw -Encoding UTF8
if ($taskText -match '(?m)^critical:\s*true\s*(#.*)?$') { $Critical = $true }
if (-not $ReviewModel) {
    if ($Critical) { $ReviewModel = $Config.criticalReviewer } else { $ReviewModel = $Config.reviewer }
}
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
$lock = Open-LoopLock (Join-Path $RunDir 'run.lock')
$sFile = Join-Path $RunDir 'status.json'
$status = [ordered]@{
    id = $Id; state = 'starting'; round = 0; max_rounds = $MaxRounds; rounds_used = 0
    executor = $Model; reviewer = $ReviewModel; critical = [bool]$Critical
    branch = $Branch; worktree = $Wt; gates = $null; verdict = $null
    summary = ''; reviewed_head = ''; started = (Get-Date).ToUniversalTime().ToString('o'); updated = ''
}
function Save-Status([string]$State) {
    $status.state = $State; $status.updated = (Get-Date).ToUniversalTime().ToString('o')
    Write-Json $sFile $status
    Write-Host "[$Id] $State (ronda $($status.round))"
}
function Invoke-Codex([string]$RoleModel, [string]$Sandbox, [string]$Prompt, [string]$Output, [string]$Schema, [string]$Log) {
    # La llamada nativa recibe argumentos separados, sin construir comandos cmd /c.
    $arguments = @('exec', '-m', $RoleModel, '--sandbox', $Sandbox, '--output-schema', $Schema, '-o', $Output, '-')
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    Push-Location $Wt
    try {
        Get-Content -LiteralPath $Prompt -Raw -Encoding UTF8 | & codex @arguments 2>&1 |
            ForEach-Object { $_ | Out-File -LiteralPath $Log -Append -Encoding UTF8 }
        $code = $LASTEXITCODE
    } finally { Pop-Location; $ErrorActionPreference = $old }
    if ($code -ne 0 -or -not (Test-Path -LiteralPath $Output)) { throw "Codex falló ($code). Consulta $Log" }
    & node (Join-Path $PSScriptRoot 'validate-json.mjs') $Schema $Output
    if ($LASTEXITCODE -ne 0) { throw "Resultado JSON inválido: $Output" }
    return Get-Content -LiteralPath $Output -Raw -Encoding UTF8 | ConvertFrom-Json
}
try {
    $null = Invoke-Git $Root @('rev-parse', '--verify', 'main')
    $feedback = ''; $start = 1; $skipExecutor = [bool]$ReviewOnly
    if (Test-Path -LiteralPath $sFile) {
        $prev = Get-Content -LiteralPath $sFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($prev.state -eq 'merged') { throw 'La tarea ya está integrada. Crea otra ficha.' }
        $start = [int]$prev.round + 1
        $status.rounds_used = [int]$prev.rounds_used
        $status.summary = $prev.summary
        $lastReview = Join-Path $RunDir "round-$($prev.round).review.json"
        $lastGates = Join-Path $RunDir "round-$($prev.round).gates.txt"
        if (Test-Path -LiteralPath $lastReview) {
            $feedback += "Último veredicto (corrige las incidencias pendientes):`n" + (Get-Content -LiteralPath $lastReview -Raw -Encoding UTF8)
        }
        if ($prev.gates -eq 'fail' -and (Test-Path -LiteralPath $lastGates)) {
            $feedback += "`nComprobaciones fallidas:`n" + (Get-Content -LiteralPath $lastGates -Raw -Encoding UTF8)
        }
        if ($prev.gates -eq 'infra') { $skipExecutor = $true }
    }
    $status.max_rounds = $start + $MaxRounds - 1
    if (-not (Test-Path -LiteralPath $Wt)) {
        if ($ReviewOnly) { throw '-ReviewOnly necesita el worktree existente de la tarea.' }
        New-Item -ItemType Directory -Force -Path (Split-Path $Wt -Parent) | Out-Null
        $branches = Invoke-Git $Root @('branch', '--list', $Branch)
        if ($branches) { $null = Invoke-Git $Root @('worktree', 'add', $Wt, $Branch) }
        else { $null = Invoke-Git $Root @('worktree', 'add', '-b', $Branch, $Wt, 'main') }
    }
    if ((Invoke-Git $Wt @('branch', '--show-current')) -ne $Branch) { throw 'El worktree no está en la rama esperada.' }
    if ($skipExecutor -and (Invoke-Git $Wt @('status', '--porcelain'))) { throw '-ReviewOnly requiere cambios guardados en un commit de la rama de tarea.' }
    $approved = $false
    for ($r = $start; $r -lt $start + $MaxRounds; $r++) {
        $status.round = $r; $status.gates = $null; $status.verdict = $null
        if (-not ($skipExecutor -and $r -eq $start)) {
            Save-Status 'executing'
            $prompt = @"
Eres el ejecutor del proyecto. Sigue AGENTS.md. Trabajas en $Branch para $Id.
No hagas commit, push ni despliegues. No leas secretos. No cambies las reglas del bucle ni desactives comprobaciones.
Tu sandbox puede no tener Docker; documenta ese límite. Las comprobaciones oficiales corren después fuera de él.
Entrega el JSON del esquema de resultado. Comprueba cada criterio de aceptación con evidencia.

===== TAREA =====
$taskText

===== FEEDBACK ANTERIOR =====
$feedback
"@
            $pFile = Join-Path $RunDir "round-$r.prompt.md"
            Set-Content -LiteralPath $pFile -Value $prompt -Encoding UTF8
            $result = Invoke-Codex $Model 'workspace-write' $pFile (Join-Path $RunDir "round-$r.result.json") (Join-Path $Schemas 'result.schema.json') (Join-Path $RunDir "round-$r.exec.log")
            $status.summary = $result.summary
            $null = Invoke-Git $Wt @('add', '-A')
            if (Invoke-Git $Wt @('diff', '--cached', '--name-only')) {
                $null = Invoke-Git $Wt @('commit', '-m', "$Id ronda $r", '-m', $status.summary)
            }
            if ($result.status -eq 'blocked') { Save-Status 'blocked'; break }
            if ($result.status -ne 'done' -or $result.missing.Count -gt 0 -or @($result.acceptance | Where-Object { -not $_.met }).Count -gt 0) {
                $feedback = 'Completa lo pendiente: ' + ($result | ConvertTo-Json -Depth 8)
                $status.rounds_used++; continue
            }
        }
        if ([int](Invoke-Git $Wt @('rev-list', '--count', 'main..HEAD')) -eq 0) { Save-Status 'blocked'; break }
        Save-Status 'gates'
        $gFile = Join-Path $RunDir "round-$r.gates.txt"
        $gCode = Invoke-Gates $Wt $Root $gFile
        if ($gCode -eq 2) {
            $status.gates = 'infra'; $status.summary = "Infraestructura no disponible. Consulta round-$r.gates.txt; corrige el entorno y relanza."
            Save-Status 'needs_opus'; break
        }
        $status.rounds_used++
        if ($gCode -ne 0) {
            $status.gates = 'fail'
            $feedback = "Comprobaciones fallidas:`n" + (Get-Content -LiteralPath $gFile -Raw -Encoding UTF8)
            continue
        }
        $status.gates = 'pass'
        Save-Status 'reviewing'
        $head = Invoke-Git $Wt @('rev-parse', 'HEAD')
        $diff = Invoke-Git $Wt @('diff', 'main...HEAD')
        if ($diff.Length -gt 120000) { $diff = $diff.Substring(0, 120000) + "`n[Diff truncado. Lee git diff main...HEAD para el resto.]" }
        $prompt = @"
Eres el revisor en solo lectura. No modifiques archivos. Sigue AGENTS.md y las referencias de la ficha.
Revisa la tarea $Id en $Branch contra main. Comprueba cada criterio con evidencia.
Busca errores reales, cambios fuera de alcance y comprobaciones eliminadas o debilitadas.
Revisa especialmente permisos, dinero, envíos externos y secretos. No hagas acciones externas.
Emite changes_requested por blocker/major o criterios incumplidos; minor no bloquea por sí solo.
Devuelve el JSON del esquema de revisión. Puedes leer archivos y ejecutar git diff main...HEAD.

===== TAREA =====
$taskText

===== DIFF =====
$diff
"@
        $pFile = Join-Path $RunDir "round-$r.review.prompt.md"
        Set-Content -LiteralPath $pFile -Value $prompt -Encoding UTF8
        $verdict = Invoke-Codex $ReviewModel 'read-only' $pFile (Join-Path $RunDir "round-$r.review.json") (Join-Path $Schemas 'review.schema.json') (Join-Path $RunDir "round-$r.review.log")
        if ((Invoke-Git $Wt @('rev-parse', 'HEAD')) -ne $head -or (Invoke-Git $Wt @('status', '--porcelain'))) { throw 'La rama cambió durante la revisión.' }
        $status.verdict = $verdict.verdict
        $bad = @($verdict.issues | Where-Object { $_.severity -in @('blocker', 'major') }).Count
        $unmet = @($verdict.acceptance | Where-Object { -not $_.met }).Count
        $ids = @([regex]::Matches($taskText, '(?m)^- \[[ xX]\] (AC\d+):') | ForEach-Object { $_.Groups[1].Value })
        $missingIds = @($ids | Where-Object { $_ -notin @($verdict.acceptance.id) }).Count
        if ($ids.Count -eq 0) { throw 'La ficha debe declarar criterios con el formato - [ ] AC1: ...' }
        if ($verdict.verdict -eq 'approve' -and $bad -eq 0 -and $unmet -eq 0 -and $missingIds -eq 0) {
            $status.reviewed_head = $head; $approved = $true; break
        }
        $feedback = "Corrige el veredicto y todos los criterios sin evidencia:`n" + ($verdict | ConvertTo-Json -Depth 8)
    }
    if ($approved) { Save-Status 'ready_to_merge' }
    elseif ($status.state -notin @('blocked', 'needs_opus')) { Save-Status 'needs_opus' }
} catch {
    $status.summary = $_.Exception.Message
    Save-Status 'needs_opus'
    Write-Warning $status.summary
} finally {
    $summary = "# ${Id}: $($status.state)`n`nRonda: $($status.round)/$($status.max_rounds). Rondas consumidas: $($status.rounds_used).`nEjecutor: $Model. Revisor: $ReviewModel.`nComprobaciones: $($status.gates). Veredicto: $($status.verdict).`n`n$($status.summary)`n`nConsulta round-N.result.json, round-N.gates.txt y round-N.review.json.`n"
    try { $summary += "`n" + (Invoke-Git $Root @('diff', '--stat', "main...$Branch")) } catch {}
    Set-Content -LiteralPath (Join-Path $RunDir 'summary.md') -Value $summary -Encoding UTF8
    $lock.Dispose()
}
if ($status.state -eq 'ready_to_merge') { exit 0 }
if ($status.gates -eq 'infra') { exit 2 }
exit 1
