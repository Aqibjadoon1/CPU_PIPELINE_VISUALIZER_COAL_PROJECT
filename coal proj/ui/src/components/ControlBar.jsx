import { motion } from 'framer-motion';

export default function ControlBar({
  cycle, status, connected, metrics,
  onStep, onRun, onPause, onReset, onExport,
  onToggleForwarding, forwardingEnabled,
}) {
  const isRunning = status === 'running';
  const isComplete = status === 'complete';
  const canStep = connected && !isRunning && !isComplete;

  return (
    <div className="border border-dark-border rounded-sm p-3 bg-dark-card/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onStep}
            disabled={!canStep}
            className="px-3 py-1.5 font-mono text-xs border border-dark-border text-white
                       hover:border-red-accent/50 disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            STEP
          </button>
          {!isRunning ? (
            <button
              onClick={onRun}
              disabled={!connected || isComplete}
              className="px-3 py-1.5 font-mono text-xs border border-red-accent text-red-accent
                         hover:bg-red-accent hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              RUN
            </button>
          ) : (
            <button
              onClick={onPause}
              className="px-3 py-1.5 font-mono text-xs border border-yellow-500 text-yellow-500
                         hover:bg-yellow-500 hover:text-black transition-all cursor-pointer"
            >
              PAUSE
            </button>
          )}
          <button
            onClick={onReset}
            className="px-3 py-1.5 font-mono text-xs border border-dark-border text-text-dim
                       hover:border-text-dim transition-all cursor-pointer"
          >
            RESET
          </button>
          <button
            onClick={onExport}
            disabled={cycle === 0}
            className="px-3 py-1.5 font-mono text-xs border border-dark-border text-text-dim
                       hover:border-text-dim disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            EXPORT
          </button>
        </div>

        {/* Center: cycle + status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-text-muted tracking-wider">CYCLE</span>
            <motion.span
              className="font-hero text-lg text-white tabular-nums"
              key={cycle}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
              {String(cycle).padStart(3, '0')}
            </motion.span>
          </div>
          <span className={`font-mono text-[10px] tracking-widest px-2 py-0.5 border
            ${status === 'running' ? 'text-green-400 border-green-400/30' :
              status === 'complete' ? 'text-blue-400 border-blue-400/30' :
              status === 'error' ? 'text-red-accent border-red-accent/30' :
              'text-text-muted border-dark-border'
            }`}>
            {status.toUpperCase()}
          </span>
        </div>

        {/* Right: metrics + forwarding */}
        <div className="flex items-center gap-4">
          {metrics && metrics.totalCycles > 0 && (
            <div className="hidden sm:flex items-center gap-3 font-mono text-[10px] text-text-muted">
              <span>CPI: {metrics.cpi}</span>
              <span>EFF: {metrics.efficiency}%</span>
              <span>STALLS: {metrics.stalls}</span>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={forwardingEnabled}
              onChange={e => onToggleForwarding && onToggleForwarding(e.target.checked)}
              className="w-3 h-3 accent-red-accent cursor-pointer"
            />
            <span className="font-mono text-[10px] text-text-muted">FWD</span>
          </label>
        </div>
      </div>
    </div>
  );
}
