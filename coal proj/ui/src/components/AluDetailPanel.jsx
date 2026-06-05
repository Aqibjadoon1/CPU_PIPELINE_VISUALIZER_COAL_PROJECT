import { motion } from 'framer-motion';

export default function AluDetailPanel({ alu, flags, mode, error }) {
  if (error) {
    return (
      <div className="border border-red-accent/30 rounded-sm bg-red-accent/5 p-4">
        <div className="flex items-center gap-3">
          <span className="font-hero text-red-accent text-xs tracking-widest">ERROR</span>
          <span className="font-mono text-xs text-red-accent/80">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-dark-border rounded-sm bg-dark-card/30">
      <div className="px-3 py-2 border-b border-dark-border">
        <span className="font-hero text-xs text-white tracking-widest">ALU</span>
      </div>

      {/* ALU Operation */}
      <div className="p-3 border-b border-dark-border/50">
        <div className="flex items-center justify-center gap-4 py-2">
          <motion.div
            className={`font-mono text-sm ${alu?.active ? 'text-red-accent' : 'text-text-dim'}`}
            animate={alu?.active ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.5, repeat: alu?.active ? Infinity : 0 }}
          >
            {alu?.a || '0000'}
          </motion.div>
          <span className="font-mono text-lg text-text-muted">
            {alu?.op === 'ADD' ? '+' : alu?.op === 'SUB' ? '−' : alu?.op === 'MUL' ? '×' : alu?.op === 'DIV' ? '÷' : alu?.op === 'AND' ? '&' : alu?.op === 'OR' ? '|' : alu?.op === 'XOR' ? '^' : alu?.op === 'NOT' ? '~' : alu?.op === 'SHL' ? '<<' : alu?.op === 'SHR' ? '>>' : '?'}
          </span>
          <motion.div
            className={`font-mono text-sm ${alu?.active ? 'text-red-accent' : 'text-text-dim'}`}
            animate={alu?.active ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.5, repeat: alu?.active ? Infinity : 0, delay: 0.15 }}
          >
            {alu?.b || '0000'}
          </motion.div>
        </div>

        {alu?.active && (
          <motion.div
            className="text-center font-hero text-2xl text-white tracking-wider"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            = {alu?.result || '0000'}
          </motion.div>
        )}

        {alu?.multicycle && (
          <div className="text-center mt-2">
            <span className="font-mono text-[9px] text-yellow-500">
              MULTI-CYCLE: {alu.cycle}/{alu.cyclesTotal}
            </span>
          </div>
        )}
      </div>

      {/* Flags */}
      <div className="p-3">
        <div className="flex flex-wrap gap-2 justify-center">
          {['ZF', 'SF', 'CF', 'OF', 'PF'].map(f => (
            <div
              key={f}
              className={`px-2 py-1 border text-center min-w-[48px] transition-all duration-200 ${
                flags?.[f]
                  ? 'border-red-accent/50 bg-red-accent/10 text-red-accent'
                  : 'border-dark-border text-text-muted'
              }`}
            >
              <span className="block font-mono text-[9px] tracking-wider">{f}</span>
              <span className="block font-mono text-xs">{flags?.[f] || 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
