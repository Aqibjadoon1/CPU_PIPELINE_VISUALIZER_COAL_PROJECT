import { useReducer, useCallback, useRef, useEffect } from 'react';

const initialState = {
  connected: false,
  mode: null,
  cycle: 0,
  pipeline: { IF: { empty: true }, ID: { empty: true }, EX: { empty: true }, MEM: { empty: true }, WB: { empty: true } },
  registers: { AX: '0000', BX: '0000', CX: '0000', DX: '0000', SI: '0000', DI: '0000', SP: '01FE' },
  flags: { ZF: 0, SF: 0, CF: 0, OF: 0, PF: 0, AF: 0 },
  alu: { op: null, a: '0000', b: '0000', result: '0000', active: false, multicycle: false, cycle: 1, cyclesTotal: 1, high: '0000' },
  hazard: { detected: false, type: null, reg: null, stallsInserted: 0, totalStalls: 0 },
  memory: [],
  instructionQueue: [],
  status: 'idle',
  operationMode: '',
  explanation: '',
  concepts: [],
  changedRegisters: [],
  totalInstructions: 0,
  completedInstructions: 0,
  error: null,
  log: [],
  history: [],
  metrics: null,
  forwardingEnabled: false,
};

function pipelineReducer(state, action) {
  switch (action.type) {
    case 'STATE_UPDATE': {
      const logEntry = {
        cycle: action.cycle,
        pipeline: action.pipeline,
        explanation: action.step_explanation,
        concepts: action.assembly_concepts || [],
        hazard: action.hazard,
      };
      const history = [...state.history, {
        cycle: action.cycle,
        pipeline: JSON.parse(JSON.stringify(action.pipeline)),
        registers: { ...action.registers },
        hazard: { ...action.hazard },
      }].slice(-500);

      const metrics = computeMetrics(action, state);

      return {
        ...state,
        cycle: action.cycle,
        pipeline: action.pipeline,
        registers: action.registers,
        flags: action.flags,
        alu: action.alu,
        hazard: action.hazard,
        memory: action.memory || [],
        instructionQueue: action.instruction_queue || [],
        status: action.status || state.status,
        operationMode: action.operation_mode || state.operationMode,
        explanation: action.step_explanation || '',
        concepts: action.assembly_concepts || [],
        changedRegisters: action.changed_registers || [],
        totalInstructions: action.total_instructions || 0,
        completedInstructions: action.completed_instructions || 0,
        log: [...state.log, logEntry].slice(-100),
        history,
        metrics,
        error: null,
      };
    }

    case 'ready':
      return { ...initialState, connected: true, mode: action.mode || null };

    case 'sim_started':
      return {
        ...initialState,
        connected: state.connected,
        forwardingEnabled: state.forwardingEnabled,
        mode: action.mode,
      };

    case 'sim_complete': {
      const m = state.metrics || {};
      const finalMetrics = {
        ...m,
        totalCycles: action.cycles || state.cycle,
        instructionsCompleted: state.completedInstructions || state.totalInstructions,
        cpi: state.completedInstructions > 0
          ? ((action.cycles || state.cycle) / state.completedInstructions).toFixed(2)
          : '0.00',
        efficiency: state.totalInstructions > 0
          ? Math.round(((state.totalInstructions + 4) / Math.max(action.cycles || state.cycle, 1)) * 100)
          : 0,
        stalls: (state.hazard ? state.hazard.totalStalls : 0) || state.metrics?.stalls || 0,
        hazards: state.metrics?.hazards || 0,
      };
      return { ...state, status: 'complete', metrics: finalMetrics };
    }

    case 'status':
      return { ...state, status: action.status };

    case 'reset':
      return { ...initialState, connected: state.connected, forwardingEnabled: state.forwardingEnabled };

    case 'set_forwarding':
      return { ...state, forwardingEnabled: action.enabled };

    case 'error':
      return { ...state, error: action.message || action.error, status: 'error' };

    default:
      return state;
  }
}

function computeMetrics(action, state) {
  const totalCycles = action.cycle || 0;
  const completed = action.completed_instructions || 0;
  const total = action.total_instructions || 0;
  const haz = action.hazard || {};
  const stalls = haz.stallsInserted || 0;
  const hazards = haz.detected ? 1 : 0;
  const idealCycles = total > 0 ? total + 4 : 0;
  const actualCycles = Math.max(totalCycles, 1);
  const efficiency = idealCycles > 0 ? Math.round((idealCycles / actualCycles) * 100) : 0;

  return {
    totalCycles,
    instructionsCompleted: completed || state.completedInstructions,
    cpi: completed > 0 ? (totalCycles / completed).toFixed(2) : '0.00',
    efficiency: Math.min(efficiency, 100),
    stalls: (state.metrics?.stalls || 0) + stalls,
    hazards: (state.metrics?.hazards || 0) + hazards,
  };
}

export function usePipelineState() {
  const [state, dispatch] = useReducer(pipelineReducer, initialState);

  const onMessage = useCallback((data) => {
    dispatch(data);
  }, []);

  return { state, dispatch, onMessage };
}
