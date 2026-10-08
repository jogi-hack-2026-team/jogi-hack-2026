$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'measurement-ledger.ps1')
$collected = @()
foreach ($row in @(@{exitCode=0; assertionFailures=0}, @{exitCode=1; assertionFailures=1}, @{exitCode=0; assertionFailures=0})) {
  if ((Get-MeasurementOutcome $row.exitCode $row.assertionFailures) -eq 'execution-failure') { throw 'Valid saved result classified as execution failure.' }
  $collected += $row
}
if ($collected.Count -ne 3 -or (Get-MeasurementExitCode $collected) -ne 1) { throw 'Saved FAIL must allow remaining runs and keep final exit 1.' }
if ((Get-MeasurementExitCode @(@{exitCode=0; assertionFailures=0})) -ne 0) { throw 'All-PASS ledger should exit 0.' }
foreach ($row in @(@{exitCode=1; assertionFailures=$null}, @{exitCode=1; assertionFailures=0})) {
  if ((Get-MeasurementOutcome $row.exitCode $row.assertionFailures) -ne 'execution-failure') { throw 'Missing result/execution error must abort.' }
}
if ((Get-MeasurementExitCode @()) -ne 1) { throw 'Empty ledger must not PASS.' }
Write-Output 'PASS: saved FAIL collects later runs and keeps final exit1; execution/missing/empty results fail; all-PASS exits0.'
