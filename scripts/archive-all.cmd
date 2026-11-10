@echo off
rem Runs the whole archive in one go: database change archive, record templates, documents,
rem all submitted records + CSV files, and the PDFs. Only new or changed items are written.
rem Double-click to run. The last run's output is also kept in scripts\archive-all.log.
cd /d "%~dp0.."
node scripts\archive-all.mjs %* > scripts\archive-all.log 2>&1
type scripts\archive-all.log
echo.
pause
