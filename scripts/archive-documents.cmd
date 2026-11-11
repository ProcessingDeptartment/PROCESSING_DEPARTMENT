@echo off
rem Archive current policies, procedures, SOPs, PRPs and record templates.
rem Double-click to run. Progress shows in this window; the last run is also kept in scripts\archive-documents.log.
title archive-documents
cd /d "%~dp0.."
echo Archive current policies, procedures, SOPs, PRPs and record templates.
echo Started %date% %time%
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "node scripts\archive-documents.mjs %* 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath scripts\archive-documents.log; exit $LASTEXITCODE"
if errorlevel 1 (echo. & echo *** FINISHED WITH PROBLEMS - see the lines marked FAILED above ***) else (echo. & echo Finished OK.)
echo.
pause
