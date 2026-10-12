@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 serve.py
  pause
  exit /b
)
where python >nul 2>nul
if %errorlevel%==0 (
  python serve.py
  pause
  exit /b
)
where node >nul 2>nul
if %errorlevel%==0 (
  start http://localhost:8080
  node server.cjs
  pause
  exit /b
)
echo Install Python 3 dari python.org atau Node.js dari nodejs.org dahulu.
echo Setelah selesai, jalankan START_TRACKERS.bat kembali.
pause
