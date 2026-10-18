param()
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$files = @(Get-ChildItem -LiteralPath (Join-Path $root 'template'), (Join-Path $root 'plugins'), (Join-Path $root 'tests') -Recurse -File -Force |
    Where-Object { $_.FullName -notmatch '[\\/]\.claude-plugin[\\/]types[\\/]' })
$files += Get-Item -LiteralPath (Join-Path $root 'install.ps1')
foreach ($file in $files) {
    if ($file.Extension -eq '.ps1') {
        $tokens = $null; $errors = $null
        [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$errors) | Out-Null
        if ($errors.Count) { throw "$($file.Name): $errors" }
        $bytes = [IO.File]::ReadAllBytes($file.FullName)
        if ($bytes[0] -ne 239 -or $bytes[1] -ne 187 -or $bytes[2] -ne 191) { throw "Falta BOM UTF-8 para PS 5.1: $($file.Name)" }
    }
    if ($file.Extension -eq '.mjs') {
        & node --check $file.FullName
        if ($LASTEXITCODE -ne 0) { throw "Sintaxis Node: $($file.Name)" }
    }
    if ($file.Extension -eq '.json') { $null = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json }
}
Write-Host 'OK: parser PowerShell, BOM UTF-8, sintaxis Node y JSON.'
