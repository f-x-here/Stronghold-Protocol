@echo off
cd /d "%~dp0"
call scripts\start-windows.bat --no-assets --no-local --no-scenes --host 0.0.0.0 --port 3000
