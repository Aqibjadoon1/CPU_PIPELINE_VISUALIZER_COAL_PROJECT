import PipelineSimulator from './PipelineSimulator.js';

const DEFAULT_RUN_INTERVAL = 350;

export class BrowserPipelineRuntime {
  constructor(onMessage, options = {}) {
    this.onMessage = onMessage;
    this.intervalMs = options.intervalMs || DEFAULT_RUN_INTERVAL;
    this.setTimer = options.setTimer || globalThis.setInterval;
    this.clearTimer = options.clearTimer || globalThis.clearInterval;
    this.sim = null;
    this.timer = null;
    this.forwardingEnabled = false;
  }

  send(message) {
    switch (message.type) {
      case 'start':
        this.start(message);
        break;
      case 'step':
        this.step();
        break;
      case 'run':
        this.run();
        break;
      case 'pause':
        this.pause();
        break;
      case 'reset':
        this.reset();
        break;
      case 'quit':
        this.reset();
        break;
      case 'set_forwarding':
        this.setForwarding(Boolean(message.enabled));
        break;
    }
  }

  start(message) {
    this.clearRunTimer();
    this.sim = new PipelineSimulator();
    this.sim.forwardingEnabled = this.forwardingEnabled;

    const mode = message.mode || 'ADD';
    const a = typeof message.a === 'number' ? message.a : 5;
    const b = typeof message.b === 'number' ? message.b : 3;

    this.sim.loadProgram(mode, a, b);
    this.emit({ type: 'sim_started', mode, a, b });

    if (this.sim.error) {
      this.emit({ type: 'error', message: this.sim.error });
      return;
    }

    this.emit(this.sim.serializeState());
  }

  step() {
    if (!this.sim || this.sim.simComplete) return;

    const state = this.sim.advancePipeline();
    if (state) this.emit(state);

    if (this.sim.simComplete) {
      this.emit({ type: 'sim_complete', cycles: this.sim.clockCycle });
      this.clearRunTimer();
    }
  }

  run() {
    if (!this.sim || this.sim.simComplete) return;

    this.clearRunTimer();
    this.sim.runMode = 'auto';
    this.emit({ type: 'status', status: 'running' });
    this.timer = this.setTimer(() => this.step(), this.intervalMs);
  }

  pause() {
    this.clearRunTimer();
    if (this.sim) this.sim.runMode = 'idle';
    this.emit({ type: 'status', status: 'paused' });
  }

  reset() {
    this.clearRunTimer();
    this.sim = null;
    this.emit({ type: 'reset' });
  }

  setForwarding(enabled) {
    this.forwardingEnabled = enabled;
    if (this.sim) {
      this.sim.forwardingEnabled = enabled;
    }
  }

  dispose() {
    this.clearRunTimer();
    this.sim = null;
  }

  clearRunTimer() {
    if (this.timer) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
  }

  emit(message) {
    this.onMessage(message);
  }
}

export function createBrowserPipelineRuntime(onMessage, options) {
  return new BrowserPipelineRuntime(onMessage, options);
}
