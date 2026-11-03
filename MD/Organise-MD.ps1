# Organise-MD.ps1
# Run this from anywhere — it reorganises the MD folder in the repo.
# Usage: .\Organise-MD.ps1

$mdRoot = "T:\Abagold Processing Facility\20. Paperless\PROCESSING_DEPARTMENT\MD"

# ── Subfolder structure ────────────────────────────────────────────────────────
$dirs = @(
    "Instructions\records\dry-processing",
    "Instructions\records\receiving-salting",
    "Instructions\records\canning",
    "Instructions\records\monitoring",
    "Instructions\verification",
    "Instructions\oosw",
    "Instructions\pdf-print",
    "Instructions\admin",
    "Instructions\nc",
    "Instructions\ui-ux",
    "Instructions\system",
    "Instructions\archive"
)

foreach ($d in $dirs) {
    $full = Join-Path $mdRoot $d
    if (-not (Test-Path $full)) { New-Item -ItemType Directory -Path $full | Out-Null }
}

# ── Helper: move a file if it exists, warn if destination already has it ───────
function Move-Safe {
    param($src, $destDir)
    if (-not (Test-Path $src)) { return }
    $name = Split-Path $src -Leaf
    $dest = Join-Path $destDir $name
    if (Test-Path $dest) {
        Write-Warning "SKIP (exists): $name → $destDir"
        return
    }
    Move-Item -Path $src -Destination $dest
    Write-Host "  → $name" -ForegroundColor Cyan
}

# ── Move files from MD root into Instructions subfolders ──────────────────────

Write-Host "`n[1/9] Dry processing records (REC 7.4.x)" -ForegroundColor Yellow
$destDry = Join-Path $mdRoot "Instructions\records\dry-processing"
@(
    "rec-7.4.0-barcode-scan-and-job-search-fix-instructions.md",
    "rec-7.4.0-cooking-ux-fixes-instructions.md",
    "rec-7.4.0-multi-cook-rule-instructions.md",
    "rec-7.4.0-remove-temp-oosw-entry-instructions.md",
    "rec-7.4.0-timestamp-now-button-fix-instructions.md",
    "rec-7.4.1-add-steam-open-section-instructions.md",
    "rec-7.4.2-dry-monitoring-colour-fixes-instructions.md",
    "rec-7.4.2-product-condition-checks-nc-instructions.md",
    "rec-7.4.3-grading-fixes-oct2026.md",
    "rec-7.4.3-grading-log-updates-instructions.md",
    "rec-7.4.6-click-routes-to-8.1.6-fix-instructions.md",
    "dry-cooking-oosw-field-entry-details-fix-instructions.md",
    "drying-log-superseded-and-print-hub-instructions.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot $_) $destDry }

# Also move from Instructions/ root
@(
    "dry-cooking-pots-roster-instructions.md",
    "dried-submission-batch-2-rec-7.4.10-7.4.6-7.4.3-instructions.md",
    "rec-7.4.0-pot-slides-blanching-stage-instructions.md",
    "rec-7.4.0-print-layout-instructions.md",
    "rec-7.4.0-temporary-entry-flow-instructions.md",
    "rec-7.4.10-crate-number-automatic-instructions.md",
    "rec-7.4.2-dry-monitoring-field-changes-instructions.md",
    "rec-7.4.2-layout-4col-instructions.md",
    "rec-7.4.3-dry-weight-received-check-instructions.md",
    "rec-7.4.3-job-prefix-scope-instructions.md",
    "rec-7.4.5-closed-box-inspection-report-instructions.md",
    "rec-7.4.6-dry-stock-control-merge-job-info-instructions.md",
    "drying-report-data-source-fix-instructions.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot "Instructions\$_") $destDry }

Write-Host "`n[2/9] Receiving & salting records (REC 7.1.x)" -ForegroundColor Yellow
$destSalt = Join-Path $mdRoot "Instructions\records\receiving-salting"
@(
    "rec-7.1.2-scan-lot-barcode-admin-only-instructions.md",
    "rec-7.1.3-salting-tablet-ux-barcode-instructions.md",
    "harvest-farm-intake-date-readonly-instructions.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot $_) $destSalt }

@(
    "rec-7.1.2-7.1.5-code-instruction.md",
    "rec-7.1.2-7.1.5-redesign-worklog.md",
    "rec-7.1.2-7.1.5-tablet-ux-instructions.md",
    "rec-7.1.2-basket-entry-flow-instructions.md",
    "rec-7.1.5-oosw-entry-flow-instructions.md",
    "farm-selector-update-instructions.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot "Instructions\$_") $destSalt }

Write-Host "`n[3/9] Canning & monitoring records" -ForegroundColor Yellow
$destCan  = Join-Path $mdRoot "Instructions\records\canning"
$destMon  = Join-Path $mdRoot "Instructions\records\monitoring"

Move-Safe (Join-Path $mdRoot "rec-7.2.11-canning-inspection-instructions.md") $destCan
Move-Safe (Join-Path $mdRoot "Instructions\rec-7.2.7-trolley-retort-dropdown-management-instructions.md") $destCan 2>$null

Move-Safe (Join-Path $mdRoot "rec-7.8.9.1-lha-water-monitoring-instructions.md") $destMon
Move-Safe (Join-Path $mdRoot "rec-7.9.3.1-daily-submissions-group-verification-instructions.md") $destMon
Move-Safe (Join-Path $mdRoot "rec-7.9.3.1-daily-submissions-group-verification-log-pulling-instructions.md") $destMon
Move-Safe (Join-Path $mdRoot "Instructions\rec-7.9.3.1-dry-room-log-field-removal-instructions.md") $destMon

Write-Host "`n[4/9] Verification & passkeys" -ForegroundColor Yellow
$destVer = Join-Path $mdRoot "Instructions\verification"
@(
    "verification-48hr-hard-block-on-login-instructions.md",
    "verification-block-escape-passkey-audit-instructions.md",
    "verification-block-per-user-config-and-nc-coexistence-instructions.md",
    "verification-outstanding-alert-on-login-instructions.md",
    "verification-preview-rich-instructions.md",
    "verification-preview-salting-oosw-fields-instructions.md",
    "passkey-role-restrictions-instructions.md",
    "email-alerts-outlook-unverified-48hr-and-nc-instructions.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot $_) $destVer }

@(
    "passkey-users-seed-instructions.md",
    "tablet-field-row-alignment-passkey-fix-instructions.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot "Instructions\$_") $destVer }

Write-Host "`n[5/9] OOSW" -ForegroundColor Yellow
$destOosw = Join-Path $mdRoot "Instructions\oosw"
@(
    "oosw-duplicate-submission-warning-instructions.md",
    "oosw-implementation-outline.md",
    "oosw-read-only-field-system-design.md",
    "drying-report-oosw-from-salting-record-instructions.md",
    "oosw-lower-than-cooked-verify-reason-instructions.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot $_) $destOosw }

Write-Host "`n[6/9] PDF & print" -ForegroundColor Yellow
$destPdf = Join-Path $mdRoot "Instructions\pdf-print"
@(
    "pdf-button-tab-closure-fix-instructions.md",
    "pdf-button-unified-behaviour-instructions.md",
    "pdf-revision-date-sync-master-index-instructions.md",
    "print-entry-missing-scripts-fix-instructions.md",
    "monitoring-pdf-naming-standardization.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot $_) $destPdf }

@(
    "pdf-print-any-status-instructions.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot "Instructions\$_") $destPdf }

Write-Host "`n[7/9] Admin" -ForegroundColor Yellow
$destAdm = Join-Path $mdRoot "Instructions\admin"
@(
    "admin-bulk-verify-all-records-instructions.md",
    "admin-role-instructions.md",
    "admin-single-passkey-delete-instructions.md",
    "admin-verification-preview-fields-instructions.md",
    "record-archive-and-delete-instructions.md",
    "delete-dry-submissions-instructions.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot $_) $destAdm }

@(
    "bulk-data-upload-instructions.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot "Instructions\$_") $destAdm }

Write-Host "`n[8/9] Non-conformance (NC)" -ForegroundColor Yellow
$destNc = Join-Path $mdRoot "Instructions\nc"
@(
    "nc-auto-close-on-corrective-action-completion-instructions.md",
    "nc-record-update-feedback-loop-instructions.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot $_) $destNc }

@(
    "nc-log-page-instructions.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot "Instructions\$_") $destNc }

Write-Host "`n[9/9] System, UI/UX, and general" -ForegroundColor Yellow
$destUi  = Join-Path $mdRoot "Instructions\ui-ux"
$destSys = Join-Path $mdRoot "Instructions\system"

# UI/UX
@(
    "barcode-job-lifecycle-traceability-instructions.md",
    "barcode-split-ui-placement-instructions.md",
    "batch-traceability-any-batch-instructions.md",
    "category-dot-only-instructions.md",
    "date-format-abbreviated-month-instructions.md",
    "job-picker-no-auto-dropdown-instructions.md",
    "nav-back-button-every-page-instructions.md",
    "time-picker-digital-instructions.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot $_) $destUi }

@(
    "barcode-scan-to-log-system-instructions.md",
    "bartender-argox-label-printing-instructions.md",
    "home-categories-as-blocks-instructions.md",
    "index-24hr-dashboard-placeholder-instructions.md",
    "post-submit-complete-another-page-prompt-instructions.md",
    "trolley-barcode-dry-process-instructions.md",
    "view-submissions-always-visible.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot "Instructions\$_") $destUi }

# System / infrastructure
@(
    "central-image-archive-instructions.md",
    "certification-version-update-instructions.md",
    "data-archiving-instructions.md",
    "data-store-first-submit-fix.md",
    "edit-submitted-record-instructions.md",
    "field-spec-live-enforcement-instructions.md",
    "field-specifications-system-instructions.md",
    "growing-log-single-entry-fix-instructions.md",
    "master-index-audit-log-instructions.md",
    "prp-integration-instructions.md",
    "production-dashboard-seam-charts-instructions.md",
    "rec-6.1.2-training-register-add-delete-submission-instructions.md",
    "remove-categories-instructions.md",
    "revision-edit-button-and-dry-cooking-fix-instructions.md",
    "sop-record-spec-cross-linking-instructions.md",
    "tables-authoritative-switch.md",
    "template-versioning-instructions.md",
    "trending-requirements-questionnaire.md"
) | ForEach-Object { Move-Safe (Join-Path $mdRoot $_) $destSys }

@(
    "fsms-calendar-instructions.md",
    "hard-rule-one-user-per-form-and-job-instructions.md",
    "production-dashboard-live-instructions.md",
    "record-open-job-gate-instructions.md",
    "sop-update-instructions.md",
    "rec-7.1.2-scan-lot-barcode-admin-only-instructions.md"
) | ForEach-Object {
    $p = Join-Path $mdRoot "Instructions\$_"
    if (Test-Path $p) { Move-Safe $p $destSys }
}

Write-Host "`nDone! Summary of new structure:" -ForegroundColor Green
Get-ChildItem $mdRoot -Recurse -Directory | Select-Object -ExpandProperty FullName | ForEach-Object {
    $rel = $_.Substring($mdRoot.Length + 1)
    $count = (Get-ChildItem $_ -Filter "*.md" -File).Count
    Write-Host "  $rel  ($count files)"
}
Write-Host "`n  MD root (numbered docs + config files remain here)"
(Get-ChildItem $mdRoot -Filter "*.md" -File).Count | ForEach-Object { Write-Host "  *.md in root: $_" }
