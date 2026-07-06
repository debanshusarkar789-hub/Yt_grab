#!/bin/bash
set -e

# Install yt-dlp if missing
if ! command -v yt-dlp &>/dev/null; then
  echo "Installing yt-dlp..."
  mkdir -p bin
  curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp
  chmod +x bin/yt-dlp
  export PATH="$PWD/bin:$PATH"
fi

# Install deno if missing
if ! command -v deno &>/dev/null; then
  echo "Installing deno..."
  mkdir -p bin
  curl -fsSL https://deno.land/install.sh | sh -s -- -y
  cp "$HOME/.deno/bin/deno" bin/deno 2>/dev/null || true
  chmod +x bin/deno 2>/dev/null || true
  export PATH="$PWD/bin:$PATH"
fi

# Install ffmpeg if missing
if ! command -v ffmpeg &>/dev/null; then
  echo "Installing ffmpeg..."
  apt-get update -qq && apt-get install -y -qq ffmpeg 2>/dev/null || true
fi

cd backend && node server.js
