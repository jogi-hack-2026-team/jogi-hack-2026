[CmdletBinding()]
param([Parameter(Mandatory)][string]$EvidenceRoot)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'measurement-ledger.ps1')
$root = [IO.Path]::GetFullPath($EvidenceRoot)
$files = @(Get-ChildItem -LiteralPath $root -Recurse -File -Filter '*.json' | Where-Object Name -Match '^(predict|question-prior)-run[12]\.json$' | Sort-Object FullName)
if ($files.Count -ne 4) { throw 'Expected exactly four saved runs; incomplete evidence must not PASS.' }
$runs = @()
foreach ($file in $files) {
  $r = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
  $ledger = @(Get-Content -LiteralPath (Join-Path $file.DirectoryName 'commands.json') -Raw | ConvertFrom-Json)
  $iteration = [int]([regex]::Match($file.Name, 'run([12])').Groups[1].Value)
  $command = @($ledger | Where-Object { $_.entry -eq $r.engineProvenance.entryPoint -and $_.iteration -eq $iteration })
  if ($command.Count -ne 1 -or $command[0].assertionFailures -ne $r.summary.fail) { throw 'Run result does not match execution ledger.' }
  $scenarios = @($r.checks | Where-Object id -eq 'E5')[0].detail
  if ($scenarios.Count -ne 7) { throw 'Missing scenario.' }
  $runs += [pscustomobject]@{ file=[IO.Path]::GetRelativePath($root,$file.FullName).Replace('\','/'); entry=$r.engineProvenance.entryPoint;
    iteration=$iteration; at=$r.at; pass=$r.summary.pass; assertionFailures=$r.summary.fail; exitCode=$command[0].exitCode;
    scenarios=$scenarios.Count; requestFailures=($scenarios.errors | Measure-Object -Sum).Sum;
    failures=@($r.checks | Where-Object status -eq 'FAIL' | ForEach-Object { [pscustomobject]@{ id=$_.id; name=$_.name } });
    candidateHead=$r.engineProvenance.repositoryHead; engineHead=$r.engineProvenance.engineRepositoryHead; distHash=$r.engineProvenance.loadedDistSha256 }
}
$exitCode = Get-MeasurementExitCode $runs
$summary = [pscustomobject]@{ label='Supporting Artifact / Not a Source of Truth'; at=[DateTimeOffset]::UtcNow.ToString('o'); runs=$runs;
  completedRuns=$runs.Count; completedScenarios=($runs.scenarios | Measure-Object -Sum).Sum;
  pass=($runs.pass | Measure-Object -Sum).Sum; fail=($runs.assertionFailures | Measure-Object -Sum).Sum;
  overallExitCode=$exitCode; note='Valid performance FAIL remains FAIL; later PASS runs do not erase earlier failures.' }
$summary | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $root 'aggregate.json')
Write-Output ('Runs=' + $summary.completedRuns + '; scenarios=' + $summary.completedScenarios + '; PASS=' + $summary.pass + '; FAIL=' + $summary.fail + '; overallExitCode=' + $exitCode)
exit $exitCode
