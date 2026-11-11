@echo off
rem Make PDFs (online print layout) for verified records and documents that do not have one yet.
rem Double-click to run. Progress shows in this window; the last run is also kept in scripts\archive-pdfs.log.
title archive-pdfs
cd /d "%~dp0.."
echo Make PDFs (online print layout) for verified records and documents that do not have one yet.
echo Started %date% %time%
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "node scripts\archive-pdfs.mjs %* 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath scripts\archive-pdfs.log; exit $LASTEXITCODE"
if errorlevel 1 (echo. & echo *** FINISHED WITH PROBLEMS - see the lines marked FAILED above ***) else (echo. & echo Finished OK.)
echo.
pause
