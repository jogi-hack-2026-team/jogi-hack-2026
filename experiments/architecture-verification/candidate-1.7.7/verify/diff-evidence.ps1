# Supporting Artifact / Not a Source of Truth. Carry the exact hashed payload into the run evidence.
function Copy-DiffEvidence($Provenance, [string]$SourceDirectory, [string]$DestinationDirectory) {
  $name = [string]$Provenance.candidateDiffFile
  if ($name -ne [IO.Path]::GetFileName($name) -or $name -notmatch '^[a-zA-Z0-9_-]+\.candidate\.diff$') { throw 'Invalid diff evidence filename.' }
  $source = Join-Path $SourceDirectory $name
  if ((Get-FileHash -LiteralPath $source -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant() -ne $Provenance.candidateDiffSha256) { throw 'Diff evidence hash mismatch.' }
  if ((Get-Item -LiteralPath $source -ErrorAction Stop).Length -ne $Provenance.candidateDiffBytes) { throw 'Diff evidence byte count mismatch.' }
  $destination = Join-Path $DestinationDirectory $name
  if (Test-Path -LiteralPath $destination) { throw 'Diff evidence exists; refusing to overwrite.' }
  Copy-Item -LiteralPath $source -Destination $destination -ErrorAction Stop
  if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant() -ne $Provenance.candidateDiffSha256 -or
      (Get-Item -LiteralPath $destination -ErrorAction Stop).Length -ne $Provenance.candidateDiffBytes) { throw 'Copied diff evidence mismatch.' }
}
