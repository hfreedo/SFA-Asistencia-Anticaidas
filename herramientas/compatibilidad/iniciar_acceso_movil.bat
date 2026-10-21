@echo off
setlocal
title SFA - Acceso movil por red local
for %%I in ("%~dp0..\..") do set "SFA_ROOT=%%~fI\"
cd /d "%SFA_ROOT%"
set "SFA_PYTHON=%SFA_ROOT%.venv313\Scripts\python.exe"
if not exist "%SFA_PYTHON%" (
  py -3.13 -m venv "%SFA_ROOT%.venv313"
  if errorlevel 1 goto error
)
"%SFA_PYTHON%" -m pip install --disable-pip-version-check -r "%SFA_ROOT%servidor_pc\requirements.txt"
if errorlevel 1 goto error
"%SFA_PYTHON%" -m servidor_pc.acceso_movil
pause
exit /b
:error
echo No se pudo preparar el entorno local de Python.
pause
exit /b 1
