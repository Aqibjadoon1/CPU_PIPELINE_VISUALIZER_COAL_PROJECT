# 8086 CPU Instruction Pipeline Visualizer

## Detailed Project Report

**Course:** Computer Organization and Assembly Language (COAL)  
**Semester:** Spring 2026  
**Project Title:** 8086 CPU Instruction Pipeline Visualizer  
**Team Members:** Siddique Akbar (241826), Aqib Jadoon (241916), Taha Yasin (241874)  

---

## Abstract

The 8086 CPU Instruction Pipeline Visualizer is an educational project designed to explain how instructions move through a processor pipeline. In computer organization, pipelining is one of the most important performance-improving techniques, but it is often difficult for students to understand because the internal movement of instructions inside a processor is invisible.

This project solves that problem by creating an interactive visual simulator. It shows instructions moving through the five classic pipeline stages: Instruction Fetch (IF), Instruction Decode (ID), Execute (EX), Memory Access (MEM), and Write Back (WB). The project also displays register values, ALU operations, processor flags, memory state, hazards, stalls, cycle count, CPI, and pipeline efficiency.

The project contains an 8086 assembly implementation that demonstrates low-level concepts such as registers, memory addressing, interrupts, procedures, macros, arithmetic instructions, flags, and command-line parsing. For the web interface, a JavaScript simulator mirrors the same pipeline behavior and communicates with a React UI through a Node.js WebSocket bridge.

The final result is a complete learning tool for understanding CPU pipelining, instruction execution, data hazards, stalls, ALU behavior, and the relationship between low-level assembly concepts and a modern visual interface.

---

## Table of Contents

1. Introduction
2. Problem Statement
3. Project Objectives
4. Scope of the Project
5. Background Theory
6. System Architecture
7. Technology Stack
8. File and Folder Structure
9. Assembly Layer
10. JavaScript Simulation Engine
11. Bridge Server
12. React User Interface
13. Data Flow
14. Core Algorithms
15. Supported Operations
16. Data Structures
17. Testing and Verification
18. Results and Output
19. Limitations
20. Future Enhancements
21. Conclusion

---

## 1. Introduction

A computer processor executes instructions one by one. Each instruction usually goes through several steps before it is completed. For example, the processor must fetch the instruction from memory, understand what the instruction means, perform the required operation, access memory if needed, and finally store the result.

In a non-pipelined processor, one instruction completes all of these steps before the next instruction begins. This is simple, but slow. Pipelining improves performance by dividing instruction execution into stages and allowing multiple instructions to be processed at the same time. This is similar to an assembly line in a factory.

The purpose of this project is to make this concept visible. Instead of only reading theory, the user can see instructions moving from one stage to another cycle by cycle. The user can also observe what happens inside registers, the ALU, memory, and the pipeline control unit.

The project combines concepts from:

- 8086 assembly language
- CPU pipeline design
- Register and memory simulation
- Arithmetic and logical instruction execution
- Data hazard detection
- Pipeline stalls
- WebSocket communication
- React-based visualization

---

## 2. Problem Statement

Students often face difficulty understanding CPU pipelining because it is an internal hardware process. Textbook diagrams usually show static pipeline tables, but they do not clearly show how instructions move cycle by cycle or how hazards affect performance.

The main problems addressed by this project are:

- Pipeline stages are hard to visualize.
- Register updates are not visible during execution.
- Data hazards are difficult to understand from theory alone.
- Students often confuse execution, memory access, and write-back.
- The effect of stalls on CPI and efficiency is not easy to observe.
- Assembly language operations such as `MUL`, `DIV`, `CMP`, and flags are abstract for beginners.

This project provides an interactive visual solution where all of these concepts can be observed directly.

---

## 3. Project Objectives

The main objectives of the project are:

1. To simulate a five-stage instruction pipeline.
2. To demonstrate how instructions move through IF, ID, EX, MEM, and WB stages.
3. To show register values changing during execution.
4. To display ALU operations and results.
5. To demonstrate important 8086 assembly instructions.
6. To detect and display Read After Write (RAW) data hazards.
7. To show pipeline stalls caused by hazards.
8. To calculate performance metrics such as cycle count, CPI, and efficiency.
9. To provide a modern browser-based interface for better understanding.
10. To connect low-level CPU concepts with a high-level visual system.

---

## 4. Scope of the Project

The project focuses on educational visualization rather than building a full real processor emulator.

### Included in Scope

- Five-stage pipeline visualization
- Instruction fetch, decode, execute, memory, and write-back stages
- Register simulation for AX, BX, CX, DX, SI, DI, and SP
- Flag simulation for ZF, SF, CF, OF, PF, and AF
- ALU operation visualization
- Memory grid visualization
- Hazard detection
- Stall insertion
- Cycle-by-cycle stepping
- Auto-run mode
- Operation selection from the UI
- Export of simulation state
- Assembly reference implementation
- JavaScript simulator for the web interface

### Not Included in Scope

- Full x86/8086 instruction set emulation
- Real-time execution of compiled `.COM` files inside the browser
- Complete operating system or BIOS emulation
- Advanced branch prediction
- Cache simulation
- Out-of-order execution
- Superscalar execution

---

## 5. Background Theory

### 5.1 CPU Pipeline

A CPU pipeline divides instruction execution into smaller stages. Each stage performs one part of the instruction execution process.

The project uses the classic five-stage model:

| Stage | Full Name | Purpose |
|---|---|---|
| IF | Instruction Fetch | Fetches the instruction from memory |
| ID | Instruction Decode | Decodes instruction and reads registers |
| EX | Execute | Performs ALU operation |
| MEM | Memory Access | Reads or writes memory if required |
| WB | Write Back | Stores final result in register |

### 5.2 Why Pipelining Is Useful

Without pipelining, if one instruction takes five stages, the next instruction must wait until all five stages are complete.

With pipelining, multiple instructions are active at the same time. One instruction can be in fetch while another is in decode and another is in execute.

This improves throughput. Ideally, after the pipeline is full, one instruction completes every clock cycle.

### 5.3 Pipeline Hazards

A hazard is a situation that prevents the next instruction from executing normally.

Common hazard types:

- Data hazard
- Control hazard
- Structural hazard

This project focuses mainly on data hazards, especially RAW hazards.

### 5.4 RAW Data Hazard

RAW stands for Read After Write.

It occurs when an instruction needs to read a register before a previous instruction has written the correct value.

Example:

```asm
ADD AX, BX
SUB CX, AX
```

The first instruction writes to `AX`. The second instruction reads `AX`. If the second instruction reads `AX` before the first instruction has completed write-back, it may read an old value. This is a RAW hazard.

### 5.5 Pipeline Stall

A stall is a delay inserted into the pipeline to handle a hazard. During a stall, an instruction waits for one or more cycles until the required data becomes available.

In the visualizer, stalls are highlighted so the user can see how hazards reduce performance.

### 5.6 8086 Registers

The project displays these 8086-style registers:

| Register | Meaning |
|---|---|
| AX | Accumulator register, commonly used for arithmetic |
| BX | Base register |
| CX | Count register |
| DX | Data register, also used as high word in multiplication/division |
| SI | Source index |
| DI | Destination index |
| SP | Stack pointer |

### 5.7 Flags

Flags describe the result of an operation.

| Flag | Full Name | Meaning |
|---|---|---|
| ZF | Zero Flag | Set if result is zero |
| SF | Sign Flag | Set if result has sign bit 1 |
| CF | Carry Flag | Set on unsigned carry or borrow |
| OF | Overflow Flag | Set on signed overflow |
| PF | Parity Flag | Set if low byte has even parity |
| AF | Auxiliary Carry Flag | Used in BCD-related arithmetic |

---

## 6. System Architecture

The project has three major layers:

1. Assembly/reference layer
2. Bridge/simulation layer
3. Web UI layer

### 6.1 High-Level Architecture

```text
+-----------------------------+
|  React UI                   |
|  Vite + Tailwind + Motion   |
|  Browser                    |
+-------------+---------------+
              |
              | WebSocket JSON
              v
+-------------+---------------+
|  Node.js Bridge Server      |
|  HTTP server + WebSocket    |
|  bridge/server.js           |
+-------------+---------------+
              |
              | Direct function calls
              v
+-------------+---------------+
|  Pipeline Simulator         |
|  bridge/asm_simulator.js    |
+-----------------------------+

+-----------------------------+
|  Assembly Reference         |
|  pipeline_visualizer.ASM    |
|  EMU8086/MASM style logic   |
+-----------------------------+
```

### 6.2 Important Architecture Note

The older documentation describes a design where the assembly program or `mock_emu.js` outputs text protocol lines to stdout and the bridge parses those lines.

In the current runnable web application, `bridge/server.js` directly imports `bridge/asm_simulator.js`. The simulator returns JSON state, and the bridge sends that state to the React UI using WebSocket.

Therefore, the current data flow is:

```text
React UI -> WebSocket command -> Node bridge -> JavaScript simulator -> JSON state -> React UI
```

The assembly file remains important because it demonstrates the low-level design, instruction format, pipeline logic, register handling, interrupts, procedures, and protocol output approach.

---

## 7. Technology Stack

### 7.1 Assembly Layer

- 8086 assembly language
- EMU8086/MASM/TASM style syntax
- `.COM` program structure
- DOS interrupts
- BIOS interrupts

### 7.2 Backend/Bridge Layer

- Node.js
- `ws` WebSocket library
- Built-in `http`, `fs`, and `path` modules

### 7.3 Frontend Layer

- React 18
- Vite
- Tailwind CSS
- Framer Motion
- HTML/CSS/JavaScript

### 7.4 Development Tools

- npm
- Vite build system
- Node runtime
- Browser-based testing

---

## 8. File and Folder Structure

```text
coal proj/
|-- pipeline_visualizer.ASM
|-- README.md
|-- VIVA_GUIDE.md
|-- VIVA_MASTERCLASS.md
|-- run.bat
|-- run.sh
|-- asm/
|   |-- macros.inc
|   |-- data_segment.inc
|-- bridge/
|   |-- server.js
|   |-- asm_simulator.js
|   |-- mock_emu.js
|   |-- package.json
|   |-- package-lock.json
|-- docs/
|   |-- project_report.md
|-- scripts/
|   |-- start.bat
|   |-- start.sh
|-- ui/
|   |-- index.html
|   |-- package.json
|   |-- vite.config.js
|   |-- tailwind.config.js
|   |-- postcss.config.js
|   |-- dist/
|   |-- src/
|       |-- main.jsx
|       |-- App.jsx
|       |-- hooks/
|       |   |-- useWebSocket.js
|       |   |-- usePipelineState.js
|       |-- styles/
|       |   |-- index.css
|       |-- components/
|           |-- SplashScreen.jsx
|           |-- OperationSelector.jsx
|           |-- ControlBar.jsx
|           |-- PipelineCanvas.jsx
|           |-- RegisterPanel.jsx
|           |-- AluDetailPanel.jsx
|           |-- HazardBanner.jsx
|           |-- StepExplainer.jsx
|           |-- InstructionQueue.jsx
|           |-- InstructionLog.jsx
|           |-- PipelineTimeline.jsx
|           |-- MemoryViewer.jsx
```

### 8.1 Root Files

`pipeline_visualizer.ASM` is the main assembly source file. It contains constants, data definitions, macros, procedures, command-line parsing, pipeline advancement, hazard handling, ALU operations, memory simulation, register output, and DOS exit logic.

`README.md` describes the project, architecture, running instructions, protocol format, and usage.

`VIVA_GUIDE.md` is a short viva preparation guide.

`VIVA_MASTERCLASS.md` is a detailed viva learning guide.

`run.bat` and `run.sh` are launcher scripts for Windows and Unix-like systems.

### 8.2 Assembly Folder

`asm/macros.inc` contains modular macro definitions such as `PUSH_ALL`, `POP_ALL`, `PRINT_STRING`, `GOTOXY`, and JSON append helpers.

`asm/data_segment.inc` contains an alternate modular data segment definition with instruction tables, pipeline slots, register snapshots, flags, ALU state, hazards, memory, and strings.

These include files are useful for understanding a modular design, but the current root `.ASM` file is self-contained and does not include them directly.

### 8.3 Bridge Folder

`bridge/server.js` is the active backend server.

It performs two jobs:

1. Serves the built UI from `ui/dist`.
2. Runs a WebSocket server for simulation commands and state updates.

`bridge/asm_simulator.js` is the active pipeline simulation engine used by the UI.

`bridge/mock_emu.js` is a mock command-line emulator that emits the older protocol-line format for testing and demonstration.

### 8.4 UI Folder

The `ui` folder contains the React frontend. It displays the pipeline, registers, ALU, memory, hazards, metrics, queue, timeline, and logs.

---

## 9. Assembly Layer

The assembly layer demonstrates how the same pipeline idea can be represented in low-level 8086 assembly style.

### 9.1 Program Format

The assembly file starts with:

```asm
ORG 100h
JMP START
```

`ORG 100h` is used because DOS `.COM` programs are loaded at offset `100h`. The first 256 bytes are reserved for the Program Segment Prefix (PSP).

`JMP START` is required because the file defines data before code. Without this jump, the CPU would try to execute data bytes as instructions.

### 9.2 Constants

The assembly file defines constants for:

- Pipeline stages
- Opcodes
- Operation modes
- Empty register markers
- Maximum instruction count

Examples:

```asm
STAGE_FETCH   EQU 0
STAGE_DECODE  EQU 1
STAGE_EXECUTE EQU 2
STAGE_MEMORY  EQU 3
STAGE_WB      EQU 4
STAGE_EMPTY   EQU 0FFh
```

These constants make the program readable and remove magic numbers.

### 9.3 Instruction Table

The instruction table stores each simulated instruction as a record.

Each record contains:

| Byte | Meaning |
|---|---|
| 0 | Opcode |
| 1 | Source register |
| 2 | Destination register |
| 3 | Immediate low byte |
| 4 | Immediate high byte |
| 5 | Memory flag |

Example demo instructions:

```asm
MOV AX, 0005h
MOV BX, 0003h
ADD AX, BX
SUB CX, AX
MOV [1000h], AX
MOV DX, [1000h]
CMP AX, BX
MOV AX, 0000h
```

This table is like a small program stored in memory for the simulator to execute.

### 9.4 Pipeline State

The assembly file uses `PIPELINE_STATE` to store the current stage of each instruction slot.

```asm
PIPELINE_STATE:
  DB 12 DUP(STAGE_EMPTY)
```

Each byte stores one of:

- `0` for Fetch
- `1` for Decode
- `2` for Execute
- `3` for Memory
- `4` for Write Back
- `FFh` for empty

### 9.5 Register Snapshot

The simulated registers are stored in memory:

```asm
REG_SNAPSHOT:
  DW 8 DUP(0)
```

The order is:

```text
AX, BX, CX, DX, SI, DI, SP, FLAGS
```

The simulator updates this array instead of using the real CPU registers as the final program state. This is important because the real 8086 registers are needed by the simulator itself for calculations and printing.

### 9.6 Macros

The assembly file uses macros to reduce repetition.

`PRINT_STRING`:

```asm
PRINT_STRING MACRO addr
    LEA DX, addr
    MOV AH, 09h
    INT 21h
ENDM
```

This prints a DOS `$`-terminated string.

`SAVE_REGS` and `RESTORE_REGS` push and pop registers so procedures do not accidentally destroy values needed by the caller.

### 9.7 Procedures

The assembly file is organized into procedures.

Important procedures include:

| Procedure | Purpose |
|---|---|
| `HEX_DISPLAY` | Converts AX into four hexadecimal digits |
| `APPEND_STRING` | Appends text to output buffer |
| `APPEND_WORD_HEX` | Appends a 16-bit hex value |
| `GET_INSTR_ADDR` | Finds an instruction record in the table |
| `FETCH_STAGE` | Outputs fetch information |
| `DECODE_STAGE` | Outputs decode information |
| `EXECUTE_STAGE` | Performs ALU operation |
| `MEMORY_STAGE` | Simulates memory read/write |
| `WRITEBACK_STAGE` | Commits result and prints registers |
| `SHOW_REGISTERS` | Prints all register values |
| `CHECK_KEYBOARD` | Handles keyboard controls |
| `ADVANCE_PIPELINE` | Moves instructions through the pipeline |
| `OPERATION_DISPATCHER` | Builds operation-mode instruction sequence |
| `PARSE_HEX_WORD` | Parses command-line hex operands |

### 9.8 Interrupts Used

The assembly uses:

| Interrupt | Purpose |
|---|---|
| `INT 21h AH=09h` | Print `$`-terminated string |
| `INT 21h AH=4Ch` | Exit to DOS |
| `INT 16h AH=01h` | Check keyboard without blocking |
| `INT 16h AH=00h` | Read keyboard key |
| `INT 10h` | Text-mode screen/video functions |

### 9.9 Assembly Pipeline Flow

The main flow is:

1. Initialize segment registers.
2. Initialize stack.
3. Clear pipeline state.
4. Clear stall flags.
5. Clear register snapshot.
6. Parse command-line mode and operands.
7. Print `READY` message.
8. If user selected ADD/SUB/MUL/DIV, build instruction table.
9. Repeatedly call `ADVANCE_PIPELINE`.
10. Print `DONE` message.
11. Exit to DOS.

### 9.10 Important Assembly Instructions

| Instruction | Meaning |
|---|---|
| `MOV` | Copy data |
| `ADD` | Add source to destination |
| `SUB` | Subtract source from destination |
| `MUL` | Unsigned multiplication |
| `DIV` | Unsigned division |
| `CMP` | Compare by subtracting without storing |
| `JMP` | Unconditional jump |
| `JE/JNE` | Conditional jump based on zero flag |
| `JB/JA` | Unsigned comparison jumps |
| `PUSH/POP` | Stack operations |
| `CALL/RET` | Procedure call and return |
| `LOOP` | Decrement CX and loop if CX not zero |
| `INT` | Call interrupt service |
| `SHL/SHR` | Bit shifting |
| `AND/OR/XOR` | Logical operations |

---

## 10. JavaScript Simulation Engine

The file `bridge/asm_simulator.js` is the active simulation engine used by the current web app.

### 10.1 Purpose

Its purpose is to simulate the pipeline in a form that the browser can easily use. Instead of printing text protocol lines, it creates structured JSON objects containing the complete state of the CPU pipeline.

### 10.2 Main Class

The simulator is implemented as:

```js
class PipelineSimulator {
  constructor() {
    this.reset();
  }
}
```

The `reset()` method initializes:

- Registers
- Previous registers
- Flags
- Pipeline stages
- Memory
- Instruction table
- Instruction pointer
- Cycle count
- Hazard counters
- ALU state
- Simulation status

### 10.3 Opcode Model

Operations are represented by numeric opcode constants:

```js
const OP = {
  MOV_REG_IMM: 0,
  MOV_REG_REG: 1,
  MOV_MEM_WRITE: 2,
  MOV_MEM_READ: 3,
  ADD: 4,
  SUB: 5,
  MUL: 6,
  DIV: 7,
  CMP: 8,
  AND: 9,
  OR: 10,
  XOR: 11,
  NOT: 12,
  SHL: 13,
  SHR: 14,
  NOP: 15
};
```

### 10.4 Pipeline Model

The JavaScript simulator stores pipeline stages as an object:

```js
this.pipeline = {
  IF: null,
  ID: null,
  EX: null,
  MEM: null,
  WB: null
};
```

Each stage can contain:

- `null` if empty
- instruction index if occupied
- `"STALL"` if a stall bubble is present

### 10.5 Instruction Format

Each instruction is an object:

```js
{
  op: OP.ADD,
  src: 1,
  dst: 0,
  imm: 0,
  mem: 0,
  flags: 0
}
```

Meaning:

- `op`: operation type
- `src`: source register code
- `dst`: destination register code
- `imm`: immediate value or memory address
- `mem`: memory flag
- `flags`: extra display/behavior info

### 10.6 Program Loading

The `loadProgram(mode, a, b)` method builds a different instruction sequence depending on the selected mode.

Supported modes include:

- ADD
- SUB
- MUL
- DIV
- AND
- OR
- XOR
- NOT
- SHL
- SHR
- FULL_DEMO

### 10.7 Pipeline Advancement

The most important method is:

```js
advancePipeline()
```

It advances the simulator by one clock cycle.

It performs these steps:

1. Increment cycle count.
2. Clear temporary state.
3. Process WB stage.
4. Move MEM to WB.
5. Process EX stage.
6. Check hazards in ID stage.
7. Move IF to ID.
8. Fetch new instruction.
9. Build explanation.
10. Check completion.
11. Save history.
12. Return serialized state.

### 10.8 Why It Processes Backward

The simulator processes stages from WB to IF. This is done to prevent one instruction from moving through multiple stages in the same cycle.

If stages were processed from IF to WB, an instruction could move from IF to ID, then immediately from ID to EX, then maybe to MEM in one cycle. That would be incorrect.

### 10.9 Hazard Detection

The method `detectHazards(idInstIdx)` checks whether the instruction in ID reads a register that an instruction in EX or MEM will write.

If a hazard is found:

- `hazard.detected` becomes `true`
- hazard type becomes `RAW`
- the hazard register is stored
- stall counters are incremented
- a stall bubble is inserted

### 10.10 ALU Execution

The method `executeALU(instrIdx)` performs the operation.

For ADD:

```js
result = (b + a) & 0xFFFF;
carry = (b + a) > 0xFFFF;
```

For SUB:

```js
result = (b - a) & 0xFFFF;
carry = (b - a) < 0;
```

For MUL:

```js
const product = (b & 0xFFFF) * (a & 0xFFFF);
result = product & 0xFFFF;
high = (product >>> 16) & 0xFFFF;
```

For DIV:

```js
quotient = Math.floor(b / a);
remainder = b % a;
```

### 10.11 Flags

After execution, the simulator updates:

- ZF
- SF
- CF
- OF
- PF
- AF

Example:

```js
this.flags.ZF = result === 0 ? 1 : 0;
this.flags.SF = (result & 0x8000) ? 1 : 0;
this.flags.CF = carry ? 1 : 0;
this.flags.OF = overflow ? 1 : 0;
```

### 10.12 JSON Serialization

The `serializeState()` method returns a complete state object:

```js
{
  type: "STATE_UPDATE",
  cycle: this.clockCycle,
  pipeline: pipelineState,
  registers: regs,
  flags: this.flags,
  alu: this.alu,
  hazard: this.hazard,
  memory: memoryState,
  instruction_queue: instrQueue,
  status: "...",
  operation_mode: this.operationMode,
  step_explanation: this.explanation,
  assembly_concepts: this.conceptTags
}
```

This state is sent to the React UI.

---

## 11. Bridge Server

The file `bridge/server.js` connects the simulator to the browser.

### 11.1 Responsibilities

The bridge server:

1. Serves static UI files.
2. Opens a WebSocket server.
3. Receives commands from the browser.
4. Calls methods on the simulator.
5. Broadcasts updated simulator state.

### 11.2 Ports

| Service | Port |
|---|---|
| HTTP UI server | 3000 |
| WebSocket server | 3001 |
| Vite dev server | 5173 |

### 11.3 Commands Received from UI

| Command | Meaning |
|---|---|
| `start` | Start simulation with selected mode and operands |
| `step` | Advance one cycle |
| `run` | Auto-run continuously |
| `pause` | Pause auto-run |
| `reset` | Reset simulation |
| `quit` | Stop server process |

### 11.4 Start Flow

When the user starts a simulation:

```js
sim = new PipelineSimulator();
sim.loadProgram(mode, a, b);
broadcast({ type: "sim_started", mode, a, b });
broadcast(sim.serializeState());
```

### 11.5 Step Flow

When the user clicks STEP:

```js
const state = sim.advancePipeline();
broadcast(state);
```

### 11.6 Run Flow

When the user clicks RUN, the bridge creates a timer:

```js
autoRunTimer = setInterval(() => {
  const state = sim.advancePipeline();
  broadcast(state);
}, 350);
```

This means the simulation advances automatically every 350 milliseconds.

---

## 12. React User Interface

The UI is located in `ui/src`.

### 12.1 Main Entry

`main.jsx` renders the React app:

```jsx
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 12.2 App Component

`App.jsx` is the main component. It:

- Shows splash screen
- Stores operand values
- Connects to WebSocket
- Handles keyboard shortcuts
- Sends commands to server
- Renders all visualization panels

### 12.3 WebSocket Hook

`useWebSocket.js` connects to:

```js
ws://localhost:3001
```

It:

- Opens the socket
- Tracks connection status
- Reconnects if disconnected
- Parses incoming JSON
- Sends outgoing JSON

### 12.4 Pipeline State Hook

`usePipelineState.js` uses a reducer to manage simulator state.

It stores:

- Current cycle
- Pipeline stage data
- Register values
- Flags
- ALU state
- Hazard state
- Memory
- Instruction queue
- Logs
- Timeline history
- Metrics

### 12.5 Major UI Components

| Component | Purpose |
|---|---|
| `SplashScreen` | Opening screen |
| `OperationSelector` | Operation buttons and operand inputs |
| `ControlBar` | Step, run, pause, reset, export |
| `PipelineCanvas` | Main pipeline visualization |
| `RegisterPanel` | Register values |
| `AluDetailPanel` | ALU inputs, result, flags |
| `HazardBanner` | RAW hazard warning |
| `StepExplainer` | Cycle explanation |
| `InstructionQueue` | Program instruction list |
| `InstructionLog` | Sidebar log |
| `PipelineTimeline` | Historical cycle chart |
| `MemoryViewer` | Memory grid |

---

## 13. Data Flow

### 13.1 Starting a Simulation

1. User selects operation, for example ADD.
2. User enters operands, for example AX = 5 and BX = 3.
3. User clicks ADD button.
4. `OperationSelector` calls `onStart`.
5. `App.jsx` sends:

```json
{
  "type": "start",
  "mode": "ADD",
  "a": 5,
  "b": 3
}
```

6. `server.js` receives the message.
7. Server creates a new simulator.
8. Simulator loads ADD instruction sequence.
9. Server broadcasts initial state.
10. UI reducer updates state.
11. Components re-render.

### 13.2 Stepping One Cycle

1. User clicks STEP.
2. UI sends:

```json
{ "type": "step" }
```

3. Server calls:

```js
sim.advancePipeline()
```

4. Simulator moves instructions by one cycle.
5. Server sends `STATE_UPDATE`.
6. UI updates pipeline display, registers, ALU, hazards, logs, and metrics.

### 13.3 Running Continuously

1. User clicks RUN.
2. UI sends:

```json
{ "type": "run" }
```

3. Server starts an interval.
4. Every 350 ms, one cycle is executed.
5. UI updates automatically.

### 13.4 Resetting

1. User clicks RESET.
2. UI sends:

```json
{ "type": "reset" }
```

3. Server clears simulator.
4. UI reducer resets state.

---

## 14. Core Algorithms

### 14.1 Instruction Fetch Algorithm

```text
if instruction pointer is less than instruction count:
    place instruction in IF stage
    mark instruction as entered pipeline
    increment instruction pointer
```

### 14.2 Pipeline Advance Algorithm

```text
increment clock cycle

process WB:
    complete instruction

process MEM:
    move instruction to WB

process EX:
    execute ALU if needed
    move instruction to MEM

process ID:
    check hazards
    if hazard:
        insert stall
    else:
        move instruction to EX

process IF:
    move instruction to ID

fetch new instruction into IF
serialize state
```

### 14.3 Hazard Detection Algorithm

```text
get source register of instruction in ID

if EX instruction writes same register:
    hazard found

if MEM instruction writes same register:
    hazard found

if hazard found:
    insert stall
else:
    continue normally
```

### 14.4 ALU Algorithm

```text
read source operand
read destination operand

switch operation:
    ADD: result = destination + source
    SUB: result = destination - source
    MUL: result = destination * source
    DIV: result = destination / source
    AND: result = destination & source
    OR:  result = destination | source
    XOR: result = destination ^ source
    NOT: result = ~destination
    SHL: result = destination << 1
    SHR: result = destination >> 1

update flags
update destination register
```

### 14.5 CPI Calculation

CPI means Cycles Per Instruction.

```text
CPI = total cycles / completed instructions
```

A lower CPI means better performance.

### 14.6 Efficiency Calculation

Ideal pipeline cycles are estimated as:

```text
ideal cycles = number of instructions + 4
```

The `+4` is because a five-stage pipeline needs four extra cycles to fill and drain.

```text
efficiency = ideal cycles / actual cycles * 100
```

---

## 15. Supported Operations

The UI and JavaScript simulator support:

| Operation | Meaning |
|---|---|
| ADD | Addition |
| SUB | Subtraction |
| MUL | Unsigned multiplication |
| DIV | Unsigned division |
| AND | Bitwise AND |
| OR | Bitwise OR |
| XOR | Bitwise XOR |
| NOT | Bitwise NOT |
| SHL | Shift left |
| SHR | Shift right |
| FULL_DEMO | Demonstrates multiple operations together |

The assembly file primarily demonstrates:

- Demo sequence
- ADD
- SUB
- MUL
- DIV

### 15.1 ADD Example

If AX = 5 and BX = 3:

```text
AX = AX + BX
AX = 5 + 3
AX = 8
```

### 15.2 SUB Example

If AX = 5 and BX = 3:

```text
AX = AX - BX
AX = 5 - 3
AX = 2
```

### 15.3 MUL Example

If AX = 6 and BX = 7:

```text
DX:AX = AX * BX
DX:AX = 42
AX = 002Ah
DX = 0000h
```

### 15.4 DIV Example

If AX = 20 and BX = 4:

```text
AX = quotient = 5
DX = remainder = 0
```

### 15.5 Division by Zero

Division by zero is invalid. The simulator checks the divisor before division. If divisor is zero, it sets an error state.

---

## 16. Data Structures

### 16.1 Assembly Data Structures

| Data Structure | Purpose |
|---|---|
| `INSTR_TABLE` | Stores instruction records |
| `PIPELINE_STATE` | Stores current stage of each instruction |
| `STALL_FLAGS` | Marks stalled instructions |
| `REG_SNAPSHOT` | Stores simulated register values |
| `OUTPUT_BUF` | Builds output strings |
| `HEX_BUF` | Stores converted hex text |
| `MEMORY_SIM` | Simulates memory location `1000h` |
| `OPERAND_A` | First user operand |
| `OPERAND_B` | Second user operand |
| `RESULT_VAL` | Low-word ALU result |
| `RESULT_HIGH` | High-word ALU result |

### 16.2 JavaScript Data Structures

| Data Structure | Purpose |
|---|---|
| `registers` | Stores register values |
| `flags` | Stores CPU flags |
| `pipeline` | Stores IF/ID/EX/MEM/WB stage state |
| `instrTable` | Stores instruction sequence |
| `instructionQueue` | Stores display queue |
| `alu` | Stores ALU operation state |
| `hazard` | Stores hazard information |
| `memory` | Stores visual memory cells |
| `cycleHistory` | Stores timeline history |
| `conceptTags` | Stores educational concept labels |

### 16.3 React State

The UI reducer stores:

- `cycle`
- `pipeline`
- `registers`
- `flags`
- `alu`
- `hazard`
- `memory`
- `instructionQueue`
- `status`
- `operationMode`
- `explanation`
- `concepts`
- `changedRegisters`
- `metrics`
- `log`
- `history`

---

## 17. Testing and Verification

The project was verified using command-line and build tests.

### 17.1 Mock Emulator Test

Command:

```bash
node bridge/mock_emu.js A 5 3
```

This produced protocol output such as:

```text
READY:mode=ADD,a=0005h,b=0003h
FETCH:00:MOV AX,0005h
DECODE:00:src=--,dst=AX,imm=0005h
EXECUTE:02:op=ADD,result=0008h,flags=ZF:0,SF:0,CF:0,OF:0
DONE:cycles=0008
```

This confirms that the protocol-line emulator works.

### 17.2 JavaScript Simulator Test

The simulator was tested through all supported modes:

- ADD
- SUB
- MUL
- DIV
- AND
- OR
- XOR
- NOT
- SHL
- SHR
- FULL_DEMO

Each mode completed successfully.

### 17.3 UI Build Test

Command:

```bash
npm.cmd run build
```

Result:

```text
vite build completed successfully
443 modules transformed
dist files generated
```

Note: On Windows PowerShell, plain `npm run build` may be blocked by execution policy because `npm.ps1` cannot run. Using `npm.cmd run build` avoids this PowerShell policy issue.

---

## 18. Results and Output

The project successfully displays:

- Pipeline stages
- Instruction movement
- Current cycle
- Register values
- ALU inputs and result
- Flags
- Hazard alerts
- Stall indicators
- Instruction queue
- Memory grid
- Cycle timeline
- Instruction log
- CPI and efficiency metrics

### 18.1 Example ADD Result

For input:

```text
AX = 5
BX = 3
```

The ALU computes:

```text
5 + 3 = 8
```

The UI shows the result in hexadecimal:

```text
0008
```

### 18.2 Example Hazard Result

When an instruction reads a register before a previous instruction writes it, the UI displays a hazard banner and inserts a stall.

Example:

```asm
ADD AX, BX
SUB CX, AX
```

`SUB` needs the updated `AX`, but `ADD` has not completed write-back yet. The simulator detects this as a RAW hazard.

---

## 19. Limitations

Although the project is complete as an educational visualizer, it has some limitations:

1. The web UI currently uses `asm_simulator.js`, not direct execution of the `.ASM` file.
2. The assembly file supports fewer operation modes than the JavaScript simulator.
3. It does not emulate the complete 8086 instruction set.
4. Memory simulation is simplified.
5. Cache behavior is not included.
6. Branch hazards and branch prediction are not deeply implemented.
7. Structural hazards are not the main focus.
8. The forwarding checkbox exists in the UI, and forwarding-related methods exist in the simulator, but the current toggle is not fully wired from UI to simulator behavior.
9. The simulator is educational, not a cycle-perfect real 8086 hardware emulator.

---

## 20. Future Enhancements

Possible future improvements include:

1. Direct integration with compiled EMU8086 output.
2. Full protocol parser for real assembly stdout.
3. More complete 8086 instruction support.
4. Branch instruction simulation.
5. Control hazard visualization.
6. Structural hazard visualization.
7. Cache memory simulation.
8. Fully functional forwarding toggle.
9. User-defined instruction programs.
10. Export to PDF report.
11. More detailed binary-level ALU visualization.
12. Support for signed arithmetic modes.
13. Step backward/replay feature.
14. Better memory read/write highlighting.
15. Exam mode with built-in quizzes.

---

## 21. Conclusion

The 8086 CPU Instruction Pipeline Visualizer successfully demonstrates one of the most important concepts in computer organization: instruction pipelining. The project makes pipeline execution easy to understand by showing each instruction moving through fetch, decode, execute, memory, and write-back stages.

It also explains important assembly and processor concepts such as registers, memory, ALU operations, flags, hazards, stalls, and CPI. The combination of an assembly reference implementation, JavaScript simulation engine, Node.js bridge, and React UI creates a strong educational tool.

The project is especially useful for COAL students because it connects theory with visual execution. Instead of only memorizing pipeline diagrams, students can interact with the system, step through cycles, observe hazards, and understand how each instruction affects the CPU state.

Overall, the project meets its objective of making CPU pipeline behavior visible, interactive, and easier to understand.

---

## Appendix A: Viva Summary

A short explanation suitable for viva:

> Our project is an 8086 CPU instruction pipeline visualizer. It shows how instructions move through the five stages of a pipeline: fetch, decode, execute, memory, and write-back. The project demonstrates register updates, ALU operations, flags, hazards, stalls, CPI, and efficiency. The low-level assembly file shows how the pipeline can be modeled using 8086 concepts, while the current web version uses a JavaScript simulator connected to a React UI through a Node.js WebSocket bridge.

---

## Appendix B: How to Run

### Production-style run

```bash
cd scripts
start.bat
```

or on Unix:

```bash
cd scripts
./start.sh
```

### Manual run

Build UI:

```bash
cd ui
npm.cmd run build
```

Start bridge:

```bash
cd ../bridge
node server.js
```

Open:

```text
http://localhost:3000
```

### Development run

Terminal 1:

```bash
cd bridge
node server.js
```

Terminal 2:

```bash
cd ui
npm.cmd run dev
```

Open:

```text
http://localhost:5173
```

