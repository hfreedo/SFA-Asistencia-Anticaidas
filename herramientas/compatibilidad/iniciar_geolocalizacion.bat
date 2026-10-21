@echo off
setlocal
title SFA - Geolocalizacion HTTPS
for %%I in ("%~dp0..\..") do set "SFA_ROOT=%%~fI\"
cd /d "%SFA_ROOT%"
set "SFA_PYTHON=%SFA_ROOT%.venv313\Scripts\python.exe"
if not exist "%SFA_PYTHON%" (
  py -3.13 -m venv "%SFA_ROOT%.venv313"
  if errorlevel 1 goto error
)
echo Verificando dependencias locales...
"%SFA_PYTHON%" -m pip install --quiet --disable-pip-version-check -r "%SFA_ROOT%servidor_pc\requirements.txt"
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
