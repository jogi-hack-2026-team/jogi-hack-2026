function Get-MeasurementOutcome([int]$ExitCode, $AssertionFailures) {
  if ($null -eq $AssertionFailures -or ($ExitCode -ne 0 -and $AssertionFailures -eq 0)) { return 'execution-failure' }
  if ($AssertionFailures -ne 0) { return 'assertion-failure' }
  return 'pass'
}
function Get-MeasurementExitCode([array]$Ledger) {
  if ($Ledger.Count -eq 0) { return 1 }
  foreach ($row in $Ledger) {
    if ((Get-MeasurementOutcome $row.exitCode $row.assertionFailures) -ne 'pass') { return 1 }
  }
  return 0
}
