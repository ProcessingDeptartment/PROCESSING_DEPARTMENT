# move-md-to-MD.ps1
# Moves all project .md files from Claude outputs\, MD_PROJECT_ONLY\, MD_CONSOLIDATED\
# and the claude\ worklogs into the MD\ folder.
# Root CLAUDE.md and README.md are left in place.
# Skips files whose name already exists in MD\ (won't overwrite).

$base = "T:\Abagold Processing Facility\20. Paperless\PROCESSING_DEPARTMENT"
$dest = Join-Path $base "MD"

$sources = @(
    (Join-Path $base "Claude outputs"),
    (Join-Path $base "MD_PROJECT_ONLY"),
    (Join-Path $base "MD_CONSOLIDATED")
)

# Also move the worklogs from claude\
$claudeWorklogs = @(
    "home-categories-as-blocks-worklog.md",
    "rec-7.1.2-7.1.5-redesign-worklog.md",
    "rec-7.4.4-report-only-worklog.md",
    "rec-7.4.6-dry-stock-control-worklog.md",
    "record-open-job-gate-worklog.md",
    "tablet-field-row-alignment-worklog.md"
)

$moved   = 0
$skipped = 0

foreach ($src in $sources) {
    if (-not (Test-Path $src)) { Write-Host "Folder not found, skipping: $src"; continue }
    Get-ChildItem -Path $src -Filter "*.md" -File | ForEach-Object {
        $target = Join-Path $dest $_.Name
        if (Test-Path $target) {
            Write-Host "SKIP (already exists): $($_.Name)"
            $skipped++
        } else {
            Move-Item -Path $_.FullName -Destination $target
            Write-Host "Moved: $($_.FullName) -> MD\"
            $moved++
        }
    }
}

foreach ($name in $claudeWorklogs) {
    $srcFile = Join-Path $base "claude" $name
    if (-not (Test-Path $srcFile)) { Write-Host "Not found, skipping: $name"; continue }
    $target = Join-Path $dest $name
    if (Test-Path $target) {
        Write-Host "SKIP (already exists): $name"
        $skipped++
    } else {
        Move-Item -Path $srcFile -Destination $target
        Write-Host "Moved: claude\$name -> MD\"
        $moved++
    }
}

Write-Host ""
Write-Host "Done. Moved: $moved   Skipped (already in MD\): $skipped"
Read-Host "Press Enter to close"
