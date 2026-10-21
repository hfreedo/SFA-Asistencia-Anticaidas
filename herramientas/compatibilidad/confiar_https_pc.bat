@echo off
setlocal
title SFA - Confianza HTTPS de pruebas
for %%I in ("%~dp0..\..") do set "SFA_ROOT=%%~fI\"
cd /d "%SFA_ROOT%"
if not exist "%SFA_ROOT%.venv313\Scripts\python.exe" (
  echo Primero ejecuta iniciar_geolocalizacion.bat para preparar Python.
  pause
  exit /b 1
)
"%SFA_ROOT%.venv313\Scripts\python.exe" -m servidor_pc.preparar_https --trust-pc
set "RESULT=%errorlevel%"
pause
exit /b %RESULT%
