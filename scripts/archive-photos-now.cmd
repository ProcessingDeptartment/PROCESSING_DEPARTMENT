@echo off
rem Copies any REC 7.4.2 photos not yet archived from the cloud to the Images folder, then stops.
rem Double-click to run (or use the "Archive Photos Now" desktop shortcut).
cd /d "%~dp0.."
node scripts\image-archive-agent.mjs --once
echo.
pause
