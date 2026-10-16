@echo off
chcp 65001 >nul
setlocal
title SFA - Detener servidor

echo.
echo Buscando servidor en el puerto 8780...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8780" ^| findstr "LISTENING"') do (
  echo Deteniendo proceso %%a...
  taskkill /PID %%a /F
)

echo.
echo Listo. Si no aparecio ningun proceso, el servidor no estaba iniciado.
pause
