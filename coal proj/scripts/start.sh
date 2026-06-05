#!/bin/bash
cd "$(dirname "$0")/.."

echo "============================================"
echo " 8086 CPU PIPELINE VISUALIZER"
echo " COAL Spring 2026"
echo "============================================"
echo ""

if ! command -v node &> /dev/null; then
  echo "[ERROR] Node.js is not installed or not in PATH."
  echo "Please install Node.js from https://nodejs.org/"
  exit 1
fi

echo "[1/3] Installing bridge dependencies..."
cd bridge && npm install --silent 2>/dev/null
cd ..

echo "[2/3] Building UI..."
cd ui && npm install --silent 2>/dev/null && npm run build --silent 2>/dev/null
cd ..

echo "[3/3] Starting bridge server..."
echo ""
echo " WebSocket: ws://localhost:3001"
echo " HTTP:      http://localhost:3000"
echo ""
echo " Controls:"
echo "   SPACE  = Step one cycle"
echo "   R      = Run continuously"
echo "   P      = Pause"
echo "   Q      = Reset"
echo ""

cd bridge && node server.js
