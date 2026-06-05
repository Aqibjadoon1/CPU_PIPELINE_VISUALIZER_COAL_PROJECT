import { motion, AnimatePresence } from 'framer-motion';

export default function StepExplainer({ explanation, concepts, hazard }) {
  return (
    <div className="border border-dark-border rounded-sm bg-dark-card/30">
      <div className="px-3 py-2 border-b border-dark-border">
        <span className="font-hero text-xs text-white tracking-widest">EXPLANATION</span>
      </div>
      <div className="p-3 min-h-[60px]">
        <AnimatePresence mode="wait">
          {explanation ? (
            <motion.p
              key={explanation}
              className="font-mono text-xs text-text-dim leading-relaxed"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
            >
              {explanation}
            </motion.p>
          ) : (
            <motion.p
              className="font-mono text-[10px] text-text-muted/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Press STEP to begin pipeline execution
            </motion.p>
          )}
        </AnimatePresence>

        {/* Concept tags */}
        {concepts && concepts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {concepts.map((tag, i) => (
              <motion.span
                key={tag}
                className="font-mono text-[9px] text-text-muted border border-dark-border px-1.5 py-0.5"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                {tag}
              </motion.span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
