$ErrorActionPreference = "Stop"

. "$PSScriptRoot\install\APS-Common.ps1"

Set-ApsRoot
Assert-ApsDocker

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}

docker compose build --pull

if ($LASTEXITCODE -ne 0) {
    throw "Docker image build failed."
}

docker compose up -d

if ($LASTEXITCODE -ne 0) {
    throw "Unable to start AI Process Studio."
}

$Health = Wait-ApsHealth -TimeoutSeconds 90

Write-Host ""
Write-Host "AI Process Studio installed." -ForegroundColor Green
Write-Host "URL: http://127.0.0.1:3080"
Write-Host "Version: $($Health.version)"
