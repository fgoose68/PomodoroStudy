@echo off
:: =============================================================================
::  Study Timer - Script di installazione per Windows
::  Uso: install.bat [--dir C:\percorso\cartella]
:: =============================================================================
setlocal enabledelayedexpansion
title Study Timer - Installazione

echo.
echo   Study Timer -- Installazione
echo   ================================
echo.

:: ── Rilevamento argomenti ─────────────────────────────────────────────────────
set "INSTALL_DIR="
:parse_args
if "%~1"=="" goto :end_args
if /i "%~1"=="--dir" (
    set "INSTALL_DIR=%~2"
    shift
)
shift
goto :parse_args
:end_args

:: ── Directory di installazione ────────────────────────────────────────────────
if "%INSTALL_DIR%"=="" (
    set "DEFAULT_DIR=%USERPROFILE%\StudyTimer"
    set /p "INSTALL_DIR=Dove installare? [!DEFAULT_DIR!]: "
    if "!INSTALL_DIR!"=="" set "INSTALL_DIR=!DEFAULT_DIR!"
)

:: ── Verifica Node.js ──────────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo [ERRORE] Node.js non trovato. Installalo da https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -e "process.stdout.write(process.version)"') do set "NODE_VER=%%v"
echo [INFO]  Node.js %NODE_VER% trovato

:: ── Cartella sorgente ─────────────────────────────────────────────────────────
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."

:: ── Build dell'app ────────────────────────────────────────────────────────────
echo [INFO]  Build dell'applicazione in corso...
cd /d "%PROJECT_DIR%"
call npm install --silent
if errorlevel 1 ( echo [ERRORE] npm install fallito & pause & exit /b 1 )
call npm run build
if errorlevel 1 ( echo [ERRORE] Build fallita & pause & exit /b 1 )

:: ── Crea struttura di installazione ──────────────────────────────────────────
echo [INFO]  Installazione in: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%INSTALL_DIR%\app" mkdir "%INSTALL_DIR%\app"

xcopy /E /I /Y "%PROJECT_DIR%\dist\*" "%INSTALL_DIR%\app\" >nul

:: ── Installa http-server locale ───────────────────────────────────────────────
if not exist "%INSTALL_DIR%\server" mkdir "%INSTALL_DIR%\server"
cd /d "%INSTALL_DIR%\server"
call npm init -y >nul 2>&1
call npm install --save http-server --silent
if errorlevel 1 ( echo [ERRORE] Installazione http-server fallita & pause & exit /b 1 )

:: ── Script di avvio .bat ──────────────────────────────────────────────────────
set "START_SCRIPT=%INSTALL_DIR%\start.bat"
(
echo @echo off
echo title Study Timer
echo set "DIR=%%~dp0"
echo set PORT=3737
echo echo [Study Timer] Avvio server sulla porta %%PORT%%...
echo start "" /b "%%DIR%%server\node_modules\.bin\http-server" "%%DIR%%app" -p %%PORT%% -c-1
echo timeout /t 2 /nobreak ^>nul
echo start http://localhost:%%PORT%%
echo echo [Study Timer] Aperto http://localhost:%%PORT%%
echo echo Chiudi questa finestra per fermare il server.
echo pause ^>nul
) > "%START_SCRIPT%"

:: ── Collegamento sul Desktop ──────────────────────────────────────────────────
set "SHORTCUT=%USERPROFILE%\Desktop\StudyTimer.lnk"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%START_SCRIPT%'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.IconLocation = 'shell32.dll,21'; $s.Description = 'Study Timer'; $s.Save()"
if exist "%SHORTCUT%" (
    echo [OK]    Collegamento creato sul Desktop: StudyTimer
) else (
    echo [WARN]  Impossibile creare il collegamento sul Desktop
)

:: ── Voce nel menu Start ───────────────────────────────────────────────────────
set "START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%START_MENU%\StudyTimer.lnk'); $s.TargetPath = '%START_SCRIPT%'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.IconLocation = 'shell32.dll,21'; $s.Description = 'Study Timer'; $s.Save()" >nul 2>&1

:: ── Fine ──────────────────────────────────────────────────────────────────────
echo.
echo [OK]    Installazione completata!
echo.
echo   Avvio:    %INSTALL_DIR%\start.bat
echo   Desktop:  %USERPROFILE%\Desktop\StudyTimer
echo   URL:      http://localhost:3737
echo.
echo   Per installare come PWA, apri l'URL in Chrome o Edge e clicca
echo   l'icona 'Installa' nella barra degli indirizzi.
echo.
set /p "LAUNCH=Avviare subito Study Timer? [S/n]: "
if /i not "%LAUNCH%"=="n" (
    start "" "%START_SCRIPT%"
)
endlocal
