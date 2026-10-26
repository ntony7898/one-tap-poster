// poster.js — deterministic poster engine. render(ctx, spec) draws a 1080x1920 poster.
// spec = { t: text, s: styleId, seed: int, pal: -1|0..3 (palette, -1 = from seed), mix: 1|0 (shuffle layout) }
(function () {
const W = 1080, H = 1920, M = 72;
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;
const graphemes = s => seg ? [...seg.segment(s)].map(x => x.segment) : Array.from(s);
const pick = (r, a) => a[Math.floor(r() * a.length)];
const font = (s, fam) => `${s}px "${fam}"`;

// ---------- text fitting ----------
function wrap(ctx, words, maxW) { const L = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (!cur || ctx.measureText(t).width <= maxW) cur = t; else { L.push(cur); cur = w; } } if (cur) L.push(cur); return L; }
function fit(ctx, text, fam, maxW, maxH, o = {}) {
  const lh = o.lh || 0.92, maxS = o.max || 560, minS = o.min || 26, maxLines = o.maxLines || 9;
  ctx.font = font(100, fam);
  const asc = ctx.measureText('HÉ').actualBoundingBoxAscent / 100 || 0.8;
  const desc = /[gjpqy,;]/.test(text) || /[^\x00-\u024f]/.test(text) ? Math.max(0.12, (ctx.measureText('gjpqy').actualBoundingBoxDescent || 20) / 100) : 0.04;
  let words = text.split(/\s+/).filter(Boolean); if (!words.length) words = ['…'];
  const tryS = (s, ws) => { ctx.font = font(s, fam); const L = wrap(ctx, ws, maxW); return L.length <= maxLines && L.every(l => ctx.measureText(l).width <= maxW) && (L.length - 1) * s * lh + s * (asc + desc) <= maxH ? L : null; };
  let best = null, bs = minS;
  for (let pass = 0; pass < 2 && !best; pass++) {
    let lo = minS - 1, hi = maxS + 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; const L = tryS(m, words); if (L) { best = L; bs = m; lo = m; } else hi = m; }
    if (!best) words = words.flatMap(w => { const g = graphemes(w); if (g.length <= 5) return [w]; const out = []; for (let i = 0; i < g.length; i += 5) out.push(g.slice(i, i + 5).join('') + (i + 5 < g.length ? '-' : '')); return out; });
  }
  if (!best) { (window.__fitFallbacks = (window.__fitFallbacks || 0) + 1); ctx.font = font(minS, fam); best = wrap(ctx, words, maxW); }
  ctx.font = font(bs, fam);
  return { s: bs, lines: best, lh, asc, desc, fam, h: (best.length - 1) * bs * lh + bs * (asc + desc), w: Math.max(...best.map(l => ctx.measureText(l).width)) };
}
function drawFit(ctx, f, x, y, maxW, align = 'left', each) {
  ctx.font = font(f.s, f.fam); ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const xx = align === 'center' ? x + maxW / 2 : align === 'right' ? x + maxW : x;
  f.lines.forEach((l, i) => { const by = y + f.s * f.asc + i * f.s * f.lh; each ? each(l, xx, by, i) : ctx.fillText(l, xx, by); });
  ctx.textAlign = 'left';
}
function small(ctx, t, x, y, s, fam, col, align = 'left', spacing = 0) { ctx.save(); ctx.font = font(s, fam); ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px'; ctx.fillText(t, x, y); ctx.restore(); }

// ---------- texture & shapes ----------
let noiseC = null;
function noise() { if (noiseC) return noiseC; noiseC = document.createElement('canvas'); noiseC.width = noiseC.height = 256; const c = noiseC.getContext('2d'), d = c.createImageData(256, 256), r = rng(7); for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } c.putImageData(d, 0, 0); return noiseC; }
function grain(ctx, a = 0.12, mode = 'overlay') { ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = mode; ctx.fillStyle = ctx.createPattern(noise(), 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore(); }
const TN = [[178.4,217,90.8,307,144.6,307,205.7,245.1],[48.2,49.8,48.2,86,108.5,86,110.1,87.6,110.1,231.4,147.1,231.4,147.9,157.5,290.1,307,311,307,311,119.7,273.2,119.7,272.4,228.2,167.1,119.7,147.1,118.9,147.9,86.8,208.9,86,208.9,49.8]];
function mark(ctx, x, y, size, col) { ctx.save(); ctx.translate(x, y); ctx.scale(size / 360, size / 360); ctx.fillStyle = col; for (const p of TN) { ctx.beginPath(); for (let i = 0; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.fill(); } ctx.restore(); }
function shape(ctx, type, x, y, s, col, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot * Math.PI / 2); ctx.fillStyle = ctx.strokeStyle = col; ctx.beginPath(); const h = s / 2;
  if (type === 'circle') ctx.arc(0, 0, h * 0.86, 0, 7);
  else if (type === 'half') { ctx.moveTo(-h, h); ctx.arc(0, h, h, Math.PI, 0); }
  else if (type === 'quarter') { ctx.moveTo(-h, h); ctx.arc(-h, h, s, -Math.PI / 2, 0); }
  else if (type === 'tri') { ctx.moveTo(-h, h); ctx.lineTo(h, h); ctx.lineTo(-h, -h); }
  else if (type === 'square') ctx.rect(-h * 0.7, -h * 0.7, h * 1.4, h * 1.4);
  else if (type === 'ring') { ctx.lineWidth = s * 0.16; ctx.arc(0, 0, h * 0.7, 0, 7); ctx.stroke(); ctx.restore(); return; }
  else if (type === 'bars') { for (let i = 0; i < 3; i++) ctx.rect(-h, -h + i * s / 3 + s / 12, s, s / 6); }
  ctx.fill(); ctx.restore();
}
function halftone(ctx, cx, cy, R, step, col) { ctx.fillStyle = col; for (let y = cy - R; y <= cy + R; y += step) for (let x = cx - R; x <= cx + R; x += step) { const d = Math.hypot(x - cx, y - cy) / R; if (d < 1) { ctx.beginPath(); ctx.arc(x, y, step * 0.5 * (1 - d * 0.85), 0, 7); ctx.fill(); } } }
function squiggle(ctx, x, y, len, amp, col, lw, rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i <= len; i += 6) ctx.lineTo(i - len / 2, Math.sin(i / len * Math.PI * 4) * amp); ctx.stroke(); ctx.restore(); }
function star4(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill(); }
function bat(ctx, x, y, s, col) { ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, -16); ctx.lineTo(8, -6); ctx.quadraticCurveTo(30, -26, 50, -14); ctx.quadraticCurveTo(40, -4, 44, 8); ctx.quadraticCurveTo(30, 0, 22, 10); ctx.quadraticCurveTo(12, 2, 0, 14); ctx.quadraticCurveTo(-12, 2, -22, 10); ctx.quadraticCurveTo(-30, 0, -44, 8); ctx.quadraticCurveTo(-40, -4, -50, -14); ctx.quadraticCurveTo(-30, -26, -8, -6); ctx.lineTo(-6, -16); ctx.closePath(); ctx.fill(); ctx.restore(); }
const no = seed => String(seed % 1000).padStart(3, '0');

// ---------- styles ----------
const STY = {};
STY.bauhaus = { name: 'Bauhaus', fonts: ['Archivo Black', 'Space Grotesk'], pals: [
  { bg: '#F2EAD8', ink: '#111111', c: ['#E63B2E', '#1F4FA8', '#F4C430'] }, { bg: '#111111', ink: '#F2EAD8', c: ['#E63B2E', '#F4C430', '#2E6CE6'] },
  { bg: '#1F4FA8', ink: '#F2EAD8', c: ['#F4C430', '#E63B2E', '#111111'] }, { bg: '#F4C430', ink: '#111111', c: ['#E63B2E', '#1F4FA8', '#F2EAD8'] }],
  draw(ctx, t, r, P, v, seed) {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    const cols = [...P.c, P.ink], types = ['circle', 'half', 'quarter', 'tri', 'square', 'ring', 'bars'];
    const gy = v ? 1040 : 200, cs = 312;
    for (let i = 0; i < 9; i++) { const x = M + (i % 3) * cs, y = gy + Math.floor(i / 3) * cs; if (r() < 0.35) { ctx.fillStyle = pick(r, cols); ctx.fillRect(x, y, cs, cs); } let c = pick(r, cols); if (ctx.fillStyle.toLowerCase() === c.toLowerCase()) c = P.bg; shape(ctx, pick(r, types), x + cs / 2, y + cs / 2, cs, c, Math.floor(r() * 4)); }
    ctx.fillStyle = P.ink; ctx.fillRect(M, v ? 1000 : 1150, W - 2 * M, 10);
    const f = fit(ctx, t.toUpperCase(), 'Archivo Black', W - 2 * M, v ? 760 : 520, { lh: 0.98, max: 300 });
    ctx.fillStyle = P.ink; drawFit(ctx, f, M, v ? 200 + (760 - f.h) : 1190 + (520 - f.h) / 2, W - 2 * M);
    small(ctx, 'STAATLICHES · ONE-TAP', M, v ? 130 : 130, 30, 'Space Grotesk', P.ink, 'left', 4);
    small(ctx, 'Nº ' + no(seed), W - M, 130, 30, 'Space Grotesk', P.ink, 'right', 4);
    mark(ctx, W - M - 64, H - 130, 64, P.ink); small(ctx, 'FORM FOLLOWS FEELING', M, H - 80, 28, 'Space Grotesk', P.ink, 'left', 4);
    grain(ctx, 0.1, 'multiply');
  } };
STY.swiss = { name: 'Swiss', fonts: ['Space Grotesk'], pals: [
  { bg: '#F4F4F0', ink: '#111111', acc: '#E3001B' }, { bg: '#E3001B', ink: '#F4F4F0', acc: '#111111' }, { bg: '#111111', ink: '#F4F4F0', acc: '#E3001B' }, { bg: '#DCDCD4', ink: '#111111', acc: '#E3001B' }],
  draw(ctx, t, r, P, v, seed) {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H); const cw = (W - 2 * M) / 6;
    ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.12; ctx.lineWidth = 2; for (let i = 0; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(M + i * cw, 0); ctx.lineTo(M + i * cw, H); ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.fillStyle = P.acc;
    if (!v) { const d = cw * (3 + Math.floor(r() * 2)), cx = M + cw * (2 + Math.floor(r() * 3)); ctx.beginPath(); ctx.arc(Math.min(cx, W), 300 + d / 2, d / 2, 0, 7); ctx.fill(); ctx.fillRect(M, 1000, cw * (1 + Math.floor(r() * 3)), 24); }
    else { ctx.save(); ctx.translate(W / 2, 1450); ctx.rotate(-0.26); for (let i = 0; i < 4; i++) ctx.fillRect(-700 + i * 60, -200 + i * 110, 900 + r() * 400, 60); ctx.restore(); }
    const txt = v ? t.toUpperCase() : t.toLowerCase();
    const f = fit(ctx, txt, 'Space Grotesk', W - 2 * M, v ? 820 : 640, { lh: 0.9, max: 420 });
    ctx.fillStyle = P.ink; drawFit(ctx, f, M - 4, v ? 260 : 1060 + (640 - f.h), W - 2 * M);
    const top = v ? H - 110 : 150;
    small(ctx, 'One-Tap Poster', M, top, 30, 'Space Grotesk', P.ink); small(ctx, 'Serie ' + (seed % 12 + 1), M + cw * 2, top, 30, 'Space Grotesk', P.ink); small(ctx, 'Zürich / Phoenix', M + cw * 4, top, 30, 'Space Grotesk', P.ink);
    ctx.save(); ctx.translate(W - 34, v ? 140 : H - 120); ctx.rotate(-Math.PI / 2); small(ctx, 'Nº ' + no(seed) + ' — International Typographic Style', 0, 0, 26, 'Space Grotesk', P.ink, 'left', 2); ctx.restore();
    if (!v) mark(ctx, M, H - 150, 60, P.ink);
  } };
STY.riso = { name: 'Risograph', fonts: ['Anton', 'Space Mono'], pals: [
  { a: '#FF48B0', b: '#0078BF' }, { a: '#FF6C2F', b: '#00838A' }, { a: '#FFE800', b: '#765BA7' }, { a: '#00A95C', b: '#F15060' }].map(p => ({ ...p, bg: '#F3EEE3' })),
  draw(ctx, t, r, P, v, seed) {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'multiply';
    const hy = v ? 1400 : 520; halftone(ctx, 300 + r() * 480, hy, 420, 30, P.a);
    ctx.fillStyle = P.b; ctx.globalAlpha = 0.9; ctx.fillRect(r() * 300, v ? 1300 : 140, 300 + r() * 300, 26); ctx.fillRect(M, v ? 1760 : 900, W - 2 * M, 14);
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.fillStyle = P.b; ctx.arc(W - 200 - r() * 200, v ? 1560 : 380, 150, 0, 7); ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
    const ry = v ? 200 : 960, rh = v ? 1000 : 740;
    const f = fit(ctx, t.toUpperCase(), 'Anton', W - 2 * M, rh, { lh: 0.92, max: 520 });
    const y = ry + (rh - f.h) / 2, dx = 8 + r() * 10, dy = 6 + r() * 8;
    ctx.fillStyle = P.a; drawFit(ctx, f, M + dx, y + dy, W - 2 * M - 2 * dx, 'center');
    ctx.fillStyle = P.b; drawFit(ctx, f, M, y, W - 2 * M - 2 * dx, 'center');
    ctx.globalCompositeOperation = 'source-over';
    small(ctx, 'RISO PRINT · 2 COLOUR · Nº' + no(seed), M, v ? 130 : H - 90, 28, 'Space Mono', P.b, 'left', 2);
    small(ctx, 'ONE-TAP', W - M, v ? 130 : H - 90, 28, 'Space Mono', P.b, 'right', 2);
    grain(ctx, 0.28, 'multiply'); grain(ctx, 0.15, 'screen');
  } };
STY.memphis = { name: 'Memphis', fonts: ['Syne', 'Space Mono'], pals: [
  { bg: '#FFD6E0', c: ['#00B3A4', '#FFC700', '#6A4CFF'] }, { bg: '#C9F0E5', c: ['#FF5C8A', '#FFC700', '#2E6CE6'] }, { bg: '#FFF1A8', c: ['#FF5C8A', '#00B3A4', '#6A4CFF'] }, { bg: '#D9D2FF', c: ['#FF7A1A', '#00B3A4', '#FF5C8A'] }],
  draw(ctx, t, r, P, v, seed) {
    const ink = '#111111'; ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H, c = pick(r, [...P.c, ink]), k = Math.floor(r() * 6); ctx.lineWidth = 10; ctx.strokeStyle = ink;
      if (k === 0) squiggle(ctx, x, y, 200 + r() * 140, 22, c, 14, r() * 3);
      else if (k === 1) { ctx.save(); ctx.translate(x, y); ctx.rotate(r() * 6); ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(55, 40); ctx.lineTo(-55, 40); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.stroke(); ctx.restore(); }
      else if (k === 2) { ctx.beginPath(); ctx.arc(x, y, 30 + r() * 40, 0, 7); ctx.fillStyle = c; ctx.fill(); ctx.stroke(); }
      else if (k === 3) { ctx.fillStyle = ink; for (let a = 0; a < 5; a++) for (let b = 0; b < 4; b++) { ctx.beginPath(); ctx.arc(x + a * 26, y + b * 26, 5, 0, 7); ctx.fill(); } }
      else if (k === 4) { ctx.save(); ctx.translate(x, y); ctx.rotate(r() * 6); ctx.fillStyle = c; ctx.fillRect(-50, -12, 100, 24); ctx.restore(); }
      else { ctx.save(); ctx.translate(x, y); ctx.rotate(r() * 6); ctx.strokeStyle = c; ctx.lineWidth = 12; ctx.beginPath(); for (let z = 0; z < 6; z++) ctx.lineTo(z * 30 - 75, z % 2 ? 22 : -22); ctx.stroke(); ctx.restore(); } }
    const pw = W - 2 * M - 40, f = fit(ctx, t.toUpperCase(), 'Syne', pw - 100, 900, { lh: 0.98, max: 300 });
    const ph = f.h + 120, px = M, py = v ? 1720 - ph : (H - ph) / 2 - 20;
    ctx.fillStyle = P.c[0]; ctx.fillRect(px + 34, py + 34, pw, ph); ctx.fillStyle = '#FFFDF6'; ctx.fillRect(px, py, pw, ph); ctx.lineWidth = 10; ctx.strokeStyle = ink; ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = P.c[2]; drawFit(ctx, f, px + 56, py + 66, pw - 100, 'center'); ctx.fillStyle = ink; drawFit(ctx, f, px + 50, py + 60, pw - 100, 'center');
    ctx.fillStyle = ink; ctx.fillRect(M, 90, 420, 64); small(ctx, 'MILANO MOOD Nº' + no(seed), M + 22, 136, 30, 'Space Mono', '#FFFDF6');
    grain(ctx, 0.06, 'multiply');
  } };
STY.brutal = { name: 'Brutalist', fonts: ['Space Mono'], pals: [
  { bg: '#E9E9E4', ink: '#111111', hi: '#C6FF3D', ht: '#111111' }, { bg: '#111111', ink: '#EDEDED', hi: '#FF3B1F', ht: '#111111' }, { bg: '#0033FF', ink: '#FFFFFF', hi: '#111111', ht: '#FFFFFF' }, { bg: '#FFED00', ink: '#111111', hi: '#FF2E88', ht: '#111111' }],
  draw(ctx, t, r, P, v, seed) {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = P.ink; ctx.lineWidth = 28; ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.lineWidth = 6; const labels = ['FILE_' + seed.toString(36).toUpperCase(), 'STATUS: LOUD', 'V.' + (v + 1)]; let x = 56;
    labels.forEach((l, i) => { const w = i === 0 ? 420 : i === 1 ? 330 : W - 112 - 750; ctx.strokeRect(x, 56, w, 110); small(ctx, l, x + 22, 128, 34, 'Space Mono', P.ink); x += w; });
    const ry = v ? 760 : 240, rh = v ? 820 : 1200;
    if (v) { ctx.save(); ctx.font = font(560, 'Space Mono'); ctx.lineWidth = 8; ctx.strokeStyle = P.ink; ctx.strokeText(no(seed), 40, 690); ctx.restore(); }
    const f = fit(ctx, t.toUpperCase(), 'Space Mono', W - 2 * M - 40, rh, { lh: 1.12, max: 260 });
    const y = ry + (v ? rh - f.h : 0);
    drawFit(ctx, f, M + 20, y, W - 2 * M, 'left', (l, xx, by) => { const w = ctx.measureText(l).width; ctx.fillStyle = P.hi; ctx.fillRect(xx - 16, by - f.s * f.asc - f.s * 0.1, w + 32, f.s * (f.asc + 0.22)); ctx.fillStyle = P.ht; ctx.fillText(l, xx, by); });
    ctx.fillStyle = P.ink; let bx = 56; while (bx < 620) { const w = 4 + Math.floor(r() * 4) * 5; ctx.fillRect(bx, 1650, w, 160); bx += w + 6 + r() * 12; }
    small(ctx, '→→→ ONE-TAP', W - 56, 1740, 44, 'Space Mono', P.ink, 'right'); small(ctx, 'NO_FILTER.PNG', W - 56, 1800, 30, 'Space Mono', P.ink, 'right');
    grain(ctx, 0.08, 'overlay');
  } };
STY.y2k = { name: 'Y2K Chrome', fonts: ['Unbounded', 'Space Mono'], pals: [
  { bg: ['#05051A', '#2B0A6B'], b: ['#7B2FFF', '#00E0FF'], ol: '#0B0630' }, { bg: ['#F7D6FF', '#B8C6FF'], b: ['#FF5FD2', '#7DF9FF'], ol: '#2A1050' },
  { bg: ['#050505', '#1E2A12'], b: ['#C6FF3D', '#00FFA3'], ol: '#050505' }, { bg: ['#1B1B22', '#3A3F55'], b: ['#D7DCE8', '#8C9BFF'], ol: '#101018' }],
  draw(ctx, t, r, P, v, seed) {
    let g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, P.bg[0]); g.addColorStop(1, P.bg[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 3; i++) { const x = r() * W, y = r() * H, R = 400 + r() * 300, rg = ctx.createRadialGradient(x, y, 0, x, y, R); rg.addColorStop(0, P.b[i % 2] + 'AA'); rg.addColorStop(1, P.b[i % 2] + '00'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); }
    const hz = v ? 1500 : 1380; ctx.strokeStyle = P.b[1]; ctx.globalAlpha = 0.55; ctx.lineWidth = 3;
    for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(W / 2, hz); ctx.lineTo(W / 2 + i * 200, H); ctx.stroke(); } for (let i = 0; i < 9; i++) { const y = hz + Math.pow(i / 8, 2) * (H - hz); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.globalAlpha = 1;
    if (v) { const cg = ctx.createLinearGradient(0, 1000, 0, 1500); ['#FFFFFF', '#8E97AD', '#FFFFFF', '#4A5168', '#E8ECF7'].forEach((c, i) => cg.addColorStop(i / 4, c)); ctx.strokeStyle = cg; ctx.lineWidth = 70; ctx.beginPath(); ctx.ellipse(W / 2, 1250, 330, 170, -0.2, 0, 7); ctx.stroke(); }
    for (let i = 0; i < 14; i++) star4(ctx, r() * W, r() * H, 14 + r() * 40, '#FFFFFF');
    const ry = v ? 260 : 380, rh = v ? 620 : 900;
    const f = fit(ctx, t.toUpperCase(), 'Unbounded', W - 2 * M - 20, rh, { lh: 1.0, max: 300 });
    const y = ry + (rh - f.h) / 2;
    drawFit(ctx, f, M + 10, y, W - 2 * M - 20, 'center', (l, xx, by) => {
      const cg = ctx.createLinearGradient(0, by - f.s * f.asc, 0, by); [['#FFFFFF', 0], ['#C9D1E0', 0.4], ['#5B6378', 0.52], ['#F5F7FF', 0.58], ['#A9B3C9', 0.85], ['#FFFFFF', 1]].forEach(([c, o]) => cg.addColorStop(o, c));
      ctx.save(); ctx.shadowColor = P.b[0]; ctx.shadowBlur = 40; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(6, f.s * 0.09); ctx.strokeStyle = P.ol; ctx.strokeText(l, xx, by); ctx.restore(); ctx.fillStyle = cg; ctx.fillText(l, xx, by); });
    const pill = (txt, x, y) => { ctx.font = font(28, 'Space Mono'); const w = ctx.measureText(txt).width + 48; ctx.fillStyle = '#FFFFFF22'; ctx.strokeStyle = '#FFFFFFAA'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, w, 60, 30); ctx.fill(); ctx.stroke(); small(ctx, txt, x + 24, y + 40, 28, 'Space Mono', '#FFFFFF'); };
    pill('★ ONE-TAP.EXE', M, 110); pill('SEED://' + seed.toString(36).toUpperCase(), M, H - 170);
  } };
STY.sunset = { name: 'Retro Sunset', fonts: ['Anton', 'Monoton'], pals: [
  { sky: ['#140A33', '#5B1A6E', '#FF4F8B'], sun: ['#FFE45C', '#FF2E88'], grid: '#FF4FD8', tx: ['#FFE45C', '#FF6B3D'], ol: '#140A33' },
  { sky: ['#0B1E3F', '#1F6F8B', '#FFB86B'], sun: ['#FFF3B0', '#FF7A1A'], grid: '#7DF9FF', tx: ['#FFF3B0', '#FF7A1A'], ol: '#0B1E3F' },
  { sky: ['#2A0A12', '#8B1E3F', '#FF9F45'], sun: ['#FFD27A', '#E8364F'], grid: '#FFB347', tx: ['#FFF4D6', '#FFB347'], ol: '#2A0A12' },
  { sky: ['#0E0E10', '#2B1055', '#7597DE'], sun: ['#F9F871', '#FF6F91'], grid: '#C9B6FF', tx: ['#F9F871', '#FF6F91'], ol: '#0E0E10' }],
  draw(ctx, t, r, P, v, seed) {
    const hz = v ? 1060 : 1240; const sky = ctx.createLinearGradient(0, 0, 0, hz); P.sky.forEach((c, i) => sky.addColorStop(i / 2, c)); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.3 + r() * 0.6; ctx.fillRect(r() * W, r() * hz * 0.6, 4, 4); } ctx.globalAlpha = 1;
    const sr = 380, sy = hz - 60, sg = ctx.createLinearGradient(0, sy - sr, 0, sy + sr * 0.3); sg.addColorStop(0, P.sun[0]); sg.addColorStop(1, P.sun[1]);
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(W / 2, sy, sr, 0, 7); ctx.fill(); ctx.fillStyle = sky; for (let i = 0; i < 7; i++) { const y = sy - 120 + i * 34 + i * i * 2; ctx.fillRect(0, y, W, 6 + i * 3.4); }
    ctx.fillStyle = P.ol; ctx.fillRect(0, hz, W, H - hz); ctx.strokeStyle = P.grid; ctx.lineWidth = 4; ctx.shadowColor = P.grid; ctx.shadowBlur = 18;
    for (let i = -14; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 30, hz); ctx.lineTo(W / 2 + i * 260, H); ctx.stroke(); } for (let i = 0; i < 12; i++) { const y = hz + Math.pow(i / 11, 2.2) * (H - hz); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.shadowBlur = 0;
    ctx.fillStyle = P.ol; ctx.beginPath(); ctx.moveTo(0, hz); [[0, hz - 120], [140, hz - 40], [260, hz - 180], [400, hz - 30], [W - 380, hz - 20], [W - 240, hz - 160], [W - 110, hz - 60], [W, hz - 140], [W, hz]].forEach(p => ctx.lineTo(p[0], p[1])); ctx.fill();
    const sk = 0.18, ry = v ? 1180 : 200, rh = v ? 560 : 640, mw = W - 2 * M - sk * rh;
    const f = fit(ctx, t.toUpperCase(), 'Anton', mw, rh, { lh: 0.95, max: 440 });
    ctx.save(); const y0 = ry + (rh - f.h) / 2; ctx.translate(M + sk * f.h, y0); ctx.transform(1, 0, -sk, 1, 0, 0);
    drawFit(ctx, f, 0, 0, mw, 'center', (l, xx, by) => { ctx.lineJoin = 'round'; ctx.fillStyle = P.ol; ctx.fillText(l, xx + 10, by + 16); ctx.lineWidth = f.s * 0.07; ctx.strokeStyle = P.ol; ctx.strokeText(l, xx, by);
      const g = ctx.createLinearGradient(0, by - f.s * f.asc, 0, by); g.addColorStop(0, P.tx[0]); g.addColorStop(1, P.tx[1]); ctx.fillStyle = g; ctx.fillText(l, xx, by); });
    ctx.restore();
    const tag = pick(r, ['NITE DRIVE', 'HI-FI', 'TURBO', 'NEON', 'VHS']); small(ctx, tag, W / 2, v ? 140 : H - 110, 64, 'Monoton', P.grid, 'center', 6);
  } };
STY.gothic = { name: 'Poster Gothic', fonts: ['Pirata One', 'DM Serif Display'], pals: [
  { bg: '#0D0A0B', ink: '#F3E6CF', acc: '#FF7A1A' }, { bg: '#0B0B0B', ink: '#EDE3D1', acc: '#C8102E' }, { bg: '#140A1F', ink: '#C6FF3D', acc: '#8E44FF' }, { bg: '#F3E6CF', ink: '#140C0A', acc: '#8A1C1C' }],
  draw(ctx, t, r, P, v, seed) {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    const my = v ? 1640 : 430, mr = v ? 360 : 230; const mg = ctx.createRadialGradient(W / 2, my, mr * 0.6, W / 2, my, mr * 2.2); mg.addColorStop(0, P.acc + '55'); mg.addColorStop(1, P.acc + '00'); ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = P.acc; ctx.beginPath(); ctx.arc(W / 2, my, mr, 0, 7); ctx.fill(); ctx.fillStyle = P.bg; ctx.beginPath(); ctx.arc(W / 2 + mr * 0.42, my - mr * 0.2, mr * 0.88, 0, 7); ctx.fill();
    for (let i = 0; i < 6; i++) bat(ctx, 140 + r() * 800, (v ? 1300 : 200) + r() * 380, 70 + r() * 90, P.ink);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.strokeRect(44, 44, W - 88, H - 88); ctx.lineWidth = 2; ctx.strokeRect(64, 64, W - 128, H - 128);
    ctx.fillStyle = P.acc; [[44, 44], [W - 44, 44], [44, H - 44], [W - 44, H - 44]].forEach(([x, y]) => { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-18, -18, 36, 36); ctx.restore(); });
    const ry = v ? 240 : 760, rh = v ? 900 : 860;
    small(ctx, '✶  A Most Peculiar Notice  ✶', W / 2, ry - 40, 44, 'DM Serif Display', P.acc, 'center', 2);
    const f = fit(ctx, t, 'Pirata One', W - 2 * M - 80, rh - 120, { lh: 1.0, max: 380 });
    const y = ry + 20 + (rh - 120 - f.h) / 2;
    ctx.fillStyle = P.acc; drawFit(ctx, f, M + 46, y + 8, W - 2 * M - 80, 'center'); ctx.fillStyle = P.ink; drawFit(ctx, f, M + 40, y, W - 2 * M - 80, 'center');
    const ly = y + f.h + 60; ctx.fillStyle = P.ink; ctx.fillRect(W / 2 - 260, ly, 220, 3); ctx.fillRect(W / 2 + 40, ly, 220, 3); ctx.save(); ctx.translate(W / 2, ly + 1); ctx.rotate(Math.PI / 4); ctx.fillRect(-10, -10, 20, 20); ctx.restore();
    small(ctx, 'Est. MMXXVI  ·  Nº ' + no(seed), W / 2, v ? 1220 : H - 120, 36, 'DM Serif Display', P.ink, 'center', 3);
    grain(ctx, 0.14, 'overlay');
  } };
STY.editorial = { name: 'Editorial Serif', fonts: ['DM Serif Display', 'Space Grotesk'], pals: [
  { bg: '#F3EEE4', ink: '#111111', acc: '#C8102E' }, { bg: '#111111', ink: '#F3EEE4', acc: '#D9A400' }, { bg: '#E7E4DA', ink: '#16213E', acc: '#2F5D3A' }, { bg: '#F7E1D7', ink: '#2B1B17', acc: '#1F4FA8' }],
  draw(ctx, t, r, P, v, seed) {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    small(ctx, 'One—Tap', W / 2, 250, 190, 'DM Serif Display', P.ink, 'center', -4);
    ctx.fillStyle = P.ink; ctx.fillRect(M, 290, W - 2 * M, 8); ctx.fillRect(M, 308, W - 2 * M, 2); ctx.fillRect(M, 372, W - 2 * M, 2);
    small(ctx, 'VOL. 04   —   ISSUE ' + no(seed) + '   —   AUTUMN 2026   —   FREE', W / 2, 352, 26, 'Space Grotesk', P.ink, 'center', 4);
    const ty = v ? 1180 : 430, th = v ? 600 : 700;
    const f = fit(ctx, t, 'DM Serif Display', W - 2 * M, th, { lh: 0.98, max: 330 });
    ctx.fillStyle = P.ink; drawFit(ctx, f, M, ty + (v ? th - f.h : 0), W - 2 * M, 'left');
    const ay = v ? 420 : 1200, ah = v ? 700 : 560, ax = v ? W - M - 480 : M, aw = v ? 480 : 440;
    ctx.fillStyle = P.acc; ctx.beginPath(); ctx.moveTo(ax, ay + ah); ctx.lineTo(ax, ay + aw / 2); ctx.arc(ax + aw / 2, ay + aw / 2, aw / 2, Math.PI, 0); ctx.lineTo(ax + aw, ay + ah); ctx.fill();
    ctx.fillStyle = P.bg; ctx.beginPath(); ctx.arc(ax + aw / 2 + (r() - 0.5) * 100, ay + ah * 0.6, aw * 0.22, 0, 7); ctx.fill();
    const cx = v ? M : M + 500, cw = v ? 400 : W - 2 * M - 500;
    small(ctx, '“' + pick(r, ['Say less. Print more.', 'Loud by design.', 'Set in ink.', 'Words, made objects.']) + '”', cx, ay + 50, 40, 'DM Serif Display', P.acc);
    ctx.fillStyle = P.ink; ctx.globalAlpha = 0.28; for (let i = 0; i < 12; i++) ctx.fillRect(cx, ay + 110 + i * 34, cw * (i % 4 === 3 ? 0.6 : 0.9 + r() * 0.1), 12); ctx.globalAlpha = 1;
    ctx.fillStyle = P.ink; ctx.fillRect(M, H - 150, W - 2 * M, 2); small(ctx, 'THE ONE-TAP REVIEW', M, H - 100, 26, 'Space Grotesk', P.ink, 'left', 4); mark(ctx, W - M - 52, H - 130, 52, P.ink);
    grain(ctx, 0.08, 'multiply');
  } };

const STYLES = Object.keys(STY).map(id => ({ id, name: STY[id].name }));
const FONTS = ['Anton', 'Archivo Black', 'Space Grotesk', 'Bebas Neue', 'DM Serif Display', 'Space Mono', 'Syne', 'Unbounded', 'Pirata One', 'Monoton'];
let fontsReady = null;
function ready() { return fontsReady ||= Promise.all(FONTS.map(f => document.fonts.load(`40px "${f}"`, 'Aa★'))).then(() => document.fonts.ready); }
function resolve(spec) { const st = STY[spec.s] ? spec.s : 'bauhaus', S = STY[st], r = rng(spec.seed); const palI = spec.pal >= 0 ? spec.pal % S.pals.length : Math.floor(r() * S.pals.length); const v = spec.mix === 0 ? 0 : Math.floor(rng(spec.seed ^ 0x9e37)() * 2); return { S, st, palI, v, r }; }
function render(ctx, spec, scale = 1) {
  const { S, palI, v, r } = resolve(spec); ctx.save(); ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  S.draw(ctx, (spec.t || 'Make it loud').trim().slice(0, 80) || 'Make it loud', r, S.pals[palI], v, spec.seed >>> 0); ctx.restore();
}
function canvasFor(spec, w = W) { const c = document.createElement('canvas'); c.width = w; c.height = Math.round(w * H / W); render(c.getContext('2d'), spec, w / W); return c; }
const thumbCache = new Map();
async function thumb(spec, w = 360) { const k = JSON.stringify([spec.t, spec.s, spec.seed, spec.pal, spec.mix, w]); if (thumbCache.has(k)) return thumbCache.get(k); await ready();
  const p = new Promise(res => canvasFor(spec, w).toBlob(b => res(URL.createObjectURL(b)), 'image/png')); thumbCache.set(k, p); return p; }
function toBlob(spec) { return ready().then(() => new Promise(res => canvasFor(spec).toBlob(res, 'image/png'))); }
const AV = ['#E63B2E', '#1F4FA8', '#F4C430', '#C6FF3D', '#FF5C8A', '#00B3A4', '#6A4CFF', '#FF7A1A'];
const avCache = new Map();
function avatar(handle, name) { if (avCache.has(handle)) return avCache.get(handle); const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d'), r = rng(hash(handle));
  const a = pick(r, AV); let b = pick(r, AV); if (b === a) b = '#111111'; x.fillStyle = a; x.fillRect(0, 0, 160, 160); shape(x, pick(r, ['circle', 'half', 'quarter', 'tri']), 80 + (r() - 0.5) * 60, 80 + (r() - 0.5) * 60, 150, b, Math.floor(r() * 4));
  const ini = graphemes((name || handle).trim()).filter(g => /\p{L}|\p{N}/u.test(g)).slice(0, 2).join('').toUpperCase() || '★'; x.font = font(64, 'Archivo Black'); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = '#111111'; x.strokeText(ini, 80, 84); x.fillStyle = '#FFFFFF'; x.fillText(ini, 80, 84);
  const u = c.toDataURL(); if (fontsReady) avCache.set(handle, u); return u; }
// deep link codec: <style>-<seed36>.<pal>.<mix>-<base64url utf8 text>
function encode(spec) { const b = btoa(String.fromCharCode(...new TextEncoder().encode(spec.t || ''))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); return `${spec.s}-${(spec.seed >>> 0).toString(36)}.${spec.pal ?? -1}.${spec.mix ?? 1}-${b}`; }
function decode(code) { try { const p = code.split('-'); const s = p[0], [sd, pal, mix] = p[1].split('.'); let b = p.slice(2).join('-').replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
  const t = new TextDecoder().decode(Uint8Array.from(atob(b), c => c.charCodeAt(0))); if (!STY[s]) return null; return { s, seed: parseInt(sd, 36) >>> 0, pal: pal === undefined ? -1 : +pal, mix: mix === undefined ? 1 : +mix, t: t.slice(0, 80) }; } catch { return null; } }
window.Poster = { W, H, STYLES, STY, render, canvasFor, thumb, toBlob, ready, avatar, encode, decode, hash, rng, resolve };
})();
