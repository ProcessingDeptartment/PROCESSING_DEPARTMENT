# Reorganise MD/ folder — Processing System repo
# Run from: T:\Abagold Processing Facility\20. Paperless\PROCESSING_DEPARTMENT

$root = "T:\Abagold Processing Facility\20. Paperless\PROCESSING_DEPARTMENT"
$md   = Join-Path $root "MD"
$co   = Join-Path $root "Claude outputs"

Write-Host "=== Step 1: Create sub-folders ===" -ForegroundColor Cyan
$folders = @(
    "reference",
    "instructions\receiving",
    "instructions\dry-processing",
    "instructions\system",
    "worklogs"
)
foreach ($f in $folders) {
    $path = Join-Path $md $f
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path | Out-Null
        Write-Host "  Created: MD\$f"
    } else {
        Write-Host "  Already exists: MD\$f"
    }
}

Write-Host ""
Write-Host "=== Step 2: Copy 3 orphan MDs from 'Claude outputs' to MD\instructions\system ===" -ForegroundColor Cyan
$orphans = @(
    "barcode-scan-to-log-system-instructions.md",
    "bartender-argox-label-printing-instructions.md",
    "trolley-barcode-dry-process-instructions.md"
)
foreach ($f in $orphans) {
    $src = Join-Path $co $f
    $dst = Join-Path $md "instructions\system\$f"
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "  Copied: $f -> MD\instructions\system\"
    } else {
        Write-Host "  NOT FOUND (skipped): $f" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Step 3: Move reference docs (01-09) ===" -ForegroundColor Cyan
$refDocs = @(
    "01_System-Overview-and-Plan.md",
    "02_Database-and-Relational-Design.md",
    "03_Traceability-and-Field-Reference.md",
    "04_ERP-Integration.md",
    "05_Canning-Records-Reports-and-Job-Status.md",
    "06_Dry-Processing-Records-REC-7.4.md",
    "07_UI-UX-Tablet-and-Layout.md",
    "08_REC-7.1-Receiving-Salting-and-Form-Changes.md",
    "09_Authentication-Signoff-and-Passkeys.md"
)
foreach ($f in $refDocs) {
    $src = Join-Path $md $f
    $dst = Join-Path $md "reference\$f"
    if (Test-Path $src) {
        Move-Item $src $dst -Force
        Write-Host "  Moved: $f -> reference\"
    }
}

Write-Host ""
Write-Host "=== Step 4: Move receiving instructions (REC-7.1.x) ===" -ForegroundColor Cyan
$receiving = @(
    "rec-7.1.2-basket-entry-flow-instructions.md",
    "rec-7.1.2-7.1.5-code-instruction.md",
    "rec-7.1.2-7.1.5-tablet-ux-instructions.md",
    "rec-7.1.5-oosw-entry-flow-instructions.md"
)
foreach ($f in $receiving) {
    $src = Join-Path $md $f
    $dst = Join-Path $md "instructions\receiving\$f"
    if (Test-Path $src) {
        Move-Item $src $dst -Force
        Write-Host "  Moved: $f -> instructions\receiving\"
    }
}

Write-Host ""
Write-Host "=== Step 5: Move dry-processing instructions (REC-7.4.x) ===" -ForegroundColor Cyan
$dryProc = @(
    "rec-7.4.0-temporary-entry-flow-instructions.md",
    "rec-7.4.0-pot-slides-blanching-stage-instructions.md",
    "rec-7.4.0-print-layout-instructions.md",
    "rec-7.4.2-dry-monitoring-field-changes-instructions.md",
    "rec-7.4.2-layout-4col-instructions.md",
    "rec-7.4.3-dry-weight-received-check-instructions.md",
    "rec-7.4.3-job-prefix-scope-instructions.md",
    "rec-7.4.5-closed-box-inspection-report-instructions.md",
    "rec-7.4.6-dry-stock-control-merge-job-info-instructions.md",
    "rec-7.4.10-crate-number-automatic-instructions.md",
    "rec-7.9.3.1-dry-room-log-field-removal-instructions.md",
    "dried-submission-batch-2-rec-7.4.10-7.4.6-7.4.3-instructions.md",
    "dry-cooking-pots-roster-instructions.md",
    "drying-report-data-source-fix-instructions.md"
)
foreach ($f in $dryProc) {
    $src = Join-Path $md $f
    $dst = Join-Path $md "instructions\dry-processing\$f"
    if (Test-Path $src) {
        Move-Item $src $dst -Force
        Write-Host "  Moved: $f -> instructions\dry-processing\"
    }
}

Write-Host ""
Write-Host "=== Step 6: Move system instructions ===" -ForegroundColor Cyan
$system = @(
    "bulk-data-upload-instructions.md",
    "farm-selector-update-instructions.md",
    "fsms-calendar-instructions.md",
    "hard-rule-one-user-per-form-and-job-instructions.md",
    "home-categories-as-blocks-instructions.md",
    "index-24hr-dashboard-placeholder-instructions.md",
    "nc-log-page-instructions.md",
    "passkey-users-seed-instructions.md",
    "pdf-print-any-status-instructions.md",
    "post-submit-complete-another-page-prompt-instructions.md",
    "production-dashboard-live-instructions.md",
    "record-open-job-gate-instructions.md",
    "sop-update-instructions.md",
    "tablet-field-row-alignment-passkey-fix-instructions.md",
    "view-submissions-always-visible.md"
)
foreach ($f in $system) {
    $src = Join-Path $md $f
    $dst = Join-Path $md "instructions\system\$f"
    if (Test-Path $src) {
        Move-Item $src $dst -Force
        Write-Host "  Moved: $f -> instructions\system\"
    }
}

Write-Host ""
Write-Host "=== Step 7: Move worklogs ===" -ForegroundColor Cyan
$worklogs = @(
    "awaiting-verification-changes.md",
    "dry-cooking-pots-fixes-2026-09-30.md",
    "fix-title-prefill-2026-10-01.md",
    "home-categories-as-blocks-worklog.md",
    "rec-7.1.2-7.1.5-redesign-worklog.md",
    "rec-7.4.0-pot-slides-worklog.md",
    "rec-7.4.4-report-only-worklog.md",
    "rec-7.4.6-dry-stock-control-worklog.md",
    "record-open-job-gate-worklog.md",
    "signoff-block-updates.md",
    "tablet-field-row-alignment-worklog.md",
    "title-prefill-fixes.md"
)
foreach ($f in $worklogs) {
    $src = Join-Path $md $f
    $dst = Join-Path $md "worklogs\$f"
    if (Test-Path $src) {
        Move-Item $src $dst -Force
        Write-Host "  Moved: $f -> worklogs\"
    }
}

Write-Host ""
Write-Host "=== Step 8: Rename REC741-layout-changes.md ===" -ForegroundColor Cyan
$old = Join-Path $md "REC741-layout-changes.md"
$new = Join-Path $md "worklogs\rec-7.4.1-layout-changes.md"
if (Test-Path $old) {
    Move-Item $old $new -Force
    Write-Host "  Renamed + moved: REC741-layout-changes.md -> worklogs\rec-7.4.1-layout-changes.md"
}

Write-Host ""
Write-Host "=== Step 9: Delete duplicate MDs from 'Claude outputs' ===" -ForegroundColor Cyan
$dupes = @(
    "bulk-data-upload-instructions.md",
    "rec-7.4.0-temporary-entry-flow-instructions.md",
    "barcode-scan-to-log-system-instructions.md",
    "bartender-argox-label-printing-instructions.md",
    "trolley-barcode-dry-process-instructions.md"
)
foreach ($f in $dupes) {
    $path = Join-Path $co $f
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "  Deleted: Claude outputs\$f"
    }
}

Write-Host ""
Write-Host "=== Step 10: Delete stale backup in public/ ===" -ForegroundColor Cyan
$bak = Join-Path $root "public\index.html.bak-2026-10-01"
if (Test-Path $bak) {
    Remove-Item $bak -Force
    Write-Host "  Deleted: public\index.html.bak-2026-10-01"
} else {
    Write-Host "  Not found (already gone): public\index.html.bak-2026-10-01"
}

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Remaining in MD/ root (should only be these):" -ForegroundColor Cyan
Get-ChildItem -Path $md -File | Select-Object Name | Format-Table -HideTableHeaders
Write-Host ""
Write-Host "Sub-folder file counts:" -ForegroundColor Cyan
Get-ChildItem -Path $md -Directory | ForEach-Object {
    $count = (Get-ChildItem $_.FullName -Recurse -File).Count
    Write-Host "  $($_.Name): $count files"
}
