import { motion, AnimatePresence } from 'framer-motion';

const REG_ORDER = ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'SP'];

export default function RegisterPanel({ registers, changedRegisters }) {
  return (
    <div className="border border-dark-border rounded-sm bg-dark-card/30">
      <div className="px-3 py-2 border-b border-dark-border">
        <span className="font-hero text-xs text-white tracking-widest">REGISTERS</span>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {REG_ORDER.map(reg => {
            const val = registers?.[reg] || '0000';
            const changed = changedRegisters?.includes(reg);

            return (
              <div key={reg} className="text-center">
                <span className="block font-mono text-[10px] text-text-muted tracking-wider mb-1">{reg}</span>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={val}
                    className={`block font-mono text-xs tracking-wider
                      ${changed ? 'text-red-accent' : 'text-white'}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    layout
                  >
                    {val}
                  </motion.span>
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
