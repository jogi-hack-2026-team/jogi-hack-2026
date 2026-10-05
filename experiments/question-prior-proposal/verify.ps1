param(
    [Parameter(Mandatory = $true)][string]$NodePath,
    [Parameter(Mandatory = $true)][string]$TscPath
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Push-Location $PSScriptRoot
try {
    & $NodePath verify.mjs $TscPath
    if ($LASTEXITCODE -ne 0) { throw "Local verification failed (exit $LASTEXITCODE)" }
} finally { Pop-Location }
