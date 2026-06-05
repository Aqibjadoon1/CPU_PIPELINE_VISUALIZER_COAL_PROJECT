import { motion, AnimatePresence } from 'framer-motion';

const STAGE_CONFIG = [
  { key: 'IF', label: 'FETCH', color: '#E8131C', desc: 'Instruction Fetch' },
  { key: 'ID', label: 'DECODE', color: '#E8131C', desc: 'Instruction Decode' },
  { key: 'EX', label: 'EXECUTE', color: '#E8131C', desc: 'Execution' },
  { key: 'MEM', label: 'MEMORY', color: '#E8131C', desc: 'Memory Access' },
  { key: 'WB', label: 'WRITEBK', color: '#E8131C', desc: 'Write-Back' },
];

export default function PipelineCanvas({ pipeline, hazard, alu }) {
  return (
    <div className="border border-dark-border rounded-sm overflow-hidden">
      <div className="grid grid-cols-5 divide-x divide-dark-border">
        {STAGE_CONFIG.map((stage, idx) => {
          const slot = pipeline?.[stage.key];
          const isEmpty = slot?.empty;
          const isStall = slot?.stall;
          const hasHazard = hazard?.detected && stage.key === 'ID';
          const isALUActive = alu?.active && stage.key === 'EX';
          const isMulticycle = alu?.multicycle && stage.key === 'EX';

          return (
            <div
              key={stage.key}
              className={`relative min-h-[120px] transition-all duration-300 ${
                isALUActive || (!isEmpty && !isStall) ? 'bg-red-accent/[0.02]' : ''
              } ${hasHazard ? 'bg-red-accent/[0.06]' : ''}`}
            >
              {/* Stage label - vertical on left */}
              <div className="absolute top-0 left-0 bottom-0 w-5 flex items-center justify-center border-r border-dark-border">
                <span className="font-mono text-[9px] text-text-muted tracking-[0.15em] -rotate-90 whitespace-nowrap origin-center">
                  {stage.label}
                </span>
              </div>

              {/* Content */}
              <div className="ml-6 p-3 h-full flex flex-col justify-center">
                {/* Hazard indicator */}
                {hasHazard && (
                  <motion.div
                    className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-accent rounded-full"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}

                {/* Multi-cycle indicator */}
                {isMulticycle && (
                  <motion.div
                    className="absolute top-1 left-8 font-mono text-[8px] text-yellow-500"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {alu.cycle}/{alu.cyclesTotal}
                  </motion.div>
                )}

                {/* Instruction token */}
                {isStall ? (
                  <motion.div
                    className="text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <span className="font-mono text-[10px] text-yellow-500/60 tracking-widest">STALL</span>
                    <div className="mt-1 h-px bg-yellow-500/20" />
                  </motion.div>
                ) : isEmpty ? (
                  <div className="text-center">
                    <span className="font-mono text-[9px] text-text-muted/30">—</span>
                  </div>
                ) : (
                  <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <span className="block font-mono text-[10px] text-text-dim mb-1">
                      {slot.instruction || ''}
                    </span>
                    <span className="block font-mono text-[10px] text-white leading-tight">
                      {slot.mnemonic || ''}
                    </span>
                    {/* Data flow arrow for EX stage */}
                    {stage.key === 'EX' && alu?.active && (
                      <motion.div
                        className="mt-2 font-mono text-[8px] text-text-muted"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        {alu.a} {alu.op === 'ADD' ? '+' : alu.op === 'SUB' ? '−' : alu.op === 'MUL' ? '×' : alu.op === 'DIV' ? '÷' : ''} {alu.b} = {alu.result}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Bottom indicator */}
              <div className={`absolute bottom-0 left-0 right-0 h-[2px] transition-colors duration-300 ${
                isALUActive ? 'bg-red-accent' :
                hasHazard ? 'bg-red-accent' :
                (!isEmpty && !isStall) ? 'bg-red-accent/40' :
                'bg-transparent'
              }`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
