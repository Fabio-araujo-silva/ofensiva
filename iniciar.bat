@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)
start "" http://localhost:4848
node server.js
pause
