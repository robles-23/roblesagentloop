# Muestra en directo la salida de Codex. Sin -Id sigue siempre el log más reciente (cambia solo de tarea o de ronda).
param([string]$Id = "")

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Runs = Join-Path $Root ".agents\runs"
if ($Id) { $Runs = Join-Path $Runs $Id }
New-Item -ItemType Directory -Force $Runs | Out-Null

$current = $null; $pos = 0
Write-Host "Esperando ejecuciones de Codex en $Runs ... (Ctrl+C para salir)" -ForegroundColor DarkGray
while ($true) {
    $latest = Get-ChildItem $Runs -Recurse -Filter "*.log" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latest -and $latest.FullName -ne $current) {
        $current = $latest.FullName; $pos = 0
        Write-Host "`n===== $($latest.Directory.Name) / $($latest.Name) =====" -ForegroundColor Magenta
    }
    if ($current) {
        try {
            $fs = [System.IO.File]::Open($current, 'Open', 'Read', 'ReadWrite')
            if ($fs.Length -gt $pos) {
                $fs.Seek($pos, 'Begin') | Out-Null
                $buf = New-Object byte[] ($fs.Length - $pos)
                $n = $fs.Read($buf, 0, $buf.Length); $pos += $n
                [Console]::Write([System.Text.Encoding]::UTF8.GetString($buf, 0, $n))
            }
            $fs.Close()
        } catch {}
    }
    Start-Sleep -Milliseconds 700
}
