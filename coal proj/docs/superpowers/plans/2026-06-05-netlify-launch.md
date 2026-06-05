# Netlify Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CPU Pipeline Visualizer deployable as a working Netlify demo and prepare the repository/posting materials.

**Architecture:** The UI keeps the current WebSocket bridge path for local runs. Production builds without `VITE_WS_URL` use a browser runtime that emits the same messages as the bridge, so the React state reducer and components stay unchanged.

**Tech Stack:** React 18, Vite 5, Node built-in test runner, Netlify static hosting, GitHub.

---

### Task 1: Browser Runtime Tests

**Files:**
- Create: `ui/src/simulator/browserRuntime.test.js`
- Modify: `ui/package.json`

- [ ] **Step 1: Write failing tests**

Create tests that start the browser runtime, assert it emits `sim_started` and `STATE_UPDATE`, step until completion, and assert `sim_complete` is emitted.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm.cmd test`

Expected: failure because `browserRuntime.js` does not exist yet.

### Task 2: Browser Simulator Runtime

**Files:**
- Create: `ui/src/simulator/PipelineSimulator.js`
- Create: `ui/src/simulator/browserRuntime.js`

- [ ] **Step 1: Copy the simulator engine**

Copy `bridge/asm_simulator.js` into `ui/src/simulator/PipelineSimulator.js` and convert the export from CommonJS to ESM.

- [ ] **Step 2: Implement browser runtime commands**

Create a runtime with `send`, `dispose`, `start`, `step`, `run`, `pause`, `reset`, and `set_forwarding` behavior that emits messages into the existing reducer.

- [ ] **Step 3: Run tests and verify pass**

Run: `npm.cmd test`

Expected: all browser runtime tests pass.

### Task 3: Transport Fallback

**Files:**
- Modify: `ui/src/hooks/useWebSocket.js`
- Modify: `ui/src/App.jsx`

- [ ] **Step 1: Prefer browser runtime in production**

Use the browser runtime when `import.meta.env.PROD` is true and no `VITE_WS_URL` is configured.

- [ ] **Step 2: Fall back when WebSocket closes before connecting**

If the bridge is unavailable, start the browser runtime and keep controls enabled.

- [ ] **Step 3: Show runtime mode**

Show `CONNECTED` for WebSocket and `BROWSER DEMO` for the fallback runtime.

### Task 4: Netlify Configuration

**Files:**
- Create: `netlify.toml`

- [ ] **Step 1: Add static build settings**

Set the base to `ui`, command to `npm run build`, and publish directory to `ui/dist`.

- [ ] **Step 2: Add SPA redirect**

Route all paths back to `/index.html`.

### Task 5: Verify, Push, Deploy, Post

**Files:**
- Modify/create repository metadata as needed.

- [ ] **Step 1: Run verification**

Run tests, build, and preview the production output.

- [ ] **Step 2: Push to GitHub**

Commit the project and push it to `Aqibjadoon1/CPU_PIPELINE_VISUALIZER_COAL_PROJECT`.

- [ ] **Step 3: Deploy to Netlify**

Deploy `ui/dist` and capture the live URL.

- [ ] **Step 4: Prepare LinkedIn copy**

Write a polished post with the live demo URL, GitHub URL, and relevant hashtags.
