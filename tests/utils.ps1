param()
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Text.Encoding]::UTF8
$root = Split-Path $PSScriptRoot -Parent
$project = Join-Path $root ('.scratch/utils-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $project | Out-Null
Copy-Item -Path (Join-Path $root 'template/*') -Destination $project -Recurse -Force
$utf8 = New-Object Text.UTF8Encoding $false
$script:count = 0
function Assert($Condition, [string]$Name) {
    if (-not $Condition) { throw "FALLO: $Name" }
    $script:count++; Write-Host "OK: $Name"
}
function Hook([string]$Json, [int]$Expected) {
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $null = $Json | & node (Join-Path $project '.claude/hooks/protect-secrets.mjs') 2>&1; $code = $LASTEXITCODE }
    finally { $ErrorActionPreference = $old }
    Assert ($code -eq $Expected) "hook: salida $Expected"
}
foreach ($target in @('.env', '.env.local', '.env.example.local', 'config/private.pem', 'id_ed25519')) {
    Hook (@{ tool_name = 'Read'; tool_input = @{ file_path = $target } } | ConvertTo-Json) 2
}
Hook (@{ tool_name = 'Read'; tool_input = @{ file_path = '.env.example' } } | ConvertTo-Json) 0
Hook (@{ tool_name = 'Write'; tool_input = @{ file_path = 'README.md'; content = 'Usa .env' } } | ConvertTo-Json) 0
Hook '{' 2
New-Item -ItemType Directory -Path (Join-Path $project 'docs') | Out-Null
[IO.File]::WriteAllText((Join-Path $project 'agentloop.config.json'), '{"contextFile":"docs/guide.md","staleMinutes":1}', $utf8)
[IO.File]::WriteAllText((Join-Path $project 'docs/guide.md'), "# Guía`n## 1 Inicio`n### 1.1 Instalación`nTexto con tildes`n## 2 Uso`nOtro texto`n", $utf8)
$out = & node (Join-Path $project 'scripts/ctx.mjs') 1 | Out-String
Assert ($LASTEXITCODE -eq 0 -and $out -match '1.1 Instalación' -and $out -notmatch '## 2 Uso') 'contexto configurable con subapartados'
$out = & node (Join-Path $project 'scripts/ctx.mjs') instalacion | Out-String
Assert ($LASTEXITCODE -eq 0 -and $out -match 'Instalación') 'búsqueda sin tildes'
$old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
try { $null = & node (Join-Path $project 'scripts/ctx.mjs') 99 2>&1; $code = $LASTEXITCODE }
finally { $ErrorActionPreference = $old }
Assert ($code -eq 1) 'apartado ausente devuelve error'
$runDir = Join-Path $project '.agents/runs/T-001'
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$statusFile = Join-Path $runDir 'status.json'
[IO.File]::WriteAllText($statusFile, '{"state":"executing","round":1,"max_rounds":3}', $utf8)
(Get-Item -LiteralPath $statusFile).LastWriteTimeUtc = (Get-Date).ToUniversalTime().AddMinutes(-2)
$out = & node (Join-Path $project 'scripts/agent/board.mjs') | Out-String
Assert ($LASTEXITCODE -eq 0 -and $out -match 'interrupted') 'tablero respeta staleMinutes'
$status = Get-Content -LiteralPath $statusFile -Raw -Encoding UTF8 | ConvertFrom-Json
Assert ($status.state -eq 'executing') 'tablero no modifica el estado persistido'
Write-Host "$count comprobaciones de utilidades correctas."
