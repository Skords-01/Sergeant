#!/usr/bin/env bash
set -e
echo "[post-merge] Installing dependencies..."
npm install --no-audit --no-fund < /dev/null
echo "[post-merge] Building frontend..."
npm run build < /dev/null
echo "[post-merge] Done."
