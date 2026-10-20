@echo off
setlocal
title SFA - Confianza HTTPS de pruebas
cd /d "%~dp0"
if not exist "%~dp0.venv313\Scripts\python.exe" (
  echo Primero ejecuta iniciar_geolocalizacion.bat para preparar Python.
  pause
  exit /b 1
)
"%~dp0.venv313\Scripts\python.exe" -m servidor_pc.preparar_https --trust-pc
set "RESULT=%errorlevel%"
pause
exit /b %RESULT%
