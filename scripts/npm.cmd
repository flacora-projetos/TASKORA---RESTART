@echo off
set NODE20=E:\APPS AND EXTENSIONS\TASKORA - 2.0 - PROMPT FER\node20_full\node-v20.18.0-win-x64
set NPMCLI=E:\APPS AND EXTENSIONS\TASKORA - 2.0 - PROMPT FER\node20_full\node-v20.18.0-win-x64\node_modules\npm\bin\npm-cli.js
setlocal
set CMD=%1
if /I "%CMD%"=="install" (
  echo %2 | findstr /I "esbuild" >nul 2>&1
  if %errorlevel%==0 (
    echo [npm stub] Skipping npm %* (handled manually)
    exit /b 0
  )
)
"%NODE20%\node.exe" "%NPMCLI%" %*

