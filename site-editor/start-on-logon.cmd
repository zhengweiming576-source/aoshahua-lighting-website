@echo off
rem Aoshahua Lighting - auto start editor (3456) + preview (5173) at logon.
rem launch.cjs skips ports already in use, so re-running is safe.
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo [aoshahua] Node.js not found on PATH - skipped autostart. >> site-editor\autostart.log
  exit /b 1
)
echo [%date% %time%] autostart triggered >> site-editor\autostart.log
node site-editor\launch.cjs >> site-editor\autostart.log 2>&1
