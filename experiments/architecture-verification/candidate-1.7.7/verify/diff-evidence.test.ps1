# Supporting Artifact / Not a Source of Truth. No server, DB, or performance measurement.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'diff-evidence.ps1')
$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$directory = Join-Path $temporaryRoot ('pr131-diff-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $directory | Out-Null
function MustReject([scriptblock]$Action) {
  $rejected = $false
  try { & $Action } catch { $rejected = $true }
  if (-not $rejected) { throw 'Invalid diff evidence was accepted.' }
}
try {
  $target = Join-Path $directory 'evidence'
  New-Item -ItemType Directory -Path $target | Out-Null
  $name = 'v8-predict-test.candidate.diff'
  $source = Join-Path $directory $name
  $bytes = [Text.Encoding]::UTF8.GetBytes("diff --git a/日.txt b/日.txt`r`n+line`r`n")
  [IO.File]::WriteAllBytes($source, $bytes)
  $provenance = @{ candidateDiffFile=$name; candidateDiffBytes=$bytes.Length; candidateDiffSha256=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() }
  Copy-DiffEvidence $provenance $directory $target
  if (-not [Linq.Enumerable]::SequenceEqual([byte[]]$bytes, [byte[]][IO.File]::ReadAllBytes((Join-Path $target $name)))) { throw 'Copied bytes changed.' }
  MustReject { Copy-DiffEvidence $provenance $directory $target }
  MustReject { Copy-DiffEvidence (@{candidateDiffFile='../escape.candidate.diff'}) $directory $target }
  MustReject { Copy-DiffEvidence (@{candidateDiffFile='missing.candidate.diff';candidateDiffSha256='bad';candidateDiffBytes=0}) $directory $target }
  $empty = Join-Path $directory 'empty'
  New-Item -ItemType Directory -Path $empty | Out-Null
  MustReject { Copy-DiffEvidence (@{candidateDiffFile=$name;candidateDiffSha256='bad';candidateDiffBytes=$bytes.Length}) $directory $empty }
  MustReject { Copy-DiffEvidence (@{candidateDiffFile=$name;candidateDiffSha256=$provenance.candidateDiffSha256;candidateDiffBytes=0}) $directory $empty }
  Write-Output 'PASS diff evidence: exact UTF-8 bytes, overwrite/path/missing/hash/length rejection'
} finally {
  $resolved = [IO.Path]::GetFullPath($directory)
  if (-not $resolved.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notlike 'pr131-diff-*') { throw 'Unexpected cleanup path.' }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
