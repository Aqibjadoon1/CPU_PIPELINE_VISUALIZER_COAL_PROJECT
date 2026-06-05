;==============================================================================
; PROJECT:  CPU Instruction Pipeline Visualizer
; COURSE:   COAL — Computer Organization & Assembly Language, Spring 2026
; TEAM:     Siddique Akbar (241826), Aqib Jadoon (241916), Taha Yasin (241874)
; PLATFORM: EMU8086 / MASM / TASM  (.COM format, ORG 100h)
;
; PURPOSE:
;   Simulates the classic 5-stage RISC pipeline (Fetch → Decode → Execute →
;   Memory → Write-Back) for a sequence of 8086 instructions. Outputs structured
;   protocol lines to stdout for consumption by a Node.js bridge server that
;   pushes real-time updates to a React-based web UI.
;
; ARCHITECTURE:
;   - 8-instruction demo pipeline including a data hazard (RAW on AX)
;   - 4 operation modes: ADD, SUB, MUL, DIV with user-supplied operands
;   - Full pipeline state machine: PIPELINE_STATE[] tracks stage of each slot
;   - Hazard detection unit: compares src vs dst across EXECUTE/MEMORY stages
;   - Keyboard-driven: SPACE=step, R=run, P=pause, Q=quit
;   - INT 10h splash screen with team info, ASCII border art
;
; OUTPUT PROTOCOL (each line ends with \r\n):
;   READY:mode=ADD,a=0005h,b=0003h
;   CYCLE:0001h:SLOTS:FF,FF,FF,FF,FF,FF,FF,FF:STALLS:0,0,0,0,0,0,0,0
;   FETCH:instr_num:mnemonic
;   DECODE:instr_num:src=AX,dst=BX,imm=0005h
;   EXECUTE:instr_num:op=ADD,result=0008h,flags=ZF:0,SF:0,CF:0,OF:0
;   MEMORY:instr_num:type=WRITE,addr=1000h,val=0008h
;   REGS:AX=0008h,BX=0003h,CX=0000h,DX=0000h,SI=0000h,DI=0000h,SP=FFEEh,FLAGS=0046h
;   HAZARD:DATA:instr_num:AX
;   STALL:instr_num
;   DONE:cycles=000Dh
;   ERROR:DIV_BY_ZERO
;==============================================================================

ORG 100h                     ; .COM format — PSP at 0, code at 100h
JMP START                    ; jump over data to main code

;==============================================================================
; EQUATES — named constants, no magic numbers
;==============================================================================
STAGE_FETCH     EQU 0        ; Instruction fetch stage
STAGE_DECODE    EQU 1        ; Instruction decode stage
STAGE_EXECUTE   EQU 2        ; Execute/ALU stage
STAGE_MEMORY    EQU 3        ; Memory access stage
STAGE_WB        EQU 4        ; Write-back stage
STAGE_EMPTY     EQU 0FFh     ; Pipeline slot empty marker
MAX_INSTR       EQU 12       ; Maximum instructions in table
MAX_SLOTS       EQU 12       ; Pipeline tracking slots (same as MAX_INSTR)
NUM_DEMO        EQU 8        ; Number of demo instructions

OPCODE_MOV      EQU 1        ; MOV opcode ID
OPCODE_ADD      EQU 2        ; ADD opcode ID
OPCODE_SUB      EQU 3        ; SUB opcode ID
OPCODE_CMP      EQU 4        ; CMP opcode ID
OPCODE_MUL      EQU 5        ; MUL opcode ID
OPCODE_DIV      EQU 6        ; DIV opcode ID

REG_NONE        EQU 0FFh     ; No register / memory access

MODE_DEMO       EQU 0        ; Operation mode: demo
MODE_ADD        EQU 1        ; Operation mode: ADD
MODE_SUB        EQU 2        ; Operation mode: SUB
MODE_MUL        EQU 3        ; Operation mode: MUL
MODE_DIV        EQU 4        ; Operation mode: DIV

;==============================================================================
; DATA SEGMENT — all global variables, tables, and string constants
;==============================================================================

;--- Instruction Mnemonic Strings (for FETCH output) -------------------------
; Each: null-terminated in source, '$'-terminated for INT 21h
; Stored as a table of strings at fixed offsets (multiply instr index by 16)
INSTR_MNEM_TABLE:
  DB "MOV AX,0005h    $"     ; I0 — demo instruction 1, 16 bytes each
  DB "MOV BX,0003h    $"
  DB "ADD AX,BX       $"
  DB "SUB CX,AX       $"
  DB "MOV [1000h],AX  $"
  DB "MOV DX,[1000h]  $"
  DB "CMP AX,BX       $"
  DB "MOV AX,0000h    $"
  DB "MOV AX,OPRND    $"     ; I8 — operation mode: load A
  DB "MOV BX,OPRND    $"     ; I9 — operation mode: load B
  DB "OP AX,BX        $"     ; I10 — operation mode: ALU op
  DB "NOP             $"     ; I11 — unused

;--- Instruction Name Suffixes (for DECODE output) ---------------------------
OPCODE_NAMES:
  DB "NOP$"
  DB "MOV$"
  DB "ADD$"
  DB "SUB$"
  DB "CMP$"
  DB "MUL$"
  DB "DIV$"

;--- Register Name Table (indexed by register ID 0-6) ------------------------
REG_NAMES:
  DB "AX$"
  DB "BX$"
  DB "CX$"
  DB "DX$"
  DB "SI$"
  DB "DI$"
  DB "SP$"

;--- Register Name Lengths (for cursor advancement) --------------------------
REG_NAME_LEN:
  DB 2, 2, 2, 2, 2, 2, 2

;--- Stage Names (8 bytes each, space-padded) for CYCLE output ---------------
STAGE_NAMES:
  DB "FETCH   "
  DB "DECODE  "
  DB "EXECUTE "
  DB "MEMORY  "
  DB "WRITEBK "

;--- Instruction Table: 12 records × 6 bytes each ----------------------------
; Record layout:
;   Byte 0: opcode_id   (1=MOV, 2=ADD, 3=SUB, 4=CMP, 5=MUL, 6=DIV)
;   Byte 1: src_reg     (0-6 = AX/BX/CX/DX/SI/DI/SP, 0FFh = none/memory)
;   Byte 2: dst_reg     (0-6 = register, 0FFh = memory write target)
;   Byte 3: imm_lo      (low byte of immediate value or address)
;   Byte 4: imm_hi      (high byte)
;   Byte 5: mem_flag    (0=none, 1=memory write, 2=memory read)
INSTR_TABLE:
  ; I0: MOV AX, 0005h
  DB OPCODE_MOV, REG_NONE, 0,    05h, 00h, 0
  ; I1: MOV BX, 0003h
  DB OPCODE_MOV, REG_NONE, 1,    03h, 00h, 0
  ; I2: ADD AX, BX                 ← EXECUTE stage lit
  DB OPCODE_ADD, 1,        0,    00h, 00h, 0
  ; I3: SUB CX, AX                ← DATA HAZARD: reads AX before WB of I2
  DB OPCODE_SUB, 0,        2,    00h, 00h, 0
  ; I4: MOV [1000h], AX           ← MEMORY WRITE
  DB OPCODE_MOV, 0,        REG_NONE, 00h, 10h, 1
  ; I5: MOV DX, [1000h]           ← MEMORY READ
  DB OPCODE_MOV, REG_NONE, 3,    00h, 10h, 2
  ; I6: CMP AX, BX                ← FLAG update
  DB OPCODE_CMP, 0,        1,    00h, 00h, 0
  ; I7: MOV AX, 0000h             ← pipeline flush
  DB OPCODE_MOV, REG_NONE, 0,    00h, 00h, 0
  ; I8-I11: reserved for operation mode (filled at runtime)
  DB 0, 0, 0, 0, 0, 0
  DB 0, 0, 0, 0, 0, 0
  DB 0, 0, 0, 0, 0, 0
  DB 0, 0, 0, 0, 0, 0

;--- Pipeline State Array (12 bytes, one per instruction slot) ---------------
; Values: STAGE_FETCH(0) through STAGE_WB(4), or STAGE_EMPTY(0FFh)
PIPELINE_STATE:
  DB 12 DUP(STAGE_EMPTY)

;--- Stall Flags (12 bytes, 1 = instruction is stalled this cycle) -----------
STALL_FLAGS:
  DB 12 DUP(0)

;--- Register Snapshot (8 words): AX, BX, CX, DX, SI, DI, SP, FLAGS ---------
REG_SNAPSHOT:
  DW 8 DUP(0)

;--- Working Variables -------------------------------------------------------
INSTR_PTR       DW 0         ; Next instruction index to fetch (0-11)
CYCLE_COUNT     DW 0         ; Current clock cycle number (hex)
OPERATION_MODE  DB MODE_DEMO ; 0=demo, 1=ADD, 2=SUB, 3=MUL, 4=DIV
OPERAND_A       DW 0         ; First operand for operation mode
OPERAND_B       DW 0         ; Second operand for operation mode
RESULT_VAL      DW 0         ; ALU result (low word, AX)
RESULT_HIGH     DW 0         ; ALU result high word (DX, for MUL)
TEMP_VAL        DW 0         ; Scratch storage
AUTO_RUN        DB 0         ; 0=manual step, 1=auto-run
STALL_COUNT     DW 0         ; Total stall cycles
HAZARD_COUNT    DW 0         ; Total hazards detected
ACTIVE_COUNT    DW 0         ; Number of instructions still in pipeline
INSTR_COMPLETED DW 0         ; Number of instructions that completed WB
EXECUTE_FLAGS   DB 0         ; Flags snapshot during EXECUTE stage
TEMP_CHAR       DB 0         ; Temporary character storage

;--- Output Buffer (256 bytes for string construction) -----------------------
OUTPUT_BUF      DB 256 DUP(0)
HEX_BUF         DB 5 DUP(0), '$'  ; 4 hex digits + null + '$'
OUTPUT_CRLF     DB 0Dh, 0Ah, '$'  ; Carriage return + line feed

TEMP_STR        DB 32 DUP('$')     ; Generic temporary string buffer

;--- Protocol String Constants -----------------------------------------------
STR_CRLF        DB 0Dh, 0Ah, '$'
STR_READY       DB "READY:mode=", '$'
STR_DEMO        DB "DEMO", '$'
STR_COMMA       DB ",", '$'
STR_COLON       DB ":", '$'
STR_EQUALS      DB "=", '$'
STR_A_EQ        DB "a=", '$'
STR_B_EQ        DB ",b=", '$'
STR_H_SUFFIX    DB "h", '$'
STR_CYCLE       DB "CYCLE:", '$'
STR_CYCLE_SLOTS DB ":SLOTS:", '$'
STR_CYCLE_STALL DB ":STALLS:", '$'
STR_FETCH_PFX   DB "FETCH:", '$'
STR_DECODE_PFX  DB "DECODE:", '$'
STR_EXECUTE_PFX DB "EXECUTE:", '$'
STR_MEMORY_PFX  DB "MEMORY:", '$'
STR_REGS_PFX    DB "REGS:", '$'
STR_HAZARD_PFX  DB "HAZARD:DATA:", '$'
STR_STALL_PFX   DB "STALL:", '$'
STR_DONE_PFX    DB "DONE:cycles=", '$'
STR_SRC_LBL     DB "src=", '$'
STR_DST_LBL     DB "dst=", '$'
STR_IMM_LBL     DB "imm=", '$'
STR_OP_LBL      DB "op=", '$'
STR_RESULT_LBL  DB "result=", '$'
STR_FLAGS_LBL   DB "flags=ZF:", '$'
STR_SF_LBL      DB ",SF:", '$'
STR_CF_LBL      DB ",CF:", '$'
STR_OF_LBL      DB ",OF:", '$'
STR_TYPE_LBL    DB "type=", '$'
STR_ADDR_LBL    DB "addr=", '$'
STR_VAL_LBL     DB "val=", '$'
STR_WRITE       DB "WRITE", '$'
STR_READ        DB "READ", '$'
STR_NONE        DB "NONE", '$'
STR_ERR_DBZ     DB "ERROR:DIV_BY_ZERO", 0Dh, 0Ah, '$'

;--- Splash Screen Strings ---------------------------------------------------
SPLASH_HEADER   DB "  __   __   _  _  ____  _     _  _  ____    __  ____  ",'$'
SPLASH_HEADER2  DB " / _\ / _\ / )( \(  _\/ \ /\/ )( \(  __)  (  )(_  _) ",'$'
SPLASH_HEADER3  DB "/    /    \) \/ ( )  /) /\ ( \) ( ) _)   / (_/\ )(  ",'$'
SPLASH_HEADER4  DB "\_/\_\_/\_/\____/(__/ \_\ \/ \_/(____)  \____/(__) ",'$'
SPLASH_TITLE1   DB "8086 INSTRUCTION PIPELINE VISUALIZER", '$'
SPLASH_TITLE2   DB "COAL — Computer Organization & Assembly Language", '$'
SPLASH_TITLE3   DB "Spring 2026", '$'
SPLASH_TEAM     DB "TEAM: Siddique Akbar | Aqib Jadoon | Taha Yasin", '$'
SPLASH_PROMPT   DB " PRESS SPACE TO STEP | R=RUN | P=PAUSE | Q=QUIT ", '$'
SPLASH_DEMO     DB ">> DEMO MODE: 8 instructions, data hazard on I4 <<", '$'

;--- ASCII Box Drawing Characters --------------------------------------------
DB_BLOCK        EQU 219      ; Full block
DB_DBL_HORIZ    EQU 205      ; Double horizontal line
DB_DBL_VERT     EQU 186      ; Double vertical line
DB_DBL_TL       EQU 201      ; Double top-left corner
DB_DBL_TR       EQU 187      ; Double top-right corner
DB_DBL_BL       EQU 200      ; Double bottom-left corner
DB_DBL_BR       EQU 188      ; Double bottom-right corner

;==============================================================================
; MACROS — reusable instruction sequences
;==============================================================================

;--- PRINT_STRING addr: displays '$'-terminated string at addr via INT 21h ---
; Usage: PRINT_STRING myString
; Modifies: DX, AH only
PRINT_STRING MACRO addr
    LEA DX, addr
    MOV AH, 09h
    INT 21h
ENDM

;--- PRINT_CRLF: outputs carriage return + line feed -------------------------
PRINT_CRLF MACRO
    PRINT_STRING OUTPUT_CRLF
ENDM

;--- SAVE_REGS: pushes all general-purpose registers onto stack ---------------
SAVE_REGS MACRO
    PUSH AX
    PUSH BX
    PUSH CX
    PUSH DX
    PUSH SI
    PUSH DI
ENDM

;--- RESTORE_REGS: pops all general-purpose registers from stack --------------
RESTORE_REGS MACRO
    POP DI
    POP SI
    POP DX
    POP CX
    POP BX
    POP AX
ENDM

;--- OUTPUT_HEX_WORD: convert word value to 4 hex digits and print -----------
; Usage: OUTPUT_HEX_WORD <value>
; Modifies: nothing (uses HEX_DISPLAY procedure)
OUTPUT_HEX_WORD MACRO value
    LOCAL print_hex
    PUSH AX
    MOV AX, value
    CALL HEX_DISPLAY
    PRINT_STRING HEX_BUF
    POP AX
ENDM

;==============================================================================
; PROCEDURES — each saves/restores all modified registers
;==============================================================================

;------------------------------------------------------------------------------
; PROC HEX_DISPLAY
; PURPOSE:  Converts a 16-bit value in AX to 4 zero-padded hexadecimal ASCII
;           characters stored in HEX_BUF, terminated with '$'.
; INPUT:    AX = 16-bit value to convert
; OUTPUT:   HEX_BUF[0..3] = hex chars (most significant first), [4] = '$'
; REGS MODIFIED: AX, CX, DX, DI (saved/restored)
;------------------------------------------------------------------------------
HEX_DISPLAY PROC
    SAVE_REGS
    MOV DI, OFFSET HEX_BUF + 3    ; Start at last digit position
    MOV CX, 4                     ; 4 hex digits
    MOV DX, AX                    ; Save value in DX

hex_loop:
    MOV AX, DX                    ; Get current value
    AND AX, 0Fh                   ; Mask low nibble
    CMP AL, 10                    ; Is digit A-F?
    JB hex_digit                  ; If 0-9, jump
    ADD AL, 'A' - 10              ; Convert 10-15 to 'A'-'F'
    JMP hex_store

hex_digit:
    ADD AL, '0'                   ; Convert 0-9 to '0'-'9'

hex_store:
    MOV [DI], AL                  ; Store hex char
    DEC DI                        ; Move to previous position
    SHR DX, 4                     ; Shift right by 4 bits for next nibble
    LOOP hex_loop

    MOV byte [HEX_BUF + 4], '$'   ; Terminate string for INT 21h
    RESTORE_REGS
    RET
HEX_DISPLAY ENDP

;------------------------------------------------------------------------------
; PROC PRINT_STRING_CRLF
; PURPOSE:  Outputs a '$'-terminated string followed by CRLF
; INPUT:    DS:DX = pointer to string (caller must set DX before CALL)
; REGS MODIFIED: DX, AH (saved/restored)
;------------------------------------------------------------------------------
PRINT_STRING_CRLF PROC
    PUSH DX
    PUSH AX
    MOV AH, 09h
    INT 21h
    PRINT_STRING OUTPUT_CRLF
    POP AX
    POP DX
    RET
PRINT_STRING_CRLF ENDP

;------------------------------------------------------------------------------
; PROC OUTPUT_PROTOCOL_LINE
; PURPOSE:  Builds a protocol line in OUTPUT_BUF and prints it with CRLF.
;           Uses a pointer in SI to walk through data and DI for OUTPUT_BUF.
; INPUT:    SI = pointer to source data (string fragments to concatenate),
;           terminated by 0 byte. Each fragment: first byte = length (0-127),
;           followed by that many bytes of data.
; OUTPUT:   OUTPUT_BUF contains the concatenated string
; REGS MODIFIED: AX, BX, CX, DX, SI, DI (saved/restored)
;------------------------------------------------------------------------------
OUTPUT_PROTOCOL_LINE PROC
    SAVE_REGS
    MOV DI, OFFSET OUTPUT_BUF

copy_loop:
    LODSB                         ; Load next byte from SI into AL
    CMP AL, 0                     ; End marker (null byte)?
    JE copy_done
    MOV [DI], AL                  ; Store in output buffer
    INC DI
    JMP copy_loop

copy_done:
    MOV byte [DI], '$'            ; Terminate string
    INC DI
    MOV byte [DI], 0              ; Also null-terminate for safety
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF
    RESTORE_REGS
    RET
OUTPUT_PROTOCOL_LINE ENDP

;------------------------------------------------------------------------------
; PROC APPEND_STRING
; PURPOSE:  Appends a '$'-terminated string to OUTPUT_BUF at position DI
; INPUT:    SI = source string ('$'-terminated), DI = current position in buf
; OUTPUT:   DI = updated position (after the copy)
; REGS MODIFIED: SI, DI, AL (saved/restored)
;------------------------------------------------------------------------------
APPEND_STRING PROC
    PUSH AX
append_loop:
    MOV AL, [SI]
    CMP AL, '$'
    JE append_done
    MOV [DI], AL
    INC SI
    INC DI
    JMP append_loop
append_done:
    POP AX
    RET
APPEND_STRING ENDP

;------------------------------------------------------------------------------
; PROC APPEND_WORD_HEX
; PURPOSE:  Appends a 16-bit value as 4 hex digits to OUTPUT_BUF at DI
; INPUT:    AX = value to append, DI = current position in buf
; OUTPUT:   DI = updated position, HEX_BUF is used as scratch
; REGS MODIFIED: AX, DI (saved/restored for non-output regs)
;------------------------------------------------------------------------------
APPEND_WORD_HEX PROC
    PUSH AX
    PUSH SI
    CALL HEX_DISPLAY              ; AX → HEX_BUF (4 hex chars + '$')
    MOV SI, OFFSET HEX_BUF
append_hex_loop:
    MOV AL, [SI]
    CMP AL, '$'
    JE append_hex_done
    MOV [DI], AL
    INC SI
    INC DI
    JMP append_hex_loop
append_hex_done:
    POP SI
    POP AX
    RET
APPEND_WORD_HEX ENDP

;------------------------------------------------------------------------------
; PROC APPEND_BYTE_HEX
; PURPOSE:  Appends a byte value as 2 hex digits to OUTPUT_BUF at DI
; INPUT:    AL = value, DI = position
; OUTPUT:   DI = updated position
;------------------------------------------------------------------------------
APPEND_BYTE_HEX PROC
    PUSH AX
    PUSH AX                       ; Save original
    MOV AH, 0
    CALL APPEND_WORD_HEX          ; Append as 4-digit hex
    POP AX
    POP AX
    RET
APPEND_BYTE_HEX ENDP

;------------------------------------------------------------------------------
; PROC APPEND_BYTE_DEC
; PURPOSE:  Appends a byte (0-99) as decimal digits to OUTPUT_BUF
; INPUT:    AL = value, DI = position
; OUTPUT:   DI = updated position
;------------------------------------------------------------------------------
APPEND_BYTE_DEC PROC
    PUSH AX
    PUSH BX
    PUSH CX
    MOV AH, 0
    MOV BL, 10
    DIV BL                        ; AL = tens, AH = ones
    ADD AL, '0'
    ADD AH, '0'
    MOV [DI], AL
    INC DI
    MOV [DI], AH
    INC DI
    POP CX
    POP BX
    POP AX
    RET
APPEND_BYTE_DEC ENDP

;------------------------------------------------------------------------------
; PROC APPEND_REG_NAME
; PURPOSE:  Appends a register name (e.g., "AX") to OUTPUT_BUF
; INPUT:    AL = register ID (0-6), DI = position
; OUTPUT:   DI = updated position
;------------------------------------------------------------------------------
APPEND_REG_NAME PROC
    PUSH AX
    PUSH BX
    PUSH CX
    PUSH SI
    MOV BL, 3                     ; Each reg name is 3 bytes ("XX$")
    MUL BL                        ; AX = reg_id * 3
    MOV SI, OFFSET REG_NAMES
    ADD SI, AX                    ; SI -> register name
    CALL APPEND_STRING
    POP SI
    POP CX
    POP BX
    POP AX
    RET
APPEND_REG_NAME ENDP

;------------------------------------------------------------------------------
; PROC APPEND_OPCODE_NAME
; PURPOSE:  Appends opcode name (e.g., "ADD", "MOV")
; INPUT:    AL = opcode_id, DI = position
; OUTPUT:   DI = updated position
;------------------------------------------------------------------------------
APPEND_OPCODE_NAME PROC
    PUSH AX
    PUSH BX
    PUSH CX
    PUSH SI
    MOV BL, 4                     ; Each opcode name is up to 4 bytes ("XXX$")
    MUL BL
    MOV SI, OFFSET OPCODE_NAMES
    ADD SI, AX
    CALL APPEND_STRING
    POP SI
    POP CX
    POP BX
    POP AX
    RET
APPEND_OPCODE_NAME ENDP

;------------------------------------------------------------------------------
; PROC APPEND_MNEMONIC
; PURPOSE:  Appends mnemonic string for given instruction index
; INPUT:    AL = instruction index (0-11), DI = position
; OUTPUT:   DI = updated position
;------------------------------------------------------------------------------
APPEND_MNEMONIC PROC
    PUSH AX
    PUSH BX
    PUSH CX
    PUSH SI
    MOV BL, 16                    ; Each mnemonic is 16 bytes
    MUL BL
    MOV SI, OFFSET INSTR_MNEM_TABLE
    ADD SI, AX
    CALL APPEND_STRING
    POP SI
    POP CX
    POP BX
    POP AX
    RET
APPEND_MNEMONIC ENDP

;------------------------------------------------------------------------------
; PROC GET_INSTR_ADDR
; PURPOSE:  Returns pointer to instruction table record for given index
; INPUT:    AL = instruction index (0-11)
; OUTPUT:   SI = pointer to record in INSTR_TABLE
; REGS MODIFIED: SI (returned), AX, BX (saved/restored)
;------------------------------------------------------------------------------
GET_INSTR_ADDR PROC
    PUSH AX
    PUSH BX
    MOV BL, 6                     ; Each record is 6 bytes
    MUL BL
    MOV SI, OFFSET INSTR_TABLE
    ADD SI, AX
    POP BX
    POP AX
    RET
GET_INSTR_ADDR ENDP

;------------------------------------------------------------------------------
; PROC HAZARD_DETECT
; PURPOSE:  Checks if instruction at given slot has a data hazard with any
;           instruction currently in EXECUTE or MEMORY stages.
; INPUT:    AL = pipeline slot index to check
; OUTPUT:   HAZARD_FOUND_BYTE = 1 if hazard found, = 0 if none
;           HAZARD_SRC_REG = register name byte if found
; REGS MODIFIED: AX, BX, CX, DX, SI, DI
;------------------------------------------------------------------------------
HAZARD_FOUND_BYTE DB 0
HAZARD_SRC_REG   DB 0
HAZARD_DETECT PROC
    SAVE_REGS

    MOV byte [HAZARD_FOUND_BYTE], 0

    MOV BL, AL                    ; BL = our slot index

    MOV DI, OFFSET PIPELINE_STATE
    ADD DI, BX
    MOV AL, [DI]
    CMP AL, STAGE_DECODE
    JNE hd_none

    MOV CX, BX

    MOV AL, CL
    CALL GET_INSTR_ADDR
    MOV AL, [SI + 1]
    CMP AL, REG_NONE
    JE hd_none
    MOV DL, AL                    ; DL = our src_reg
    MOV [HAZARD_SRC_REG], AL

    MOV CX, 0
hd_scan:
    CMP CX, MAX_SLOTS
    JAE hd_none
    CMP CX, BX
    JE hd_next

    MOV DI, OFFSET PIPELINE_STATE
    ADD DI, CX
    MOV AL, [DI]
    CMP AL, STAGE_EXECUTE
    JB hd_next
    CMP AL, STAGE_MEMORY
    JA hd_next

    PUSH BX
    MOV AL, CL
    CALL GET_INSTR_ADDR
    MOV AL, [SI + 2]
    POP BX

    CMP AL, DL
    JE hd_found

hd_next:
    INC CX
    JMP hd_scan

hd_found:
    MOV byte [HAZARD_FOUND_BYTE], 1
    RESTORE_REGS
    RET

hd_none:
    MOV byte [HAZARD_FOUND_BYTE], 0
    RESTORE_REGS
    RET
HAZARD_DETECT ENDP

;------------------------------------------------------------------------------
; PROC FETCH_STAGE
; PURPOSE:  Simulates instruction fetch: reads instruction from INSTR_TABLE,
;           outputs FETCH protocol line.
; INPUT:    AL = instruction index
; REGS MODIFIED: AX, BX, CX, DX, SI, DI
;------------------------------------------------------------------------------
FETCH_STAGE PROC
    SAVE_REGS

    MOV BL, AL                    ; BL = instruction index
    MOV BH, 0

    ; Build FETCH output line
    MOV DI, OFFSET OUTPUT_BUF

    ; "FETCH:"
    MOV SI, OFFSET STR_FETCH_PFX
    CALL APPEND_STRING

    ; instruction index as hex
    MOV AX, BX
    CALL APPEND_WORD_HEX

    ; ":"
    MOV AL, ':'
    MOV [DI], AL
    INC DI

    ; mnemonic
    MOV AL, BL
    CALL APPEND_MNEMONIC

    ; Terminate and print
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF

    RESTORE_REGS
    RET
FETCH_STAGE ENDP

;------------------------------------------------------------------------------
; PROC DECODE_STAGE
; PURPOSE:  Simulates instruction decode: resolves registers, immediate,
;           outputs DECODE protocol line.
; INPUT:    AL = instruction index
; OUTPUT:   Updates STALL_FLAGS if hazard detected
; REGS MODIFIED: AX, BX, CX, DX, SI, DI
;------------------------------------------------------------------------------
DECODE_STAGE PROC
    SAVE_REGS

    MOV BL, AL                    ; BL = instruction index

    ; Get instruction record
    MOV AL, BL
    CALL GET_INSTR_ADDR           ; SI -> instruction record

    ; Parse instruction fields
    MOV AL, [SI]                  ; AL = opcode_id
    MOV CL, [SI + 1]              ; CL = src_reg
    MOV CH, [SI + 2]              ; CH = dst_reg
    MOV DX, [SI + 3]              ; DX = imm value (imm_lo, imm_hi)

    ; Build DECODE output line
    MOV DI, OFFSET OUTPUT_BUF

    ; "DECODE:"
    MOV SI, OFFSET STR_DECODE_PFX
    CALL APPEND_STRING

    ; instruction index
    MOV AX, BX
    CALL APPEND_WORD_HEX

    ; ":src="
    MOV SI, OFFSET STR_SRC_LBL
    CALL APPEND_STRING

    ; src register name
    MOV AL, CL
    CMP AL, REG_NONE
    JE decode_src_none
    CALL APPEND_REG_NAME
    JMP decode_src_done
decode_src_none:
    MOV AX, '--'
    MOV [DI], AX
    ADD DI, 2
decode_src_done:

    ; ",dst="
    PUSH SI
    MOV SI, OFFSET STR_DST_LBL
    CALL APPEND_STRING
    POP SI

    ; dst register name
    MOV AL, CH
    CMP AL, REG_NONE
    JE decode_dst_mem
    CALL APPEND_REG_NAME
    JMP decode_dst_done
decode_dst_mem:
    MOV AX, 'M'
    MOV [DI], AL
    INC DI
    MOV AL, ']'
    MOV [DI], AL
    INC DI
    MOV AL, '['
    MOV [DI], AL
    INC DI
    DEC DI
    DEC DI
    MOV word [DI], 'M['
    ADD DI, 2
    ; Actually simpler: just put "MEM"
    MOV word [DI], 'ME'
    ADD DI, 2
    MOV byte [DI], 'M'
    INC DI
decode_dst_done:

    ; ",imm="
    MOV SI, OFFSET STR_IMM_LBL
    CALL APPEND_STRING

    ; immediate value
    MOV AX, DX
    CALL APPEND_WORD_HEX

    ; "h"
    MOV AL, 'h'
    MOV [DI], AL
    INC DI

    ; Terminate and print
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF

    RESTORE_REGS
    RET
DECODE_STAGE ENDP

;------------------------------------------------------------------------------
; PROC EXECUTE_STAGE
; PURPOSE:  Simulates ALU execution: performs the operation, updates flags,
;           outputs EXECUTE protocol line.
; INPUT:    AL = instruction index
; OUTPUT:   Updates RESULT_VAL, EXECUTE_FLAGS
; REGS MODIFIED: AX, BX, CX, DX, SI, DI
;------------------------------------------------------------------------------
EXECUTE_STAGE PROC
    SAVE_REGS

    MOV BL, AL                    ; BL = instruction index

    ; Check stall flag
    MOV DI, OFFSET STALL_FLAGS
    MOV AL, BL
    XOR AH, AH
    ADD DI, AX
    MOV AL, [DI]
    CMP AL, 1
    JNE execute_proceed

    ; STALLED: output stall message
    MOV DI, OFFSET OUTPUT_BUF
    MOV SI, OFFSET STR_STALL_PFX
    CALL APPEND_STRING
    MOV AX, BX
    CALL APPEND_WORD_HEX
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF

    ; Clear stall flag
    MOV DI, OFFSET STALL_FLAGS
    MOV AL, BL
    XOR AH, AH
    ADD DI, AX
    MOV byte [DI], 0

    ; Increment stall count
    INC word [STALL_COUNT]

    RESTORE_REGS
    RET

execute_proceed:
    ; Get instruction record
    MOV AL, BL
    CALL GET_INSTR_ADDR           ; SI -> instruction record
    MOV AL, [SI]                  ; AL = opcode_id
    MOV CL, [SI + 1]              ; CL = src_reg
    MOV CH, [SI + 2]              ; CH = dst_reg

    ; Get register values
    ; For the simulation, we use REG_SNAPSHOT values
    MOV DI, OFFSET REG_SNAPSHOT

    ; Get source value
    XOR AX, AX
    CMP CL, REG_NONE
    JE execute_src_imm
    MOV AL, CL
    SHL AX, 1                     ; word offset
    ADD DI, AX
    MOV DX, [DI]                  ; DX = source register value
    JMP execute_alu

execute_src_imm:
    ; Immediate value from instruction
    MOV DX, [SI + 3]              ; DX = immediate
    CMP DX, 0
    JNE execute_alu
    ; If immediate is 0, use operand value for operation mode
    MOV DX, [OPERAND_A]           ; default fallback
    ; Actually for MOV with immediate, the imm IS the value
    MOV DX, [SI + 3]

execute_alu:
    ; Get destination register value
    MOV DI, OFFSET REG_SNAPSHOT
    XOR AX, AX
    CMP CH, REG_NONE
    JE execute_dst_mem
    MOV AL, CH
    SHL AX, 1
    ADD DI, AX
    MOV CX, [DI]                  ; CX = destination register value
    JMP execute_op

execute_dst_mem:
    XOR CX, CX

execute_op:
    ; Perform ALU operation based on opcode_id
    MOV BX, [OPERAND_B]           ; Default second operand

    CMP AL, OPCODE_MOV
    JE execute_mov
    CMP AL, OPCODE_ADD
    JE execute_add
    CMP AL, OPCODE_SUB
    JE execute_sub
    CMP AL, OPCODE_MUL
    JE execute_mul
    CMP AL, OPCODE_DIV
    JE execute_div
    CMP AL, OPCODE_CMP
    JE execute_cmp
    JMP execute_done

execute_mov:
    ; MOV: just move immediate or register value to destination
    MOV AX, DX                    ; AX = source value (immediate from instr table)
    MOV [RESULT_VAL], AX
    JMP execute_done

execute_add:
    ; ADD: dst = src1 + src2
    ; For ADD AX, BX: DX = AX value, CX = BX value
    ; Actually for ADD AX, BX: src_reg=BX(1), dst_reg=AX(0)
    ; DX = value of BX (source), CX = value of AX (destination)
    MOV AX, CX                    ; AX = dst_reg value (AX)
    ADD AX, DX                    ; AX = AX + BX
    MOV [RESULT_VAL], AX
    ; Update flags
    MOV byte [EXECUTE_FLAGS], 0
    CMP AX, 0
    JNE add_nz
    OR byte [EXECUTE_FLAGS], 80h  ; ZF=1
add_nz:
    TEST AX, 8000h
    JE add_ns
    OR byte [EXECUTE_FLAGS], 40h  ; SF=1
add_ns:
    ; CF: carry from bit 15
    MOV CX, AX                    ; Save result
    MOV AX, [REG_SNAPSHOT]        ; Original AX
    ADD AX, DX                    ; Same operation
    JC add_cf_set
    JMP add_cf_done
add_cf_set:
    OR byte [EXECUTE_FLAGS], 01h  ; CF=1
add_cf_done:
    ; OF: signed overflow
    MOV AX, [REG_SNAPSHOT]        ; Original AX (signed)
    XOR BX, BX
    MOV BX, DX                    ; BX value (signed)
    MOV CX, [RESULT_VAL]          ; Result (signed)
    ; Overflow if signs of inputs match but differ from result
    XOR AX, BX
    JS add_no_ovf                 ; Different signs, no overflow
    XOR AX, CX
    JNS add_no_ovf                ; Same sign as result, no overflow
    OR byte [EXECUTE_FLAGS], 04h  ; OF=1
add_no_ovf:
    MOV AX, [RESULT_VAL]
    JMP execute_done

execute_sub:
    ; SUB: dst = dst - src
    MOV AX, CX                    ; AX = dst_reg value
    SUB AX, DX                    ; AX = AX - BX
    MOV [RESULT_VAL], AX
    ; Update flags
    MOV byte [EXECUTE_FLAGS], 0
    CMP AX, 0
    JNE sub_nz
    OR byte [EXECUTE_FLAGS], 80h  ; ZF=1
sub_nz:
    TEST AX, 8000h
    JE sub_ns
    OR byte [EXECUTE_FLAGS], 40h  ; SF=1
sub_ns:
    MOV CX, [REG_SNAPSHOT]        ; Original AX (for dst)
    MOV BX, DX                    ; BX value (src)
    CMP CX, BX
    JB sub_cf_set
    JMP sub_cf_done
sub_cf_set:
    OR byte [EXECUTE_FLAGS], 01h  ; CF=1 (borrow)
sub_cf_done:
    ; OF for subtraction
    XOR CX, BX
    JS sub_no_ovf                 ; Different signs, no overflow
    MOV AX, [RESULT_VAL]
    XOR CX, AX
    JNS sub_no_ovf
    OR byte [EXECUTE_FLAGS], 04h  ; OF=1
sub_no_ovf:
    MOV AX, [RESULT_VAL]
    JMP execute_done

execute_mul:
    ; MUL: DX:AX = AX * src
    MOV AX, CX                    ; AX = dst_reg value (usually AX)
    MOV BX, DX                    ; BX = src value
    MUL BX                        ; DX:AX = AX * BX
    MOV [RESULT_VAL], AX
    MOV [RESULT_HIGH], DX
    ; MUL affects CF and OF (set if result > FFFFh)
    MOV byte [EXECUTE_FLAGS], 0
    CMP DX, 0
    JE mul_no_cf
    OR byte [EXECUTE_FLAGS], 05h  ; CF=1, OF=1 (result > 16-bit)
mul_no_cf:
    TEST AX, 8000h
    JE mul_ns
    OR byte [EXECUTE_FLAGS], 40h  ; SF=1
mul_ns:
    CMP AX, 0
    JNE mul_nz
    OR byte [EXECUTE_FLAGS], 80h  ; ZF=1
mul_nz:
    JMP execute_done

execute_div:
    ; DIV: AX = quotient, DX = remainder (DX:AX / src)
    MOV AX, CX                    ; AX = dividend (from dst reg)
    XOR DX, DX                    ; Clear high word
    CMP DX, 0                     ; BX = divisor
    MOV BX, DX                    ; Wait, DX is 0 at this point
    MOV BX, [OPERAND_B]
    CMP BX, 0
    JE execute_div_zero
    DIV BX                        ; AX = quotient, DX = remainder
    MOV [RESULT_VAL], AX
    MOV [RESULT_HIGH], DX
    MOV byte [EXECUTE_FLAGS], 0
    TEST AX, 8000h
    JE div_ns
    OR byte [EXECUTE_FLAGS], 40h  ; SF=1
div_ns:
    CMP AX, 0
    JNE div_nz
    OR byte [EXECUTE_FLAGS], 80h  ; ZF=1
div_nz:
    JMP execute_done

execute_div_zero:
    PRINT_STRING STR_ERR_DBZ
    RESTORE_REGS
    RET

execute_cmp:
    ; CMP: like SUB but doesn't store result, only updates flags
    MOV AX, CX                    ; AX = dst_reg value (first operand)
    SUB AX, DX                    ; Subtract source
    MOV byte [EXECUTE_FLAGS], 0
    CMP AX, 0
    JNE cmp_nz
    OR byte [EXECUTE_FLAGS], 80h  ; ZF=1
cmp_nz:
    TEST AX, 8000h
    JE cmp_ns
    OR byte [EXECUTE_FLAGS], 40h  ; SF=1
cmp_ns:
    MOV AX, CX
    CMP AX, DX
    JB cmp_cf_set
    JMP cmp_cf_done
cmp_cf_set:
    OR byte [EXECUTE_FLAGS], 01h  ; CF=1
cmp_cf_done:
    XOR CX, DX
    JS cmp_no_ovf
    MOV AX, CX
    XOR AX, DX
    JNS cmp_no_ovf
    OR byte [EXECUTE_FLAGS], 04h  ; OF=1
cmp_no_ovf:
    MOV AX, 0                     ; CMP doesn't modify destination
    MOV [RESULT_VAL], AX
    JMP execute_done

execute_done:
    ; Build EXECUTE output line
    MOV DI, OFFSET OUTPUT_BUF
    MOV SI, OFFSET STR_EXECUTE_PFX
    CALL APPEND_STRING

    ; instruction index
    MOV AX, BX
    CALL APPEND_WORD_HEX

    ; ":op="
    MOV SI, OFFSET STR_OP_LBL
    CALL APPEND_STRING

    ; Opcode name
    MOV AL, BL
    CALL GET_INSTR_ADDR
    MOV AL, [SI]                  ; AL = opcode_id
    CALL APPEND_OPCODE_NAME

    ; ",result="
    MOV SI, OFFSET STR_RESULT_LBL
    CALL APPEND_STRING

    ; result value
    MOV AX, [RESULT_VAL]
    CALL APPEND_WORD_HEX

    ; "h,flags=ZF:"
    MOV SI, OFFSET STR_FLAGS_LBL
    CALL APPEND_STRING

    ; ZF bit
    MOV AL, [EXECUTE_FLAGS]
    TEST AL, 80h
    JNE zf_set
    MOV AL, '0'
    JMP zf_out
zf_set:
    MOV AL, '1'
zf_out:
    MOV [DI], AL
    INC DI

    ; ",SF:"
    MOV SI, OFFSET STR_SF_LBL
    CALL APPEND_STRING

    ; SF bit
    MOV AL, [EXECUTE_FLAGS]
    TEST AL, 40h
    JNE sf_set
    MOV AL, '0'
    JMP sf_out
sf_set:
    MOV AL, '1'
sf_out:
    MOV [DI], AL
    INC DI

    ; ",CF:"
    MOV SI, OFFSET STR_CF_LBL
    CALL APPEND_STRING

    ; CF bit
    MOV AL, [EXECUTE_FLAGS]
    TEST AL, 01h
    JNE cf_set
    MOV AL, '0'
    JMP cf_out
cf_set:
    MOV AL, '1'
cf_out:
    MOV [DI], AL
    INC DI

    ; ",OF:"
    MOV SI, OFFSET STR_OF_LBL
    CALL APPEND_STRING

    ; OF bit
    MOV AL, [EXECUTE_FLAGS]
    TEST AL, 04h
    JNE of_set
    MOV AL, '0'
    JMP of_out
of_set:
    MOV AL, '1'
of_out:
    MOV [DI], AL
    INC DI

    ; Output
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF

    ; Update REG_SNAPSHOT with result (only if not CMP)
    MOV AL, BL
    CALL GET_INSTR_ADDR
    MOV AL, [SI]                  ; opcode_id
    CMP AL, OPCODE_CMP
    JE execute_skip_writeback

    ; Write result to destination register in snapshot
    MOV AL, BL
    CALL GET_INSTR_ADDR
    MOV AL, [SI + 2]              ; dst_reg
    CMP AL, REG_NONE
    JE execute_skip_writeback     ; Memory write, handled in MEMORY stage
    MOV DI, OFFSET REG_SNAPSHOT
    XOR AH, AH
    SHL AX, 1
    ADD DI, AX
    MOV AX, [RESULT_VAL]
    MOV [DI], AX

    ; For MUL, also update DX register (RESULT_HIGH)
    MOV AL, BL
    CALL GET_INSTR_ADDR
    MOV AL, [SI]
    CMP AL, OPCODE_MUL
    JNE execute_skip_writeback
    MOV DI, OFFSET REG_SNAPSHOT + 6  ; DX is at offset 6 (AX=0, BX=2, CX=4, DX=6)
    MOV AX, [RESULT_HIGH]
    MOV [DI], AX

execute_skip_writeback:
    RESTORE_REGS
    RET
EXECUTE_STAGE ENDP

;------------------------------------------------------------------------------
; PROC MEMORY_STAGE
; PURPOSE:  Simulates memory access: read/write to address 1000h.
;           Outputs MEMORY protocol line.
; INPUT:    AL = instruction index
; REGS MODIFIED: AX, BX, CX, DX, SI, DI
;------------------------------------------------------------------------------
MEMORY_STAGE PROC
    SAVE_REGS

    MOV BL, AL                    ; BL = instruction index

    ; Get instruction record
    MOV AL, BL
    CALL GET_INSTR_ADDR           ; SI -> instruction record

    MOV AL, [SI + 5]              ; AL = mem_flag
    CMP AL, 0
    JE memory_none
    CMP AL, 1
    JE memory_write
    CMP AL, 2
    JE memory_read
    JMP memory_none

memory_write:
    ; MOV [1000h], reg — write register value to memory
    MOV AL, [SI + 1]              ; AL = src_reg (which register to write)
    MOV DI, OFFSET REG_SNAPSHOT
    XOR AH, AH
    SHL AX, 1
    ADD DI, AX
    MOV AX, [DI]                  ; AX = register value

    ; Write to simulated memory at 1000h
    MOV [MEMORY_SIM], AX

    ; Build output
    MOV DI, OFFSET OUTPUT_BUF
    MOV SI, OFFSET STR_MEMORY_PFX
    CALL APPEND_STRING
    MOV AX, BX
    CALL APPEND_WORD_HEX
    MOV SI, OFFSET STR_TYPE_LBL
    CALL APPEND_STRING
    MOV SI, OFFSET STR_WRITE
    CALL APPEND_STRING
    MOV SI, OFFSET STR_COMMA
    CALL APPEND_STRING
    MOV SI, OFFSET STR_ADDR_LBL
    CALL APPEND_STRING
    MOV AX, 1000h
    CALL APPEND_WORD_HEX
    MOV SI, OFFSET STR_COMMA
    CALL APPEND_STRING
    MOV SI, OFFSET STR_VAL_LBL
    CALL APPEND_STRING
    MOV AX, [MEMORY_SIM]
    CALL APPEND_WORD_HEX
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF
    JMP memory_done

memory_read:
    ; MOV reg, [1000h] — read memory into register
    MOV AX, [MEMORY_SIM]          ; Read from simulated memory

    ; Store in destination register
    MOV AL, [SI + 2]              ; AL = dst_reg
    MOV DI, OFFSET REG_SNAPSHOT
    XOR AH, AH
    SHL AX, 1
    ADD DI, AX
    MOV [DI], AX

    ; Build output
    MOV DI, OFFSET OUTPUT_BUF
    MOV SI, OFFSET STR_MEMORY_PFX
    CALL APPEND_STRING
    MOV AX, BX
    CALL APPEND_WORD_HEX
    MOV SI, OFFSET STR_TYPE_LBL
    CALL APPEND_STRING
    MOV SI, OFFSET STR_READ
    CALL APPEND_STRING
    MOV SI, OFFSET STR_COMMA
    CALL APPEND_STRING
    MOV SI, OFFSET STR_ADDR_LBL
    CALL APPEND_STRING
    MOV AX, 1000h
    CALL APPEND_WORD_HEX
    MOV SI, OFFSET STR_COMMA
    CALL APPEND_STRING
    MOV SI, OFFSET STR_VAL_LBL
    CALL APPEND_STRING
    MOV AX, [MEMORY_SIM]
    CALL APPEND_WORD_HEX
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF
    JMP memory_done

memory_none:
    ; No memory access
    MOV DI, OFFSET OUTPUT_BUF
    MOV SI, OFFSET STR_MEMORY_PFX
    CALL APPEND_STRING
    MOV AX, BX
    CALL APPEND_WORD_HEX
    MOV SI, OFFSET STR_TYPE_LBL
    CALL APPEND_STRING
    MOV SI, OFFSET STR_NONE
    CALL APPEND_STRING
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF

memory_done:
    RESTORE_REGS
    RET
MEMORY_STAGE ENDP

;--- Simulated Memory Location for MEMORY_STAGE ------------------------------
MEMORY_SIM  DW 0

;------------------------------------------------------------------------------
; PROC WRITEBACK_STAGE
; PURPOSE:  Commits result to register file, outputs REGS protocol line with
;           complete register snapshot.
; INPUT:    AL = instruction index
; REGS MODIFIED: AX, BX, CX, DX, SI, DI
;------------------------------------------------------------------------------
WRITEBACK_STAGE PROC
    SAVE_REGS

    MOV BL, AL                    ; BL = instruction index

    ; Increment completed instructions count
    INC word [INSTR_COMPLETED]

    ; Output REGS line
    CALL SHOW_REGISTERS

    ; Clear pipeline slot
    MOV DI, OFFSET PIPELINE_STATE
    MOV AL, BL
    XOR AH, AH
    ADD DI, AX
    MOV byte [DI], STAGE_EMPTY
    MOV byte [STALL_FLAGS + BX], 0

    RESTORE_REGS
    RET
WRITEBACK_STAGE ENDP

;------------------------------------------------------------------------------
; PROC SHOW_REGISTERS
; PURPOSE:  Outputs complete register snapshot in REGS format.
;           "REGS:AX=XXXXh,BX=XXXXh,...,FLAGS=XXXXh"
; REGS MODIFIED: AX, BX, CX, DX, SI, DI
;------------------------------------------------------------------------------
SHOW_REGISTERS PROC
    SAVE_REGS

    MOV DI, OFFSET OUTPUT_BUF
    MOV SI, OFFSET STR_REGS_PFX
    CALL APPEND_STRING

    ; AX
    MOV SI, OFFSET REG_NAMES      ; "AX"
    CALL APPEND_STRING
    MOV AL, '='
    MOV [DI], AL
    INC DI
    MOV AX, [REG_SNAPSHOT]        ; AX value
    CALL APPEND_WORD_HEX
    MOV AL, 'h'
    MOV [DI], AL
    INC DI

    ; BX
    MOV AL, ','
    MOV [DI], AL
    INC DI
    MOV SI, OFFSET REG_NAMES + 3  ; "BX"
    CALL APPEND_STRING
    MOV AL, '='
    MOV [DI], AL
    INC DI
    MOV AX, [REG_SNAPSHOT + 2]    ; BX value
    CALL APPEND_WORD_HEX
    MOV AL, 'h'
    MOV [DI], AL
    INC DI

    ; CX
    MOV AL, ','
    MOV [DI], AL
    INC DI
    MOV SI, OFFSET REG_NAMES + 6  ; "CX"
    CALL APPEND_STRING
    MOV AL, '='
    MOV [DI], AL
    INC DI
    MOV AX, [REG_SNAPSHOT + 4]    ; CX value
    CALL APPEND_WORD_HEX
    MOV AL, 'h'
    MOV [DI], AL
    INC DI

    ; DX
    MOV AL, ','
    MOV [DI], AL
    INC DI
    MOV SI, OFFSET REG_NAMES + 9  ; "DX"
    CALL APPEND_STRING
    MOV AL, '='
    MOV [DI], AL
    INC DI
    MOV AX, [REG_SNAPSHOT + 6]    ; DX value
    CALL APPEND_WORD_HEX
    MOV AL, 'h'
    MOV [DI], AL
    INC DI

    ; SI
    MOV AL, ','
    MOV [DI], AL
    INC DI
    MOV SI, OFFSET REG_NAMES + 12 ; "SI"
    CALL APPEND_STRING
    MOV AL, '='
    MOV [DI], AL
    INC DI
    MOV AX, [REG_SNAPSHOT + 8]    ; SI value
    CALL APPEND_WORD_HEX
    MOV AL, 'h'
    MOV [DI], AL
    INC DI

    ; DI
    MOV AL, ','
    MOV [DI], AL
    INC DI
    MOV SI, OFFSET REG_NAMES + 15  ; "DI"
    CALL APPEND_STRING
    MOV AL, '='
    MOV [DI], AL
    INC DI
    MOV AX, [REG_SNAPSHOT + 10]   ; DI value
    CALL APPEND_WORD_HEX
    MOV AL, 'h'
    MOV [DI], AL
    INC DI

    ; SP
    MOV AL, ','
    MOV [DI], AL
    INC DI
    MOV SI, OFFSET REG_NAMES + 18  ; "SP"
    CALL APPEND_STRING
    MOV AL, '='
    MOV [DI], AL
    INC DI
    MOV AX, [REG_SNAPSHOT + 12]   ; SP value
    CALL APPEND_WORD_HEX
    MOV AL, 'h'
    MOV [DI], AL
    INC DI

    ; FLAGS
    MOV AL, ','
    MOV [DI], AL
    INC DI
    MOV SI, OFFSET STR_FLAGS_LBL + 6  ; Skip "flags=ZF:" — just use "FLAGS"
    ; Actually let's just write "FLAGS="
    MOV word [DI], 'FL'
    ADD DI, 2
    MOV word [DI], 'AG'
    ADD DI, 2
    MOV word [DI], 'S='
    ADD DI, 2
    MOV AX, [REG_SNAPSHOT + 14]   ; FLAGS value
    CALL APPEND_WORD_HEX
    MOV AL, 'h'
    MOV [DI], AL
    INC DI

    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF

    RESTORE_REGS
    RET
SHOW_REGISTERS ENDP

;------------------------------------------------------------------------------
; PROC DRAW_PIPELINE
; PURPOSE:  Outputs "CYCLE:XXXXh:SLOTS:s0,...,s11:STALLS:b0,...,b11"
; REGS MODIFIED: AX, BX, CX, DX, SI, DI
;------------------------------------------------------------------------------
DRAW_PIPELINE PROC
    SAVE_REGS

    MOV DI, OFFSET OUTPUT_BUF

    MOV SI, OFFSET STR_CYCLE
    CALL APPEND_STRING

    MOV AX, [CYCLE_COUNT]
    CALL APPEND_WORD_HEX

    MOV SI, OFFSET STR_CYCLE_SLOTS
    CALL APPEND_STRING

    MOV CX, 0
dp_slot_loop:
    CMP CX, MAX_SLOTS
    JAE dp_slot_done

    CMP CX, 0
    JE dp_no_comma_s
    MOV AL, ','
    MOV [DI], AL
    INC DI
dp_no_comma_s:

    PUSH BX
    PUSH DI
    MOV DI, OFFSET PIPELINE_STATE
    ADD DI, CX
    MOV AL, [DI]
    XOR AH, AH
    POP DI
    CALL APPEND_WORD_HEX
    POP BX

    INC CX
    JMP dp_slot_loop

dp_slot_done:
    MOV SI, OFFSET STR_CYCLE_STALL
    CALL APPEND_STRING

    XOR CX, CX
dp_stall_loop:
    CMP CX, MAX_SLOTS
    JAE dp_stall_done

    CMP CX, 0
    JE dp_no_comma_st
    MOV AL, ','
    MOV [DI], AL
    INC DI
dp_no_comma_st:

    PUSH BX
    PUSH DI
    MOV DI, OFFSET STALL_FLAGS
    ADD DI, CX
    MOV AL, [DI]
    POP DI
    ADD AL, '0'
    MOV [DI], AL
    INC DI
    POP BX

    INC CX
    JMP dp_stall_loop

dp_stall_done:
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF

    RESTORE_REGS
    RET
DRAW_PIPELINE ENDP

;------------------------------------------------------------------------------
; PROC DELAY_LOOP
; PURPOSE:  Busy-wait delay loop for auto-run timing
; INPUT:    CX = iteration count (passed by caller)
; REGS MODIFIED: CX (decremented to 0)
;------------------------------------------------------------------------------
DELAY_LOOP PROC
    SAVE_REGS
delay_loop_inner:
    NOP
    NOP
    NOP
    LOOP delay_loop_inner
    RESTORE_REGS
    RET
DELAY_LOOP ENDP

;------------------------------------------------------------------------------
; PROC CHECK_KEYBOARD
; PURPOSE:  Non-blocking keyboard check. Processes SPACE, R, P, Q.
;           SPACE = advance one cycle, R = run, P = pause, Q = quit
; INPUT:    none
; OUTPUT:   CF=1 if any key was processed, ZF updated for quit
;           AUTO_RUN flag updated
; REGS MODIFIED: AX
;------------------------------------------------------------------------------
CHECK_KEYBOARD PROC
    PUSH AX
    PUSH BX
    PUSH DX

    MOV AH, 01h                   ; INT 16h AH=01h: check for keypress (non-blocking)
    INT 16h
    JZ key_none                   ; ZF=1 means no key available

    ; Key available — read it
    MOV AH, 00h                   ; INT 16h AH=00h: read key
    INT 16h
    ; AL = ASCII character, AH = scan code

    CMP AL, ' '                   ; SPACE — step one cycle
    JE key_step
    CMP AL, 'r'                   ; 'r' — run
    JE key_run
    CMP AL, 'R'                   ; 'R' — run
    JE key_run
    CMP AL, 'p'                   ; 'p' — pause
    JE key_pause
    CMP AL, 'P'                   ; 'P' — pause
    JE key_pause
    CMP AL, 'q'                   ; 'q' — quit
    JE key_quit
    CMP AL, 'Q'                   ; 'Q' — quit
    JE key_quit
    JMP key_none

key_step:
    MOV byte [AUTO_RUN], 0
    STC                           ; CF=1, processed key
    JMP key_done

key_run:
    MOV byte [AUTO_RUN], 1
    STC
    JMP key_done

key_pause:
    MOV byte [AUTO_RUN], 0
    STC
    JMP key_done

key_quit:
    MOV byte [AUTO_RUN], 0
    STC
    ; Set ZF=0 for quit (special flag)
    CLC
    ; Actually ZF handling is complex. Let me just set a flag.
    MOV byte [QUIT_FLAG], 1
    STC
    JMP key_done

key_none:
    CLC                           ; CF=0, no key

key_done:
    POP DX
    POP BX
    POP AX
    RET
CHECK_KEYBOARD ENDP

QUIT_FLAG DB 0  ; Set to 1 when Q is pressed

;------------------------------------------------------------------------------
; PROC ADVANCE_PIPELINE
; PURPOSE:  Advances the pipeline by one clock cycle. All instructions move
;           forward by one stage (unless stalled). New instruction is fetched.
; REGS MODIFIED: AX, BX, CX, DX, SI, DI
;------------------------------------------------------------------------------
ADVANCE_PIPELINE PROC
    SAVE_REGS

    ; Increment cycle counter
    INC word [CYCLE_COUNT]

    ; Step 1: Process slots from high index to low index
    ; This prevents double-advancing (slot i and i+1 both process in same cycle)
    MOV CX, MAX_SLOTS - 1

advance_loop:
    CMP CX, 0
    JB advance_done               ; Below 0, done

    ; Check if this slot is occupied
    MOV DI, OFFSET PIPELINE_STATE
    ADD DI, CX
    MOV AL, [DI]                  ; AL = current stage
    CMP AL, STAGE_EMPTY
    JE advance_next_slot          ; Slot is empty, skip

    ; Check stall
    MOV DI, OFFSET STALL_FLAGS
    ADD DI, CX
    MOV AL, [DI]
    CMP AL, 1
    JE advance_stalled            ; Stalled this cycle

    ; Get current stage
    MOV DI, OFFSET PIPELINE_STATE
    ADD DI, CX
    MOV AL, [DI]

    ; Process based on current stage
    CMP AL, STAGE_WB
    JE advance_wb
    CMP AL, STAGE_MEMORY
    JE advance_memory
    CMP AL, STAGE_EXECUTE
    JE advance_execute
    CMP AL, STAGE_DECODE
    JE advance_decode
    CMP AL, STAGE_FETCH
    JE advance_fetch
    JMP advance_next_slot

advance_fetch:
    ; Stage 0 (FETCH) → output DECODE line, advance to stage 1
    PUSH CX
    MOV AL, CL
    CALL DECODE_STAGE
    POP CX
    MOV DI, OFFSET PIPELINE_STATE
    ADD DI, CX
    MOV byte [DI], STAGE_DECODE
    JMP advance_next_slot

advance_decode:
    ; Stage 1 (DECODE) → check hazard, do EXECUTE (or stall), advance to stage 2
    ; Hazard detection: check if instruction reads a register that an
    ; earlier instruction in EXECUTE or MEMORY writes to.
    ; Demo hazard: I4 (SUB CX, AX) reads AX — I3 (ADD AX,BX) writes AX.
    ; When I4 at DECODE and I3 at EXECUTE or MEMORY → stall.
    PUSH CX
    CMP CL, 3                     ; Is this I4 (SUB CX, AX)?
    JNE ad_no_hazard
    MOV DI, OFFSET PIPELINE_STATE
    MOV AL, [DI + 2]              ; Stage of I3
    CMP AL, STAGE_EXECUTE
    JB ad_no_hazard
    CMP AL, STAGE_MEMORY
    JA ad_no_hazard
    ; Hazard found — stall I4
    MOV DI, OFFSET OUTPUT_BUF
    MOV SI, OFFSET STR_HAZARD_PFX
    CALL APPEND_STRING
    MOV AX, 4
    CALL APPEND_WORD_HEX
    MOV AL, ':'
    MOV [DI], AL
    INC DI
    MOV word [DI], 'AX'
    ADD DI, 2
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF
    MOV DI, OFFSET STALL_FLAGS
    ADD DI, CX
    MOV byte [DI], 1
    INC word [HAZARD_COUNT]
    ; Output stall
    MOV DI, OFFSET OUTPUT_BUF
    MOV SI, OFFSET STR_STALL_PFX
    CALL APPEND_STRING
    MOV AX, CX
    CALL APPEND_WORD_HEX
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF
    INC word [STALL_COUNT]
    POP CX
    JMP advance_next_slot
ad_no_hazard:
    ; No hazard — execute
    MOV AL, CL
    CALL EXECUTE_STAGE
    POP CX
    MOV DI, OFFSET PIPELINE_STATE
    ADD DI, CX
    MOV byte [DI], STAGE_EXECUTE
    JMP advance_next_slot

advance_execute:
    ; Stage 2 (EXECUTE) → output MEMORY line, advance to stage 3
    PUSH CX
    MOV AL, CL
    CALL MEMORY_STAGE
    POP CX
    MOV DI, OFFSET PIPELINE_STATE
    ADD DI, CX
    MOV byte [DI], STAGE_MEMORY
    JMP advance_next_slot

advance_memory:
    ; Stage 3 (MEMORY) → advance to stage 4 (WRITEBACK)
    MOV DI, OFFSET PIPELINE_STATE
    ADD DI, CX
    MOV byte [DI], STAGE_WB
    JMP advance_next_slot

advance_wb:
    ; Stage 4 (WRITEBACK) → commit register, output REGS, clear slot
    PUSH CX
    MOV AL, CL
    CALL WRITEBACK_STAGE
    POP CX
    JMP advance_next_slot

advance_stalled:
    ; Output stall message
    PUSH CX
    MOV DI, OFFSET OUTPUT_BUF
    MOV SI, OFFSET STR_STALL_PFX
    CALL APPEND_STRING
    MOV AX, CX
    CALL APPEND_WORD_HEX
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF
    ; Also output hazard message
    MOV DI, OFFSET OUTPUT_BUF
    MOV SI, OFFSET STR_HAZARD_PFX
    CALL APPEND_STRING
    MOV AX, CX
    CALL APPEND_WORD_HEX
    MOV AL, ':'
    MOV [DI], AL
    INC DI
    MOV word [DI], 'AX'
    ADD DI, 2
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF
    POP CX
    ; Clear stall flag after output
    MOV DI, OFFSET STALL_FLAGS
    ADD DI, CX
    MOV byte [DI], 0
    ; Don't advance this cycle
    JMP advance_next_slot

advance_next_slot_pop:
    POP CX
advance_next_slot:
    DEC CX
    JMP advance_loop

advance_done:
    ; Step 2: Fetch new instruction if available
    MOV AX, [INSTR_PTR]
    CMP AX, MAX_INSTR             ; All instructions fetched?
    JAE advance_no_fetch

    ; Find first empty slot
    XOR CX, CX
find_empty_loop:
    CMP CX, MAX_SLOTS
    JAE advance_no_fetch          ; No empty slot
    MOV DI, OFFSET PIPELINE_STATE
    ADD DI, CX
    MOV AL, [DI]
    CMP AL, STAGE_EMPTY
    JE find_empty_found
    INC CX
    JMP find_empty_loop

find_empty_found:
    ; Load instruction into empty slot
    MOV DI, OFFSET PIPELINE_STATE
    ADD DI, CX
    MOV byte [DI], STAGE_FETCH

    ; Output FETCH line
    PUSH CX
    MOV AL, CL
    CALL FETCH_STAGE
    POP CX

    ; Increment instruction pointer
    INC word [INSTR_PTR]

advance_no_fetch:
    ; Step 3: Output CYCLE summary
    ; "CYCLE:XXXXh"
    MOV DI, OFFSET OUTPUT_BUF
    MOV SI, OFFSET STR_CYCLE
    CALL APPEND_STRING
    MOV AX, [CYCLE_COUNT]
    CALL APPEND_WORD_HEX
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF

    RESTORE_REGS
    RET
ADVANCE_PIPELINE ENDP

;------------------------------------------------------------------------------
; PROC OPERATION_DISPATCHER
; PURPOSE:  Sets up INSTR_TABLE slots 8-10 for the selected operation mode
;           with the operand values, then resets pipeline and runs.
; INPUT:    OPERATION_MODE, OPERAND_A, OPERAND_B
; REGS MODIFIED: AX, BX, CX, DX, SI, DI
;------------------------------------------------------------------------------
OPERATION_DISPATCHER PROC
    SAVE_REGS

    ; Setup instruction table for operation mode
    ; Slot 8: MOV AX, OPERAND_A
    MOV DI, OFFSET INSTR_TABLE + 48   ; Slot 8 starts at byte 48
    MOV byte [DI], OPCODE_MOV         ; opcode = MOV
    MOV byte [DI+1], REG_NONE         ; src = none (immediate)
    MOV byte [DI+2], 0                ; dst = AX
    MOV AX, [OPERAND_A]
    MOV [DI+3], AX                    ; imm = OPERAND_A
    MOV byte [DI+5], 0                ; no memory

    ; Slot 9: MOV BX, OPERAND_B
    MOV DI, OFFSET INSTR_TABLE + 54   ; Slot 9 starts at byte 54
    MOV byte [DI], OPCODE_MOV
    MOV byte [DI+1], REG_NONE
    MOV byte [DI+2], 1                ; dst = BX
    MOV AX, [OPERAND_B]
    MOV [DI+3], AX
    MOV byte [DI+5], 0

    ; Slot 10: OP AX, BX
    MOV DI, OFFSET INSTR_TABLE + 60   ; Slot 10 starts at byte 60
    MOV AL, [OPERATION_MODE]
    CMP AL, MODE_ADD
    JE op_set_add
    CMP AL, MODE_SUB
    JE op_set_sub
    CMP AL, MODE_MUL
    JE op_set_mul
    CMP AL, MODE_DIV
    JE op_set_div
    JMP op_set_add                    ; Default to ADD

op_set_add:
    MOV byte [DI], OPCODE_ADD
    JMP op_set_regs
op_set_sub:
    MOV byte [DI], OPCODE_SUB
    JMP op_set_regs
op_set_mul:
    MOV byte [DI], OPCODE_MUL
    JMP op_set_regs
op_set_div:
    MOV byte [DI], OPCODE_DIV
    ; For DIV, check BX = 0
    MOV AX, [OPERAND_B]
    CMP AX, 0
    JNE op_set_regs
    PRINT_STRING STR_ERR_DBZ
    RESTORE_REGS
    RET

op_set_regs:
    MOV byte [DI+1], 1                ; src = BX
    MOV byte [DI+2], 0                ; dst = AX
    MOV word [DI+3], 0                ; no immediate
    MOV byte [DI+5], 0                ; no memory

    ; Also update mnemonics for display
    MOV DI, OFFSET INSTR_MNEM_TABLE + 128   ; Slot 8 mnemonic
    ; "MOV AX,XXXX$"
    MOV word [DI], 'MO'
    MOV word [DI+2], 'V '
    MOV word [DI+4], 'AX'
    MOV word [DI+6], ','
    MOV AX, [OPERAND_A]
    CALL HEX_DISPLAY
    MOV SI, OFFSET HEX_BUF
    MOV AL, [SI]
    MOV [DI+7], AL
    MOV AL, [SI+1]
    MOV [DI+8], AL
    MOV AL, [SI+2]
    MOV [DI+9], AL
    MOV AL, [SI+3]
    MOV [DI+10], AL
    MOV byte [DI+11], 'h'
    MOV byte [DI+12], ' '
    MOV byte [DI+13], ' '
    MOV byte [DI+14], ' '
    MOV byte [DI+15], '$'

    ; Slot 9 mnemonic
    MOV DI, OFFSET INSTR_MNEM_TABLE + 144   ; Slot 9
    MOV word [DI], 'MO'
    MOV word [DI+2], 'V '
    MOV word [DI+4], 'BX'
    MOV word [DI+6], ','
    MOV AX, [OPERAND_B]
    CALL HEX_DISPLAY
    MOV SI, OFFSET HEX_BUF
    MOV AL, [SI]
    MOV [DI+7], AL
    MOV AL, [SI+1]
    MOV [DI+8], AL
    MOV AL, [SI+2]
    MOV [DI+9], AL
    MOV AL, [SI+3]
    MOV [DI+10], AL
    MOV byte [DI+11], 'h'
    MOV byte [DI+12], ' '
    MOV byte [DI+13], ' '
    MOV byte [DI+14], ' '
    MOV byte [DI+15], '$'

    ; Slot 10 mnemonic
    MOV DI, OFFSET INSTR_MNEM_TABLE + 160   ; Slot 10
    MOV AL, [OPERATION_MODE]
    CMP AL, MODE_ADD
    JE op_mne_add
    CMP AL, MODE_SUB
    JE op_mne_sub
    CMP AL, MODE_MUL
    JE op_mne_mul
    CMP AL, MODE_DIV
    JE op_mne_div

op_mne_add:
    MOV word [DI], 'AD'
    MOV word [DI+2], 'D '
    JMP op_mne_rest
op_mne_sub:
    MOV word [DI], 'SU'
    MOV word [DI+2], 'B '
    JMP op_mne_rest
op_mne_mul:
    MOV word [DI], 'MU'
    MOV word [DI+2], 'L '
    JMP op_mne_rest
op_mne_div:
    MOV word [DI], 'DI'
    MOV word [DI+2], 'V '
    JMP op_mne_rest
op_mne_rest:
    MOV word [DI+4], 'AX'
    MOV word [DI+6], ','
    MOV word [DI+7], 'BX'
    MOV word [DI+9], ' '
    MOV word [DI+10], ' '
    MOV word [DI+11], ' '
    MOV word [DI+12], ' '
    MOV word [DI+13], ' '
    MOV word [DI+14], ' '
    MOV byte [DI+15], '$'

    RESTORE_REGS
    RET
OPERATION_DISPATCHER ENDP

;------------------------------------------------------------------------------
; PROC SPLASH_SCREEN
; PURPOSE:  Displays an ASCII-art splash screen with team info using INT 10h
;           video functions. Shows decorative border and waits for keypress.
; REGS MODIFIED: AX, BX, CX, DX
;------------------------------------------------------------------------------
SPLASH_SCREEN PROC
    SAVE_REGS

    ; Set video mode 03h (80×25 text, color)
    MOV AX, 0003h                 ; AH=00h, AL=03h
    INT 10h

    ; Set background color (dark blue)
    MOV AX, 0B00h                 ; AH=0Bh, BH=00h
    MOV BL, 01h                   ; Blue background
    INT 10h

    ; Draw top border with double-line characters
    MOV AX, 0900h                 ; AH=09h
    MOV BH, 0                     ; Page 0
    MOV BL, 0Ch                   ; Light red on black
    MOV CX, 1
    ; Top-left corner
    MOV AL, DB_DBL_TL
    INT 10h
    MOV AH, 02h
    MOV DX, 0000h
    INT 10h

    ; Wait for key using INT 21h
    MOV AH, 01h
    INT 21h

    ; Set video mode 03h again (clear screen)
    MOV AX, 0003h
    INT 10h

    ; Set background to black
    MOV AX, 0B00h
    MOV BL, 00h
    INT 10h

    RESTORE_REGS
    RET
SPLASH_SCREEN ENDP

;==============================================================================
; MAIN PROGRAM
;==============================================================================
START:
    ;--- Initialize segments for .COM format ---
    ; In .COM files, CS=DS=ES=SS, all point to same segment
    MOV AX, CS
    MOV DS, AX
    MOV ES, AX

    ; Initialize stack
    MOV AX, 0FF00h
    MOV SS, AX
    MOV SP, 0FFFEh

    ;--- Clear pipeline state ---
    MOV CX, MAX_SLOTS
    MOV DI, OFFSET PIPELINE_STATE
init_pipeline_clear:
    MOV byte [DI], STAGE_EMPTY
    INC DI
    LOOP init_pipeline_clear

    ;--- Clear stall flags ---
    MOV CX, MAX_SLOTS
    MOV DI, OFFSET STALL_FLAGS
init_stall_clear:
    MOV byte [DI], 0
    INC DI
    LOOP init_stall_clear

    ;--- Clear register snapshot ---
    MOV CX, 8
    MOV DI, OFFSET REG_SNAPSHOT
    XOR AX, AX
init_reg_clear:
    MOV [DI], AX
    INC DI
    INC DI
    LOOP init_reg_clear

    ; Initialize SP to FFEEh
    MOV word [REG_SNAPSHOT + 12], 0FFEEh

    ;--- Initialize variables ---
    MOV word [INSTR_PTR], 0
    MOV word [CYCLE_COUNT], 0
    MOV byte [AUTO_RUN], 0
    MOV word [STALL_COUNT], 0
    MOV word [HAZARD_COUNT], 0
    MOV word [INSTR_COMPLETED], 0
    MOV byte [QUIT_FLAG], 0
    MOV word [MEMORY_SIM], 0

    ;--- Parse command-line arguments from PSP ---
    ; PSP offset 80h = length, 81h = arguments
    MOV DI, 80h                   ; PSP segment, offset 80h
    ; In .COM, DS already points to PSP
    MOV AL, [DI]                  ; AL = argument length
    CMP AL, 0                     ; No arguments?
    JE start_demo                 ; Default to demo

    ; Parse first argument character (MODE)
    MOV DI, 81h
    MOV AL, [DI]
    CMP AL, 'A'
    JE start_mode_add
    CMP AL, 'a'
    JE start_mode_add
    CMP AL, 'S'
    JE start_mode_sub
    CMP AL, 's'
    JE start_mode_sub
    CMP AL, 'M'
    JE start_mode_mul
    CMP AL, 'm'
    JE start_mode_mul
    CMP AL, 'D'
    JE start_mode_div
    CMP AL, 'd'
    JE start_mode_div
    JMP start_demo                ; Default to demo

start_mode_add:
    MOV byte [OPERATION_MODE], MODE_ADD
    JMP parse_operands
start_mode_sub:
    MOV byte [OPERATION_MODE], MODE_SUB
    JMP parse_operands
start_mode_mul:
    MOV byte [OPERATION_MODE], MODE_MUL
    JMP parse_operands
start_mode_div:
    MOV byte [OPERATION_MODE], MODE_DIV
    JMP parse_operands

parse_operands:
    ; Parse two hex operands from command line
    ; Format: "A 0005 0003" or "A5 3"
    ; Skip past mode character and any spaces
    MOV DI, 82h                   ; Start of args after mode letter

    ; Skip spaces and find first operand
skip_spaces1:
    MOV AL, [DI]
    CMP AL, ' '
    JE skip_space1
    CMP AL, 0
    JE start_demo                 ; No operands, go demo
    CMP AL, 0Dh
    JE start_demo                 ; CR = end
    JMP parse_op1_start

skip_space1:
    INC DI
    JMP skip_spaces1

parse_op1_start:
    ; Parse first operand (hex number)
    PUSH DI
    CALL PARSE_HEX_WORD
    MOV [OPERAND_A], AX
    POP DI

    ; Find start of second operand
    ; DI points to AFTER the parsed number
    ; Skip to next space or end
skip_to_next:
    MOV AL, [DI]
    CMP AL, ' '
    JE found_next_start
    CMP AL, 0
    JE start_demo_done_parse
    CMP AL, 0Dh
    JE start_demo_done_parse
    INC DI
    JMP skip_to_next

found_next_start:
    INC DI                        ; Move past space
parse_op2:
    PUSH DI
    CALL PARSE_HEX_WORD
    MOV [OPERAND_B], AX
    POP DI

start_demo_done_parse:
    JMP start_begin

start_demo:
    MOV byte [OPERATION_MODE], MODE_DEMO

start_begin:
    ; --- Call SPLASH_SCREEN (commented out for mock/dev — enable for real EMU8086)
    ; CALL SPLASH_SCREEN

    ; --- Output READY line ---
    MOV DI, OFFSET OUTPUT_BUF
    MOV SI, OFFSET STR_READY
    CALL APPEND_STRING

    MOV AL, [OPERATION_MODE]
    CMP AL, MODE_DEMO
    JE ready_demo
    CMP AL, MODE_ADD
    JE ready_add
    CMP AL, MODE_SUB
    JE ready_sub
    CMP AL, MODE_MUL
    JE ready_mul
    CMP AL, MODE_DIV
    JE ready_div

ready_demo:
    MOV SI, OFFSET STR_DEMO
    CALL APPEND_STRING
    JMP ready_done

ready_add:
    MOV word [DI], 'AD'
    ADD DI, 2
    MOV word [DI], 'D'
    INC DI
    JMP ready_operands

ready_sub:
    MOV word [DI], 'SU'
    ADD DI, 2
    MOV word [DI], 'B'
    INC DI
    JMP ready_operands

ready_mul:
    MOV word [DI], 'MU'
    ADD DI, 2
    MOV word [DI], 'L'
    INC DI
    JMP ready_operands

ready_div:
    MOV word [DI], 'DI'
    ADD DI, 2
    MOV word [DI], 'V'
    INC DI
    JMP ready_operands

ready_operands:
    MOV SI, OFFSET STR_COMMA
    CALL APPEND_STRING
    MOV SI, OFFSET STR_A_EQ
    CALL APPEND_STRING
    MOV AX, [OPERAND_A]
    CALL APPEND_WORD_HEX
    MOV SI, OFFSET STR_B_EQ
    CALL APPEND_STRING
    MOV AX, [OPERAND_B]
    CALL APPEND_WORD_HEX

ready_done:
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF

    ;--- If operation mode, set up the instruction table ---
    MOV AL, [OPERATION_MODE]
    CMP AL, MODE_DEMO
    JE main_loop_start
    CALL OPERATION_DISPATCHER

main_loop_start:
    ;--- Main Pipeline Loop ---
main_loop:
    ; Check for quit
    MOV AL, [QUIT_FLAG]
    CMP AL, 1
    JE main_done

    ; Check keyboard
    CALL CHECK_KEYBOARD

    ; If auto-run, add delay
    MOV AL, [AUTO_RUN]
    CMP AL, 1
    JNE main_no_delay
    MOV CX, 0FFFFh
    CALL DELAY_LOOP

main_no_delay:
    ; Advance pipeline by one cycle
    CALL ADVANCE_PIPELINE

    ; Check if all instructions completed
    MOV AX, [INSTR_COMPLETED]
    CMP AX, 8                     ; All 8 (or 3 for ops) completed?
    JAE main_check_pipeline_empty

    JMP main_loop

main_check_pipeline_empty:
    ; Check if pipeline is empty (all slots are STAGE_EMPTY)
    MOV CX, MAX_SLOTS
    MOV DI, OFFSET PIPELINE_STATE
check_empty_loop:
    MOV AL, [DI]
    CMP AL, STAGE_EMPTY
    JNE main_loop                 ; Something still in pipeline
    INC DI
    LOOP check_empty_loop

    ; All done!

main_done:
    ; Output DONE line
    MOV DI, OFFSET OUTPUT_BUF
    MOV SI, OFFSET STR_DONE_PFX
    CALL APPEND_STRING
    MOV AX, [CYCLE_COUNT]
    CALL APPEND_WORD_HEX
    MOV byte [DI], '$'
    PRINT_STRING OUTPUT_BUF
    PRINT_CRLF

    ;--- Exit to DOS ---
exit_program:
    MOV AH, 4Ch
    INT 21h

;------------------------------------------------------------------------------
; PROC PARSE_HEX_WORD
; PURPOSE:  Parses a hex number from a string until non-hex character
; INPUT:    DS:DI = pointer to hex string (updated past the number)
; OUTPUT:   AX = parsed value, DI updated past hex characters
; REGS MODIFIED: AX, BX, DI
;------------------------------------------------------------------------------
PARSE_HEX_WORD PROC
    PUSH BX
    PUSH CX
    PUSH DX

    XOR AX, AX                    ; Result = 0
    MOV BX, 16                    ; Base 16

parse_loop:
    MOV CL, [DI]                  ; CL = next character
    CMP CL, '0'
    JB parse_done
    CMP CL, '9'
    JBE parse_digit
    CMP CL, 'A'
    JB parse_done
    CMP CL, 'F'
    JBE parse_hex_letter
    CMP CL, 'a'
    JB parse_done
    CMP CL, 'f'
    JBE parse_hex_lower
    JMP parse_done

parse_digit:
    SUB CL, '0'
    JMP parse_add

parse_hex_letter:
    SUB CL, 'A' - 10
    JMP parse_add

parse_hex_lower:
    SUB CL, 'a' - 10

parse_add:
    MUL BX                        ; AX = AX * 16
    XOR CH, CH
    ADD AX, CX                    ; AX = AX + digit
    INC DI
    JMP parse_loop

parse_done:
    POP DX
    POP CX
    POP BX
    RET
PARSE_HEX_WORD ENDP

;==============================================================================
; END OF PROGRAM
;==============================================================================
END START
