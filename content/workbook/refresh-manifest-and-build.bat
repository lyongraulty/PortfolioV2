@echo off
setlocal

pushd "%~dp0..\.."

echo Refreshing Bunny media manifest...
call npm.cmd run sync:bunny-media
set "MANIFEST_EXIT=%ERRORLEVEL%"

if not "%MANIFEST_EXIT%"=="0" (
  echo.
  echo Bunny manifest refresh failed. Check Bunny settings in .env.local and the message above.
  popd
  pause
  exit /b %MANIFEST_EXIT%
)

echo.
echo Syncing detected media into workbook...
call npm.cmd run content:sync-workbook-media
set "SYNC_EXIT=%ERRORLEVEL%"

if not "%SYNC_EXIT%"=="0" (
  echo.
  echo Workbook media sync failed. Close workbook.xlsx if it is open, then try again.
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
echo Bunny manifest refresh, workbook media sync, and JSON export complete.
popd
pause
exit /b 0
