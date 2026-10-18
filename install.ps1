param([Parameter(Mandatory)][string]$Target, [switch]$Force)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$destination = [IO.Path]::GetFullPath($Target)
$source = Join-Path $PSScriptRoot 'template'
if ($destination.TrimEnd('\', '/') -eq $PSScriptRoot.TrimEnd('\', '/')) { throw 'Elige el proyecto de destino, no el repositorio del instalador.' }
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$files = @(Get-ChildItem -LiteralPath $source -Recurse -File -Force | ForEach-Object {
    [PSCustomObject]@{ Source = $_.FullName; Relative = $_.FullName.Substring($source.Length + 1) }
})
$files += [PSCustomObject]@{ Source = (Join-Path $PSScriptRoot 'agentloop.config.example.json'); Relative = 'agentloop.config.json' }
$skipped = 0; $copied = 0
foreach ($file in $files) {
    $dest = Join-Path $destination $file.Relative
    # No atravesar enlaces o junctions existentes al copiar.
    $cursor = $dest
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -LiteralPath $cursor -Force
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Destino con enlace: $cursor" }
        }
        $cursor = Split-Path $cursor -Parent
    }
    if ((Test-Path -LiteralPath $dest) -and -not $Force) {
        Write-Host "OMITE (ya existe): $($file.Relative)"; $skipped++; continue
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
    Copy-Item -LiteralPath $file.Source -Destination $dest -Force:$Force
    Write-Host "COPIA: $($file.Relative)"; $copied++
}
Write-Host "$copied archivos copiados; $skipped omitidos."
Write-Host 'Revisa AGENTS.md, CLAUDE.md, agentloop.config.json y los archivos omitidos antes de lanzar una tarea.'
Write-Host 'Añade .agents/runs/ y .agentloop-worktrees/ a tu .gitignore si ya tenías uno.'
Write-Host 'El instalador no combina settings existentes, no instala plugins y no hace commits.'
