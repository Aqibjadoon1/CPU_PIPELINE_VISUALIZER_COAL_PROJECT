import { motion } from 'framer-motion';

export default function MemoryViewer({ memory }) {
  if (!memory || memory.length === 0) return null;

  return (
    <div className="border border-dark-border rounded-sm bg-dark-card/30">
      <div className="px-3 py-2 border-b border-dark-border">
        <span className="font-hero text-xs text-white tracking-widest">MEMORY</span>
      </div>
      <div className="p-2">
        <div className="grid grid-cols-4 gap-1">
          {memory.map((cell, i) => (
            <motion.div
              key={i}
              className={`font-mono text-[9px] px-1.5 py-1 border text-center transition-colors
                ${cell.justWritten ? 'border-red-accent/50 bg-red-accent/10 text-red-accent' :
                  cell.justRead ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' :
                  'border-dark-border text-text-dim'}`}
              animate={cell.justWritten || cell.justRead ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <span className="block">{cell.addr}</span>
              <span className="block text-white">{cell.value}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
