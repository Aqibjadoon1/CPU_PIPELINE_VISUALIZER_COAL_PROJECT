#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const PipelineSimulator = require('./asm_simulator');

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;
const DIST_DIR = path.resolve(__dirname, '..', 'ui', 'dist');

let sim = null;
let autoRunTimer = null;
let isPaused = false;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, indexData) => {
        if (err2) { res.writeHead(404); res.end('Not Found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(indexData);
      }); return;
    }
    res.writeHead(200, { 'Content-Type': contentType }); res.end(data);
  });
}

const httpServer = http.createServer(serveStatic);
httpServer.listen(HTTP_PORT, () => {
  console.log(`[bridge] HTTP serving on http://localhost:${HTTP_PORT}`);
});

const wss = new WebSocketServer({ port: WS_PORT });
console.log(`[bridge] WebSocket on ws://localhost:${WS_PORT}`);

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

wss.on('connection', (ws) => {
  console.log('[bridge] WS client connected');
  ws.send(JSON.stringify({ type: 'ready' }));
  ws.on('message', (raw) => {
    try { handleMessage(JSON.parse(raw.toString())); }
    catch { /* ignore malformed */ }
  });
  ws.on('close', () => console.log('[bridge] WS client disconnected'));
});

function handleMessage(msg) {
  switch (msg.type) {
    case 'start': handleStart(msg); break;
    case 'step': handleStep(); break;
    case 'run': handleRun(); break;
    case 'pause': handlePause(); break;
    case 'reset': handleReset(); break;
    case 'quit': handleQuit(); break;
  }
}

function handleStart(msg) {
  sim = new PipelineSimulator();
  const mode = msg.mode || 'ADD';
  const a = typeof msg.a === 'number' ? msg.a : 5;
  const b = typeof msg.b === 'number' ? msg.b : 3;
  sim.loadProgram(mode, a, b);
  isPaused = false;
  broadcast({ type: 'sim_started', mode, a, b });
  broadcast(sim.serializeState());
}

function handleStep() {
  if (!sim || sim.simComplete) return;
  const state = sim.advancePipeline();
  if (state) broadcast(state);
  if (sim.simComplete) {
    broadcast({ type: 'sim_complete', cycles: sim.clockCycle });
  }
}

function handleRun() {
  if (!sim) return;
  isPaused = false;
  if (autoRunTimer) clearInterval(autoRunTimer);
  autoRunTimer = setInterval(() => {
    if (!sim || isPaused || sim.simComplete) {
      if (sim && sim.simComplete) {
        clearInterval(autoRunTimer);
        autoRunTimer = null;
        broadcast({ type: 'sim_complete', cycles: sim.clockCycle });
      }
      return;
    }
    const state = sim.advancePipeline();
    if (state) broadcast(state);
    if (sim.simComplete) {
      clearInterval(autoRunTimer);
      autoRunTimer = null;
      broadcast({ type: 'sim_complete', cycles: sim.clockCycle });
    }
  }, 350);
  broadcast({ type: 'status', status: 'running' });
}

function handlePause() {
  isPaused = true;
  if (autoRunTimer) { clearInterval(autoRunTimer); autoRunTimer = null; }
  broadcast({ type: 'status', status: 'paused' });
}

function handleReset() {
  sim = null;
  isPaused = false;
  if (autoRunTimer) { clearInterval(autoRunTimer); autoRunTimer = null; }
  broadcast({ type: 'reset' });
}

function handleQuit() {
  handleReset();
  wss.close();
  httpServer.close();
  process.exit(0);
}

process.on('SIGINT', () => { console.log('\n[bridge] Shutting down...'); handleQuit(); });
process.on('SIGTERM', () => { handleQuit(); });
