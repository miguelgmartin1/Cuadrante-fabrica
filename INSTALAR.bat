@echo off
chcp 65001 >nul
title Instalacion - Cuadrante de Turnos

echo ================================================
echo   CUADRANTE DE TURNOS - Instalacion
echo ================================================
echo.

:: Verificar Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo.
    echo  Por favor, instala Node.js primero:
    echo  1. Abre tu navegador
    echo  2. Ve a:  https://nodejs.org
    echo  3. Descarga la version LTS ^(boton verde grande^)
    echo  4. Ejecuta el instalador y sigue los pasos
    echo  5. Reinicia el ordenador
    echo  6. Vuelve a ejecutar este archivo INSTALAR.bat
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js encontrado:
node --version
echo.

:: Instalar dependencias
echo [1/3] Instalando dependencias ^(puede tardar unos minutos^)...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al instalar dependencias.
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas.
echo.

:: Generar cliente Prisma y crear base de datos
echo [2/3] Configurando base de datos...
call npx prisma db push
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al configurar la base de datos.
    pause
    exit /b 1
)
echo [OK] Base de datos configurada.
echo.

:: Cargar datos de ejemplo
echo [3/3] Cargando datos de ejemplo...
call npm run db:seed
if %errorlevel% neq 0 (
    echo [AVISO] No se pudieron cargar los datos de ejemplo.
    echo Puedes continuar de todas formas.
)
echo [OK] Datos de ejemplo cargados.
echo.

echo ================================================
echo   Instalacion completada con exito!
echo ================================================
echo.
echo Ahora haz doble clic en INICIAR.bat para arrancar la aplicacion.
echo.
pause
