@echo off
setlocal
title SFA - Geolocalizacion HTTPS
cd /d "%~dp0"
set "SFA_PYTHON=%~dp0.venv313\Scripts\python.exe"
if not exist "%SFA_PYTHON%" (
  py -3.13 -m venv "%~dp0.venv313"
  if errorlevel 1 goto error
)
echo Verificando dependencias locales...
"%SFA_PYTHON%" -m pip install --quiet --disable-pip-version-check -r "%~dp0servidor_pc\requirements.txt"
if errorlevel 1 goto error
"%SFA_PYTHON%" -m servidor_pc.preparar_https
if errorlevel 1 goto error
"%SFA_PYTHON%" -m servidor_pc.acceso_movil --https
set "RESULT=%errorlevel%"
pause
exit /b %RESULT%
:error
echo No se pudo completar la preparacion. Revisa el mensaje anterior.
pause
exit /b 1
