$ErrorActionPreference = "Stop"

. "$PSScriptRoot\install\APS-Common.ps1"

Set-ApsRoot
Assert-ApsDocker

docker compose stop

if ($LASTEXITCODE -ne 0) {
    throw "Unable to stop AI Process Studio."
}

Write-Host "AI Process Studio stopped." -ForegroundColor Green
