// CP437 decoding (bytes -> string) plus utf-8 sniffing.
const HI = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0";
const LOW = "\u0000☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼";
export function cp437(bytes, keepControls = false) {
  let out = [];
  const CH = 8192;
  for (let i = 0; i < bytes.length; i += CH) {
    let s = "";
    const end = Math.min(bytes.length, i + CH);
    for (let j = i; j < end; j++) {
      const b = bytes[j];
      if (b >= 128) s += HI[b - 128];
      else if (b >= 32 && b !== 127) s += String.fromCharCode(b);
      else if (b === 10 || b === 13 || b === 9 || b === 27) s += String.fromCharCode(b);
      else if (b === 127) s += "⌂";
      else s += keepControls ? LOW[b] : (b === 0 ? " " : LOW[b]);
    }
    out.push(s);
  }
  return out.join("");
}
export function decodeText(bytes) {
  let hi = false;
  for (let i = 0; i < Math.min(bytes.length, 65536); i++) if (bytes[i] > 127) { hi = true; break; }
  if (hi) { try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/\r\n?/g, "\n"); } catch (e) {} }
  return cp437(bytes).replace(/\r\n?/g, "\n").replace(/\x1a/g, "");
}
export { cp437 as decodeCp437 };
