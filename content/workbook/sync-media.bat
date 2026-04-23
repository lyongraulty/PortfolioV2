@echo off
setlocal

pushd "%~dp0..\.."

echo Syncing detected Bunny/local project media into content\workbook\workbook.xlsx...
call npm.cmd run content:sync-workbook-media
set "SYNC_EXIT=%ERRORLEVEL%"

if not "%SYNC_EXIT%"=="0" (
  echo.
  echo Media sync failed. Close workbook.xlsx if it is open, then try again.
  popd
  pause
  exit /b %SYNC_EXIT%
)

echo.
echo Rebuilding JSON from workbook...
call npm.cmd run content:import-workbook
set "BUILD_EXIT=%ERRORLEVEL%"

if not "%BUILD_EXIT%"=="0" (
  echo.
  echo JSON export failed. Check the message above.
  popd
  pause
  exit /b %BUILD_EXIT%
)

echo.
echo Media sync and JSON export complete.
popd
pause
exit /b 0
