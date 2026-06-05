; ═══════════════════════════════════════════════════════════════════
; macros.inc — CPU Pipeline Visualizer
; COAL Spring 2026 — Air University BSCS
; ═══════════════════════════════════════════════════════════════════

; ── PUSH_ALL / POP_ALL ────────────────────────────────────────────
PUSH_ALL MACRO
    PUSH AX
    PUSH BX
    PUSH CX
    PUSH DX
    PUSH SI
    PUSH DI
ENDM

POP_ALL MACRO
    POP DI
    POP SI
    POP DX
    POP CX
    POP BX
    POP AX
ENDM

; ── PRINT_STRING ──────────────────────────────────────────────────
PRINT_STRING MACRO str_label
    LEA DX, str_label
    MOV AH, 09h
    INT 21h
ENDM

; ── GOTOXY ────────────────────────────────────────────────────────
GOTOXY MACRO col_val, row_val
    MOV AH, 02h
    MOV BH, 00h
    MOV DH, row_val
    MOV DL, col_val
    INT 10h
ENDM

; ── WRITE_CHAR_ATTR ───────────────────────────────────────────────
WRITE_CHAR_ATTR MACRO char_val, attr_val, rep_count
    MOV AH, 09h
    MOV AL, char_val
    MOV BH, 00h
    MOV BL, attr_val
    MOV CX, rep_count
    INT 10h
ENDM

; ── APPEND_CHAR ───────────────────────────────────────────────────
APPEND_CHAR MACRO
    PUSH SI
    MOV SI, json_ptr
    MOV [json_buf + SI], AL
    INC SI
    MOV json_ptr, SI
    INC json_len
    POP SI
ENDM

; ── APPEND_STR ────────────────────────────────────────────────────
APPEND_STR MACRO str_label
    LEA SI, str_label
    CALL APPEND_STR_SI
ENDM

; ── APPEND_QUOTED_STR ─────────────────────────────────────────────
APPEND_QUOTED_STR MACRO str_label
    MOV AL, '"'
    APPEND_CHAR
    APPEND_STR str_label
    MOV AL, '"'
    APPEND_CHAR
ENDM

; ── APPEND_COMMA ──────────────────────────────────────────────────
APPEND_COMMA MACRO
    MOV AL, ','
    APPEND_CHAR
ENDM

; ── APPEND_COLON ─────────────────────────────────────────────────
APPEND_COLON MACRO
    MOV AL, ':'
    APPEND_CHAR
ENDM

; ── CRLF ──────────────────────────────────────────────────────────
CRLF MACRO
    MOV AL, 0Dh
    APPEND_CHAR
    MOV AL, 0Ah
    APPEND_CHAR
ENDM

; ── DRAW_BOX ──────────────────────────────────────────────────────
DRAW_BOX MACRO top_r, left_c, w, h, attr
    MOV BH, top_r
    MOV BL, left_c
    MOV DH, h
    MOV DL, w
    MOV AL, 0DBh
    CALL FILL_RECT
ENDM

; ── CHECK_SIM_DONE ────────────────────────────────────────────────
CHECK_SIM_DONE MACRO
    CMP sim_complete, 1
ENDM

; ── SET_CURSOR ────────────────────────────────────────────────────
SET_CURSOR MACRO col, row
    MOV AH, 02h
    MOV BH, 00h
    MOV DH, row
    MOV DL, col
    INT 10h
ENDM
