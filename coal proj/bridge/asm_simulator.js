/**
 * asm_simulator.js — Cycle-accurate 8086 pipeline simulation engine
 * CPU Pipeline Visualizer — COAL Spring 2026
 *
 * Faithfully replicates the behavior of pipeline_visualizer.asm
 * Produces identical JSON output for the React UI.
 * Supports: ADD, SUB, MUL, DIV, AND, OR, XOR, NOT, SHL, SHR, FULL_DEMO
 */

const OP = {
  MOV_REG_IMM: 0, MOV_REG_REG: 1, MOV_MEM_WRITE: 2, MOV_MEM_READ: 3,
  ADD: 4, SUB: 5, MUL: 6, DIV: 7, CMP: 8,
  AND: 9, OR: 10, XOR: 11, NOT: 12, SHL: 13, SHR: 14, NOP: 15
};

const STAGE = { IF: 0, ID: 1, EX: 2, MEM: 3, WB: 4 };
const STAGE_NAMES = ['IF', 'ID', 'EX', 'MEM', 'WB'];
const REG_NAMES = ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'SP'];

class PipelineSimulator {
  constructor() {
    this.reset();
  }

  reset() {
    this.registers = { AX: 0, BX: 0, CX: 0, DX: 0, SI: 0, DI: 0, SP: 0x01FE };
    this.prevRegisters = { AX: -1, BX: -1, CX: -1, DX: -1, SI: -1, DI: -1, SP: -1 };
    this.flags = { ZF: 0, SF: 0, CF: 0, OF: 0, PF: 0, AF: 0 };
    this.pipeline = { IF: null, ID: null, EX: null, MEM: null, WB: null };
    this.memory = new Array(16).fill(0);
    this.instrTable = [];
    this.instrPtr = 0;
    this.clockCycle = 0;
    this.stallCount = 0;
    this.totalStalls = 0;
    this.hazardCount = 0;
    this.alu = { op: null, a: 0, b: 0, result: 0, active: false, cycle: 0, cyclesTotal: 1 };
    this.hazard = { detected: false, type: null, reg: null, stallsInserted: 0, totalStalls: 0 };
    this.simComplete = false;
    this.runMode = 'idle';
    this.operationMode = 'ADD';
    this.operandA = 0x0005;
    this.operandB = 0x0003;
    this.completedInstructions = 0;
    this.totalInstructions = 0;
    this.changedRegisters = [];
    this.instructionQueue = [];
    this.cycleHistory = [];
    this.conceptTags = [];
    this.explanation = '';
    this.forwardingEnabled = false;
  }

  loadProgram(mode, a, b) {
    this.operationMode = mode;
    this.operandA = a;
    this.operandB = b;
    this.instrTable = [];
    this.instructionQueue = [];

    switch (mode) {
      case 'ADD': this.loadAddSequence(a, b); break;
      case 'SUB': this.loadSubSequence(a, b); break;
      case 'MUL': this.loadMulSequence(a, b); break;
      case 'DIV': this.loadDivSequence(a, b); break;
      case 'AND': this.loadAndSequence(a, b); break;
      case 'OR':  this.loadOrSequence(a, b); break;
      case 'XOR': this.loadXorSequence(a, b); break;
      case 'NOT': this.loadNotSequence(a, b); break;
      case 'SHL': this.loadShlSequence(a, b); break;
      case 'SHR': this.loadShrSequence(a, b); break;
      case 'FULL_DEMO': this.loadFullSequence(a, b); break;
      default: this.loadAddSequence(a, b);
    }

    this.totalInstructions = this.instrTable.length;
    this.instructionQueue = this.instrTable.map((inst, i) => ({
      index: i, mnemonic: this.buildMnemonic(inst), enteredPipeline: false
    }));
  }

  // ── Instruction Loaders ──────────────────────────────────────────

  loadAddSequence(a, b) {
    this.instrTable = [
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: a, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 1, imm: b, mem: 0, flags: 0 },
      { op: OP.ADD, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 0, dst: 2, imm: 0, mem: 0, flags: 2 },
      { op: OP.MOV_MEM_WRITE, src: 0, dst: 0xFF, imm: 0x1000, mem: 1, flags: 0 },
      { op: OP.MOV_MEM_READ, src: 0xFE, dst: 3, imm: 0x1000, mem: 2, flags: 0 },
      { op: OP.ADD, src: 1, dst: 2, imm: 0, mem: 0, flags: 2 },
      { op: OP.CMP, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 2, dst: 4, imm: 0, mem: 0, flags: 2 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: 0, mem: 0, flags: 0 },
    ];
  }

  loadSubSequence(a, b) {
    this.instrTable = [
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: a, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 1, imm: b, mem: 0, flags: 0 },
      { op: OP.SUB, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 0, dst: 4, imm: 0, mem: 0, flags: 2 },
      { op: OP.MOV_MEM_WRITE, src: 0, dst: 0xFF, imm: 0x1000, mem: 1, flags: 0 },
      { op: OP.MOV_MEM_READ, src: 0xFE, dst: 3, imm: 0x1000, mem: 2, flags: 0 },
      { op: OP.SUB, src: 1, dst: 2, imm: 0, mem: 0, flags: 0 },
      { op: OP.CMP, src: 0, dst: 1, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 4, dst: 5, imm: 0, mem: 0, flags: 2 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: 0, mem: 0, flags: 0 },
    ];
  }

  loadMulSequence(a, b) {
    this.instrTable = [
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: a & 0xFF, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 1, imm: b & 0xFF, mem: 0, flags: 0 },
      { op: OP.MUL, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 0, dst: 2, imm: 0, mem: 0, flags: 2 },
      { op: OP.MOV_MEM_WRITE, src: 0, dst: 0xFF, imm: 0x1000, mem: 1, flags: 0 },
      { op: OP.MOV_MEM_READ, src: 0xFE, dst: 3, imm: 0x1000, mem: 2, flags: 0 },
      { op: OP.CMP, src: 0, dst: 1, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 0, dst: 4, imm: 0, mem: 0, flags: 2 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: 0, mem: 0, flags: 0 },
    ];
  }

  loadDivSequence(a, b) {
    if (b === 0) {
      this.simComplete = true;
      this.error = 'DIVISION_BY_ZERO';
      return;
    }
    this.instrTable = [
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: a, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 3, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 1, imm: b, mem: 0, flags: 0 },
      { op: OP.CMP, src: 1, dst: 1, imm: 0, mem: 0, flags: 0 },
      { op: OP.DIV, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 0, dst: 2, imm: 0, mem: 0, flags: 2 },
      { op: OP.MOV_MEM_WRITE, src: 0, dst: 0xFF, imm: 0x1000, mem: 1, flags: 0 },
      { op: OP.MOV_MEM_READ, src: 0xFE, dst: 3, imm: 0x1000, mem: 2, flags: 0 },
      { op: OP.CMP, src: 3, dst: 1, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: 0, mem: 0, flags: 0 },
    ];
  }

  loadAndSequence(a, b) {
    this.instrTable = [
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: a, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 1, imm: b, mem: 0, flags: 0 },
      { op: OP.AND, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 0, dst: 2, imm: 0, mem: 0, flags: 2 },
      { op: OP.OR, src: 1, dst: 2, imm: 0, mem: 0, flags: 0 },
      { op: OP.XOR, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.NOT, src: 0, dst: 1, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_MEM_WRITE, src: 0, dst: 0xFF, imm: 0x1000, mem: 1, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: 0, mem: 0, flags: 0 },
    ];
  }

  loadOrSequence(a, b) {
    this.instrTable = [
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: a, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 1, imm: b, mem: 0, flags: 0 },
      { op: OP.OR, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 0, dst: 2, imm: 0, mem: 0, flags: 2 },
      { op: OP.AND, src: 1, dst: 2, imm: 0, mem: 0, flags: 0 },
      { op: OP.XOR, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.NOT, src: 0, dst: 1, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_MEM_WRITE, src: 0, dst: 0xFF, imm: 0x1000, mem: 1, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: 0, mem: 0, flags: 0 },
    ];
  }

  loadXorSequence(a, b) {
    this.instrTable = [
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: a, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 1, imm: b, mem: 0, flags: 0 },
      { op: OP.XOR, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 0, dst: 2, imm: 0, mem: 0, flags: 2 },
      { op: OP.AND, src: 1, dst: 2, imm: 0, mem: 0, flags: 0 },
      { op: OP.OR, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.NOT, src: 0, dst: 1, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_MEM_WRITE, src: 0, dst: 0xFF, imm: 0x1000, mem: 1, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: 0, mem: 0, flags: 0 },
    ];
  }

  loadNotSequence(a, b) {
    this.instrTable = [
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: a, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 1, imm: b, mem: 0, flags: 0 },
      { op: OP.NOT, src: 0, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 0, dst: 2, imm: 0, mem: 0, flags: 2 },
      { op: OP.NOT, src: 0, dst: 1, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_MEM_WRITE, src: 1, dst: 0xFF, imm: 0x1000, mem: 1, flags: 0 },
      { op: OP.MOV_MEM_READ, src: 0xFE, dst: 3, imm: 0x1000, mem: 2, flags: 0 },
      { op: OP.CMP, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: 0, mem: 0, flags: 0 },
    ];
  }

  loadShlSequence(a, b) {
    this.instrTable = [
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: a, mem: 0, flags: 0 },
      { op: OP.SHL, src: 0, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 0, dst: 1, imm: 0, mem: 0, flags: 2 },
      { op: OP.SHL, src: 0, dst: 1, imm: 0, mem: 0, flags: 0 },
      { op: OP.SHR, src: 0, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_MEM_WRITE, src: 0, dst: 0xFF, imm: 0x1000, mem: 1, flags: 0 },
      { op: OP.MOV_MEM_READ, src: 0xFE, dst: 2, imm: 0x1000, mem: 2, flags: 0 },
      { op: OP.CMP, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: 0, mem: 0, flags: 0 },
    ];
  }

  loadShrSequence(a, b) {
    this.instrTable = [
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: a, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 1, imm: b, mem: 0, flags: 0 },
      { op: OP.SHR, src: 0, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 0, dst: 2, imm: 0, mem: 0, flags: 2 },
      { op: OP.SHR, src: 0, dst: 2, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_MEM_WRITE, src: 0, dst: 0xFF, imm: 0x1000, mem: 1, flags: 0 },
      { op: OP.MOV_MEM_READ, src: 0xFE, dst: 3, imm: 0x1000, mem: 2, flags: 0 },
      { op: OP.CMP, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: 0, mem: 0, flags: 0 },
    ];
  }

  loadFullSequence(a, b) {
    this.instrTable = [
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: a, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 1, imm: b, mem: 0, flags: 0 },
      { op: OP.ADD, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 0, dst: 2, imm: 0, mem: 0, flags: 2 },
      { op: OP.SUB, src: 1, dst: 2, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 2, dst: 4, imm: 0, mem: 0, flags: 2 },
      { op: OP.MUL, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_MEM_WRITE, src: 0, dst: 0xFF, imm: 0x1000, mem: 1, flags: 0 },
      { op: OP.DIV, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_REG, src: 0, dst: 3, imm: 0, mem: 0, flags: 2 },
      { op: OP.AND, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.OR, src: 4, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.XOR, src: 2, dst: 1, imm: 0, mem: 0, flags: 0 },
      { op: OP.SHL, src: 0, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.CMP, src: 1, dst: 0, imm: 0, mem: 0, flags: 0 },
      { op: OP.MOV_REG_IMM, src: 0xFF, dst: 0, imm: 0, mem: 0, flags: 0 },
    ];
  }

  // ── Mnemonic Builder ─────────────────────────────────────────────

  buildMnemonic(inst) {
    const srcName = inst.src === 0xFF ? 'IMM' : (inst.src === 0xFE ? '[MEM]' : REG_NAMES[inst.src] || '?');
    const dstName = inst.dst === 0xFF ? '[MEM]' : REG_NAMES[inst.dst] || '?';
    const ops = {
      0: `MOV ${dstName}, ${inst.imm.toString(16).padStart(4, '0')}h`,
      1: `MOV ${dstName}, ${srcName}`,
      2: `MOV [${inst.imm.toString(16)}h], ${srcName}`,
      3: `MOV ${dstName}, [${inst.imm.toString(16)}h]`,
      4: `ADD ${dstName}, ${srcName}`,
      5: `SUB ${dstName}, ${srcName}`,
      6: `MUL ${srcName}`,
      7: `DIV ${srcName}`,
      8: `CMP ${dstName}, ${srcName}`,
      9: `AND ${dstName}, ${srcName}`,
      10: `OR ${dstName}, ${srcName}`,
      11: `XOR ${dstName}, ${srcName}`,
      12: `NOT ${dstName}`,
      13: `SHL ${dstName}, 1`,
      14: `SHR ${dstName}, 1`,
    };
    return ops[inst.op] || `NOP`;
  }

  // ── Pipeline Core ────────────────────────────────────────────────

  advancePipeline() {
    if (this.simComplete) return null;

    this.clockCycle++;
    this.changedRegisters = [];
    this.conceptTags = [];
    this.alu.active = false;
    this.hazard.detected = false;
    this.stalls_this_cyc = 0;

    // Process stages from WB→IF (backward to prevent double-advance)
    // WB stage
    if (this.pipeline.WB !== null && this.pipeline.WB !== 'STALL') {
      this.executeWriteback(this.pipeline.WB);
      this.pipeline.WB = null;
      this.completedInstructions++;
    }

    // MEM → WB
    if (this.pipeline.MEM !== null && this.pipeline.MEM !== 'STALL') {
      this.pipeline.WB = this.pipeline.MEM;
      this.pipeline.MEM = null;
    }

    // EX → MEM (with multi-cycle support)
    if (this.pipeline.EX !== null && this.pipeline.EX !== 'STALL') {
      const exInst = this.instrTable[this.pipeline.EX];
      const exCycles = this.getEXCycles(exInst.op);
      const timer = this.stageTimer || 0;
      if (timer < exCycles - 1) {
        this.stageTimer = (this.stageTimer || 0) + 1;
      } else {
        this.executeALU(this.pipeline.EX);
        this.pipeline.MEM = this.pipeline.EX;
        this.pipeline.EX = null;
        this.stageTimer = 0;
      }
    } else if (this.pipeline.EX === 'STALL') {
      this.pipeline.EX = null;
    }

    // ID → EX (with hazard check)
    if (this.pipeline.ID !== null && this.pipeline.ID !== 'STALL') {
      const hazardFound = this.detectHazards(this.pipeline.ID);
      if (hazardFound) {
        // Check if forwarding resolves it
        if (this.forwardingEnabled && this.canForward(this.pipeline.ID)) {
          this.resolveForwarding(this.pipeline.ID);
          this.pipeline.EX = this.pipeline.ID;
          this.pipeline.ID = null;
          this.conceptTags.push('Data Forwarding');
        } else {
          this.pipeline.EX = 'STALL';
          this.pipeline.ID = 'STALL';  // ID stalls too
          this.hazard.detected = true;
          this.hazard.type = 'RAW';
          this.hazard.stallsInserted++;
          this.totalStalls++;
          this.stallCount++;
          this.stalls_this_cyc = 1;
          this.conceptTags.push('Data Hazard (RAW)');
          this.conceptTags.push('Pipeline Stall');
        }
      } else {
        this.executeDecode(this.pipeline.ID);
        this.pipeline.EX = this.pipeline.ID;
        this.pipeline.ID = null;
      }
    }

    // IF → ID
    if (this.pipeline.IF !== null && this.pipeline.IF !== 'STALL') {
      this.executeFetch(this.pipeline.IF);
      this.pipeline.ID = this.pipeline.IF;
      this.pipeline.IF = null;
    } else if (this.pipeline.IF === 'STALL') {
      this.pipeline.IF = null;
    }

    // Fetch new instruction into IF
    if (this.instrPtr < this.instrTable.length &&
        this.pipeline.IF === null &&
        this.pipeline.ID !== 'STALL') {
      this.pipeline.IF = this.instrPtr;
      // Build queue state
      this.instructionQueue = this.instrTable.map((inst, i) => ({
        index: i,
        mnemonic: this.buildMnemonic(inst),
        enteredPipeline: i < this.instrPtr
      }));
      this.executeFetch(this.instrPtr);
      this.instrPtr++;
    }

    // Build explanation
    this.buildExplanation();

    // Check completion
    if (this.instrPtr >= this.instrTable.length &&
        this.pipeline.IF === null &&
        this.pipeline.ID === null &&
        this.pipeline.EX === null &&
        this.pipeline.MEM === null &&
        this.pipeline.WB === null &&
        this.completedInstructions > 0) {
      this.simComplete = true;
    }

    // Store in history
    this.cycleHistory.push(this.serializeState());

    return this.serializeState();
  }

  getEXCycles(opcode) {
    if (opcode === OP.MUL) return 2;
    if (opcode === OP.DIV) return 3;
    return 1;
  }

  // ── Hazard Detection ─────────────────────────────────────────────

  detectHazards(idInstIdx) {
    const idInst = this.instrTable[idInstIdx];
    if (!idInst) return false;
    const idSrc = idInst.src;

    // Check EX stage
    if (this.pipeline.EX !== null && this.pipeline.EX !== 'STALL') {
      const exInst = this.instrTable[this.pipeline.EX];
      if (exInst && exInst.dst !== 0xFF && exInst.dst === idSrc && idSrc !== 0xFF && idSrc !== 0xFE) {
        this.hazard.reg = REG_NAMES[idSrc] || '?';
        this.hazardCount++;
        return true;
      }
    }

    // Check MEM stage  
    if (this.pipeline.MEM !== null && this.pipeline.MEM !== 'STALL') {
      const memInst = this.instrTable[this.pipeline.MEM];
      if (memInst && memInst.dst !== 0xFF && memInst.dst === idSrc && idSrc !== 0xFF && idSrc !== 0xFE) {
        this.hazard.reg = REG_NAMES[idSrc] || '?';
        this.hazardCount++;
        return true;
      }
    }

    return false;
  }

  // ── Forwarding (for bonus/advanced feature) ──────────────────────

  canForward(idInstIdx) {
    const idInst = this.instrTable[idInstIdx];
    if (!idInst) return false;
    const idSrc = idInst.src;
    if (idSrc === 0xFF || idSrc === 0xFE) return false;

    // Can forward from EX (result already computed)
    if (this.pipeline.EX !== null && this.pipeline.EX !== 'STALL') {
      const exInst = this.instrTable[this.pipeline.EX];
      if (exInst && exInst.dst === idSrc) return true;
    }
    return false;
  }

  resolveForwarding(idInstIdx) {
    const idInst = this.instrTable[idInstIdx];
    const exInst = this.instrTable[this.pipeline.EX];
    if (!idInst || !exInst) return;

    const fwdReg = REG_NAMES[idInst.src];
    this.explanation = `FORWARDING: ${fwdReg} value forwarded from EX directly to next instruction. No stall needed.`;
  }

  // ── Stage Executors ──────────────────────────────────────────────

  executeFetch(instrIdx) {
    const inst = this.instrTable[instrIdx];
    if (!inst) return;
    this.conceptTags.push('Instruction Fetch');
    this.explanation = `IF: Fetching "${this.buildMnemonic(inst)}" from code segment. PC incremented.`;
  }

  executeDecode(instrIdx) {
    const inst = this.instrTable[instrIdx];
    if (!inst) return;
    this.conceptTags.push('Instruction Decode');

    // Read register values into ALU operands
    if (inst.src !== 0xFF && inst.src !== 0xFE) {
      this.alu.a = this.getRegister(inst.src);
    } else {
      this.alu.a = inst.imm;
    }
    if (inst.dst !== 0xFF) {
      this.alu.b = this.getRegister(inst.dst);
    }

    this.alu.op = this.opcodeToName(inst.op);
    this.alu.active = false;

    // Set stage limits for multi-cycle ops
    this.stageTimer = 0;

    this.explanation = `ID: Decoding "${this.buildMnemonic(inst)}". Registers read from register file.`;
  }

  executeALU(instrIdx) {
    const inst = this.instrTable[instrIdx];
    if (!inst) return;
    this.conceptTags.push('ALU Operation');

    const a = inst.src === 0xFF ? inst.imm : this.getRegister(inst.src);
    const b = inst.dst === 0xFF ? 0 : this.getRegister(inst.dst);
    let result = 0;
    let high = 0;
    let carry = false;
    let overflow = false;

    this.alu.a = a;
    this.alu.b = b;
    this.alu.op = this.opcodeToName(inst.op);
    this.alu.active = true;
    this.alu.cycle = 1;
    this.alu.cyclesTotal = this.getEXCycles(inst.op);

    switch (inst.op) {
      case OP.MOV_REG_IMM:
      case OP.MOV_REG_REG:
        result = a;
        this.conceptTags.push('PROC/ENDP');
        break;

      case OP.ADD: {
        result = (b + a) & 0xFFFF;
        carry = (b + a) > 0xFFFF;
        const sA = (b << 16) >> 16;
        const sB = (a << 16) >> 16;
        const sR = (result << 16) >> 16;
        overflow = ((sA > 0 && sB > 0 && sR < 0) || (sA < 0 && sB < 0 && sR >= 0));
        this.conceptTags.push('Flags Register');
        break;
      }

      case OP.SUB:
      case OP.CMP: {
        result = (b - a) & 0xFFFF;
        carry = (b - a) < 0;
        const sSubA = (b << 16) >> 16;
        const sSubB = (a << 16) >> 16;
        const sSubR = (result << 16) >> 16;
        overflow = ((sSubA >= 0 && sSubB < 0 && sSubR < 0) || (sSubA < 0 && sSubB >= 0 && sSubR >= 0));
        this.conceptTags.push('Conditional Branch');
        this.conceptTags.push('Flags Register');
        if (inst.op === OP.CMP) {
          result = b;  // CMP doesn't change destination
        }
        break;
      }

      case OP.MUL: {
        const product = (b & 0xFFFF) * (a & 0xFFFF);
        result = product & 0xFFFF;
        high = (product >>> 16) & 0xFFFF;
        carry = high > 0;
        overflow = high > 0;
        this.alu.cyclesTotal = 2;
        this.conceptTags.push('MUL Instruction');
        break;
      }

      case OP.DIV: {
        if (a === 0) {
          this.error = 'DIVISION_BY_ZERO';
          return;
        }
        const quotient = Math.floor(b / a);
        const remainder = b % a;
        result = quotient & 0xFFFF;
        high = remainder & 0xFFFF;
        this.alu.cyclesTotal = 3;
        this.conceptTags.push('DIV Instruction');
        break;
      }

      case OP.AND: {
        result = b & a;
        carry = false; overflow = false;
        this.conceptTags.push('Flags Register');
        break;
      }
      case OP.OR: {
        result = b | a;
        carry = false; overflow = false;
        break;
      }
      case OP.XOR: {
        result = b ^ a;
        carry = false; overflow = false;
        break;
      }
      case OP.NOT: {
        result = (~b) & 0xFFFF;
        carry = false; overflow = false;
        break;
      }
      case OP.SHL: {
        result = (b << 1) & 0xFFFF;
        carry = (b & 0x8000) !== 0;
        overflow = false;
        break;
      }
      case OP.SHR: {
        result = b >>> 1;
        carry = (b & 0x0001) !== 0;
        overflow = false;
        break;
      }
    }

    this.alu.result = result;
    this.alu.high = high;

    // Update flags
    this.flags.ZF = result === 0 ? 1 : 0;
    this.flags.SF = (result & 0x8000) ? 1 : 0;
    this.flags.CF = carry ? 1 : 0;
    this.flags.OF = overflow ? 1 : 0;
    this.flags.PF = this.calcParity(result);
    this.flags.AF = 0;  // simplified

    // Update register for non-CMP instructions
    if (inst.op !== OP.CMP) {
      if (inst.dst !== 0xFF && inst.dst < 7) {
        this.setRegister(inst.dst, result);
      }
      if (inst.op === OP.MUL) {
        this.setRegister(3, high);  // DX = high word
      }
      if (inst.op === OP.DIV) {
        this.registers.AX = result;
        this.setRegister(3, high);  // DX = remainder
      }
    }

    this.explanation = `EX: ALU executing ${this.alu.op}. ${REG_NAMES[inst.dst] || '?'}=${b.toString(16)} ${this.opSymbol(inst.op)} ${a.toString(16)}h = ${result.toString(16)}h. Flags updated.`;
  }

  executeWriteback(instrIdx) {
    const inst = this.instrTable[instrIdx];
    if (!inst) return;
    this.conceptTags.push('Write-Back');

    // Track changes
    if (inst.dst < 7) {
      const regName = REG_NAMES[inst.dst];
      if (this.registers[regName] !== this.prevRegisters[regName]) {
        this.changedRegisters.push(regName);
      }
    }

    // Update previous snapshot
    this.prevRegisters = { ...this.registers };

    this.explanation = `WB: "${this.buildMnemonic(inst)}" complete. Result committed to register file.`;
  }

  // ── Register Helpers ─────────────────────────────────────────────

  getRegister(code) {
    if (code < 7) return this.registers[REG_NAMES[code]] || 0;
    return 0;
  }

  setRegister(code, value) {
    if (code < 7) {
      this.registers[REG_NAMES[code]] = value & 0xFFFF;
    }
  }

  calcParity(val) {
    let bits = 0;
    for (let i = 0; i < 8; i++) {
      if (val & (1 << i)) bits++;
    }
    return (bits % 2) === 0 ? 1 : 0;
  }

  opcodeToName(op) {
    const names = ['MOV', 'MOV', 'MOV', 'MOV', 'ADD', 'SUB', 'MUL', 'DIV', 'CMP',
                   'AND', 'OR', 'XOR', 'NOT', 'SHL', 'SHR', 'NOP'];
    return names[op] || '?';
  }

  opSymbol(op) {
    const symbols = ['', '', '', '', '+', '-', '×', '÷', '', '&', '|', '^', '~', '<<', '>>'];
    return symbols[op] || '?';
  }

  // ── Explanation Builder ──────────────────────────────────────────

  buildExplanation() {
    if (this.error) {
      this.explanation = `ERROR: ${this.error}`;
      return;
    }
    if (this.hazard.detected) {
      this.explanation = `HAZARD: RAW dependency on ${this.hazard.reg}. ` +
        `Instruction reads ${this.hazard.reg} before write-back. 1 stall cycle inserted.`;
    }
  }

  // ── JSON Serialization ───────────────────────────────────────────

  serializeState() {
    const p = this.pipeline;
    const pipelineState = {};
    STAGE_NAMES.forEach((name, i) => {
      const slot = p[name];
      if (slot === null) {
        pipelineState[name] = { instruction: null, mnemonic: null, empty: true, stall: false };
      } else if (slot === 'STALL') {
        pipelineState[name] = { instruction: null, mnemonic: null, empty: false, stall: true };
      } else {
        const inst = this.instrTable[slot];
        pipelineState[name] = {
          instruction: `I${slot}`,
          mnemonic: inst ? this.buildMnemonic(inst) : null,
          empty: false,
          stall: false,
          index: slot
        };
      }
    });

    const regs = {};
    REG_NAMES.forEach(r => { regs[r] = this.hex4(this.registers[r]); });

    const instrQueue = this.instructionQueue.map(q => ({
      ...q, enteredPipeline: q.index < this.instrPtr
    }));

    // Memory state
    const memoryState = this.memory.map((val, i) => ({
      addr: (0x1000 + i * 2).toString(16).padStart(4, '0'),
      value: this.hex4(val),
      justWritten: false,
      justRead: false
    }));

    return {
      type: 'STATE_UPDATE',
      cycle: this.clockCycle,
      pipeline: pipelineState,
      registers: regs,
      flags: { ...this.flags },
      alu: {
        op: this.alu.op,
        a: this.hex4(this.alu.a),
        b: this.hex4(this.alu.b),
        result: this.hex4(this.alu.result),
        active: this.alu.active,
        multicycle: this.alu.cyclesTotal > 1,
        cycle: this.alu.cycle || 1,
        cyclesTotal: this.alu.cyclesTotal || 1,
        high: this.hex4(this.alu.high || 0),
      },
      hazard: {
        detected: this.hazard.detected,
        type: this.hazard.type,
        reg: this.hazard.reg,
        stallsInserted: this.stalls_this_cyc || 0,
        totalStalls: this.totalStalls,
      },
      memory: memoryState,
      instruction_queue: instrQueue,
      status: this.simComplete ? 'complete' : (this.runMode === 'auto' ? 'running' : 'idle'),
      operation_mode: this.operationMode,
      step_explanation: this.explanation || '',
      assembly_concepts: [...new Set(this.conceptTags)],
      changed_registers: this.changedRegisters,
      total_instructions: this.totalInstructions,
      completed_instructions: this.completedInstructions,
      timestamp: Date.now(),
    };
  }

  hex4(v) {
    return ((v || 0) & 0xFFFF).toString(16).padStart(4, '0').toUpperCase();
  }
}

module.exports = PipelineSimulator;
