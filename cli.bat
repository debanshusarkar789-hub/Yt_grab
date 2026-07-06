@echo off
cd /d "%~dp0"

:: Check yt-dlp
where yt-dlp >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo yt-dlp not found. Installing via pip...
    pip install yt-dlp
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to install yt-dlp. Install manually: pip install yt-dlp
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
        echo deno installation failed. Download from: https://deno.land/
    )
)

:: Check ffmpeg
where ffmpeg >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ffmpeg not found. Required for video processing.
    curl -L -o "%TEMP%\ffmpeg.zip" "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
    powershell -Command "Expand-Archive -Path \"$env:TEMP\ffmpeg.zip\" -DestinationPath \"$env:TEMP\ffmpeg-extracted\" -Force"
    copy "%TEMP%\ffmpeg-extracted\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe" "%APPDATA%\npm\ffmpeg.exe"
    copy "%TEMP%\ffmpeg-extracted\ffmpeg-master-latest-win64-gpl\bin\ffprobe.exe" "%APPDATA%\npm\ffprobe.exe"
    echo ffmpeg installed.
)

:: Launch CLI
echo.
node cli.mjs %*
echo.
pause
