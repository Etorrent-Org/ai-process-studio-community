$ErrorActionPreference = "Stop"

. "$PSScriptRoot\install\APS-Common.ps1"

Set-ApsRoot
Assert-ApsDocker

docker compose build --pull

if ($LASTEXITCODE -ne 0) {
    throw "Docker image rebuild failed."
}

docker compose up -d --force-recreate

if ($LASTEXITCODE -ne 0) {
    throw "Unable to recreate AI Process Studio."
}

$Health = Wait-ApsHealth -TimeoutSeconds 90

Write-Host ""
Write-Host "AI Process Studio updated." -ForegroundColor Green
Write-Host "Version: $($Health.version)"
Write-Host "Schema: $($Health.schema)"
