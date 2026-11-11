@echo off
rem Database change archive (DB ARCHIVE and DB EXPORTS).
rem Double-click to run. Progress shows in this window; the last run is also kept in scripts\archive-database.log.
title archive-database
cd /d "%~dp0.."
echo Database change archive (DB ARCHIVE and DB EXPORTS).
echo Started %date% %time%
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "node scripts\archive-changes.js %* 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath scripts\archive-database.log; exit $LASTEXITCODE"
if errorlevel 1 (echo. & echo *** FINISHED WITH PROBLEMS - see the lines marked FAILED above ***) else (echo. & echo Finished OK.)
echo.
pause
