@echo off
setlocal
title SFA - Acceso movil por red local
cd /d "%~dp0"
set "SFA_PYTHON=%~dp0.venv313\Scripts\python.exe"
if not exist "%SFA_PYTHON%" (
  py -3.13 -m venv "%~dp0.venv313"
  if errorlevel 1 goto error
)
"%SFA_PYTHON%" -m pip install --disable-pip-version-check -r "%~dp0servidor_pc\requirements.txt"
if errorlevel 1 goto error
"%SFA_PYTHON%" -m servidor_pc.acceso_movil
pause
exit /b
:error
echo No se pudo preparar el entorno local de Python.
pause
exit /b 1
