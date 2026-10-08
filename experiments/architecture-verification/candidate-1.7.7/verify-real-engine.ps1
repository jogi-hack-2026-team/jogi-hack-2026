# Supporting Artifact / Not a Source of Truth. Execute only in an otherwise idle CPU measurement slot.
[CmdletBinding()]
param([Parameter(Mandatory)][string]$EngineRoot, [ValidateRange(1024,65535)][int]$PgPort = 55592,
  [ValidateSet('predict','question-prior')][string[]]$Entries = @('predict','question-prior'))
$ErrorActionPreference = 'Stop'
$candidateRoot = [IO.Path]::GetFullPath($PSScriptRoot)
. (Join-Path $candidateRoot 'verify\measurement-ledger.ps1')
. (Join-Path $candidateRoot 'verify\diff-evidence.ps1')
$env:SPIKE_ENGINE_ROOT = [IO.Path]::GetFullPath($EngineRoot)
$env:SPIKE_PG_PORT = [string]$PgPort
$nodeBinary = Join-Path $candidateRoot 'node_modules\node\bin\node.exe'
$stamp = [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$evidenceRoot = Join-Path $candidateRoot ('..\results\' + [DateTimeOffset]::UtcNow.ToString('yyyy-MM-dd') + '\real-engine-review\' + $stamp)
if (Test-Path -LiteralPath $evidenceRoot) { throw 'Evidence path exists; refusing to overwrite.' }
New-Item -ItemType Directory -Path $evidenceRoot | Out-Null
$ledger = @()
Push-Location -LiteralPath $candidateRoot
try {
  foreach ($entry in $Entries) {
    $env:SPIKE_PREDICT_ENTRY = $entry
    foreach ($iteration in 1..2) {
      $tag = $stamp + '-run' + $iteration
      $env:SPIKE_RESULT_TAG = $tag
      $log = Join-Path $evidenceRoot ($entry + '-run' + $iteration + '.log')
      $started = [DateTimeOffset]::UtcNow
      & $nodeBinary verify/v8-real-engine-mixed-load.ts *> $log
      $code = $LASTEXITCODE
      $publicEntry = if ($entry -eq 'predict') { 'predict' } else { 'predictWithQuestionPrior' }
      $source = Join-Path $candidateRoot ('results\post-fix\v8-' + $publicEntry + '-' + $tag + '.json')
      $failures = $null
      if (Test-Path -LiteralPath $source) {
        $result = Get-Content -LiteralPath $source -Raw | ConvertFrom-Json
        if ([DateTimeOffset]$result.at -lt $started) { throw 'Stale result JSON.' }
        $failures = $result.summary.fail
        Copy-DiffEvidence $result.engineProvenance (Join-Path $candidateRoot 'results\post-fix') $evidenceRoot
        Copy-Item -LiteralPath $source -Destination (Join-Path $evidenceRoot ($entry + '-run' + $iteration + '.json'))
      }
      $ledger += @{ entry=$publicEntry; iteration=$iteration; startedAt=$started.ToString('o'); endedAt=[DateTimeOffset]::UtcNow.ToString('o'); exitCode=$code; assertionFailures=$failures }
      $ledger | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $evidenceRoot 'commands.json')
      Get-Content -LiteralPath $log -Tail 11
      if ((Get-MeasurementOutcome $code $failures) -eq 'execution-failure') { throw ('Measurement execution failed: ' + $entry + ' run ' + $iteration) }
      # A valid saved FAIL is evidence. Collect remaining runs without weakening the criterion.
    }
  }
} finally {
  # Windows pg_ctl cleanup is restricted to this runner's synthetic data directory.
  $dbDirectory = [IO.Path]::GetFullPath((Join-Path $candidateRoot '.local\pg-v8'))
  if (-not $dbDirectory.StartsWith($candidateRoot + '\.local\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected DB path.' }
  $control = Join-Path $candidateRoot 'node_modules\@embedded-postgres\windows-x64\native\bin\pg_ctl.exe'
  if ((Test-Path -LiteralPath $control) -and (Test-Path -LiteralPath $dbDirectory)) {
    & $control status -D $dbDirectory *> $null
    if ($LASTEXITCODE -eq 0) { & $control stop -D $dbDirectory -m fast -w -t 10 *> $null }
  }
  Remove-Item Env:SPIKE_RESULT_TAG,Env:SPIKE_PREDICT_ENTRY,Env:SPIKE_ENGINE_ROOT,Env:SPIKE_PG_PORT -ErrorAction SilentlyContinue
  Pop-Location
}
Write-Output ('Evidence: ' + $evidenceRoot)
exit (Get-MeasurementExitCode $ledger)
