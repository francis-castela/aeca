@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verificar-ortografia.ps1" %*
exit /b %ERRORLEVEL%