$ErrorActionPreference = "Stop"

. "$PSScriptRoot\install\APS-Common.ps1"

Set-ApsRoot

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Archive = Join-Path $script:ApsRoot "backups\AI-Process-Studio-$Stamp.zip"
$Tmp = Join-Path $env:TEMP "aps-backup-$Stamp"

Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Path "$Tmp\data" -Force | Out-Null
New-Item -ItemType Directory -Path "$Tmp\license" -Force | Out-Null

Copy-Item ".\data\*" "$Tmp\data\" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item ".\license\*" "$Tmp\license\" -Recurse -Force -ErrorAction SilentlyContinue

if (Test-Path ".env") {
    Copy-Item ".env" "$Tmp\.env"
}

Copy-Item ".\VERSION" "$Tmp\VERSION"

Compress-Archive `
    -Path "$Tmp\*" `
    -DestinationPath $Archive `
    -Force

Remove-Item $Tmp -Recurse -Force

Write-Host "Backup created:" -ForegroundColor Green
Write-Host $Archive
