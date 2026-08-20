@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALL-AI-PROCESS-STUDIO.ps1"
if errorlevel 1 (
  echo.
  echo Installation stopped. Read the error above.
  pause
  exit /b 1
)
echo.
echo AI Process Studio is ready.
pause
