$ErrorActionPreference = 'Stop'
$fixedRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$fixedLogRoot = Join-Path $fixedRoot 'results\post-fix\rerun-logs'
New-Item -ItemType Directory -Path $fixedLogRoot -Force | Out-Null
$fixedLedger = @()
Push-Location -LiteralPath $fixedRoot
try {
  foreach ($script in @('typecheck','web:build','verify:auth-db','verify:rate-limit','verify:fixed')) {
    $log = Join-Path $fixedLogRoot ($script.Replace(':','-') + '.log')
    $startedAt = [DateTimeOffset]::UtcNow
    & npm.cmd run $script *> $log
    $exitCode = $LASTEXITCODE
    $resultFile = switch ($script) {
      'verify:auth-db' { 'v1-auth-db.json' }
      'verify:rate-limit' { 'v1-rate-limit.json' }
      'verify:fixed' { 'v5-fixed-regression.json' }
    }
    $failCount = 0
    if ($resultFile) {
      $result = Get-Content -LiteralPath (Join-Path $fixedRoot ('results\post-fix\' + $resultFile)) -Raw | ConvertFrom-Json
      # ConvertFrom-Json may produce a UTC DateTime. Casting preserves its Kind;
      # Parse(DateTime.ToString()) loses it and can shift freshness by the local offset.
      if ([DateTimeOffset]$result.at -lt $startedAt) { throw 'Result JSON is stale; refusing to treat it as this run' }
      $failCount = $result.summary.fail
    }
    $fixedLedger += @{ command=('npm run ' + $script); exitCode=$exitCode; assertionFailures=$failCount; startedAt=$startedAt.ToString('o'); log=$log }
    if ($exitCode -ne 0 -or $failCount -ne 0) { throw ('Verification failed: ' + $script) }
  }
} finally {
  # Stop only this package's synthetic DBs, never an unattributed OS process.
  $ctl = Join-Path $fixedRoot 'node_modules\@embedded-postgres\windows-x64\native\bin\pg_ctl.exe'
  foreach ($name in @('pg-v1','pg-v1rl','pg-v5-fixed')) {
    $db = [System.IO.Path]::GetFullPath((Join-Path $fixedRoot ('.local\' + $name)))
    if (-not $db.StartsWith($fixedRoot + '\.local\',[System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected DB target' }
    & $ctl status -D $db
    if ($LASTEXITCODE -eq 0) { & $ctl stop -D $db -m fast -w -t 10 }
  }
  $fixedLedger | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $fixedLogRoot 'commands.json')
  Pop-Location
}
