@echo off
chcp 65001 >nul
cd /d "%~dp0"
title WatercolorFX 公网分享

REM ─── 1. 下载 cloudflared（仅首次，来源为 Cloudflare 官方 GitHub Release，约 60MB）───
if not exist cloudflared.exe (
    echo 首次运行：正在从 Cloudflare 官方 GitHub 下载 cloudflared.exe ...
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
    if not exist cloudflared.exe (
        echo 下载失败，请检查网络后重试。
        pause & exit /b 1
    )
)

REM ─── 2. 启动本地静态服务器（端口 8765）───
where python >nul 2>nul
if %errorlevel%==0 (
    start "wfx-local-server" /min cmd /c "cd /d "%~dp0" && python -m http.server 8765"
) else (
    where py >nul 2>nul
    if %errorlevel%==0 (
        start "wfx-local-server" /min cmd /c "cd /d "%~dp0" && py -m http.server 8765"
    ) else (
        where npx >nul 2>nul
        if %errorlevel%==0 (
            start "wfx-local-server" /min cmd /c "cd /d "%~dp0" && npx -y serve -l 8765"
        ) else (
            echo 未找到 Python 或 Node，无法启动本地服务器。
            pause & exit /b 1
        )
    )
)
timeout /t 2 >nul

REM ─── 3. 建立公网隧道（免账号）───
echo.
echo ════════════════════════════════════════════════════════
echo   下方出现的  https://xxxx.trycloudflare.com  即公网链接
echo   把它发给任何人即可访问。关闭本窗口 = 停止分享。
echo ════════════════════════════════════════════════════════
echo.
cloudflared.exe tunnel --url http://localhost:8765
