// Demoscene-style intro: plasma + starfield + wobbling logo + copper bars + sine scroller (+ optional WebAudio chiptune).
const W = 320, H = 200;
const LOGO = ["█████  █████  █████ ", "   ██  ██ ██  ██ ██ ", " ███   █████  █████ ", "██     ╚═══██ ██ ██ ", "██████ █████  ██ ██ "];
const MSG = {
  en: "   ***  29A  ***   a read-only trip through the VX scene 1996-2005 ... issues 1 to 8 ... articles, source code, utilities ... nothing here is ever executed ... greetings to VirusBuster, Darkman, Benny, Ratter, Z0MBiE, Mental Driller, GriYo, Lord Julus, Bumblebee, Vecna, Super, Spanska, Mister Sandman, Billy Belcebu, Jacky Qwerty and everyone who ever wrote a decryptor in the dark ...   press ENTER   ",
  fr: "   ***  29A  ***   un voyage en lecture seule dans la scene VX 1996-2005 ... numeros 1 a 8 ... articles, sources, utilitaires ... rien ici n'est jamais execute ... greetings a VirusBuster, Darkman, Benny, Ratter, Z0MBiE, Mental Driller, GriYo, Lord Julus, Bumblebee, Vecna, Super, Spanska, Mister Sandman, Billy Belcebu, Jacky Qwerty et a tous ceux qui ont ecrit un decrypteur dans le noir ...   appuyez sur ENTREE   ",
};

function makeMusic() {
  let ac = null, timer = null, step = 0, nextT = 0, gain = null;
  const bpm = 138, sd = 60 / bpm / 4;
  const prog = [57, 53, 48, 55]; // A F C G roots (midi)
  const f = m => 440 * Math.pow(2, (m - 69) / 12);
  const note = (t, fr, d, type, vol) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = fr; o.connect(g); g.connect(gain);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.start(t); o.stop(t + d + .02);
  };
  const noise = (t, d, vol) => {
    const n = ac.sampleRate * d | 0, b = ac.createBuffer(1, n, ac.sampleRate), x = b.getChannelData(0);
    for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; s.connect(g); g.connect(gain);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.start(t);
  };
  const sched = () => {
    while (nextT < ac.currentTime + .25) {
      const bar = (step >> 4) & 3, root = prog[bar], s = step & 15;
      const chord = [0, 3, 7, 12]; // minor-ish arpeggio
      const third = (bar === 1 || bar === 2) ? 4 : 3;
      const arp = [0, third, 7, 12][s & 3] + (s & 8 ? 12 : 0);
      note(nextT, f(root + 12 + arp), sd * 1.6, "square", .06);
      if (s % 4 === 0) note(nextT, f(root - 12), sd * 3, "triangle", .22);
      if (s % 8 === 0) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, nextT); o.frequency.exponentialRampToValueAtTime(40, nextT + .12); o.connect(g); g.connect(gain); g.gain.setValueAtTime(.5, nextT); g.gain.exponentialRampToValueAtTime(.0001, nextT + .15); o.start(nextT); o.stop(nextT + .18); }
      if (s % 4 === 2) noise(nextT, .04, .08);
      nextT += sd; step++;
    }
  };
  return {
    get on() { return !!timer; },
    start() { ac ||= new (window.AudioContext || window.webkitAudioContext)(); gain ||= Object.assign(ac.createGain(), {}); gain.gain.value = .5; gain.connect(ac.destination); ac.resume(); nextT = ac.currentTime + .05; timer = setInterval(sched, 60); },
    stop() { clearInterval(timer); timer = null; try { gain.disconnect(); } catch (e) {} },
    close() { this.stop(); if (ac) ac.close(); },
  };
}

export function runIntro(lang, done) {
  const ov = document.createElement("div");
  ov.id = "intro"; ov.tabIndex = 0;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const hint = document.createElement("div"); hint.className = "hint";
  hint.textContent = lang === "fr" ? "[ENTRÉE] entrer · [M] musique" : "[ENTER] enter · [M] music";
  ov.append(cv, hint); document.body.append(ov); ov.focus();
  const ctx = cv.getContext("2d", { alpha: false });
  const img = ctx.createImageData(W, H), px = new Uint32Array(img.data.buffer);
  const music = makeMusic();
  // palette (plasma): 256 entries ABGR
  const pal = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = i / 256 * Math.PI * 2;
    const r = 128 + 127 * Math.sin(a), g = 128 + 127 * Math.sin(a + 2.1), b = 128 + 127 * Math.sin(a + 4.2);
    pal[i] = 0xff000000 | ((b * .55) << 16) | ((g * .55) << 8) | (r * .55);
  }
  const sintab = new Float32Array(1024); for (let i = 0; i < 1024; i++) sintab[i] = Math.sin(i / 1024 * Math.PI * 2);
  const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
  // logo offscreen
  const lg = document.createElement("canvas"); lg.width = W; lg.height = 64; const lc = lg.getContext("2d");
  lc.font = "bold 56px 'DejaVu Sans Mono', monospace"; lc.textAlign = "center"; lc.textBaseline = "middle";
  const msg = MSG[lang] || MSG.en;
  const sc = document.createElement("canvas"); sc.width = W; sc.height = 40; const scx = sc.getContext("2d");
  scx.font = "bold 22px 'DejaVu Sans Mono', monospace"; scx.textBaseline = "middle";
  const charW = scx.measureText("M").width;
  let raf = 0, t0 = performance.now(), ended = false;

  function frame(now) {
    const t = (now - t0) / 1000 + (+new URLSearchParams(location.search).get("introt") || 0);
    // plasma
    const p1 = t * 90, p2 = t * 60, p3 = t * 130;
    for (let y = 0; y < H; y++) {
      const sy = sintab[((y * 4 + p2) | 0) & 1023], base = (y * 3 + p1) | 0;
      for (let x = 0; x < W; x++) {
        const v = sintab[((x * 3 + p1) | 0) & 1023] + sy + sintab[((x + y) * 2 + p3 | 0) & 1023] + sintab[((Math.hypot(x - 160, y - 100) * 5) + p2 | 0) & 1023];
        px[y * W + x] = pal[((v * 32 + 128 + t * 20) | 0) & 255];
      }
    }
    ctx.putImageData(img, 0, 0);
    // dim background a bit for contrast
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(0, 0, W, H);
    // stars
    for (const s of stars) {
      s.z -= .006; if (s.z <= .02) { s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; s.z = 1; }
      const sx = 160 + s.x / s.z * 40, sy = 100 + s.y / s.z * 30;
      if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
      const c = 255 - s.z * 190 | 0; ctx.fillStyle = `rgb(${c},${c},${c})`; ctx.fillRect(sx | 0, sy | 0, s.z < .4 ? 2 : 1, 1);
    }
    // copper bars
    for (let b = 0; b < 4; b++) {
      const cy = 100 + Math.sin(t * 1.3 + b * .9) * 70;
      for (let k = -8; k <= 8; k++) {
        const i = 1 - Math.abs(k) / 9, hue = (b * 90 + t * 40) % 360;
        ctx.fillStyle = `hsla(${hue},100%,${25 + i * 55}%,${.55})`; ctx.fillRect(0, (cy + k) | 0, W, 1);
      }
    }
    // wobbling logo
    lc.clearRect(0, 0, lg.width, lg.height);
    const grad = lc.createLinearGradient(0, 0, 0, 64); grad.addColorStop(0, "#fff"); grad.addColorStop(.5, "#9ff"); grad.addColorStop(1, "#38f");
    lc.fillStyle = grad; lc.fillText("29A", 160, 34);
    lc.strokeStyle = "#014"; lc.lineWidth = 1.5; lc.strokeText("29A", 160, 34);
    const logoY = 30 + Math.sin(t * 2) * 6, zoom = 1 + Math.sin(t * 1.5) * .12;
    for (let y = 0; y < 64; y++) {
      const dx = Math.sin(t * 3 + y * .12) * (3 + 3 * Math.sin(t * .7));
      ctx.drawImage(lg, 0, y, W, 1, dx + (1 - zoom) * 160, logoY + y * zoom, W * zoom, zoom + .5);
    }
    // subtitle
    ctx.font = "bold 10px 'DejaVu Sans Mono', monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#fff";
    ctx.fillText("t w e n t y   n i n e   a", 160 + Math.sin(t * 2) * 4, 118 + Math.sin(t * 2) * 6);
    // sine scroller
    const off = (t * 70) % (charW * msg.length);
    ctx.font = "bold 20px 'DejaVu Sans Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const first = Math.floor(off / charW);
    for (let i = 0; i < W / charW + 2; i++) {
      const ch = msg[(first + i) % msg.length], x = i * charW - (off % charW);
      const y = 168 + Math.sin(x * .035 + t * 4) * 14;
      ctx.fillStyle = "#000"; ctx.fillText(ch, x + 1, y + 1);
      ctx.fillStyle = `hsl(${(x * 1.2 + t * 120) % 360},100%,70%)`; ctx.fillText(ch, x, y);
    }
    // fade-in
    if (t < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - t})`; ctx.fillRect(0, 0, W, H); }
    raf = requestAnimationFrame(frame);
  }
  function end() {
    if (ended) return; ended = true; cancelAnimationFrame(raf); music.close();
    document.removeEventListener("keydown", onKey, true); ov.classList.add("out");
    setTimeout(() => { ov.remove(); done && done(); }, 350);
  }
  function onKey(e) {
    if (e.key === "m" || e.key === "M") { music.on ? music.stop() : music.start(); e.preventDefault(); e.stopPropagation(); }
    else if (["Enter", " ", "Escape"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); end(); }
  }
  document.addEventListener("keydown", onKey, true);
  ov.addEventListener("click", e => { if (e.target === hint || e.target === cv || e.target === ov) end(); });
  raf = requestAnimationFrame(frame);
  return end;
}
