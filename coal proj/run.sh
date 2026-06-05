#!/bin/bash
# ==========================================================================
# CPU Pipeline Visualizer — Unix Launcher
# ==========================================================================
echo ""
echo "[ PIPELINE — 8086 Instruction Pipeline Visualizer ]"
echo "[ COAL Spring 2026 ]"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start bridge server
echo "Starting Bridge Server (port 3000 HTTP, 3001 WS)..."
cd "$SCRIPT_DIR/bridge"
npm start &
BRIDGE_PID=$!

# Start React UI
echo "Starting React UI (port 5173)..."
cd "$SCRIPT_DIR/ui"
npm run dev &
UI_PID=$!

echo ""
echo "========================================================================="
echo " Bridge:  http://localhost:3000"
echo " UI:      http://localhost:5173"
echo " WS:      ws://localhost:3001"
echo "========================================================================="
echo ""
echo "Press Ctrl+C to stop all servers..."
trap "kill $BRIDGE_PID $UI_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
