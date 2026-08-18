@echo off
setlocal
cd /d "%~dp0"
title Editor PDF Clarvi

echo.
echo   Editor PDF Clarvi
echo   -----------------
echo.

py -3 --version >nul 2>&1
if %errorlevel% equ 0 (
  echo   Iniciando con Python...
  py -3 servidor.py
  goto fin
)

python --version >nul 2>&1
if %errorlevel% equ 0 (
  echo   Iniciando con Python...
  python servidor.py
  goto fin
)

node --version >nul 2>&1
if %errorlevel% equ 0 (
  echo   Iniciando con Node...
  node servidor.js
  goto fin
)

echo   No hay Python ni Node en este equipo.
echo   Se abrira el editor directamente en el navegador.
echo   Funciona igual: solo cambia como se cargan algunas fuentes.
echo.
start "" "index.html"

:fin
endlocal
