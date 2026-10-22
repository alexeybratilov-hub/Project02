@echo off
rem SAOТ — остановка приложения (D-003, T1-10).
rem Завершает процесс uvicorn, запущенный start.bat на настроенном порту.
setlocal
if not defined SAOT_PORT set "SAOT_PORT=8000"

echo Stopping SAOT on port %SAOT_PORT% ...
rem Найти PID по порту и завершить. Для embedded-режима окно console закрывается вместе с процессом.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%SAOT_PORT% .*LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1 && echo Process %%p stopped.
)
echo Done.
endlocal
