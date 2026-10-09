# Requires PowerShell 7 and Git. Read-only, no network, application runtime or secrets.
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Manifest,
    [string]$RepositoryRoot = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = [System.IO.Path]::GetFullPath($RepositoryRoot)
$utf8 = [System.Text.UTF8Encoding]::new($false, $true)

function Resolve-RepositoryFile([string]$Path) {
    if ([System.IO.Path]::IsPathRooted($Path)) { throw "Expected repository-relative path: $Path" }
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $Path))
    $relative = [System.IO.Path]::GetRelativePath($root, $full).Replace('\', '/')
    if ($relative -eq '..' -or $relative.StartsWith('../')) { throw "Path outside repository: $Path" }
    return $full
}

function Read-Current([string]$Path) {
    return [System.IO.File]::ReadAllText((Resolve-RepositoryFile $Path), $utf8).Replace("`r`n", "`n")
}

function Read-Baseline([string]$Path) {
    $null = Resolve-RepositoryFile $Path
    $lines = @(& git -C $root show "${baseCommit}:$Path")
    if ($LASTEXITCODE -ne 0) { throw "Cannot read baseline $baseCommit : $Path" }
    return ($lines -join "`n") + "`n"
}

function Find-Marker([string]$Text, [string]$Marker) {
    if ([string]::IsNullOrEmpty($Marker)) { throw 'Empty marker.' }
    $matches = [regex]::Matches($Text, '(?m)^' + [regex]::Escape($Marker))
    if ($matches.Count -ne 1) { throw "Expected one line marker, found $($matches.Count): $Marker" }
    return $matches[0].Index
}

function Get-Range([string]$Text, $Move, [bool]$Destination) {
    $start = 0
    $end = $Text.Length
    if ($Destination) {
        $start = (Find-Marker $Text $Move.destinationAfter) + $Move.destinationAfter.Length
        if ($Move.destinationBefore) { $end = Find-Marker $Text $Move.destinationBefore }
    }
    else {
        if ($Move.after) { $start = (Find-Marker $Text $Move.after) + $Move.after.Length }
        elseif ($Move.PSObject.Properties.Name -contains 'fromLine') { $start = Find-Marker $Text $Move.fromLine }
        if ($Move.before) { $end = Find-Marker $Text $Move.before }
    }
    if ($end -le $start) { throw "Invalid or overlapping range: $($Move.id)" }
    return @{ Start = $start; End = $end; Text = $Text.Substring($start, $end - $start).Trim("`n") }
}

function Convert-MovedText([string]$Text, $Move) {
    # Resolve every local link against its original file before making it relative to the destination.
    $sourceFile = Resolve-RepositoryFile $Move.source
    $destinationFile = Resolve-RepositoryFile $Move.destination
    $sourceDirectory = Split-Path $sourceFile -Parent
    $destinationDirectory = Split-Path $destinationFile -Parent
    $converted = [regex]::Replace($Text, '(\[[^\]\r\n]*\])\(([^\s)]+)\)', {
        param($match)
        $target = $match.Groups[2].Value
        if ($target -match '^[a-zA-Z][a-zA-Z0-9+.-]*:' -or $target.StartsWith('//')) { return $match.Value }
        $parts = $target.Split('#', 2)
        $original = if ($parts[0]) {
            [System.IO.Path]::GetFullPath((Join-Path $sourceDirectory ([Uri]::UnescapeDataString($parts[0]))))
        } else { $sourceFile }
        $relative = [System.IO.Path]::GetRelativePath($destinationDirectory, $original).Replace('\', '/')
        $fragment = if ($parts.Count -eq 2) { '#' + $parts[1] } else { '' }
        return $match.Groups[1].Value + '(' + $relative + $fragment + ')'
    })
    foreach ($mapping in $Move.headingMap.PSObject.Properties) {
        $converted = [regex]::Replace($converted, '(?m)^' + [regex]::Escape($mapping.Name) + '$', [string]$mapping.Value)
    }
    return $converted
}

function Get-HeadingIdentity([string]$Text) {
    $identities = [System.Collections.Generic.List[string]]::new()
    $counts = @{}
    $inFence = $false
    foreach ($line in ($Text -split "`n")) {
        if ($line -match '^```') { $inFence = -not $inFence; continue }
        if ($inFence -or $line -notmatch '^#{1,6}\s+(.+?)\s*#*\s*$') { continue }
        $heading = $Matches[1]
        $slug = ($heading.ToLowerInvariant() -replace '[^\p{L}\p{N}_\-\s]', '') -replace '\s+', '-'
        if ($counts.ContainsKey($slug)) { $counts[$slug]++ } else { $counts[$slug] = 0 }
        $anchor = if ($counts[$slug] -eq 0) { $slug } else { "$slug-$($counts[$slug])" }
        $identities.Add("$anchor`t$line")
    }
    return ,$identities.ToArray()
}

function Assert-OrderedLines([string[]]$Expected, [string[]]$Actual, [string]$Label) {
    $index = 0
    foreach ($line in $Expected) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        while ($index -lt $Actual.Count -and $Actual[$index] -cne $line) { $index++ }
        if ($index -eq $Actual.Count) { throw "Missing or reordered $Label : $line" }
        $index++
    }
}

$configuration = Read-Current $Manifest | ConvertFrom-Json
if ($configuration.schemaVersion -ne 1) { throw 'Unsupported manifest schema.' }
$baseCommit = [string]$configuration.baseCommit
if ($baseCommit -cnotmatch '^[0-9a-f]{40}$') { throw 'baseCommit must be a complete commit SHA.' }
$baseline = @{}
$current = @{}
$ranges = @{}
foreach ($path in (@($configuration.preserveHeadings) + @($configuration.preserveUnmovedLines) + @($configuration.moves.source) | Sort-Object -Unique)) {
    if ($path -notmatch '\.md$') { throw "Expected Markdown source: $path" }
    $baseline[$path] = Read-Baseline $path
    $current[$path] = Read-Current $path
}

foreach ($move in $configuration.moves) {
    $sourceRange = Get-Range $baseline[$move.source] $move $false
    $destinationRange = Get-Range (Read-Current $move.destination) $move $true
    $expected = Convert-MovedText $sourceRange.Text $move
    if ($expected -cne $destinationRange.Text) { throw "Moved text differs or links changed meaning: $($move.id)" }
    if (-not $ranges.ContainsKey($move.source)) { $ranges[$move.source] = @() }
    $ranges[$move.source] += $sourceRange
    Write-Output "PASS: $($move.id) full text and rebased links ($($expected.Length) characters)"
}

foreach ($path in $configuration.preserveHeadings) {
    Assert-OrderedLines (Get-HeadingIdentity $baseline[$path]) (Get-HeadingIdentity $current[$path]) "heading/anchor in $path"
    Write-Output "PASS: $path original heading identities and order"
}

foreach ($path in $configuration.preserveUnmovedLines) {
    $unmoved = $baseline[$path]
    if ($ranges.ContainsKey($path)) {
        $previousStart = $unmoved.Length
        foreach ($range in ($ranges[$path] | Sort-Object Start -Descending)) {
            if ($range.End -gt $previousStart) { throw "Overlapping source ranges: $path" }
            $unmoved = $unmoved.Remove($range.Start, $range.End - $range.Start).Insert($range.Start, "`n")
            $previousStart = $range.Start
        }
    }
    Assert-OrderedLines ($unmoved -split "`n") ($current[$path] -split "`n") "unmoved text in $path"
    Write-Output "PASS: $path all unmoved nonblank lines retained in order"
}
Write-Output "PASS: documentation migration from $baseCommit. Run check-foundation.ps1 separately for all local links."
