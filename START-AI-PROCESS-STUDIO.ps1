$ErrorActionPreference = "Stop"

. "$PSScriptRoot\install\APS-Common.ps1"

Set-ApsRoot
Assert-ApsDocker

docker compose up -d

if ($LASTEXITCODE -ne 0) {
    throw "Unable to start AI Process Studio."
}

$Health = Wait-ApsHealth -TimeoutSeconds 60

Write-Host ""
Write-Host "AI Process Studio is running." -ForegroundColor Green
Write-Host "URL: http://127.0.0.1:3080"
Write-Host "Version: $($Health.version)"
Write-Host "Schema: $($Health.schema)"
