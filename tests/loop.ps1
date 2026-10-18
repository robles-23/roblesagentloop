# Pruebas sin IA. Solo hace commits en repositorios nuevos dentro de .scratch/.
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$shell = (Get-Process -Id $PID).Path
$scratch = Join-Path $root ('.scratch/tests-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $scratch | Out-Null
$utf8 = New-Object Text.UTF8Encoding $false
$oldPath = $env:PATH
$oldMode = $env:AGENTLOOP_TEST_MODE
$oldCalls = $env:AGENTLOOP_TEST_CALLS
$bin = Join-Path $scratch 'bin'
New-Item -ItemType Directory -Path $bin | Out-Null
$shim = '@echo off' + "`r`n" + 'node "' + (Join-Path $PSScriptRoot 'fake-codex.mjs') + '" %*' + "`r`n"
[IO.File]::WriteAllText((Join-Path $bin 'codex.cmd'), $shim, $utf8)
$env:PATH = $bin + [IO.Path]::PathSeparator + $oldPath
$env:AGENTLOOP_TEST_CALLS = Join-Path $scratch 'calls.jsonl'
$script:count = 0
function Assert($Condition, [string]$Message) {
    if (-not $Condition) { throw "FALLO: $Message" }
    $script:count++; Write-Host "OK: $Message"
}
function Invoke-TestGit([string]$At, [string[]]$Arguments) {
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = & git -C $At @Arguments 2>&1; $code = $LASTEXITCODE }
    finally { $ErrorActionPreference = $old }
    if ($code -ne 0) { throw "git $Arguments : $out" }
    return ($out | Out-String).Trim()
}
function Run([string]$Script, [string[]]$Arguments, [int]$Expected) {
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = & $shell -NoProfile -ExecutionPolicy Bypass -File $Script @Arguments 2>&1; $code = $LASTEXITCODE }
    finally { $ErrorActionPreference = $old }
    if ($code -ne $Expected) { throw "Esperado $Expected, recibido $code en $Script : $out" }
    return ($out | Out-String)
}
function Config([string]$At, [string]$Gate = 'exit 0', [string]$Infra = '') {
    $value = @{ executor = 'test-executor'; reviewer = 'test-reviewer'; criticalReviewer = 'test-critical'; maxRounds = 1; staleMinutes = 1; worktreeRoot = '.agentloop-worktrees'; gates = @(); infrastructure = @() }
    if ($Gate) { $value.gates = @(@{ name = 'Prueba'; run = $Gate }) }
    if ($Infra) { $value.infrastructure = @(@{ name = 'Entorno'; run = $Infra }) }
    [IO.File]::WriteAllText((Join-Path $At 'agentloop.config.json'), ($value | ConvertTo-Json -Depth 6), $utf8)
}
function New-Project([string]$Name) {
    $p = Join-Path $scratch $Name
    $null = Run (Join-Path $root 'install.ps1') @('-Target', $p) 0
    $null = Invoke-TestGit $p @('init', '-b', 'main')
    # Identidad ficticia reservada a estos repositorios de prueba.
    $null = Invoke-TestGit $p @('config', 'user.name', 'Test')
    $null = Invoke-TestGit $p @('config', 'user.email', 'test@example.invalid')
    Config $p
    [IO.File]::WriteAllText((Join-Path $p '.agents/tasks/T-001.md'), "---`nid: T-001`ntitle: README`ncritical: true`n---`n- [ ] AC1: README existe`n", $utf8)
    $null = Invoke-TestGit $p @('add', '.')
    $null = Invoke-TestGit $p @('commit', '-m', 'Fixture inicial')
    return $p
}
function Status([string]$At) { return Get-Content -LiteralPath (Join-Path $At '.agents/runs/T-001/status.json') -Raw -Encoding UTF8 | ConvertFrom-Json }
try {
    $p = New-Project 'success'
    $env:AGENTLOOP_TEST_MODE = 'approve'
    $null = Run (Join-Path $p 'scripts/agent/run-task.ps1') @('-Id', 'T-001') 0
    Assert ((Status $p).state -eq 'ready_to_merge') 'tarea aprobada con modelo configurable'
    Assert ((Status $p).reviewer -eq 'test-critical') 'ficha crítica selecciona criticalReviewer'
    $null = Run (Join-Path $p 'scripts/agent/run-task.ps1') @('-Id', 'T-001', '-ReviewOnly') 0
    Assert ((Status $p).round -eq 2) 'ReviewOnly continúa la numeración'
    Assert (-not (Test-Path (Join-Path $p '.agents/runs/T-001/round-2.exec.log'))) 'ReviewOnly omite la primera implementación'
    $before = Invoke-TestGit $p @('rev-parse', 'HEAD')
    $null = Run (Join-Path $p 'scripts/agent/merge-task.ps1') @('-Id', 'T-001') 0
    Assert ((Status $p).state -eq 'merged') 'integra y marca merged'
    Assert ((Invoke-TestGit $p @('rev-parse', 'HEAD')) -ne $before) 'crea commit del merge después de gates'
    Assert (-not (Test-Path (Join-Path $p '.agentloop-worktrees/T-001'))) 'limpia worktree sin force'

    $p = New-Project 'rollback'
    Config $p 'if (Test-Path main-only.txt) { exit 1 }; exit 0'
    $null = Invoke-TestGit $p @('add', '.'); $null = Invoke-TestGit $p @('commit', '-m', 'Gate condicionado')
    $null = Run (Join-Path $p 'scripts/agent/run-task.ps1') @('-Id', 'T-001') 0
    [IO.File]::WriteAllText((Join-Path $p 'main-only.txt'), 'Cambio paralelo', $utf8)
    $null = Invoke-TestGit $p @('add', '.'); $null = Invoke-TestGit $p @('commit', '-m', 'Otro trabajo')
    $before = Invoke-TestGit $p @('rev-parse', 'HEAD')
    $null = Run (Join-Path $p 'scripts/agent/merge-task.ps1') @('-Id', 'T-001') 1
    Assert ((Invoke-TestGit $p @('rev-parse', 'HEAD')) -eq $before) 'gate sobre main falla y conserva HEAD'
    Assert ((Invoke-TestGit $p @('status', '--porcelain')) -eq '') 'aborto deja main limpio'
    Assert (-not (Test-Path (Join-Path $p 'README.md'))) 'aborto elimina cambios de la tarea'

    $p = New-Project 'resume'
    $env:AGENTLOOP_TEST_MODE = 'reject'
    $null = Run (Join-Path $p 'scripts/agent/run-task.ps1') @('-Id', 'T-001') 1
    $env:AGENTLOOP_TEST_MODE = 'approve'
    $null = Run (Join-Path $p 'scripts/agent/run-task.ps1') @('-Id', 'T-001') 0
    $prompt = Get-Content -LiteralPath (Join-Path $p '.agents/runs/T-001/round-2.prompt.md') -Raw -Encoding UTF8
    Assert ($prompt -match 'detalle de uso') 'relanzamiento conserva el feedback del revisor'
    Assert (Test-Path (Join-Path $p '.agents/runs/T-001/round-1.review.json')) 'no sobrescribe rondas anteriores'
    $wt = Join-Path $p '.agentloop-worktrees/T-001'
    [IO.File]::WriteAllText((Join-Path $wt 'later.txt'), 'Después de revisar', $utf8)
    $null = Run (Join-Path $p 'scripts/agent/merge-task.ps1') @('-Id', 'T-001') 1
    Assert ((Status $p).state -ne 'merged') 'rechaza un worktree sucio'
    $null = Invoke-TestGit $wt @('add', '.'); $null = Invoke-TestGit $wt @('commit', '-m', 'Cambio posterior')
    $null = Run (Join-Path $p 'scripts/agent/merge-task.ps1') @('-Id', 'T-001') 1
    Assert ((Status $p).state -ne 'merged') 'rechaza un commit distinto del aprobado'

    $p = New-Project 'infra'
    Config $p 'exit 0' 'exit 1'
    $null = Invoke-TestGit $p @('add', '.'); $null = Invoke-TestGit $p @('commit', '-m', 'Infra de prueba')
    $null = Run (Join-Path $p 'scripts/agent/run-task.ps1') @('-Id', 'T-001') 2
    Assert ((Status $p).rounds_used -eq 0) 'infra no consume ronda'
    Assert ((Status $p).gates -eq 'infra') 'infra escala al arquitecto'
    Config $p
    $null = Invoke-TestGit $p @('add', '.'); $null = Invoke-TestGit $p @('commit', '-m', 'Infra reparada')
    $null = Run (Join-Path $p 'scripts/agent/run-task.ps1') @('-Id', 'T-001') 0
    Assert (-not (Test-Path (Join-Path $p '.agents/runs/T-001/round-2.exec.log'))) 'infra reparada reanuda sin ejecutar implementación'

    foreach ($mode in @('invalid', 'missing-ac', 'cli-fail')) {
        $p = New-Project $mode; $env:AGENTLOOP_TEST_MODE = $mode
        $null = Run (Join-Path $p 'scripts/agent/run-task.ps1') @('-Id', 'T-001') 1
        Assert ((Status $p).state -ne 'ready_to_merge') "rechaza $mode"
    }
    $p = New-Project 'no-gates'
    Config $p ''
    $null = Invoke-TestGit $p @('add', '.'); $null = Invoke-TestGit $p @('commit', '-m', 'Sin gates')
    [IO.File]::WriteAllText((Join-Path $p 'program.go'), 'package main', $utf8)
    $null = Run (Join-Path $p 'scripts/agent/gates.ps1') @('-Path', $p) 1
    Assert $true 'lenguaje no detectado sin comprobaciones falla'
    # Archivo concreto dentro del fixture, sin borrado recursivo.
    Remove-Item -LiteralPath (Join-Path $p 'program.go')
    [IO.File]::WriteAllText((Join-Path $p 'README.md'), '# Documentación', $utf8)
    $null = Run (Join-Path $p 'scripts/agent/gates.ps1') @('-Path', $p) 0
    Assert $true 'solo documentación sin gates pasa'
    $readme = Join-Path $p 'AGENTS.md'
    [IO.File]::WriteAllText($readme, 'Conservar', $utf8)
    $null = Run (Join-Path $root 'install.ps1') @('-Target', $p) 0
    Assert ((Get-Content -LiteralPath $readme -Raw -Encoding UTF8) -eq 'Conservar') 'instalador no sobrescribe sin Force'
    $null = Run (Join-Path $root 'install.ps1') @('-Target', $p, '-Force') 0
    Assert ((Get-Content -LiteralPath $readme -Raw -Encoding UTF8) -ne 'Conservar') 'Force sobrescribe de forma explícita'

    $p = New-Project 'node'
    Config $p ''
    [IO.File]::WriteAllText((Join-Path $p 'package.json'), '{"scripts":{"lint":"node -e \"process.exit(1)\"","typecheck":"node -e \"process.exit(0)\"","test":"node -e \"process.exit(0)\"","build":"node -e \"process.exit(0)\""}}', $utf8)
    $output = Run (Join-Path $p 'scripts/agent/gates.ps1') @('-Path', $p) 1
    Assert ($output -match 'npm lint' -and $output -match 'npm typecheck' -and $output -match 'npm test' -and $output -match 'npm build') 'detecta los cuatro scripts Node y propaga su fallo'

    $p = New-Project 'python'
    Config $p ''
    New-Item -ItemType Directory -Path (Join-Path $p 'backend') | Out-Null
    [IO.File]::WriteAllText((Join-Path $p 'backend/pyproject.toml'), '[project]', $utf8)
    [IO.File]::WriteAllText((Join-Path $bin 'uv.cmd'), "@echo off`r`necho UV %*`r`nexit /b 0`r`n", $utf8)
    $output = Run (Join-Path $p 'scripts/agent/gates.ps1') @('-Path', $p) 0
    Assert ($output -match 'UV run ruff check' -and $output -match 'UV run ruff format --check' -and $output -match 'UV run mypy' -and $output -match 'UV run pytest') 'detecta Python en backend con cuatro comprobaciones uv'

    $p = New-Project 'conflict'
    $env:AGENTLOOP_TEST_MODE = 'approve'
    $null = Run (Join-Path $p 'scripts/agent/run-task.ps1') @('-Id', 'T-001') 0
    [IO.File]::WriteAllText((Join-Path $p 'README.md'), '# Otra versión incompatible', $utf8)
    $null = Invoke-TestGit $p @('add', '.'); $null = Invoke-TestGit $p @('commit', '-m', 'Cambio en main')
    $before = Invoke-TestGit $p @('rev-parse', 'HEAD')
    $null = Run (Join-Path $p 'scripts/agent/merge-task.ps1') @('-Id', 'T-001') 1
    Assert ((Invoke-TestGit $p @('rev-parse', 'HEAD')) -eq $before -and (Invoke-TestGit $p @('status', '--porcelain')) -eq '') 'conflicto abortado sin cambiar main'
    Write-Host "$count comprobaciones correctas. Fixtures conservados en .scratch/ para diagnóstico."
} finally {
    $env:PATH = $oldPath
    $env:AGENTLOOP_TEST_MODE = $oldMode
    $env:AGENTLOOP_TEST_CALLS = $oldCalls
}

