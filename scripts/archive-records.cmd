@echo off
rem Archive all submitted records and refresh the CSV files.
rem Double-click to run. Progress shows in this window; the last run is also kept in scripts\archive-records.log.
title archive-records
cd /d "%~dp0.."
echo Archive all submitted records and refresh the CSV files.
echo Started %date% %time%
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "node scripts\archive-completed-records.mjs %* 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath scripts\archive-records.log; exit $LASTEXITCODE"
if errorlevel 1 (echo. & echo *** FINISHED WITH PROBLEMS - see the lines marked FAILED above ***) else (echo. & echo Finished OK.)
echo.
pause
