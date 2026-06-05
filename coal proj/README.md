# PIPELINE — 8086 Instruction Pipeline Visualizer

**COAL Spring 2026** — Computer Organization & Assembly Language

**Team:** Siddique Akbar (241826), Aqib Jadoon (241916), Taha Yasin (241874)

---

## Architecture

```
┌─────────────────────┐     stdout     ┌──────────────┐     WebSocket     ┌──────────────┐
│ pipeline_visualizer │ ──────────────→│  Bridge       │ ────────────────→│  React UI     │
│ .ASM (or mock_emu)  │  protocol lines │  server.js    │   JSON messages  │  Vite + TW    │
└─────────────────────┘                └──────────────┘                   └──────────────┘
     EMU8086 / MASM                         Node.js                           Browser
```

Three independent layers communicate in one direction: Assembly → Bridge → UI

## Quick Start

### Windows

```batch
run.bat
```

### Linux / macOS

```bash
chmod +x run.sh
./run.sh
```

### Manual Start

**Terminal 1 — Bridge Server:**
```bash
cd bridge
npm install
npm start
```
Serves UI on http://localhost:3000, WebSocket on ws://localhost:3001

**Terminal 2 — React Dev Server (optional):**
```bash
cd ui
npm install
npm run dev
```
Dev server on http://localhost:5173 with hot reload

## Protocol Format

The assembly / mock emulator outputs structured lines to stdout:

| Prefix | Format | Description |
|--------|--------|-------------|
| `READY:` | `READY:mode=ADD,a=0005h,b=0003h` | Initial state |
| `CYCLE:` | `CYCLE:0001h:SLOTS:FF,FF,...:STALLS:0,0,...` | Pipeline snapshot |
| `FETCH:` | `FETCH:00:MOV AX,0005h` | Instruction fetch |
| `DECODE:` | `DECODE:00:src=--,dst=AX,imm=0005h` | Instruction decode |
| `EXECUTE:` | `EXECUTE:00:op=ADD,result=0008h,flags=ZF:0,SF:0,CF:0,OF:0` | ALU execution |
| `MEMORY:` | `MEMORY:00:type=WRITE,addr=1000h,val=0008h` | Memory access |
| `REGS:` | `REGS:AX=0008h,...` | Register snapshot |
| `HAZARD:` | `HAZARD:DATA:03:AX` | Data hazard detected |
| `STALL:` | `STALL:03` | Pipeline stall |
| `DONE:` | `DONE:cycles=000Dh` | Simulation complete |
| `ERROR:` | `ERROR:DIV_BY_ZERO` | Error condition |

## Usage

### Demo Mode
Shows 8 instructions flowing through all 5 pipeline stages with a data hazard on I4.

### Operation Modes
- **ADD A B** — Addition: loads A into AX, B into BX, adds them
- **SUB A B** — Subtraction: loads A into AX, B into BX, subtracts B from A
- **MUL A B** — Multiplication: AX × BX = DX:AX (32-bit result)
- **DIV A B** — Division: AX ÷ BX = quotient AX, remainder DX

### Keyboard Controls
| Key | Action |
|-----|--------|
| Space | Step one clock cycle |
| R | Auto-run (400ms per cycle) |
| P | Pause auto-run |
| Q | Quit / show splash |

## File Structure

```
coal proj/
├── pipeline_visualizer.ASM   # 8086 assembly source (EMU8086/MASM)
├── bridge/
│   ├── server.js              # Node.js WebSocket + HTTP bridge
│   ├── mock_emu.js            # JavaScript mock emulator
│   └── package.json
├── ui/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── components/        # 8 React components
│   │   ├── hooks/             # WebSocket + state hooks
│   │   └── styles/            # Tailwind CSS + animations
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── run.bat                    # Windows launcher
├── run.sh                     # Unix launcher
├── README.md
└── VIVA_GUIDE.md
```

## Switching Between Real EMU8086 and Mock Mode

The bridge server spawns `mock_emu.js` by default. To use the real assembly:
1. Compile `pipeline_visualizer.ASM` in EMU8086 to `.COM` or `.EXE`
2. Edit `bridge/server.js` — replace `MOCK_EMU` path with the compiled binary
3. Pass command-line args: `pipeline_visualizer.COM A 5 3`

## Pipeline Hazards

The demo demonstrates a **Read-After-Write (RAW) data hazard**:
- I3: `ADD AX, BX` (writes AX)
- I4: `SUB CX, AX` (reads AX before I3 write-back)

The hazard detection unit compares source registers at DECODE stage against
destination registers in EXECUTE/MEMORY stages. When detected, a 1-cycle stall
is inserted.
