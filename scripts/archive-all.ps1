# Runs scripts\archive-all.mjs, showing its output and keeping a copy in scripts\archive-all.log.
# Called by archive-all.cmd. The log sits on the network drive, so a log write must never be able to
# stop the archive itself: each line is appended on its own (no file handle held open for the whole
# run), a failed write is retried once, and if the log still cannot be written the run carries on
# without it and says so. The exit code is always node's own (1 if node never reported one).

$log = Join-Path $PSScriptRoot 'archive-all.log'
$logOk = $true
$logMissed = 0

function Write-LogLine([string]$line) {
  if (-not $script:logOk) { $script:logMissed++; return }
  foreach ($attempt in 1, 2) {
    try { Add-Content -LiteralPath $script:log -Value $line -Encoding UTF8 -ErrorAction Stop; return }
    catch { if ($attempt -eq 1) { Start-Sleep -Milliseconds 500 } else { $script:logOk = $false; $script:logMissed++; $script:logError = $_.Exception.Message } }
  }
}

try { Set-Content -LiteralPath $log -Value ("Started " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) -Encoding UTF8 -ErrorAction Stop }
catch { $logOk = $false; $logError = $_.Exception.Message }

$LASTEXITCODE = $null
$mjs = Join-Path $PSScriptRoot 'archive-all.mjs'
& node $mjs @args 2>&1 | ForEach-Object {
  $line = "$_"
  $line
  Write-LogLine $line
}
$code = $LASTEXITCODE
if ($null -eq $code) {
  ''
  '*** The archive did not run to the end (node gave no exit code). ***'
  $code = 1
}
if (-not $logOk) {
  ''
  "WARNING: could not write scripts\archive-all.log ($logError). The archive itself was not affected; $logMissed line(s) are missing from the log."
}
exit $code
