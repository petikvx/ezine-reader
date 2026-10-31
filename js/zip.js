// Minimal ZIP reader (stored + deflate). Everything stays in the browser.
export async function openZip(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip");
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const entries = [];
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = new TextDecoder("latin1").decode(u8.subarray(p + 46, p + 46 + nl));
    entries.push({ name, method, csize, size, off, enc: !!(flags & 1), dir: name.endsWith("/") });
    p += 46 + nl + el + cl;
  }
  return entries;
}
export async function extract(buf, e) {
  if (e.enc) throw new Error("encrypted");
  const dv = new DataView(buf);
  const start = e.off + 30 + dv.getUint16(e.off + 26, true) + dv.getUint16(e.off + 28, true);
  const raw = new Uint8Array(buf, start, e.csize);
  if (e.method === 0) return raw.slice();
  if (e.method === 8) {
    const ds = new DecompressionStream("deflate-raw");
    const res = new Response(new Blob([raw]).stream().pipeThrough(ds));
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new Error("unsupported method " + e.method);
}
