import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserPipelineRuntime } from './browserRuntime.js';

test('starts a browser-side pipeline simulation with bridge-compatible messages', () => {
  const messages = [];
  const runtime = new BrowserPipelineRuntime((message) => messages.push(message));

  runtime.send({ type: 'start', mode: 'ADD', a: 5, b: 3 });

  assert.equal(messages[0].type, 'sim_started');
  const update = messages.find((message) => message.type === 'STATE_UPDATE');
  assert.ok(update);
  assert.equal(update.operation_mode, 'ADD');
  assert.equal(update.cycle, 0);
  assert.equal(update.instruction_queue.length, 10);

  runtime.dispose();
});

test('steps the browser-side simulation until completion', () => {
  const messages = [];
  const runtime = new BrowserPipelineRuntime((message) => messages.push(message));

  runtime.send({ type: 'start', mode: 'ADD', a: 5, b: 3 });
  for (let i = 0; i < 60; i += 1) {
    runtime.send({ type: 'step' });
  }

  assert.ok(messages.some((message) => message.type === 'sim_complete'));
  const updates = messages.filter((message) => message.type === 'STATE_UPDATE');
  assert.equal(updates.at(-1).status, 'complete');

  runtime.dispose();
});
