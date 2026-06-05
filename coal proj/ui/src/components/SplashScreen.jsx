import { motion } from 'framer-motion';

export default function SplashScreen({ onBegin }) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-dark-bg"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="grain-overlay" />

      <motion.div
        className="relative flex flex-col items-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="corner-accent relative mb-8 px-8 py-4">
          <h1 className="font-hero text-7xl sm:text-8xl lg:text-9xl tracking-tighter text-white leading-none">
            PIPELINE
          </h1>
        </div>

        <motion.p
          className="font-mono text-xs text-text-dim tracking-[0.25em] mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          8086 INSTRUCTION PIPELINE VISUALIZER
        </motion.p>

        <motion.p
          className="font-mono text-[10px] text-text-muted tracking-wider mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          COMPUTER ORGANIZATION &amp; ASSEMBLY LANGUAGE &mdash; SPRING 2026
        </motion.p>

        <motion.button
          className="relative px-10 py-3 border border-red-accent text-red-accent font-mono text-sm tracking-widest
                     hover:bg-red-accent hover:text-white transition-all duration-300 cursor-pointer"
          onClick={onBegin}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          PRESS SPACE TO BEGIN
          <span className="ml-2 animate-pulse">▌</span>
        </motion.button>

        <motion.div
          className="absolute -bottom-24 left-1/2 -translate-x-1/2 flex gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          {['IF', 'ID', 'EX', 'MEM', 'WB'].map((s, i) => (
            <motion.span
              key={s}
              className="font-mono text-[10px] text-text-muted px-2 py-1 border border-dark-border"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.4 + i * 0.1 }}
            >
              {s}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
