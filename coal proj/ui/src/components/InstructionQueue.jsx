import { motion, AnimatePresence } from 'framer-motion';

export default function InstructionQueue({ queue, pipeline }) {
  const pipelineIndices = new Set();
  Object.values(pipeline || {}).forEach(slot => {
    if (slot && typeof slot.index === 'number') pipelineIndices.add(slot.index);
  });

  return (
    <div className="border border-dark-border rounded-sm bg-dark-card/30">
      <div className="px-3 py-2 border-b border-dark-border flex items-center justify-between">
        <span className="font-hero text-xs text-white tracking-widest">INSTRUCTION QUEUE</span>
        <span className="font-mono text-[9px] text-text-muted">{queue?.length || 0} instructions</span>
      </div>
      <div className="p-2 max-h-[300px] overflow-y-auto">
        <AnimatePresence>
          {queue?.map((instr, i) => {
            const inPipeline = pipelineIndices.has(instr.index);
            const completed = instr.enteredPipeline && !inPipeline;

            return (
              <motion.div
                key={instr.index}
                className={`flex items-center gap-2 px-2 py-1 border-b border-dark-border/30 last:border-0
                  ${inPipeline ? 'bg-red-accent/[0.04]' : ''}
                  ${completed ? 'opacity-30' : ''}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                layout
              >
                <span className={`font-mono text-[9px] w-6 shrink-0
                  ${inPipeline ? 'text-red-accent' : 'text-text-muted'}`}>
                  I{instr.index}
                </span>
                <span className="font-mono text-[10px] text-white truncate flex-1">
                  {instr.mnemonic}
                </span>
                {inPipeline && (
                  <motion.span
                    className="w-1.5 h-1.5 rounded-full bg-red-accent shrink-0"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
                {completed && (
                  <span className="font-mono text-[8px] text-green-400/50 shrink-0">DONE</span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
