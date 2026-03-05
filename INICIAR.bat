@echo off
chcp 65001 >nul
title Cuadrante de Turnos

echo ================================================
echo   CUADRANTE DE TURNOS
echo ================================================
echo.

:: Verificar Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Ejecuta primero INSTALAR.bat
    pause
    exit /b 1
)

:: Verificar que se ha instalado
if not exist "node_modules" (
    echo [ERROR] La aplicacion no esta instalada todavia.
    echo Ejecuta primero INSTALAR.bat
    pause
    exit /b 1
)

echo Arrancando la aplicacion...
echo.
echo Cuando veas "Ready", abre tu navegador en:
echo.
echo      http://localhost:3000
echo.
echo Para cerrar la aplicacion, cierra esta ventana.
echo ================================================
echo.

:: Abrir el navegador automaticamente despues de 4 segundos
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000"

:: Arrancar la aplicacion
call npm run dev
