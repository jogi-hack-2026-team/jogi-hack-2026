# Isolated fixtures for the lossless-document-migration checker. Requires PowerShell 7 and Git.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$utf8 = [System.Text.UTF8Encoding]::new($false)
$fixture = Join-Path ([System.IO.Path]::GetTempPath()) ('doc-migration-' + [guid]::NewGuid())
$null = New-Item -ItemType Directory -Path (Join-Path $fixture 'docs/changes') -Force
$checker = Join-Path $PSScriptRoot 'check-doc-migration.ps1'
$pwsh = Join-Path $PSHOME $(if ($IsWindows) { 'pwsh.exe' } else { 'pwsh' })

function Write-Fixture([string]$Path, [string]$Text) {
    [System.IO.File]::WriteAllText((Join-Path $fixture $Path), $Text.Replace("`r`n", "`n").TrimEnd() + "`n", $utf8)
}

$original = @'
# Source
## Draft
理由・却下案・未実施を削らない。
[現行](#current)と[別文書](peer.md#入口)を参照。
## Current
現行契約は元の正本に残す。
### Same?
first
### Same!
second
```md
## Heading inside a fence is not an anchor
```
'@
$original = $original.Replace("`r`n", "`n")
Write-Fixture 'docs/source.md' $original
Write-Fixture 'docs/peer.md' "# 入口`n"
& git -C $fixture init -q
if ($LASTEXITCODE -ne 0) { throw 'Fixture git init failed.' }
& git -C $fixture -c core.autocrlf=false add docs
if ($LASTEXITCODE -ne 0) { throw 'Fixture git add failed.' }
& git -C $fixture -c user.name='Doc migration fixture' -c user.email='fixture@example.invalid' commit -qm baseline
if ($LASTEXITCODE -ne 0) { throw 'Fixture commit failed.' }
$base = (& git -C $fixture rev-parse HEAD).Trim()
$current = $original.Replace("理由・却下案・未実施を削らない。`n[現行](#current)と[別文書](peer.md#入口)を参照。", '[全文](changes/history.md#body)')
$history = @'
# History
## Body
理由・却下案・未実施を削らない。
[現行](../source.md#current)と[別文書](../peer.md#入口)を参照。
'@
$history = $history.Replace("`r`n", "`n")
$manifest = @{
    schemaVersion = 1; baseCommit = $base
    preserveHeadings = @('docs/source.md'); preserveUnmovedLines = @('docs/source.md')
    moves = @(@{
        id = 'draft'; source = 'docs/source.md'; after = '## Draft'; before = '## Current'
        destination = 'docs/changes/history.md'; destinationAfter = '## Body'; destinationBefore = $null; headingMap = @{}
    })
} | ConvertTo-Json -Depth 6
Write-Fixture 'manifest.json' $manifest

function Assert-Case([string]$Name, [string]$Source, [string]$History, [string]$ExpectedFailure) {
    Write-Fixture 'docs/source.md' $Source
    Write-Fixture 'docs/changes/history.md' $History
    $output = (& $pwsh -NoProfile -File $checker -Manifest manifest.json -RepositoryRoot $fixture 2>&1) -join "`n"
    $code = $LASTEXITCODE
    if ($ExpectedFailure) {
        if ($code -eq 0 -or $output -notmatch [regex]::Escape($ExpectedFailure)) { throw "Negative case did not reject the intended defect: $Name`n$output" }
    } elseif ($code -ne 0) { throw "Positive case failed: $Name`n$output" }
    Write-Output "PASS: $Name (exit $code)"
}

Assert-Case 'full move, Japanese text, relative and fragment-only links, fenced headings' $current $history ''
Assert-Case 'deleted historical reason' $current ($history.Replace('理由・却下案・未実施を削らない。', '')) 'Moved text differs'
Assert-Case 'link changed to another existing heading' $current ($history.Replace('#current', '#draft')) 'Moved text differs'
Assert-Case 'deleted current contract' ($current.Replace('現行契約は元の正本に残す。', '')) $history 'Missing or reordered unmoved text'
$swapped = $current.Replace("### Same?`nfirst`n### Same!`nsecond", "### Same!`nsecond`n### Same?`nfirst")
Assert-Case 'duplicate-slug heading order changed' $swapped $history 'Missing or reordered heading/anchor'
Assert-Case 'HTML alias replaced original heading' ($current.Replace('## Current', '<a id="current"></a>')) $history 'Missing or reordered heading/anchor'
Assert-Case 'restored fixture' $current $history ''
Write-Output "PASS: all migration fixtures. Fixture retained at $fixture"
