; ═══════════════════════════════════════════════════════════════════
; data_segment.inc — CPU Pipeline Visualizer
; COAL Spring 2026 — Air University BSCS
; ═══════════════════════════════════════════════════════════════════

.DATA

; ── INSTRUCTION TABLE ─────────────────────────────────────────────
; 16 entries × 8 bytes each
; Byte 0: Opcode   Byte 1: Source reg   Byte 2: Dest reg
; Byte 3-4: Immediate value  Byte 5: Mem flag  Byte 6: Flags  Byte 7: Reserved
instr_table     DB  16 DUP (8 DUP (00h))
instr_count     DB  0
instr_ptr       DB  0

; ── OPCODE CONSTANTS ─────────────────────────────────────────────
; Defined at usage sites with CMP AL, immediate

; ── PIPELINE STATE ────────────────────────────────────────────────
pipeline_slots  DB  5 DUP (0FFh)  ; 5 stages: IF=0, ID=1, EX=2, MEM=3, WB=4
pipeline_prev   DB  5 DUP (0FFh)
stage_timer     DB  5 DUP (0)
stage_limit     DB  5 DUP (1)

; ── REGISTER SNAPSHOT ────────────────────────────────────────────
snap_AX         DW  0000h
snap_BX         DW  0000h
snap_CX         DW  0000h
snap_DX         DW  0000h
snap_SI         DW  0000h
snap_DI         DW  0000h
snap_SP         DW  01FEh

prev_AX         DW  0FFFFh
prev_BX         DW  0FFFFh
prev_CX         DW  0FFFFh
prev_DX         DW  0FFFFh
prev_FLAGS      DW  0FFFFh

; ── FLAGS SNAPSHOT ────────────────────────────────────────────────
snap_ZF         DB  0
snap_SF         DB  0
snap_CF         DB  0
snap_OF         DB  0
snap_PF         DB  0
snap_AF         DB  0

; ── ALU STATE ─────────────────────────────────────────────────────
alu_op          DB  00h
alu_operand_a   DW  0000h
alu_operand_b   DW  0000h
alu_result      DW  0000h
alu_active      DB  0

; ── HAZARD DETECTION ──────────────────────────────────────────────
hazard_detected DB  0
hazard_reg      DB  0FFh
hazard_type     DB  0
stall_count     DB  0
stalls_this_cyc DB  0

; ── EXECUTION CONTROL ─────────────────────────────────────────────
clock_cycle     DW  0000h
run_mode        DB  00h
sim_complete    DB  0
current_op_mode DB  00h
user_operand_a  DW  0005h
user_operand_b  DW  0003h

; ── MEMORY SIMULATION ─────────────────────────────────────────────
mem_sim         DW  16 DUP (0000h)

; ── JSON OUTPUT BUFFER ────────────────────────────────────────────
json_buf        DB  1024 DUP (00h)
json_len        DW  0000h
json_ptr        DW  0000h

; ── STRING CONSTANTS ──────────────────────────────────────────────
str_lbrace      DB  "{", 00h
str_rbrace      DB  "}", 00h
str_lbracket    DB  "[", 00h
str_rbracket    DB  "]", 00h
str_comma       DB  ",", 00h
str_colon       DB  ":", 00h
str_quote       DB  '"', 00h
str_newline     DB  0Dh, 0Ah, 00h

jf_cycle        DB  '"cycle":', 00h
jf_pipeline     DB  '"pipeline":', 00h
jf_registers    DB  '"registers":', 00h
jf_flags        DB  '"flags":', 00h
jf_alu          DB  '"alu":', 00h
jf_hazard       DB  '"hazard":', 00h
jf_memory       DB  '"memory":', 00h
jf_status       DB  '"status":', 00h
jf_explanation  DB  '"step_explanation":', 00h
jf_concepts     DB  '"assembly_concepts":', 00h
jf_instr_queue  DB  '"instruction_queue":', 00h
jf_op_mode      DB  '"operation_mode":', 00h

; Stage names
str_IF          DB  "IF", 00h
str_ID          DB  "ID", 00h
str_EX          DB  "EX", 00h
str_MEM         DB  "MEM", 00h
str_WB          DB  "WB", 00h
str_STALL       DB  "STALL", 00h
str_EMPTY       DB  "EMPTY", 00h

; Register names
str_AX          DB  "AX", 00h
str_BX          DB  "BX", 00h
str_CX          DB  "CX", 00h
str_DX          DB  "DX", 00h
str_SI          DB  "SI", 00h
str_DI          DB  "DI", 00h
str_SP          DB  "SP", 00h

; Operation mode strings
str_ADD         DB  "ADD", 00h
str_SUB         DB  "SUB", 00h
str_MUL         DB  "MUL", 00h
str_DIV         DB  "DIV", 00h
str_AND         DB  "AND", 00h
str_OR          DB  "OR", 00h
str_XOR         DB  "XOR", 00h
str_NOT         DB  "NOT", 00h
str_SHL         DB  "SHL", 00h
str_SHR         DB  "SHR", 00h
str_CMP         DB  "CMP", 00h
str_MOV         DB  "MOV", 00h
str_FULL        DB  "FULL_DEMO", 00h

; Status strings
str_running     DB  '"running"', 00h
str_paused      DB  '"paused"', 00h
str_complete    DB  '"complete"', 00h
str_idle        DB  '"idle"', 00h

; HEX character lookup
hex_chars       DB  "0123456789ABCDEF"

; ── EXPLANATION TEMPLATES ─────────────────────────────────────────
expl_mov_imm    DB  "IF: Fetching MOV instruction. Opcode+immediate loaded.", 00h
expl_mov_reg    DB  "ID: Decoding MOV register-to-register.", 00h
expl_add_ex     DB  "EX: ALU executing ADD. A=", 00h
expl_add_ex2    DB  " B=", 00h
expl_add_ex3    DB  " Result=", 00h
expl_hazard     DB  "HAZARD: RAW dependency on reg ", 00h
expl_stall      DB  "STALL: Pipeline frozen waiting for register write-back.", 00h
expl_wb         DB  "WB: Writing result back to register file.", 00h
expl_complete   DB  "SIMULATION COMPLETE. All instructions finished.", 00h

; ── CONCEPT TAG TABLE ─────────────────────────────────────────────
concept_proc    DB  '"PROC/ENDP"', 00h
concept_macro   DB  '"MACRO"', 00h
concept_stack   DB  '"PUSH/POP Stack"', 00h
concept_int10   DB  '"INT 10h Graphics"', 00h
concept_int21   DB  '"INT 21h I/O"', 00h
concept_branch  DB  '"Conditional Branch"', 00h
concept_loop    DB  '"LOOP Instruction"', 00h
concept_mem     DB  '"Memory Addressing"', 00h
concept_flags   DB  '"Flags Register"', 00h
concept_alu     DB  '"ALU Operation"', 00h
concept_hazard  DB  '"Data Hazard (RAW)"', 00h
concept_stall   DB  '"Pipeline Stall"', 00h
concept_fetch   DB  '"Instruction Fetch"', 00h
concept_decode  DB  '"Instruction Decode"', 00h
concept_wb      DB  '"Write-Back"', 00h

; ── SCREEN CONSTANTS ──────────────────────────────────────────────
SCREEN_WIDTH    EQU 80
SCREEN_HEIGHT   EQU 25
PIPELINE_ROW    EQU 5
PIPELINE_COL    EQU 5
REG_ROW         EQU 12
STATUS_ROW      EQU 22

CLR_NORMAL      EQU 07h
CLR_BRIGHT      EQU 0Fh
CLR_RED         EQU 04h
CLR_BRIGHT_RED  EQU 0Ch
CLR_CYAN        EQU 03h
CLR_BRIGHT_CYAN EQU 0Bh
CLR_MAGENTA     EQU 05h
CLR_YELLOW      EQU 06h
CLR_BRIGHT_YEL  EQU 0Eh
CLR_GREEN       EQU 02h
CLR_BRIGHT_GRN  EQU 0Ah
CLR_STALL       EQU 08h
CLR_HIGHLIGHT   EQU 70h
CLR_HAZARD_BG   EQU 4Fh
CLR_TITLE       EQU 1Fh
