import { motion } from 'framer-motion';

const OPERATIONS = [
  { id: 'ADD', color: '#E8131C' },
  { id: 'SUB', color: '#E8131C' },
  { id: 'MUL', color: '#E8131C' },
  { id: 'DIV', color: '#E8131C' },
  { id: 'AND', color: '#E8131C' },
  { id: 'OR', color: '#E8131C' },
  { id: 'XOR', color: '#E8131C' },
  { id: 'NOT', color: '#E8131C' },
  { id: 'SHL', color: '#E8131C' },
  { id: 'SHR', color: '#E8131C' },
  { id: 'FULL_DEMO', color: '#FFFFFF' },
];

export default function OperationSelector({ mode, onStart, operandA, operandB, onOperandAChange, onOperandBChange, disabled }) {
  const isDemo = mode === 'full_demo';

  return (
    <div className="border border-dark-border rounded-sm p-4 bg-dark-card/50">
      <div className="flex flex-wrap gap-2 mb-4">
        {OPERATIONS.map(op => (
          <motion.button
            key={op.id}
            className={`px-3 py-1.5 font-mono text-xs border transition-all duration-200 cursor-pointer
              ${mode === op.id.toLowerCase()
                ? 'bg-red-accent text-white border-red-accent'
                : 'border-dark-border text-text-dim hover:border-red-accent/50 hover:text-white'
              }`}
            onClick={() => onStart(op.id, operandA, operandB)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={disabled}
          >
            {op.id === 'FULL_DEMO' ? 'FULL DEMO' : op.id}
          </motion.button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-text-muted tracking-wider">AX</span>
          <input
            type="number"
            min={0}
            max={65535}
            value={operandA}
            onChange={e => onOperandAChange(Math.max(0, Math.min(65535, parseInt(e.target.value) || 0)))}
            disabled={isDemo || disabled}
            className="w-20 bg-dark-bg border border-dark-border px-2 py-1 font-mono text-xs text-white
                       focus:border-red-accent/50 focus:outline-none transition-colors disabled:opacity-30"
          />
        </div>
        <span className="font-mono text-xs text-text-muted">×</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-text-muted tracking-wider">BX</span>
          <input
            type="number"
            min={0}
            max={65535}
            value={operandB}
            onChange={e => onOperandBChange(Math.max(0, Math.min(65535, parseInt(e.target.value) || 0)))}
            disabled={isDemo || disabled}
            className="w-20 bg-dark-bg border border-dark-border px-2 py-1 font-mono text-xs text-white
                       focus:border-red-accent/50 focus:outline-none transition-colors disabled:opacity-30"
          />
        </div>
      </div>
    </div>
  );
}
