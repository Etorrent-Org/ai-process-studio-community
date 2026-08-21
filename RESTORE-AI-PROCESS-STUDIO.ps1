param(
    [Parameter(Mandatory = $true)]
    [string]$ArchivePath
)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot\install\APS-Common.ps1"

Set-ApsRoot
Assert-ApsDocker

$Archive = Resolve-Path $ArchivePath
$Tmp = Join-Path $env:TEMP "aps-restore"

Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $Tmp -Force | Out-Null

Expand-Archive -Path $Archive -DestinationPath $Tmp -Force

docker compose stop

New-Item -ItemType Directory -Path ".\data" -Force | Out-Null
New-Item -ItemType Directory -Path ".\licenses" -Force | Out-Null

if (Test-Path "$Tmp\data") {
    Copy-Item "$Tmp\data\*" ".\data\" -Recurse -Force
}

if (Test-Path "$Tmp\licenses") {
    Copy-Item "$Tmp\licenses\*" ".\licenses\" -Recurse -Force
}
elseif (Test-Path "$Tmp\license") {
    Copy-Item "$Tmp\license\*" ".\licenses\" -Recurse -Force
}

if (Test-Path "$Tmp\.env") {
    Copy-Item "$Tmp\.env" ".\.env" -Force
}

Remove-Item $Tmp -Recurse -Force

docker compose up -d

if ($LASTEXITCODE -ne 0) {
    throw "Unable to restart AI Process Studio after restore."
}

$Health = Wait-ApsHealth -TimeoutSeconds 60

Write-Host "Restore completed." -ForegroundColor Green
Write-Host "Version: $($Health.version)"
