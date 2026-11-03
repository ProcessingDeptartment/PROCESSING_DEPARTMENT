# Fix-MD-Stragglers.ps1
# Moves loose instruction files from the MD root into the correct subfolders.
# Safe to re-run — skips files that already exist at the destination.

$mdRoot = "T:\Abagold Processing Facility\20. Paperless\PROCESSING_DEPARTMENT\MD"

function Move-Safe {
    param($src, $destDir)
    if (-not (Test-Path $src)) { Write-Warning "NOT FOUND: $src"; return }
    $name = Split-Path $src -Leaf
    $dest = Join-Path $destDir $name
    if (Test-Path $dest) { Write-Warning "SKIP (exists): $name"; return }
    Move-Item -Path $src -Destination $dest
    Write-Host "  MOVED  $name  →  $destDir" -ForegroundColor Cyan
}

Write-Host "`nMoving loose NC instruction files..." -ForegroundColor Yellow
Move-Safe (Join-Path $mdRoot "nc-log-authentication-access-control-instructions.md") (Join-Path $mdRoot "Instructions\nc")
Move-Safe (Join-Path $mdRoot "nc-log-passkey-signoff-instructions.md")               (Join-Path $mdRoot "Instructions\nc")

Write-Host "`nMoving loose OOSW instruction file..." -ForegroundColor Yellow
Move-Safe (Join-Path $mdRoot "oosw-removal-code-instructions.md") (Join-Path $mdRoot "Instructions\oosw")

Write-Host "`nMoving loose PDF instruction files..." -ForegroundColor Yellow
Move-Safe (Join-Path $mdRoot "pdf-filename-timestamp-fix-claude-code.md")    (Join-Path $mdRoot "Instructions\pdf-print")
Move-Safe (Join-Path $mdRoot "pdf-filename-timestamp-fix-instructions.md")   (Join-Path $mdRoot "Instructions\pdf-print")

Write-Host "`nMoving misplaced worklog from Instructions to Worklogs..." -ForegroundColor Yellow
Move-Safe (Join-Path $mdRoot "Instructions\records\receiving-salting\rec-7.1.2-7.1.5-redesign-worklog.md") (Join-Path $mdRoot "Worklogs")

Write-Host "`nDone. Loose files remaining in MD root:" -ForegroundColor Green
Get-ChildItem $mdRoot -Filter "*.md" -File | Select-Object -ExpandProperty Name | ForEach-Object { Write-Host "  $_" }
