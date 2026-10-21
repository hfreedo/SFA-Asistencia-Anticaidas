@echo off
chcp 65001 >nul
setlocal
title SFA - Servidor de interfaz

for %%I in ("%~dp0..\..") do set "PROJECT_DIR=%%~fI\"
set "VENV_DIR=%PROJECT_DIR%.venv313"
set "PYTHON_EXE=%VENV_DIR%\Scripts\python.exe"
set "REQUIREMENTS=%PROJECT_DIR%servidor_pc\requirements.txt"
cd /d "%PROJECT_DIR%"
set "URL=http://127.0.0.1:8780"

netstat -ano | findstr ":8780" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo La interfaz SFA ya esta activa en %URL%
  start "" "%URL%"
  echo.
  pause
  exit /b 0
)

echo.
echo ============================================
echo   SFA - Sistema de alerta ante caidas
echo ============================================
echo.

if not exist "%PYTHON_EXE%" (
  echo Creando entorno virtual con Python 3.13...
  py -3.13 -m venv "%VENV_DIR%"
  if errorlevel 1 (
    echo.
    echo No se pudo crear el entorno virtual.
    echo Verifica que Python 3.13 este instalado.
    pause
    exit /b 1
  )
)

echo Instalando o verificando dependencias...
"%PYTHON_EXE%" -m pip install --disable-pip-version-check -r "%REQUIREMENTS%"
if errorlevel 1 (
  echo.
  echo No se pudieron instalar las dependencias.
  pause
  exit /b 1
)

echo.
echo Abriendo interfaz en %URL%
start "" "%URL%"
echo.
echo Servidor activo. Para detenerlo, cierra esta ventana o ejecuta detener_interfaz.bat.
echo.

"%PYTHON_EXE%" -m uvicorn servidor_pc.main:app --host 127.0.0.1 --port 8780

echo.
echo Servidor detenido.
pause
