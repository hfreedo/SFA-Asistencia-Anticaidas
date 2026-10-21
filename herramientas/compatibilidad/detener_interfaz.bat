@echo off
chcp 65001 >nul
setlocal
title SFA - Detener servidor

echo.
for %%I in ("%~dp0..\..") do set "SFA_ROOT=%%~fI\"
echo Abre el centro de inicio y utiliza Detener servidor.
if exist "%SFA_ROOT%dist\SFA_Centro.exe" start "" "%SFA_ROOT%dist\SFA_Centro.exe"
echo No se detienen procesos por nombre ni por ocupar un puerto.
pause
