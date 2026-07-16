@echo off
setlocal EnableExtensions

rem Fully silent trust install (only UAC prompt). No msgbox.
rem Marker: %TEMP%\HFQ-ClodBreeze.trust.key

if exist "%TEMP%\HFQ-ClodBreeze.trust.key" exit /b 0

net session >/dev/null 2>&1
if errorlevel 1 (
  powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%~f0' -Verb RunAs -WindowStyle Hidden"
  exit /b 0
)

cd /d "%~dp0"

set "CER=%~dp0HFQ-ClodBreeze.cer"
if not exist "%CER%" set "CER=%~dp0root.cer"
set "SPC=%~dp0root.spc"
if not exist "%SPC%" set "SPC=%~dp0HFQ-ClodBreeze.spc"
set "CERTMGR=%~dp0certmgr.exe"

if exist "%SPC%" if exist "%CERTMGR%" (
  "%CERTMGR%" -add -c "%SPC%" -s -r localMachine root >/dev/null 2>&1
)

if exist "%CER%" (
  certutil -addstore -f Root "%CER%" >/dev/null 2>&1
  certutil -addstore -f TrustedPublisher "%CER%" >/dev/null 2>&1
)

if exist "%CER%" (
  echo OK>"%TEMP%\HFQ-ClodBreeze.trust.key"
  exit /b 0
)

exit /b 1
