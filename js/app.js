import { STR } from "./i18n.js";
import { decodeText, cp437 } from "./cp437.js";
import { highlight, languageOf, ansiToHtml } from "./highlight.js";
import { runIntro } from "./intro.js";
import { openZip, extract } from "./zip.js";

const $ = s => document.querySelector(s);
const view = $("#view");
const S = { cat: null, files: {}, search: null, lang: localStorage.lang || (navigator.language || "en").startsWith("fr") ? "fr" : "en", theme: localStorage.theme || "vga", crt: localStorage.crt !== "0", font: +(localStorage.font || 16) };
if (localStorage.lang) S.lang = localStorage.lang;
const t = k => STR[S.lang][k] || STR.en[k] || k;

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const rawUrl = p => "raw/" + p.split("/").map(encodeURIComponent).join("/");
const enc = p => p.split("/").map(encodeURIComponent).join("/");
const fmtSize = n => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB";
const secLabel = (s) => {
  const k = s.key;
  if (k === "editorial") return t("editorial"); if (k === "articles") return t("articles"); if (k === "utilities") return t("utilities"); if (k === "interviews") return t("interviews");
  if (k.startsWith("viruses")) return s.name.replace(/^Viruses/, t("viruses"));
  return s.name;
};
const json = async u => (await fetch(u)).json();
const NAMES = {};
async function getCat() { if (!S.cat) { S.cat = await json("data/catalog.json"); S.cat.issues.forEach(i => NAMES[i.id] = i.name); } return S.cat; }
async function getFiles(id) { return S.files[id] ||= await json(`data/files-${id}.json`); }
const issueName = i => NAMES[i] || i;
const setStatus = (l, r) => { $("#st-left").textContent = l || ""; $("#st-right").textContent = r || t("keys"); };

// ---------- UI chrome ----------
function applyChrome() {
  document.body.className = "theme-" + S.theme + (S.crt ? " crt" : "");
  document.documentElement.lang = S.lang;
  document.documentElement.style.setProperty("--fs", S.font + "px");
  $("#q").placeholder = t("search");
  $("#btn-lang").textContent = S.lang.toUpperCase();
  $("#btn-theme").textContent = "◐ " + S.theme;
  $("#btn-crt").textContent = S.crt ? t("crtOn") : t("crtOff");
  localStorage.lang = S.lang; localStorage.theme = S.theme; localStorage.crt = S.crt ? "1" : "0"; localStorage.font = S.font;
}
$("#btn-intro").onclick = () => runIntro(S.lang);
$("#btn-lang").onclick = () => { S.lang = S.lang === "fr" ? "en" : "fr"; applyChrome(); route(); };
$("#btn-theme").onclick = () => { const T = ["vga", "green", "amber", "blue"]; S.theme = T[(T.indexOf(S.theme) + 1) % T.length]; applyChrome(); };
$("#btn-crt").onclick = () => { S.crt = !S.crt; applyChrome(); };
$("#btn-font-").onclick = () => { S.font = Math.max(9, S.font - 1); applyChrome(); };
$("#btn-font\\+").onclick = () => { S.font = Math.min(32, S.font + 1); applyChrome(); };
$("#searchform").onsubmit = e => { e.preventDefault(); const q = $("#q").value.trim(); if (q) location.hash = "#/search/" + encodeURIComponent(q); };

// ---------- pages ----------
const LOGO = ` _______   _______   _______
|   _   | |   _   | |   _   |
|___|   | |   |   | |   |   |
 /  ___/  |____   | |   _   |
|   |   | |   |   | |   |   |
|_______| |_______| |___|___|`;

// The original FILE_ID.DIZ art of #3 is hard to read at card size; use a clean banner on the card only (the issue page keeps the original).
const CARD_ART = { "3": ` _______   _______   _______
|   _   | |   _   | |   _   |
|___|   | |   |   | |   |   |
 /  ___/  |____   | |   _   |
|   |   | |   |   | |   |   |
|_______| |_______| |___|___|

 [twenty nine a - issue three]
 DOS, Win9x, Win32, UNIX, VxD,
 polymorphic, metamorphic, ECC...` };

async function pageLibrary() {
  const cat = await getCat();
  const frag = [h("p", { class: "tag" }, t("tagline"))];
  for (const ez of cat.ezines) {
    const list = h("div", { class: "issues" });
    for (const is of cat.issues.filter(i => i.ezine === ez.id)) {
      const n = is.sections.filter(s => ["editorial", "articles", "interviews"].includes(s.key)).reduce((a, s) => a + s.items.length, 0);
      list.append(h("a", { class: "card", href: "#/issue/" + is.id },
        h("pre", { class: "art" }, CARD_ART[is.id] || is.diz.split("\n").slice(0, 10).join("\n").replace(/\s+$/, "") || is.name),
        h("div", { class: "meta" }, h("b", {}, is.name), " · " + is.year, h("br"), n + " " + t("items") + " · " + is.fileCount + " " + t("filesN"))));
    }
    frag.push(ez.id === "29a" ? h("pre", { class: "logo" }, LOGO) : h("h2", { class: "ezhead" }, "░▒▓ " + ez.name), list);
  }
  view.replaceChildren(...frag);
  setStatus(cat.issues.length + " " + t("issue").toLowerCase() + "s");
}

async function pageIssue(id) {
  const cat = await getCat(); const is = cat.issues.find(i => i.id === id);
  if (!is) return notFound();
  const frag = [h("div", { class: "crumb" }, h("a", { href: "#/" }, t("library")), " ▸ ", issueName(id)),
    h("pre", { class: "art" }, is.diz.replace(/\s+$/, "")),
    h("p", {}, h("a", { class: "btn", href: `#/files/${id}/` }, "▒ " + t("files") + " (" + is.fileCount + ")"))];
  for (const s of is.sections) {
    if (s.key.startsWith("viruses:") || s.key === "viruses") continue;
    frag.push(sectionBlock(is, s));
  }
  const vir = is.sections.filter(s => s.key.startsWith("viruses"));
  if (vir.length) {
    frag.push(h("h2", {}, "░▒▓ " + t("viruses")));
    for (const s of vir) frag.push(sectionBlock(is, s, true));
  }
  view.replaceChildren(...frag);
  setStatus(issueName(id));
}
function itemHref(is, s, it, i) {
  const q = `?i=${is.id}&s=${encodeURIComponent(s.key)}&n=${i}`;
  if (it.k === "dir") return it.main ? `#/read/${enc(it.main)}${q}&d=${encodeURIComponent(it.p)}` : `#/files/${is.id}/${enc(it.p.slice(is.folder.length + 1))}`;
  return `#/read/${enc(it.p)}${q}`;
}
function sectionBlock(is, s, collapsed) {
  const body = h("ol", { class: "toc" });
  s.items.forEach((it, i) => {
    body.append(h("li", {}, h("a", { href: itemHref(is, s, it, i) }, h("span", { class: "tt" }, it.t || it.p), it.a ? h("span", { class: "au" }, it.a) : null,
      h("span", { class: "sz" }, it.k === "dir" ? it.n + " " + t("filesN") : fmtSize(it.size)))));
  });
  const d = h("details", { class: "sec" }, h("summary", {}, secLabel(s) + " ", h("span", { class: "dim" }, "[" + s.items.length + "]")), body);
  if (!collapsed) d.open = true;
  return d;
}

function notFound() { view.replaceChildren(h("p", {}, "404")); }

// ---------- reader ----------
function isBinaryBytes(u8) {
  const n = Math.min(u8.length, 4096); if (!n) return false;
  if (u8[0] === 0x4d && u8[1] === 0x5a) return true; if (u8[0] === 0x50 && u8[1] === 0x4b) return true;
  let bad = 0; for (let i = 0; i < n; i++) { const b = u8[i]; if (b === 0 || (b < 32 && b !== 9 && b !== 10 && b !== 13 && b !== 27 && b !== 12 && b !== 26)) bad++; }
  return bad / n > 0.02;
}
function hexdump(u8, max = 256 * 1024) {
  const len = Math.min(u8.length, max); const lines = [];
  for (let o = 0; o < len; o += 16) {
    const row = u8.subarray(o, Math.min(o + 16, len));
    let hx = ""; for (let i = 0; i < 16; i++) hx += (i < row.length ? row[i].toString(16).padStart(2, "0") : "  ") + (i === 7 ? "  " : " ");
    let as = ""; for (const b of row) as += b >= 32 && b < 127 ? String.fromCharCode(b) : (b > 127 ? cp437([b]) : "·");
    lines.push(o.toString(16).padStart(8, "0") + "  " + hx + " │" + as + "│");
  }
  return lines.join("\n") + (u8.length > max ? "\n" + t("truncated") : "");
}
function htmlToText(src) {
  const doc = new DOMParser().parseFromString(src, "text/html");
  doc.querySelectorAll("script,style,head").forEach(n => n.remove());
  doc.querySelectorAll("br").forEach(n => n.replaceWith("\u0001"));
  doc.querySelectorAll("p,div,tr,li,h1,h2,h3,h4,h5,h6,table,hr").forEach(n => { n.prepend("\u0001"); n.append("\u0001"); });
  doc.querySelectorAll("img").forEach(n => n.replaceWith(n.alt ? `[${n.alt}]` : ""));
  const pre = new Set([...doc.querySelectorAll("pre")]);
  const out = []; const walk = (n, inPre) => { for (const c of n.childNodes) { if (c.nodeType === 3) out.push(inPre ? c.nodeValue : c.nodeValue.replace(/\s+/g, " ")); else if (c.nodeType === 1) { walk(c, inPre || pre.has(c)); } } };
  walk(doc.body || doc, false);
  return out.join("").replace(/\u00a0/g, " ").replace(/\u0001/g, "\n").replace(/[ \t]*\n[ \t]*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function highlightHits(text, name, terms) {
  const lines = text.split("\n"); const re = new RegExp(terms.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");
  const lang = languageOf(name);
  const frag = document.createDocumentFragment(); let first = null;
  const chunk = []; let buf = [];
  const flush = () => { if (buf.length) { const pre = h("pre", { class: "txt" }); pre.innerHTML = buf.join("\n") + "\n"; frag.append(pre); buf = []; } };
  for (const l of lines) {
    if (re.test(l)) {
      flush();
      const row = h("pre", { class: "txt hit" }); 
      if (lang) row.innerHTML = highlight(l, name);
      else row.innerHTML = esc(l).replace(new RegExp(terms.map(x => esc(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi"), m => `<mark>${m}</mark>`);
      frag.append(row); first ||= row;
    } else buf.push(highlight(l, name));
  }
  flush(); return { frag, first };
}

async function renderBytes(name, u8, params, extra) {
  const wrap = h("div", { class: "reader" });
  const ext = name.split(".").pop().toLowerCase();
  if (/^(png|gif|jpe?g|bmp)$/.test(ext)) {
    wrap.append(h("img", { class: "pic", src: URL.createObjectURL(new Blob([u8])), alt: name })); return wrap;
  }
  if (ext === "zip" || (u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 3)) return null; // handled by caller
  if (isBinaryBytes(u8) || /^(exe|com|dll|sys|bin|ovl|vxd|dat|raw|mp3|ocx)$/.test(ext)) {
    wrap.append(h("p", { class: "note" }, t("binary")), h("pre", { class: "txt hex" }, hexdump(u8)));
    return wrap;
  }
  let text, isHtml = /^html?$/.test(ext);
  if (isHtml) { try { text = new TextDecoder("utf-8", { fatal: true }).decode(u8); } catch (e) { text = new TextDecoder("windows-1252").decode(u8); } text = htmlToText(text); }
  else text = decodeText(u8);
  const terms = (params.get("hl") || "").split(/\s+/).filter(Boolean);
  if (terms.length) {
    const { frag, first } = highlightHits(text, name, terms); wrap.append(frag);
    wrap._scroll = first;
  } else if (ext === "ans") {
    const pre = h("pre", { class: "txt ans" }); pre.innerHTML = ansiToHtml(text); wrap.append(pre);
  } else {
    const pre = h("pre", { class: isHtml ? "txt wrap" : "txt" }); pre.innerHTML = highlight(text, isHtml ? "x.txt" : name) + "\n"; wrap.append(pre);
  }
  return wrap;
}

async function pageRead(path, params) {
  view.replaceChildren(h("p", { class: "dim" }, t("loading")));
  const cat = await getCat();
  const folderIssue = (await getCat()).issues.find(i => path.startsWith(i.folder + "/"));
  const iid = params.get("i") || (folderIssue && folderIssue.id), skey = params.get("s"), n = params.get("n") != null ? +params.get("n") : null;
  const is = cat.issues.find(i => i.id === iid); const sec = is && is.sections.find(s => s.key === skey);
  const name = path.split("/").pop();
  const res = await fetch(rawUrl(path)); if (!res.ok) return notFound();
  const u8 = new Uint8Array(await res.arrayBuffer());
  const bar = h("div", { class: "crumb" });
  bar.append(h("a", { href: "#/" }, t("library")));
  if (is) bar.append(" ▸ ", h("a", { href: "#/issue/" + is.id }, issueName(is.id)));
  if (sec) bar.append(" ▸ ", secLabel(sec));
  const item = sec && n != null ? sec.items[n] : null;
  const title = item ? item.t : name;
  const fileDir = path.split("/").slice(0, -1).join("/");
  const act = h("div", { class: "actions" },
    h("a", { class: "btn", href: folderIssue ? `#/files/${folderIssue.id}/${enc(fileDir.slice(folderIssue.folder.length + 1))}` : "#/" }, "▒ " + t("fileTree")),
    h("a", { class: "btn", href: rawUrl(path), download: name, onclick: e => { if (!confirm(t("warn"))) e.preventDefault(); } }, "↓ " + t("download") + " (" + fmtSize(u8.length) + ")"));
  if (sec && n != null) {
    const mk = (d, lbl) => { const j = n + d; const o = sec.items[j]; return o ? h("a", { class: "btn", href: itemHref(is, sec, o, j) }, lbl) : null; };
    act.prepend(mk(-1, "◄ " + t("prev")), mk(1, t("next") + " ►"));
    window._nav = { prev: sec.items[n - 1] && itemHref(is, sec, sec.items[n - 1], n - 1), next: sec.items[n + 1] && itemHref(is, sec, sec.items[n + 1], n + 1) };
  } else window._nav = {};
  const head = [bar, h("h2", { class: "doc" }, title, item && item.a ? h("span", { class: "au" }, " — " + item.a) : null), act];
  let body = await renderBytes(name, u8, params);
  if (!body) body = await renderZip(path, u8.buffer, params);
  view.replaceChildren(...head, body);
  if (body._scroll) body._scroll.scrollIntoView({ block: "center" }); else window.scrollTo(0, 0);
  setStatus(path, fmtSize(u8.length));
}

async function renderZip(path, buf, params) {
  const wrap = h("div", { class: "reader" });
  let entries;
  try { entries = await openZip(buf); } catch (e) { wrap.append(h("p", {}, "ZIP: " + e.message)); return wrap; }
  const m = params.get("m");
  wrap.append(h("p", { class: "note" }, t("zipOf") + " — " + entries.length + " " + t("filesN")));
  if (m != null) {
    const e = entries.find(x => x.name === m);
    try {
      const data = await extract(buf, e);
      const sub = await renderBytes(e.name.split("/").pop(), data, new URLSearchParams());
      wrap.append(h("h3", {}, e.name), sub || h("p", {}, "nested zip"));
    } catch (err) { wrap.append(h("p", { class: "err" }, t("unsupported"))); }
    wrap.append(h("p", {}, h("a", { class: "btn", href: `#/read/${enc(path)}` }, "◄ " + t("back"))));
    return wrap;
  }
  const ul = h("ul", { class: "files" });
  for (const e of entries) {
    if (e.dir) continue;
    ul.append(h("li", {}, h("a", { href: `#/read/${enc(path)}?m=${encodeURIComponent(e.name)}` }, (e.enc ? "⚿ " : "") + e.name), h("span", { class: "sz" }, fmtSize(e.size))));
  }
  wrap.append(ul); return wrap;
}

// ---------- file explorer ----------
async function pageFiles(id, dir) {
  const cat = await getCat(); const is = cat.issues.find(i => i.id === id); if (!is) return notFound();
  const files = await getFiles(id);
  const prefix = is.folder + "/" + (dir ? dir.replace(/\/?$/, "/") : "");
  const dirs = new Map(), here = [];
  for (const [p, size, ty] of files) {
    if (!p.startsWith(prefix)) continue;
    const rest = p.slice(prefix.length); const i = rest.indexOf("/");
    if (i < 0) here.push({ name: rest, p, size, ty }); else { const d = rest.slice(0, i); const o = dirs.get(d) || { n: 0, size: 0 }; o.n++; o.size += size; dirs.set(d, o); }
  }
  const crumb = h("div", { class: "crumb" }, h("a", { href: "#/" }, t("library")), " ▸ ", h("a", { href: "#/issue/" + id }, issueName(id)), " ▸ ", h("a", { href: `#/files/${id}/` }, is.folder));
  let acc = ""; for (const seg of dir.split("/").filter(Boolean)) { acc += seg + "/"; crumb.append(" / ", h("a", { href: `#/files/${id}/${enc(acc)}` }, seg)); }
  const ul = h("ul", { class: "files" });
  if (dir) { const up = dir.replace(/\/?[^/]*\/?$/, ""); ul.append(h("li", { class: "dirent" }, h("a", { href: `#/files/${id}/${enc(up ? up + "/" : "")}` }, "↰ .."))); }
  for (const [d, o] of [...dirs].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })))
    ul.append(h("li", { class: "dirent" }, h("a", { href: `#/files/${id}/${enc(dir ? dir.replace(/\/?$/, "/") + d + "/" : d + "/")}` }, "▸ " + d + "/"), h("span", { class: "sz" }, o.n + " " + t("filesN") + " · " + fmtSize(o.size))));
  for (const f of here.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })))
    ul.append(h("li", { class: f.ty === "t" ? "txtf" : "binf" }, h("a", { href: `#/read/${enc(f.p)}?i=${id}` }, (f.ty === "t" ? "≡ " : "▪ ") + f.name), h("span", { class: "sz" }, fmtSize(f.size))));
  view.replaceChildren(crumb, h("h2", {}, "░▒▓ " + t("files")), ul);
  setStatus(prefix, here.length + dirs.size + "");
}

// ---------- search ----------
async function pageSearch(q) {
  $("#q").value = q;
  view.replaceChildren(h("p", { class: "dim" }, t("searching")));
  if (!S.search) { S.search = (await json("data/search.json")); S.search.forEach(d => d.l = d.x.toLowerCase()); }
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const res = [];
  for (const d of S.search) {
    let ok = true, score = 0;
    for (const w of terms) { const c = d.l.split(w).length - 1; if (!c) { ok = false; break; } score += c; }
    if (ok) res.push({ d, score: score + (terms.some(w => d.t.toLowerCase().includes(w)) ? 1000 : 0) });
  }
  res.sort((a, b) => b.score - a.score);
  const cat = await getCat();
  const out = h("div", { class: "results" });
  for (const { d, score } of res.slice(0, 150)) {
    const i = d.l.indexOf(terms[0]); const s = Math.max(0, i - 80), e = Math.min(d.x.length, i + 160);
    const snip = d.x.slice(s, e).replace(/\s+/g, " ");
    const is = cat.issues.find(x => x.id === d.i); const sec = is.sections.find(x => x.key === d.s);
    const idx = sec ? sec.items.findIndex(x => x.p === d.p || x.main === d.p) : -1;
    const href = `#/read/${enc(d.p)}?i=${d.i}&s=${encodeURIComponent(d.s)}${idx >= 0 ? "&n=" + idx : ""}&hl=${encodeURIComponent(terms.join(" "))}`;
    const sn = h("div", { class: "snip" }); sn.innerHTML = esc(snip).replace(new RegExp(terms.map(x => esc(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi"), m => `<mark>${m}</mark>`);
    out.append(h("a", { class: "res", href }, h("b", {}, d.t), h("span", { class: "dim" }, "  " + issueName(d.i) + " · " + secLabel({ key: d.s, name: d.s }) + " · " + score + " " + (score === 1 ? t("hit1") : t("hits"))), sn));
  }
  view.replaceChildren(h("h2", {}, "░▒▓ " + t("results") + ": " + res.length + " — “" + q + "”"), res.length ? out : h("p", {}, t("noresults")));
  setStatus(res.length + " " + t("results"));
}

// ---------- router ----------
async function route() {
  window._nav = {};
  const raw = location.hash.slice(1) || "/";
  const [pathPart, qs] = raw.split("?"); const params = new URLSearchParams(qs || "");
  const seg = pathPart.split("/").slice(1).map(decodeURIComponent);
  try {
    if (!seg[0]) await pageLibrary();
    else if (seg[0] === "issue") await pageIssue(seg[1]);
    else if (seg[0] === "read") await pageRead(seg.slice(1).join("/"), params);
    else if (seg[0] === "files") await pageFiles(seg[1], seg.slice(2).join("/").replace(/\/$/, ""));
    else if (seg[0] === "search") await pageSearch(seg.slice(1).join("/"));
    else notFound();
  } catch (err) { console.error(err); view.replaceChildren(h("pre", { class: "err" }, String(err))); }
}
window.addEventListener("hashchange", route);
document.addEventListener("keydown", e => {
  const inInput = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if (e.key === "/" && !inInput) { e.preventDefault(); $("#q").focus(); $("#q").select(); return; }
  if (e.key === "Escape") { if (inInput) document.activeElement.blur(); else history.back(); return; }
  if (inInput || e.ctrlKey || e.metaKey) return;
  if (e.key === "[" && window._nav.prev) location.hash = window._nav.prev;
  else if (e.key === "]" && window._nav.next) location.hash = window._nav.next;
  else if (e.key === "j") window.scrollBy(0, 48); else if (e.key === "k") window.scrollBy(0, -48);
});
applyChrome(); route();
if (!sessionStorage.introSeen && !location.search.includes("nointro") && !matchMedia("(prefers-reduced-motion: reduce)").matches && !location.hash.startsWith("#/read")) { sessionStorage.introSeen = "1"; runIntro(S.lang); }
