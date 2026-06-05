import { motion, AnimatePresence } from 'framer-motion';

export default function HazardBanner({ hazard, cycle, forwardingEnabled }) {
  const hasHazard = hazard?.detected;

  return (
    <AnimatePresence>
      {hasHazard && (
        <motion.div
          className="border border-red-accent/40 bg-red-accent/5 rounded-sm overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-hero text-red-accent text-sm tracking-widest">HAZARD</span>
              <span className="text-red-accent/80 font-mono text-xs">
                RAW &mdash; <span className="text-white">{hazard.reg}</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-[10px] text-text-muted">
                Cycle {cycle}
              </span>
              {forwardingEnabled && (
                <span className="font-mono text-[10px] text-green-400 border border-green-400/30 px-2 py-0.5">
                  FORWARDING
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
