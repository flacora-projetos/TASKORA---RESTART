@echo off
setlocal EnableDelayedExpansion
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "COMMAND=%~1"
if /I "%COMMAND%"=="esbuild" (
  set "LOCAL_CMD=!ROOT!\apps\web\node_modules\.bin\esbuild.cmd"
  if exist "!LOCAL_CMD!" (
    echo !LOCAL_CMD!
    exit /b 0
  )
  set "LOCAL_BIN=!ROOT!\apps\web\node_modules\.bin\esbuild"
  if exist "!LOCAL_BIN!" (
    echo !LOCAL_BIN!
    exit /b 0
  )
)
where %*
exit /b %errorlevel%
