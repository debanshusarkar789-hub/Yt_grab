@echo off
cd /d "%~dp0"

:: Check yt-dlp
where yt-dlp >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo yt-dlp not found. Installing via pip...
    pip install yt-dlp
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to install yt-dlp. Please install it manually: pip install yt-dlp
        pause
        exit /b 1
    )
)

:: Check deno (required by yt-dlp 2026+ for YouTube extraction)
where deno >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo deno not found. Required for YouTube extraction.
    winget install deno --accept-package-agreements --accept-source-agreements
    if %ERRORLEVEL% NEQ 0 (
        echo deno installation failed. Installing manually...
        echo Download from: https://deno.land/
    )
)

:: Check ffmpeg
where ffmpeg >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ffmpeg not found. Required for video/audio processing.
    curl -L -o "%TEMP%\ffmpeg.zip" "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
    powershell -Command "Expand-Archive -Path \"$env:TEMP\ffmpeg.zip\" -DestinationPath \"$env:TEMP\ffmpeg-extracted\" -Force"
    copy "%TEMP%\ffmpeg-extracted\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe" "%APPDATA%\npm\ffmpeg.exe"
    copy "%TEMP%\ffmpeg-extracted\ffmpeg-master-latest-win64-gpl\bin\ffprobe.exe" "%APPDATA%\npm\ffprobe.exe"
    echo ffmpeg installed.
)

echo Installing backend dependencies...
cd /d "%~dp0backend"
call npm install

echo Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install

echo Starting backend...
start "YT-Downloader Backend" cmd /c "cd /d "%~dp0backend" && node server.js"

timeout /t 2 /nobreak >nul

echo Starting frontend...
start "YT-Downloader Frontend" cmd /c "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both servers are starting up.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Alternatively, use the terminal CLI:
echo   node cli.mjs "https://youtube.com/watch?v=..."
echo.
echo Close the server windows to stop.
pause
