import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPreferBrowserRuntime } from './runtimeMode.js';

test('prefers browser runtime for production builds without a WebSocket URL', () => {
  assert.equal(shouldPreferBrowserRuntime({ PROD: true }), true);
});

test('keeps WebSocket transport when a WebSocket URL is configured', () => {
  assert.equal(
    shouldPreferBrowserRuntime({ PROD: true, VITE_WS_URL: 'wss://example.com/ws' }),
    false
  );
});

test('keeps WebSocket transport during local development', () => {
  assert.equal(shouldPreferBrowserRuntime({ PROD: false }), false);
});
