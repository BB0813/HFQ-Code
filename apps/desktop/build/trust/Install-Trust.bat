@echo off
setlocal EnableExtensions

rem Other PC trust installer for HFQ-ClodBreeze
rem Right-click - Run as administrator
rem Needs HFQ-ClodBreeze.cer in same folder

set "CER=%~dp0HFQ-ClodBreeze.cer"
if not exist "%CER%" set "CER=%~dp0root.cer"

if not exist "%CER%" (
  echo [ERROR] HFQ-ClodBreeze.cer not found next to this script.
  pause
  exit /b 1
)

net session >nul 2>&1
if errorlevel 1 (
  echo Requesting Administrator elevation...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo.
echo Install publisher cert: HFQ-ClodBreeze
echo File: %CER%
echo.

certutil -addstore -f Root "%CER%"
if errorlevel 1 (
  echo [FAIL] Could not import Root store.
  echo Close antivirus and run as Administrator.
  pause
  exit /b 1
)

certutil -addstore -f TrustedPublisher "%CER%"

echo.
echo [OK] Certificate installed.
echo You can now run software signed by HFQ-ClodBreeze.
echo Note: SmartScreen cloud reputation may still warn.
echo.
pause
exit /b 0
