Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:ApsRoot = Split-Path -Parent $PSScriptRoot

function Set-ApsRoot {
    Set-Location $script:ApsRoot
}

function Assert-ApsDocker {
    $Docker = Get-Command docker -ErrorAction SilentlyContinue

    if (-not $Docker) {
        throw "Docker CLI is not installed or not available in PATH."
    }

    docker info *> $null

    if ($LASTEXITCODE -ne 0) {
        throw "Docker Engine is not available."
    }

    docker compose version *> $null

    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose is not available."
    }
}

function Wait-ApsHealth {
    param(
        [int]$TimeoutSeconds = 60
    )

    $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    do {
        try {
            $Health = Invoke-RestMethod `
                -Uri "http://127.0.0.1:3080/api/health" `
                -Method Get `
                -TimeoutSec 5

            if ($Health.status -eq "ok") {
                return $Health
            }
        }
        catch {
        }

        Start-Sleep -Seconds 2
    }
    while ((Get-Date) -lt $Deadline)

    throw "AI Process Studio did not become healthy within $TimeoutSeconds seconds."
}
