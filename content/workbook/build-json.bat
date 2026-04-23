@echo off
setlocal

pushd "%~dp0..\.."

echo Building JSON from content\workbook\workbook.xlsx...
call npm.cmd run content:import-workbook
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo JSON export failed. Check the message above.
  popd
  pause
  exit /b %EXIT_CODE%
)

echo.
echo JSON export complete.
popd
pause
exit /b 0
