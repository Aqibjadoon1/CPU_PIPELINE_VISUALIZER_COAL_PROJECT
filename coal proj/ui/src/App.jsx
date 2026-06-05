import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useWebSocket } from './hooks/useWebSocket';
import { usePipelineState } from './hooks/usePipelineState';
import SplashScreen from './components/SplashScreen';
import PipelineCanvas from './components/PipelineCanvas';
import RegisterPanel from './components/RegisterPanel';
import AluDetailPanel from './components/AluDetailPanel';
import HazardBanner from './components/HazardBanner';
import ControlBar from './components/ControlBar';
import OperationSelector from './components/OperationSelector';
import InstructionLog from './components/InstructionLog';
import StepExplainer from './components/StepExplainer';
import InstructionQueue from './components/InstructionQueue';
import MemoryViewer from './components/MemoryViewer';
import PipelineTimeline from './components/PipelineTimeline';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [operandA, setOperandA] = useState(5);
  const [operandB, setOperandB] = useState(3);
  const [forwardingEnabled, setForwardingEnabled] = useState(false);

  const { state, dispatch, onMessage } = usePipelineState();
  const { connected, send, transport } = useWebSocket(onMessage);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (showSplash) {
        if (e.code === 'Space') { e.preventDefault(); setShowSplash(false); }
        return;
      }
      switch (e.code) {
        case 'Space': e.preventDefault(); send({ type: 'step' }); break;
        case 'KeyR': send({ type: 'run' }); break;
        case 'KeyP': send({ type: 'pause' }); break;
        case 'KeyQ': setShowSplash(true); send({ type: 'quit' }); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showSplash, send]);

  const handleStart = useCallback((mode, a, b) => {
    send({ type: 'start', mode: mode.toUpperCase(), a, b });
  }, [send]);

  const handleStep = useCallback(() => send({ type: 'step' }), [send]);
  const handleRun = useCallback(() => send({ type: 'run' }), [send]);
  const handlePause = useCallback(() => send({ type: 'pause' }), [send]);
  const handleReset = useCallback(() => {
    send({ type: 'reset' });
    dispatch({ type: 'reset' });
  }, [send, dispatch]);

  const handleToggleForwarding = useCallback((enabled) => {
    setForwardingEnabled(enabled);
    dispatch({ type: 'set_forwarding', enabled });
    send({ type: 'set_forwarding', enabled });
  }, [dispatch, send]);

  const handleExport = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      mode: state.mode,
      cycle: state.cycle,
      registers: state.registers,
      flags: state.flags,
      alu: state.alu,
      hazard: state.hazard,
      concepts: state.concepts,
      metrics: state.metrics,
      log: state.log,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  if (showSplash) {
    return <SplashScreen onBegin={() => setShowSplash(false)} />;
  }

  return (
    <div className="noise-overlay min-h-screen bg-dark-bg text-white font-body">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-bg/95 backdrop-blur-sm border-b border-dark-border h-14">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-hero text-xl text-red-accent tracking-wider">PIPELINE</span>
            <span className="text-text-dim text-xs font-mono hidden sm:inline">
              8086 Instruction Pipeline Visualizer
            </span>
          </div>
          <div className="flex items-center gap-4">
            {connected ? (
              <span className={`flex items-center gap-1.5 text-xs font-mono ${
                transport === 'browser' ? 'text-blue-400' : 'text-green-400'
              }`}>
                <span className={`w-2 h-2 rounded-full animate-pulse ${
                  transport === 'browser' ? 'bg-blue-400' : 'bg-green-400'
                }`} />
                {transport === 'browser' ? 'BROWSER DEMO' : 'CONNECTED'}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-red-accent font-mono">
                <span className="w-2 h-2 rounded-full bg-red-accent animate-pulse" />
                DISCONNECTED
              </span>
            )}
            <span className="text-text-muted text-xs">v1.0</span>
          </div>
        </div>
      </nav>

      {/* Main content area */}
      <div className="pt-14 flex">
        {/* Left sidebar — Instruction Queue */}
        <div className="hidden lg:flex flex-col w-64 border-r border-dark-border shrink-0">
          <div className="p-3 border-b border-dark-border">
            <span className="font-hero text-xs text-white tracking-widest">QUEUE</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <InstructionQueue queue={state.instructionQueue} pipeline={state.pipeline} />
          </div>
        </div>

        {/* Center content */}
        <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-5">
          {/* Hero */}
          <div className="corner-accent relative pt-8 pb-2">
            <h1 className="font-hero text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-none text-white uppercase">
              Pipeline
            </h1>
            <p className="text-text-dim font-mono text-xs mt-1 tracking-wider">
              {state.operationMode || '8086'} INSTRUCTION PIPELINE
            </p>
          </div>

          {/* Operation selector */}
          <OperationSelector
            mode={state.operationMode?.toLowerCase() || (state.mode?.toLowerCase() || '')}
            onStart={handleStart}
            operandA={operandA}
            operandB={operandB}
            onOperandAChange={setOperandA}
            onOperandBChange={setOperandB}
            disabled={state.status === 'running'}
          />

          {/* Hazard banner */}
          <HazardBanner
            hazard={state.hazard}
            cycle={state.cycle}
            forwardingEnabled={forwardingEnabled}
          />

          {/* Pipeline diagram */}
          <PipelineCanvas
            pipeline={state.pipeline}
            hazard={state.hazard}
            alu={state.alu}
          />

          {/* Explanation */}
          <StepExplainer
            explanation={state.explanation}
            concepts={state.concepts}
            hazard={state.hazard}
          />

          {/* Bottom panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <RegisterPanel
              registers={state.registers}
              changedRegisters={state.changedRegisters}
            />
            <AluDetailPanel
              alu={state.alu}
              flags={state.flags}
              mode={state.operationMode}
              error={state.error}
            />
          </div>

          {/* Control bar */}
          <ControlBar
            cycle={state.cycle}
            status={state.status}
            connected={connected}
            metrics={state.metrics}
            forwardingEnabled={forwardingEnabled}
            onStep={handleStep}
            onRun={handleRun}
            onPause={handlePause}
            onReset={handleReset}
            onExport={handleExport}
            onToggleForwarding={handleToggleForwarding}
          />

          {/* Timeline */}
          <PipelineTimeline
            history={state.history}
            cycle={state.cycle}
          />

          {/* Memory viewer */}
          <MemoryViewer memory={state.memory} />

          {/* Error */}
          {state.error && (
            <div className="bg-red-accent/10 border border-red-accent/30 rounded-sm p-4 text-center">
              <span className="text-red-accent font-mono text-sm">{state.error}</span>
            </div>
          )}
        </div>

        {/* Right sidebar — Log */}
        <div className="hidden xl:flex flex-col w-72 border-l border-dark-border shrink-0">
          <InstructionLog log={state.log} />
        </div>
      </div>
    </div>
  );
}
