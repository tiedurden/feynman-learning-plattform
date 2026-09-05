<#
.SYNOPSIS
    Starts the Feynman backend, picking a database automatically.

.DESCRIPTION
    Docker/PostgreSQL is optional. This script checks whether a PostgreSQL
    server is reachable:

      * reachable  -> starts with the default profile (PostgreSQL + Flyway),
                      so your data is persisted.
      * unreachable-> starts with the "h2" profile (in-memory database,
                      Flyway disabled). Nothing to install, but data is lost
                      when the process stops.

.PARAMETER Profile
    Force a profile instead of auto-detecting: 'postgres' or 'h2'.

.EXAMPLE
    ./run-backend.ps1
    ./run-backend.ps1 -Profile h2
#>
[CmdletBinding()]
param(
    [ValidateSet('auto', 'postgres', 'h2')]
    [string]$Profile = 'auto',

    [string]$DbHost = 'localhost',
    [int]$DbPort = 5432
)

$ErrorActionPreference = 'Stop'
$backendDir = Join-Path $PSScriptRoot 'backend'

function Test-PostgresReachable {
    param([string]$TargetHost, [int]$Port)
    # A raw TCP probe is enough and avoids needing psql installed.
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $connect = $client.BeginConnect($TargetHost, $Port, $null, $null)
        if (-not $connect.AsyncWaitHandle.WaitOne(1000, $false)) { return $false }
        $client.EndConnect($connect)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

if ($Profile -eq 'auto') {
    if (Test-PostgresReachable -TargetHost $DbHost -Port $DbPort) {
        $Profile = 'postgres'
    } else {
        $Profile = 'h2'
    }
}

Push-Location $backendDir
try {
    if ($Profile -eq 'h2') {
        Write-Host "No PostgreSQL on ${DbHost}:${DbPort} - starting with the in-memory H2 database." -ForegroundColor Yellow
        Write-Host "Data will NOT be persisted. Run 'docker compose up -d' (or install PostgreSQL) for a real database." -ForegroundColor Yellow
        mvn spring-boot:run "-Dspring-boot.run.profiles=h2"
    } else {
        Write-Host "PostgreSQL detected on ${DbHost}:${DbPort} - starting with the default profile." -ForegroundColor Green
        mvn spring-boot:run
    }
} finally {
    Pop-Location
}

