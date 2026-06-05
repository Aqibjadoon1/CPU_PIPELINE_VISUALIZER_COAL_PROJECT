#!/usr/bin/env node

/**
 * MOCK EMULATOR — bridge/mock_emu.js
 * =========================================
 * Faithfully simulates the protocol output of pipeline_visualizer.ASM
 * for development without a real EMU8086 install.
 *
 * Protocol lines emitted to stdout (each terminated by \r\n):
 *   READY:mode=DEMO
 *   READY:mode=ADD,a=0005h,b=0003h
 *   CYCLE:XXXXh:SLOTS:FF,...,FF:STALLS:0,...,0
 *   FETCH:instr_num:MOV AX,0005h
 *   DECODE:instr_num:src=--,dst=AX,imm=0005h
 *   EXECUTE:instr_num:op=ADD,result=0008h,flags=ZF:0,SF:0,CF:0,OF:0
 *   MEMORY:instr_num:type=WRITE,addr=1000h,val=0008h
 *   REGS:AX=0008h,BX=0003h,...,FLAGS=0046h
 *   HAZARD:DATA:instr_num:AX
 *   STALL:instr_num
 *   DONE:cycles=XXXXh
 *   ERROR:DIV_BY_ZERO
 *
 * Usage:
 *   node mock_emu.js                   (demo mode, 8 instructions)
 *   node mock_emu.js A 5 3            (ADD mode)
 *   node mock_emu.js S 10 4           (SUB mode)
 *   node mock_emu.js M 6 7            (MUL mode)
 *   node mock_emu.js D 20 4           (DIV mode)
 */

const MODE_DEMO = 0;
const MODE_ADD = 1;
const MODE_SUB = 2;
const MODE_MUL = 3;
const MODE_DIV = 4;

const MODE_MAP = { A: MODE_ADD, S: MODE_SUB, M: MODE_MUL, D: MODE_DIV };

const STAGE_FETCH = 0;
const STAGE_DECODE = 1;
const STAGE_EXECUTE = 2;
const STAGE_MEMORY = 3;
const STAGE_WB = 4;
const STAGE_EMPTY = 0xff;

const REGS = ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'SP', 'FLAGS'];

// ─── Instruction Database ──────────────────────────────────────────────────
const OPCODES = { MOV: 1, ADD: 2, SUB: 3, CMP: 4, MUL: 5, DIV: 6 };

const DEMO_INSTRUCTIONS = [
  { op: 'MOV', src: null, dst: 'AX', imm: 0x0005, mem: 0, mne: 'MOV AX,0005h' },
  { op: 'MOV', src: null, dst: 'BX', imm: 0x0003, mem: 0, mne: 'MOV BX,0003h' },
  { op: 'ADD', src: 'BX', dst: 'AX', imm: 0, mem: 0, mne: 'ADD AX,BX' },
  { op: 'SUB', src: 'AX', dst: 'CX', imm: 0, mem: 0, mne: 'SUB CX,AX' },
  { op: 'MOV', src: 'AX', dst: 'MEM', imm: 0x1000, mem: 1, mne: 'MOV [1000h],AX' },
  { op: 'MOV', src: null, dst: 'DX', imm: 0x1000, mem: 2, mne: 'MOV DX,[1000h]' },
  { op: 'CMP', src: 'BX', dst: 'AX', imm: 0, mem: 0, mne: 'CMP AX,BX' },
  { op: 'MOV', src: null, dst: 'AX', imm: 0x0000, mem: 0, mne: 'MOV AX,0000h' },
];

// ─── Pipeline State Machine ────────────────────────────────────────────────

class PipelineSim {
  constructor(mode = MODE_DEMO, a = 0, b = 0) {
    this.mode = mode;
    this.a = a;
    this.b = b;
    this.cycle = 0;
    this.instrPtr = 0;
    this.completed = 0;
    this.totalStalls = 0;
    this.totalHazards = 0;
    this.autoRun = false;
    this.done = false;

    // Build instruction table
    if (mode === MODE_DEMO) {
      this.instructions = DEMO_INSTRUCTIONS.map(i => ({ ...i }));
    } else {
      const opNames = { 1: 'ADD', 2: 'SUB', 3: 'MUL', 4: 'DIV' };
      const op = opNames[mode] || 'ADD';
      this.instructions = [
        { op: 'MOV', src: null, dst: 'AX', imm: a, mem: 0, mne: `MOV AX,${a.toString(16).padStart(4, '0')}h` },
        { op: 'MOV', src: null, dst: 'BX', imm: b, mem: 0, mne: `MOV BX,${b.toString(16).padStart(4, '0')}h` },
        { op, src: 'BX', dst: 'AX', imm: 0, mem: 0, mne: `${op} AX,BX` },
      ];
    }

    this.numInstr = this.instructions.length;

    // Pipeline slots: array of { instrIdx, stage } or null
    this.slots = new Array(12).fill(null);
    this.stalls = new Array(12).fill(0);
    this.regs = { AX: 0, BX: 0, CX: 0, DX: 0, SI: 0, DI: 0, SP: 0xFFEE, FLAGS: 0 };
    this.memSim = 0; // simulated memory at 0x1000
    this.flags = { ZF: 0, SF: 0, CF: 0, OF: 0 };
    this.resultVal = 0;
    this.resultHigh = 0;
    this.carryIn = false;
  }

  pad4(v) { return v.toString(16).padStart(4, '0').toUpperCase(); }
  pad2(v) { return v.toString(16).padStart(2, '0').toUpperCase(); }

  emit(line) { process.stdout.write(line + '\r\n'); }

  // Output protocol lines
  readyLine() {
    const modeNames = { 0: 'DEMO', 1: 'ADD', 2: 'SUB', 3: 'MUL', 4: 'DIV' };
    const modeStr = modeNames[this.mode] || 'DEMO';
    if (this.mode === MODE_DEMO) {
      this.emit(`READY:mode=DEMO`);
    } else {
      this.emit(`READY:mode=${modeStr},a=${this.pad4(this.a)}h,b=${this.pad4(this.b)}h`);
    }
  }

  fetchLine(instrIdx) {
    const mne = this.instructions[instrIdx]?.mne || 'NOP';
    this.emit(`FETCH:${this.pad2(instrIdx)}:${mne}`);
  }

  decodeLine(instrIdx) {
    const inst = this.instructions[instrIdx];
    if (!inst) return;
    const srcStr = inst.src || '--';
    const dstStr = inst.dst === 'MEM' ? 'MEM' : (inst.dst || '--');
    this.emit(`DECODE:${this.pad2(instrIdx)}:src=${srcStr},dst=${dstStr},imm=${this.pad4(inst.imm)}h`);
  }

  executeLine(instrIdx) {
    const inst = this.instructions[instrIdx];
    if (!inst) return;
    if (this.stalls[instrIdx]) {
      this.emit(`STALL:${this.pad2(instrIdx)}`);
      this.stalls[instrIdx] = 0;
      this.totalStalls++;
      return false;
    }
    // Simulate ALU
    let result = this.regs[inst.dst] || 0;
    const srcVal = inst.src ? (this.regs[inst.src] || 0) : inst.imm;
    this.flags = { ZF: 0, SF: 0, CF: 0, OF: 0 };
    let high = 0;
    let overflow = false;
    let carry = false;

    switch (inst.op) {
      case 'MOV':
        result = inst.imm || (inst.src ? srcVal : 0);
        break;
      case 'ADD':
        result = (this.regs[inst.dst] || 0) + srcVal;
        carry = result > 0xFFFF;
        result &= 0xFFFF;
        // Signed overflow
        const sA = (this.regs[inst.dst] || 0) << 16 >> 16;
        const sB = srcVal << 16 >> 16;
        const sR = result << 16 >> 16;
        overflow = ((sA > 0 && sB > 0 && sR < 0) || (sA < 0 && sB < 0 && sR >= 0));
        break;
      case 'SUB':
      case 'CMP':
        result = (this.regs[inst.dst] || 0) - srcVal;
        carry = result < 0;
        result = result & 0xFFFF;
        const sa = (this.regs[inst.dst] || 0) << 16 >> 16;
        const sb = srcVal << 16 >> 16;
        const sr = result << 16 >> 16;
        overflow = ((sa >= 0 && sb < 0 && sr < 0) || (sa < 0 && sb >= 0 && sr >= 0));
        if (inst.op === 'CMP') result = this.regs[inst.dst] || 0;
        break;
      case 'MUL':
        const mulResult = (this.regs[inst.dst] || 0) * srcVal;
        high = (mulResult >>> 16) & 0xFFFF;
        result = mulResult & 0xFFFF;
        carry = high > 0;
        overflow = high > 0;
        break;
      case 'DIV': {
        if (srcVal === 0) {
          this.emit('ERROR:DIV_BY_ZERO');
          return false;
        }
        const dividend = (this.regs[inst.dst] || 0);
        const quotient = Math.floor(dividend / srcVal);
        const remainder = dividend % srcVal;
        result = quotient & 0xFFFF;
        high = remainder & 0xFFFF;
        break;
      }
    }

    // Update flags
    if (result === 0) this.flags.ZF = 1;
    if (result & 0x8000) this.flags.SF = 1;
    if (carry) this.flags.CF = 1;
    if (overflow) this.flags.OF = 1;

    this.resultVal = result;
    this.resultHigh = high;

    this.emit(
      `EXECUTE:${this.pad2(instrIdx)}:op=${inst.op},result=${this.pad4(result)}h,` +
      `flags=ZF:${this.flags.ZF},SF:${this.flags.SF},CF:${this.flags.CF},OF:${this.flags.OF}`
    );

    // Update registers immediately (simplified simulation)
    if (inst.op !== 'CMP') {
      if (inst.dst && inst.dst !== 'MEM') {
        this.regs[inst.dst] = result;
      }
      if (inst.op === 'MUL') {
        this.regs.DX = high;
      }
      if (inst.op === 'DIV') {
        this.regs.AX = result;   // quotient
        this.regs.DX = high;      // remainder
      }
      // Build FLAGS register value
      let fl = 0;
      if (this.flags.CF) fl |= 0x0001;
      if (1) fl |= 0x0040; // PF (parity) — always set for simplicity
      if (this.flags.OF) fl |= 0x0800;
      if (this.flags.SF) fl |= 0x0080;
      if (this.flags.ZF) fl |= 0x0040;
      this.regs.FLAGS = fl;
    }
    return true;
  }

  memoryLine(instrIdx) {
    const inst = this.instructions[instrIdx];
    if (!inst) return;
    if (inst.mem === 1) {
      // Memory write: MOV [addr], reg
      const val = this.regs[inst.src] || 0;
      this.memSim = val;
      this.emit(`MEMORY:${this.pad2(instrIdx)}:type=WRITE,addr=${this.pad4(inst.imm)}h,val=${this.pad4(val)}h`);
    } else if (inst.mem === 2) {
      // Memory read: MOV reg, [addr]
      const val = this.memSim;
      if (inst.dst && inst.dst !== 'MEM') {
        this.regs[inst.dst] = val;
      }
      this.emit(`MEMORY:${this.pad2(instrIdx)}:type=READ,addr=${this.pad4(inst.imm)}h,val=${this.pad4(val)}h`);
    } else {
      this.emit(`MEMORY:${this.pad2(instrIdx)}:type=NONE`);
    }
  }

  regsLine() {
    const parts = REGS.map(r => `${r}=${this.pad4(this.regs[r])}h`);
    this.emit(`REGS:${parts.join(',')}`);
  }

  cycleLine() {
    const stageStrs = this.slots.map(s => s === null ? 'FF' : this.pad2(s.stage));
    const stallStrs = this.stalls.map(s => s ? '1' : '0');
    this.emit(`CYCLE:${this.pad4(this.cycle)}:SLOTS:${stageStrs.join(',')}:STALLS:${stallStrs.join(',')}`);
  }

  hazardLine(instrIdx, reg) {
    this.emit(`HAZARD:DATA:${this.pad2(instrIdx)}:${reg}`);
  }

  doneLine() {
    this.emit(`DONE:cycles=${this.pad4(this.cycle)}`);
  }

  // ─── Pipeline Advance ────────────────────────────────────────────────────

  advance() {
    if (this.done) return;

    this.cycle++;

    // Process slots from high to low
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const slot = this.slots[i];
      if (slot === null) continue;
      if (this.stalls[i]) {
        this.stalls[i] = 0;
        continue;
      }

      switch (slot.stage) {
        case STAGE_WB:
          // Writeback: output REGS, clear slot
          this.regsLine();
          this.slots[i] = null;
          this.completed++;
          this.stalls[i] = 0;
          break;

        case STAGE_MEMORY:
          // Memory → Writeback
          slot.stage = STAGE_WB;
          break;

        case STAGE_EXECUTE:
          // Execute → Memory
          this.memoryLine(i);
          slot.stage = STAGE_MEMORY;
          break;

        case STAGE_DECODE:
          // Decode → Execute (with hazard check)
          // Demo hazard: I3 (idx 2) ADD AX,BX writes AX; I4 (idx 3) SUB CX,AX reads AX
          if (i === 3) {
            const i3Slot = this.slots[2];
            if (i3Slot && (i3Slot.stage === STAGE_EXECUTE || i3Slot.stage === STAGE_MEMORY)) {
              // Hazard!
              this.hazardLine(3, 'AX');
              this.stalls[3] = 1;
              this.emit(`STALL:${this.pad2(3)}`);
              this.totalStalls++;
              this.totalHazards++;
              continue; // Don't advance this cycle
            }
          }
          const executed = this.executeLine(i);
          if (executed) {
            slot.stage = STAGE_EXECUTE;
          }
          break;

        case STAGE_FETCH:
          // Fetch → Decode
          this.decodeLine(i);
          slot.stage = STAGE_DECODE;
          break;
      }
    }

    // Fetch new instruction into first empty slot
    if (this.instrPtr < this.numInstr) {
      const emptyIdx = this.slots.indexOf(null);
      if (emptyIdx !== -1) {
        this.slots[emptyIdx] = { instrIdx: this.instrPtr, stage: STAGE_FETCH };
        this.fetchLine(this.instrPtr);
        this.instrPtr++;
      }
    }

    // Output CYCLE summary
    this.cycleLine();

    // Check done
    const allFetched = this.instrPtr >= this.numInstr;
    const allComplete = this.slots.every(s => s === null);
    if (allFetched && allComplete && this.completed > 0) {
      this.done = true;
      this.doneLine();
    }
  }

  step() {
    this.advance();
    return !this.done;
  }

  runAll() {
    while (!this.done) {
      this.advance();
    }
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  let mode = MODE_DEMO;
  let a = 0, b = 0;

  if (args.length > 0) {
    const modeChar = args[0].toUpperCase();
    mode = MODE_MAP[modeChar] || MODE_DEMO;
    a = parseInt(args[1], 10) || 0;
    b = parseInt(args[2], 10) || 0;
    if (mode === MODE_DIV && b === 0) {
      console.error('ERROR:DIV_BY_ZERO (divisor cannot be 0)');
      process.exit(1);
    }
  }

  const interactive = args.includes('-i') || args.includes('--interactive');
  const sim = new PipelineSim(mode, a, b);
  sim.readyLine();

  // Interactive mode: step on each line of stdin (used by bridge server)
  // Non-interactive: run all cycles immediately and exit
  if (interactive || !process.stdin.isTTY) {
    sim.advance();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', () => {
      if (!sim.done) sim.advance();
    });
    process.stdin.on('end', () => {
      if (!sim.done) sim.runAll();
    });
  } else {
    // Terminal TTY mode — step on newline
    sim.advance();
    process.stdin.on('data', () => {
      if (!sim.done) sim.advance();
    });
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = PipelineSim;
}
