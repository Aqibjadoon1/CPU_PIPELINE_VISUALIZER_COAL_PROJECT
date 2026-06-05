# Netlify Launch Design

## Goal

Publish the CPU Pipeline Visualizer as a working live demo on Netlify, push the complete project to the public GitHub repository, and prepare a polished LinkedIn post that includes both links.

## Approach

The existing project has a React/Vite UI and a Node WebSocket bridge that drives the simulator locally. Netlify can host the static UI, but it cannot run the local bridge as-is. To make the public link useful, the UI will use a browser-side simulator fallback when a WebSocket bridge is unavailable or when the production build is deployed without a `VITE_WS_URL`.

## Behavior

The app keeps the current local bridge workflow for development and class demos. On Netlify, users can start operations, step cycles, run, pause, reset, and export the pipeline state directly in the browser. The navigation will distinguish a real bridge connection from the browser demo runtime.

## Files

- `ui/src/simulator/PipelineSimulator.js`: browser-compatible simulator engine copied from the existing bridge simulator and exported as ESM.
- `ui/src/simulator/browserRuntime.js`: small command runtime that exposes the same message flow expected by the UI.
- `ui/src/hooks/useWebSocket.js`: transport selector that uses WebSocket when available and falls back to the browser runtime.
- `ui/src/App.jsx`: shows whether the app is using the bridge or browser runtime.
- `ui/package.json`: adds a focused test command for the browser runtime.
- `netlify.toml`: defines Netlify build and publish settings.

## Verification

Run the focused browser runtime tests, build the Vite app, preview the static build, and verify with a browser that the public-style build can start and step the simulation without a local WebSocket bridge.
