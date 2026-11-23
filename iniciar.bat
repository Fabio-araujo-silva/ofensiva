@echo off
chcp 65001 >nul
title Ofensiva
cd /d "%~dp0"

set "PORTA=4848"
if exist .env for /f "usebackq tokens=1,* delims==" %%a in (".env") do if /i "%%a"=="PORTA" set "PORTA=%%b"
set "URL=http://localhost:%PORTA%"
rem teste de porta direto em 127.0.0.1 (rapido; nao depende de proxy nem de IPv6)
set "TESTE=$c = New-Object Net.Sockets.TcpClient; try { $ok = $c.ConnectAsync('127.0.0.1', %PORTA%).Wait(700) -and $c.Connected } catch { $ok = $false } finally { $c.Close() }"

rem Ja esta rodando? Entao so abre a pagina.
powershell -NoProfile -Command "%TESTE%; if ($ok) { exit 0 } else { exit 1 }"
if %errorlevel%==0 (
  start "" "%URL%"
  exit /b
)

if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)

rem Abre o navegador assim que o servidor responder.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 80; $i++) { %TESTE%; if ($ok) { Start-Process '%URL%'; break }; Start-Sleep -Milliseconds 250 }"

echo Ofensiva rodando em %URL%  (feche esta janela para desligar)
node server.js
pause
