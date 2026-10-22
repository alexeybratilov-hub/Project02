@echo off
rem SAOТ — запуск портативного приложения (D-003, T1-10).
rem Не требует установки: использует runtime\python.exe (embedded Python 3.12),
rem если он есть; иначе — системный python из PATH (среда разработки).
setlocal
cd /d "%~dp0"

set "PY=runtime\python.exe"
if not exist "%PY%" set "PY=python"

rem Портативные рабочие папки задаются относительно корня проекта (config.py делает это сам,
rem но для start.bat фиксируем явно — путь не должен зависеть от текущей папки вызова).
set "SAOT_DATA_DIR=%~dp0data"
set "SAOT_BACKUPS_DIR=%~dp0backups"
set "SAOT_LOGS_DIR=%~dp0logs"
set "SAOT_ATTACHMENTS_DIR=%~dp0attachments"
if not defined SAOT_HOST set "SAOT_HOST=127.0.0.1"
if not defined SAOT_PORT set "SAOT_PORT=8000"

echo Starting SAOT at http://%SAOT_HOST%:%SAOT_PORT/ ...
start "" "http://%SAOT_HOST%:%SAOT_PORT/"
"%PY%" -m uvicorn app.main:app --host %SAOT_HOST% --port %SAOT_PORT%
endlocal
