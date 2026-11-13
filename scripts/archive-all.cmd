@echo off
rem Full archive: database, templates, documents, records + CSV, photos, PDFs. Only new or changed items are written.
rem Double-click to run. Progress shows in this window; the last run is also kept in scripts\archive-all.log.
title archive-all
cd /d "%~dp0.."
echo Full archive: database, templates, documents, records + CSV, photos, PDFs. Only new or changed items are written.
echo Started %date% %time%
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\archive-all.ps1 %*
if errorlevel 1 (echo. & echo *** FINISHED WITH PROBLEMS - see the lines marked FAILED or *** above ***) else (echo. & echo Finished OK.)
echo.
pause
