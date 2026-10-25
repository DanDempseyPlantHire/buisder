# Deas Jobs v25.5 clean deployment installer
# Usage in PowerShell: .\INSTALL-V25.5-SHARP-CLEAN.ps1 -RepoPath "C:\path\to\your\DEASJobs-clone"
# Never deletes the .git directory, D1 database, Cloudflare data or unrelated local files.
param(
    [Parameter(Mandatory=$true)][string]$RepoPath
)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$repo = (Resolve-Path -LiteralPath $RepoPath -ErrorAction Stop).Path
if ($source.TrimEnd('\') -eq $repo.TrimEnd('\')) { throw 'Run this installer from the extracted ZIP, not from inside the GitHub clone.' }
if (-not (Test-Path -LiteralPath (Join-Path $repo '.git'))) { throw 'Not a GitHub clone: .git is missing. Use GitHub Desktop to clone first.' }
if (-not (Test-Path -LiteralPath (Join-Path $source 'functions\api\applications\[[path]].js'))) {
    throw 'Missing compact Functions package. Extract the COMPLETE ZIP first.'
}
$old = Join-Path $repo 'functions'
if (Test-Path -LiteralPath $old) {
    Write-Host 'Removing obsolete Functions routes from GitHub clone...'
    Remove-Item -LiteralPath $old -Recurse -Force
}
Copy-Item -LiteralPath (Join-Path $source 'functions') -Destination $old -Recurse -Force
$sourcePublic = Join-Path $source 'public'
$targetPublic = Join-Path $repo 'public'
if (-not (Test-Path -LiteralPath $targetPublic)) { New-Item -ItemType Directory -Path $targetPublic | Out-Null }
Get-ChildItem -LiteralPath $sourcePublic -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $targetPublic -Recurse -Force }
$functionCount = @(Get-ChildItem -LiteralPath $old -File -Recurse).Count
Write-Host "Functions files now: $functionCount (maximum 99)"
if ($functionCount -gt 99) { throw "Unexpected count: $functionCount. Do not push." }
Write-Host 'Files updated. Now open GitHub Desktop, review changes, Commit to main, and Push origin.'
Write-Host 'Wait for Cloudflare Pages to finish deploying the new commit.'
