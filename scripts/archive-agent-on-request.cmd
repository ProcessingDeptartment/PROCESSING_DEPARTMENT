@echo off
rem File-server agent: waits for an administrator to press "Archive now" on the Home page,
rem then copies the waiting REC 7.4.2 photos to ARCHIVE_ROOT (scripts\.env). Runs until closed.
rem Set up as a Task Scheduler task "At startup" (see the top of image-archive-agent.mjs).
cd /d "%~dp0.."
node scripts\image-archive-agent.mjs --on-request >> scripts\archive-agent.log 2>&1
