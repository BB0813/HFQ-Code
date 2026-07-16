@echo off
REM Portable / side-by-side launcher: try silent trust import, then start HFQ Code.
setlocal
cd /d "%~dp0"

if exist "%~dp0resources\trust\config-silent.bat" (
  call "%~dp0resources\trust\config-silent.bat"
) else if exist "%~dp0trust\config-silent.bat" (
  call "%~dp0trust\config-silent.bat"
)

if exist "%~dp0HFQ Code.exe" (
  start "" "%~dp0HFQ Code.exe"
  exit /b 0
)

REM Fallback if productFilename differs
for %%F in ("%~dp0*.exe") do (
  echo %%~nxF | findstr /i /c:"portable" >nul
  if errorlevel 1 (
    start "" "%%~fF"
    exit /b 0
  )
)

echo HFQ Code.exe not found next to this launcher.
pause
exit /b 1
