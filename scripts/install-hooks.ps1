[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    $current = git config --get core.hooksPath
    if ($LASTEXITCODE -notin @(0, 1)) { throw 'Cannot read hooksPath.' }
    if ($current -and $current -ne '.githooks') { throw 'An existing hooksPath is configured. Integrate it manually; do not overwrite it.' }
    if (-not $current) {
        $hooks = git rev-parse --git-path hooks
        if ($LASTEXITCODE -ne 0) { throw 'Cannot find Git hooks directory.' }
        if (Test-Path -LiteralPath $hooks) {
            $active = @(Get-ChildItem -LiteralPath $hooks -File | Where-Object { $_.Name -notlike '*.sample' })
            if ($active.Count) { throw 'Existing hooks found. Integrate them manually; do not overwrite them.' }
        }
    }
    if (-not $IsWindows) {
        chmod +x .githooks/pre-commit
        if ($LASTEXITCODE -ne 0) { throw 'Cannot make the pre-commit hook executable.' }
    }
    git config --local core.hooksPath .githooks
    if ($LASTEXITCODE -ne 0) { throw 'Cannot install repository-local hooks.' }
    Write-Host 'Installed core.hooksPath=.githooks for this repository only.'
} finally {
    Pop-Location
}
