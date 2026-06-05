import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';

export default function InstructionLog({ log }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log?.length]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-dark-border shrink-0">
        <span className="font-hero text-xs text-white tracking-widest">LOG</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <AnimatePresence initial={false}>
          {log?.slice().reverse().map((entry, i) => (
            <motion.div
              key={entry.cycle + '-' + i + '-' + (entry.concepts?.[0] || '')}
              className="font-mono text-[9px] text-text-dim py-0.5 border-b border-dark-border/20 last:border-0"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
            >
              <span className="text-text-muted">C{entry.cycle}</span>{' '}
              <span className="text-white/70">{entry.concepts?.[0] || entry.explanation?.slice(0, 30) || ''}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
