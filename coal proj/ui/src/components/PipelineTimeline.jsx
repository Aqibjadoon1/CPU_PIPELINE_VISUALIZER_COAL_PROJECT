import { motion, AnimatePresence } from 'framer-motion';

const STAGE_KEYS = ['IF', 'ID', 'EX', 'MEM', 'WB'];
const STAGE_COLORS = {
  IF: '#E8131C', ID: '#E8131C', EX: '#E8131C', MEM: '#E8131C', WB: '#E8131C',
};

export default function PipelineTimeline({ history, cycle }) {
  const recentHistory = history?.slice(-40) || [];
  const maxCycle = cycle || recentHistory.length;

  return (
    <div className="border border-dark-border rounded-sm bg-dark-card/30">
      <div className="px-3 py-2 border-b border-dark-border flex items-center justify-between">
        <span className="font-hero text-xs text-white tracking-widest">TIMELINE</span>
        <span className="font-mono text-[9px] text-text-muted">
          {recentHistory.length} cycles
        </span>
      </div>
      <div className="p-3 overflow-x-auto">
        <div className="min-w-[400px]">
          {/* Header */}
          <div className="flex mb-2">
            <div className="w-8 shrink-0" />
            {STAGE_KEYS.map(s => (
              <div key={s} className="flex-1 text-center">
                <span className="font-mono text-[8px] text-text-muted tracking-wider">{s}</span>
              </div>
            ))}
          </div>

          {/* Rows */}
          <AnimatePresence>
            {recentHistory.map((h, hi) => (
              <motion.div
                key={h.cycle}
                className="flex items-center mb-0.5"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 20 }}
                transition={{ duration: 0.15 }}
              >
                <div className="w-8 shrink-0">
                  <span className="font-mono text-[8px] text-text-muted">C{h.cycle}</span>
                </div>
                {STAGE_KEYS.map(stage => {
                  const slot = h.pipeline?.[stage];
                  const isStall = slot?.stall;
                  const isEmpty = slot?.empty;
                  const hasHazard = h.hazard?.detected && stage === 'ID';
                  const isActive = !isEmpty && !isStall;

                  return (
                    <div key={stage} className="flex-1 px-0.5">
                      <motion.div
                        className={`h-3 w-full transition-colors duration-200 ${
                          hasHazard ? 'bg-red-accent/40' :
                          isStall ? 'bg-yellow-500/20' :
                          isActive ? 'bg-red-accent/30' :
                          'bg-dark-border/30'
                        }`}
                        animate={isStall ? { opacity: [0.5, 1, 0.5] } : {}}
                        transition={{ duration: 1, repeat: isStall ? Infinity : 0 }}
                      />
                    </div>
                  );
                })}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
