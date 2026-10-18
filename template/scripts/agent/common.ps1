# Compartido por los scripts. Compatible con Windows PowerShell 5.1.
$ErrorActionPreference = 'Stop'
$script:Utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $script:Utf8
$OutputEncoding = $script:Utf8
$script:Shell = (Get-Process -Id $PID).Path

function Read-LoopConfig([string]$Root) {
    $config = @{
        executor = 'gpt-6.1-sol'; reviewer = 'gpt-6-luna'; criticalReviewer = 'gpt-6-astra'
        maxRounds = 3; staleMinutes = 30; worktreeRoot = '.agentloop-worktrees'
        gates = @(); infrastructure = @(); contextFile = 'docs/specification.md'
    }
    $file = Join-Path $Root 'agentloop.config.json'
    if (Test-Path -LiteralPath $file) {
        $value = Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($p in $value.PSObject.Properties) { $config[$p.Name] = $p.Value }
    }
    foreach ($key in @('executor', 'reviewer', 'criticalReviewer')) {
        if ($config[$key] -isnot [string] -or $config[$key] -notmatch '^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$') { throw "Modelo no válido: $key" }
    }
    foreach ($key in @('maxRounds', 'staleMinutes')) {
        if ($config[$key] -notmatch '^\d+$' -or [int]$config[$key] -lt 1) { throw "$key debe ser un entero positivo" }
    }
    if (-not ($config.worktreeRoot -is [string]) -or -not $config.worktreeRoot.Trim()) { throw 'worktreeRoot no válido' }
    foreach ($key in @('gates', 'infrastructure')) {
        foreach ($gate in $config[$key]) {
            if (-not $gate.name -or -not ($gate.run -is [string]) -or -not $gate.run.Trim()) { throw "$key requiere name y run" }
        }
    }
    return $config
}

function Get-WorktreePath([string]$Root, $Config, [string]$Id) {
    $base = $Config.worktreeRoot
    if (-not [IO.Path]::IsPathRooted($base)) { $base = Join-Path $Root $base }
    return [IO.Path]::GetFullPath((Join-Path $base $Id))
}

function Invoke-Git([string]$At, [string[]]$Arguments) {
    # Git escribe avisos en stderr; PS 5.1 no debe convertirlos en errores terminantes.
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $out = & git -C $At @Arguments 2>&1; $code = $LASTEXITCODE }
    finally { $ErrorActionPreference = $old }
    if ($code -ne 0) { throw "git $($Arguments -join ' ') falló ($code): $out" }
    return ($out | Out-String).Trim()
}

function Write-Json([string]$File, $Value) {
    $temp = "$File.tmp"
    [IO.File]::WriteAllText($temp, ($Value | ConvertTo-Json -Depth 12), $script:Utf8)
    Move-Item -LiteralPath $temp -Destination $File -Force
}

function Open-LoopLock([string]$File) {
    try { return [IO.File]::Open($File, 'OpenOrCreate', 'ReadWrite', 'None') }
    catch { throw "Ya hay otro proceso usando este bucle: $File" }
}

function Invoke-Gates([string]$At, [string]$ConfigRoot, [string]$Log) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $script:Shell -NoProfile -File (Join-Path $PSScriptRoot 'gates.ps1') -Path $At -ConfigRoot $ConfigRoot *>&1 |
            Out-File -LiteralPath $Log -Encoding UTF8
        return $LASTEXITCODE
    } finally { $ErrorActionPreference = $old }
}
