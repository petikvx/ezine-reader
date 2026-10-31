// Tiny syntax highlighter. Input raw text; output safe HTML.
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const kw = s => new Set(s.split(" "));
const ASM_OPS = kw("mov push pop call ret retn retf jmp je jne jz jnz ja jae jb jbe jg jge jl jle jc jnc jo jno js jns jp jnp jcxz loop loope loopne add sub mul imul div idiv inc dec cmp test and or xor not neg shl shr sal sar rol ror rcl rcr lea xchg nop int iret into cli sti cld std lodsb lodsw lodsd stosb stosw stosd movsb movsw movsd scasb scasw scasd cmpsb cmpsw cmpsd rep repe repne repz repnz hlt cwd cdq cbw movzx movsx pushad popad pushf popf pushfd popfd enter leave in out bswap bt bts btr btc bsf bsr setz setnz sete setne xadd cmpxchg cpuid rdtsc sahf lahf clc stc cmc xlat lds les lgdt sgdt sidt lidt sldt str cmovz cmovnz cmove cmovne wait sysenter sysexit");
const ASM_REG = kw("eax ebx ecx edx esi edi ebp esp ax bx cx dx si di bp sp al ah bl bh cl ch dl dh cs ds es fs gs ss cr0 cr2 cr3 cr4 dr0 dr1 dr2 dr3 dr6 dr7");
const ASM_DIR = kw("db dw dd dq dt equ org end ends segment proc endp assume offset ptr byte word dword qword short near far dup struc struct macro endm include includelib invoke extrn public global extern .model .code .data .data? .stack .386 .386p .486 .586 .686 .if .else .elseif .endif .while .endw .repeat .until .const .startup .exit locals proc local uses addr");
const C_KW = kw("auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while class public private protected new delete template this operator virtual bool true false BYTE WORD DWORD HANDLE HWND LPVOID LPSTR");
const BAT_KW = kw("echo off on set if else goto call for in do pause exit cd md mkdir rd del copy move ren type cls rem path choice shift errorlevel exist not nul");

function lang(name) {
  const e = (name.split(".").pop() || "").toLowerCase();
  if (["asm", "inc", "mac", "s", "lst"].includes(e)) return "asm";
  if (["c", "h", "cpp", "hpp", "cc"].includes(e)) return "c";
  if (["bat", "cmd"].includes(e)) return "bat";
  if (["pas", "bas", "vbs", "pl", "php", "js", "sh"].includes(e)) return "c";
  return null;
}
export function languageOf(name) { return lang(name); }

function tokenize(line, L) {
  let out = "", i = 0;
  const w = (cls, s) => out += `<span class="${cls}">${esc(s)}</span>`;
  if (L === "bat") {
    const m = line.match(/^(\s*@?)(rem\b.*|::.*)$/i); if (m) { return esc(m[1]) + `<span class="tk-c">${esc(m[2])}</span>`; }
    if (/^\s*:\w/.test(line)) return `<span class="tk-l">${esc(line)}</span>`;
  }
  const re = L === "asm"
    ? /(;.*$)|("(?:[^"]*)"|'(?:[^']*)')|(\b(?:0x[0-9a-f]+|[0-9][0-9a-f]*h|[0-9]+)\b|\$)|([A-Za-z_.@?$][\w.@?$]*)|(\s+|.)/gi
    : /(\/\/.*$|\/\*.*?\*\/|\/\*.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b(?:0x[0-9a-f]+|[0-9]+)\b)|([A-Za-z_#][\w]*)|(\s+|.)/gi;
  let m, first = true;
  if (L === "asm") { const lm = line.match(/^([A-Za-z_@?$.][\w@?$.]*)(:{1,2})/); if (lm) { w("tk-l", lm[0]); i = lm[0].length; first = false; } }
  re.lastIndex = i;
  while ((m = re.exec(line))) {
    if (m[1]) w("tk-c", m[1]);
    else if (m[2]) w("tk-s", m[2]);
    else if (m[3]) w("tk-n", m[3]);
    else if (m[4]) {
      const t = m[4], lo = t.toLowerCase();
      if (L === "asm") {
        if (ASM_OPS.has(lo)) w("tk-k", t); else if (ASM_REG.has(lo)) w("tk-r", t); else if (ASM_DIR.has(lo)) w("tk-d", t);
        else if (/^(invoke|call)$/.test(lo)) w("tk-k", t); else out += esc(t);
      } else if (L === "bat") { if (BAT_KW.has(lo)) w("tk-k", t); else out += esc(t); }
      else { if (t[0] === "#") w("tk-d", t); else if (C_KW.has(t)) w("tk-k", t); else out += esc(t); }
    } else out += esc(m[5]);
    if (m[0] === "") re.lastIndex++;
  }
  return out;
}
export function highlight(text, name) {
  const L = lang(name);
  if (!L) return esc(text);
  return text.split("\n").map(l => tokenize(l, L)).join("\n");
}
// ANSI SGR -> HTML (for .ans files)
export function ansiToHtml(text) {
  const pal = ["#000", "#a00", "#0a0", "#a50", "#00a", "#a0a", "#0aa", "#aaa", "#555", "#f55", "#5f5", "#ff5", "#55f", "#f5f", "#5ff", "#fff"];
  let fg = 7, bg = 0, bold = false, out = "";
  const parts = text.split(/\x1b\[([0-9;]*)m/);
  const strip = s => esc(s.replace(/\x1b\[[0-9;?]*[A-Za-ln-z]/g, ""));
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) { if (parts[i]) out += `<span style="color:${pal[bold && fg < 8 ? fg + 8 : fg]};background:${pal[bg]}">${strip(parts[i])}</span>`; }
    else for (const c of (parts[i] || "0").split(";").map(Number)) {
      if (c === 0) { fg = 7; bg = 0; bold = false; } else if (c === 1) bold = true; else if (c === 22) bold = false;
      else if (c >= 30 && c <= 37) fg = c - 30; else if (c >= 40 && c <= 47) bg = c - 40;
      else if (c >= 90 && c <= 97) fg = c - 90 + 8;
    }
  }
  return out;
}
