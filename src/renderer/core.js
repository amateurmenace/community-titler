// Community Titler — pure canvas renderer.
// Framework-free and environment-free: runs in the browser (Canvas 2D) and in
// Node (@napi-rs/canvas) so the app preview, in-browser exports, and the CLI
// batch renderer all draw pixel-identical frames.
//
// Everything is a deterministic function of time `t` (seconds) across the
// timeline: [animate in][hold][animate out].
//
// Design language: skewed parallelogram panels with elements that break out of
// the main shape — an accent "blade" floating off the left edge, a station tab
// and badge chip jutting over the top, and brand-stripe tails streaking past
// the right edge. Themes with shape.style 'rounded' keep rectangular panels
// but share the same layered geometry.

/** @typedef {{id?:string,type:'show'|'speaker'|'article',badge:string,primary:string,secondary:string}} TitleItem */

// ---------------------------------------------------------------- easing ---

const easeOutQuint = (x) => 1 - Math.pow(1 - x, 5);
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x) => x * x * x;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** progress of a sub-animation: starts at `d0` (fraction of span), lasts `dur` */
function ph(p, d0, dur, ease = easeOutQuint) {
  return ease(clamp01((p - d0) / Math.min(dur, 1 - d0 || 1)));
}

// ---------------------------------------------------------------- helpers ---

/**
 * Parallelogram path. `x` is the BOTTOM-left corner, `y` the top edge;
 * the top edge is shifted right by `s` (the lean).
 */
function paraPath(ctx, x, y, w, h, s) {
  ctx.beginPath();
  ctx.moveTo(x + s, y);
  ctx.lineTo(x + s + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Theme-aware shape: parallelogram (leaning) or rounded rect. x = bottom-left. */
function shapePath(ctx, shape, x, y, w, h) {
  if (shape.lean > 0) paraPath(ctx, x, y, w, h, shape.lean * h);
  else roundRectPath(ctx, x, y, w, h, shape.radius);
}

function themeLean(theme) {
  if (theme.shape?.style === 'parallelogram') {
    return Math.tan(((theme.shape.skew ?? 12) * Math.PI) / 180);
  }
  return 0;
}

function setFont(ctx, weight, px, family) {
  ctx.font = `${weight} ${Math.max(1, Math.round(px))}px "${family}"`;
}

function measure(ctx, text) {
  return ctx.measureText(text).width;
}

/** Draw text with manual letter-spacing (cross-environment safe). Returns width. */
function drawTracked(ctx, text, x, y, tracking) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += measure(ctx, ch) + tracking;
  }
  return cx - x - tracking;
}

function measureTracked(ctx, text, tracking) {
  let w = 0;
  for (const ch of text) w += measure(ctx, ch) + tracking;
  return Math.max(0, w - tracking);
}

/**
 * Greedy word-wrap + shrink-to-fit.
 * @returns {{size:number, lines:{text:string,width:number}[]}}
 */
function fitLines(ctx, text, opts) {
  const { family, weight, maxSize, minSize, maxWidth, maxLines } = opts;
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { size: maxSize, lines: [] };

  for (let size = maxSize; size >= minSize; size -= 1) {
    setFont(ctx, weight, size, family);
    const lines = [];
    let line = '';
    let ok = true;
    for (const word of words) {
      const probe = line ? line + ' ' + word : word;
      if (measure(ctx, probe) <= maxWidth || !line) {
        line = probe;
      } else {
        lines.push(line);
        line = word;
      }
      if (lines.length > maxLines) { ok = false; break; }
    }
    if (line) lines.push(line);
    if (!ok || lines.length > maxLines) continue;
    if (lines.some((l) => measure(ctx, l) > maxWidth)) {
      if (size > minSize) continue; // keep shrinking
    }
    return { size, lines: lines.map((l) => ({ text: l, width: measure(ctx, l) })) };
  }
  // Last resort: hard-clip at min size
  setFont(ctx, weight, minSize, family);
  const lines = [];
  let line = '';
  for (const word of words) {
    const probe = line ? line + ' ' + word : word;
    if (measure(ctx, probe) <= maxWidth || !line) line = probe;
    else { lines.push(line); line = word; if (lines.length >= maxLines) break; }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return { size: minSize, lines: lines.map((l) => ({ text: l, width: measure(ctx, l) })) };
}

// ----------------------------------------------------------------- arches ---

/**
 * The BIG-style "broadcast rainbow" arches: three concentric half-rings plus a
 * solid center arch, flat bottom at baseY, centered on cx. R = outer radius.
 */
export function drawArches(ctx, cx, baseY, R, colors, center) {
  const rings = [
    [1.0, 0.8, colors[0] ?? '#C74C9C'],
    [0.62, 0.47, colors[1] ?? '#F68B1F'],
    [0.34, 0.245, colors[2] ?? '#FEEE32'],
  ];
  for (const [ro, ri, color] of rings) {
    ctx.beginPath();
    ctx.arc(cx, baseY, R * ro, Math.PI, 0, false);
    ctx.arc(cx, baseY, R * ri, 0, Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (center) {
    ctx.beginPath();
    ctx.arc(cx, baseY, R * 0.135, Math.PI, 0, false);
    ctx.lineTo(cx + R * 0.135, baseY);
    ctx.closePath();
    ctx.fillStyle = center;
    ctx.fill();
  }
}

// ----------------------------------------------------------------- lockup ---
// Horizontal station lockup, proportioned like BIG's horizontal logo: arches
// at the left sized to the cap height, then the short name in BIG chunky caps
// (the letters lead, the arches accent — not the other way around).

function lockupMetrics(ctx, theme, capH, assets) {
  const wantImage = theme.identity.markStyle === 'image' && assets?.logo;
  const style = wantImage ? 'image' : theme.identity.markStyle ?? 'arches';
  if (style === 'none') return null;
  if (style === 'image') {
    const img = assets.logo;
    const h = capH * 2.1;
    return { style, h, w: (img.width / img.height) * h };
  }
  const short = theme.identity.short || 'TV';
  const size = capH / 0.7; // Montserrat cap height ≈ 0.70 em
  setFont(ctx, theme.fonts.displayWeight, size, theme.fonts.display);
  const textW = measure(ctx, short);
  if (style === 'chip') {
    return { style, short, size, textW, capH, w: textW, h: capH };
  }
  // arches: outer radius ~80% of cap height, snug gap — letters lead
  const R = capH * 0.8;
  const gap = capH * 0.3;
  return { style, short, size, textW, R, gap, capH, w: R * 2 + gap + textW, h: Math.max(R, capH) };
}

/** Draw the lockup with its BASELINE at `baselineY`, left edge at `x`. */
function drawLockup(ctx, m, x, baselineY, theme, assets) {
  const C = theme.colors;
  if (!m) return;
  if (m.style === 'image') {
    ctx.drawImage(assets.logo, x, baselineY - m.h, m.w, m.h);
    return;
  }
  if (m.style === 'arches') {
    drawArches(ctx, x + m.R, baselineY, m.R, C.archColors ?? C.stripes, C.archCenter ?? C.text);
    setFont(ctx, theme.fonts.displayWeight, m.size, theme.fonts.display);
    ctx.fillStyle = C.text;
    ctx.fillText(m.short, x + m.R * 2 + m.gap, baselineY);
    return;
  }
  // chip: just the short name in display caps
  setFont(ctx, theme.fonts.displayWeight, m.size, theme.fonts.display);
  ctx.fillStyle = C.text;
  ctx.fillText(m.short, x, baselineY);
}

// ---------------------------------------------------------------- timeline ---

export function totalDuration(opts) {
  return opts.inDur + opts.holdDur + opts.outDur;
}

export function holdTime(opts) {
  return opts.inDur + opts.holdDur / 2;
}

// ------------------------------------------------------------------ layout ---

/**
 * Measures everything and returns a draw plan (positions at rest).
 * Panels/badges/tabs use bottom-left x + top y + lean-aware geometry.
 * Pure measurement — no painting.
 */
function computeLayout(ctx, item, theme, opts) {
  const W = opts.width;
  const H = opts.height;
  const u = (H / 1080) * (theme.layout.scale ?? 1);
  const C = theme.colors;
  const F = theme.fonts;
  const L = theme.layout;
  const lean = themeLean(theme);

  const mx = (L.marginX ?? 96) * (H / 1080);
  const my = (L.marginY ?? 72) * (H / 1080);
  const padX = 42 * u;
  const shape = { lean, radius: (L.cornerRadius ?? 10) * u };

  const stripes = theme.flags.stripe ? (C.stripes ?? []) : [];
  const bandH = 7.5 * u;

  /** @type {any} */
  const plan = {
    u, W, H, shape, padX,
    type: item.type,
    texts: [],
    badge: null,
    tab: null,
    lockup: null,
    divider: null,
    blade: null,
    stripeTail: null,
    panel: null,
  };

  const maxFrac = L.maxWidthFrac ?? (item.type === 'article' ? 0.68 : 0.56);

  // --- per-type content measurement -------------------------------------

  let panelW = 0;
  let panelH = 0;
  let padTop = 0;
  const rows = []; // {kind,text,size,weight,family,color,tracking,gapBefore,lineH}

  if (item.type === 'speaker') {
    const maxTextW = W * maxFrac - padX * 2;
    const name = fitLines(ctx, item.primary, {
      family: F.display, weight: F.displayWeight, maxSize: 58 * u, minSize: 36 * u,
      maxWidth: maxTextW, maxLines: 1,
    });
    rows.push({ kind: 'line', text: name.lines[0]?.text ?? '', size: name.size, weight: F.displayWeight, family: F.display, color: C.text, tracking: 0, gapBefore: 0, lineH: name.size * 1.06, width: name.lines[0]?.width ?? 0 });
    if (String(item.secondary ?? '').trim()) {
      const role = fitLines(ctx, item.secondary, {
        family: F.text, weight: F.textWeight, maxSize: 32 * u, minSize: 22 * u,
        maxWidth: maxTextW, maxLines: 1,
      });
      rows.push({ kind: 'secondary', text: role.lines[0]?.text ?? '', size: role.size, weight: F.textWeight, family: F.text, color: C.secondary, tracking: 0, gapBefore: 13 * u, lineH: role.size * 1.1, width: role.lines[0]?.width ?? 0 });
    }
    padTop = 30 * u;
  }

  if (item.type === 'article') {
    const maxTextW = W * maxFrac - padX * 2;
    const title = fitLines(ctx, item.primary, {
      family: F.text, weight: 600, maxSize: 40 * u, minSize: 25 * u,
      maxWidth: maxTextW, maxLines: 3,
    });
    title.lines.forEach((l, i) => {
      rows.push({ kind: 'line', text: l.text, size: title.size, weight: 600, family: F.text, color: C.text, tracking: 0, gapBefore: i === 0 ? 0 : 0, lineH: title.size * 1.22, width: l.width });
    });
    if (String(item.secondary ?? '').trim()) {
      const tagText = theme.flags.uppercaseTag ? item.secondary.toUpperCase() : item.secondary;
      const tagSize = 21.5 * u;
      const tagTracking = 1.6 * u;
      setFont(ctx, 600, tagSize, F.text);
      rows.push({ kind: 'tag', text: tagText, size: tagSize, weight: 600, family: F.text, color: C.tag, tracking: tagTracking, gapBefore: 16 * u, lineH: tagSize * 1.25, width: measureTracked(ctx, tagText, tagTracking) });
    }
    padTop = 26 * u;
  }

  if (item.type === 'show') {
    const lock = lockupMetrics(ctx, theme, 42 * u, opts.assets);
    const lockGap = lock ? 30 * u : 0;
    const divW = lock ? 2.5 * u : 0;
    const maxTextW = W * (L.maxWidthFrac ?? 0.62) - padX * 2 - (lock ? lock.w + lockGap * 2 + divW : 0);
    const title = fitLines(ctx, item.primary, {
      family: F.display, weight: F.displayWeight, maxSize: 54 * u, minSize: 32 * u,
      maxWidth: maxTextW, maxLines: 2,
    });
    title.lines.forEach((l) => {
      rows.push({ kind: 'line', text: l.text, size: title.size, weight: F.displayWeight, family: F.display, color: C.text, tracking: 0, gapBefore: 0, lineH: title.size * 1.12, width: l.width });
    });
    const sub = String(item.secondary ?? '').trim() ||
      `${theme.identity.org}${theme.identity.url ? ' · ' + theme.identity.url : ''}`;
    const subFit = fitLines(ctx, sub, {
      family: F.text, weight: F.textWeight, maxSize: 28 * u, minSize: 20 * u,
      maxWidth: maxTextW, maxLines: 1,
    });
    rows.push({ kind: 'secondary', text: subFit.lines[0]?.text ?? '', size: subFit.size, weight: F.textWeight, family: F.text, color: C.tag, tracking: 0, gapBefore: 14 * u, lineH: subFit.size * 1.2, width: subFit.lines[0]?.width ?? 0 });
    padTop = 30 * u;
    plan.showLock = lock ? { lock, lockGap, divW } : null;
  }

  // --- panel box ---------------------------------------------------------

  const contentH = rows.reduce((a, r) => a + r.gapBefore + r.lineH, 0);
  const padBottom = item.type === 'speaker' ? 28 * u : item.type === 'article' ? 26 * u : 28 * u;
  panelH = padTop + contentH + padBottom;

  const contentW = Math.max(...rows.map((r) => r.width), 300 * u);
  const leanSlack = lean * panelH * 0.55; // room so the leaning edge never clips text
  if (item.type === 'show' && plan.showLock) {
    const { lock, lockGap, divW } = plan.showLock;
    panelW = padX * 2 + lock.w + lockGap * 2 + divW + contentW + leanSlack;
  } else {
    panelW = padX * 2 + contentW + leanSlack;
  }
  panelW = Math.min(panelW, W * maxFrac + leanSlack);

  const px = L.position === 'center' ? (W - panelW - lean * panelH) / 2 : mx;
  const py = H - my - panelH;
  const panelBottom = py + panelH;
  plan.panel = { x: px, y: py, w: panelW, h: panelH };

  // x of the panel's left edge at a given y (the lean line)
  const edgeX = (y) => px + lean * (panelBottom - y);

  // --- text positions ----------------------------------------------------

  const textX0 = (item.type === 'show' && plan.showLock)
    ? edgeX(py + panelH * 0.45) + padX + plan.showLock.lock.w + plan.showLock.lockGap * 2 + plan.showLock.divW
    : edgeX(py + panelH * 0.45) + padX;

  let cy = py + padTop;
  let idx = 0;
  for (const r of rows) {
    cy += r.gapBefore;
    const baseline = cy + r.size * 0.84;
    plan.texts.push({ ...r, x: textX0, y: baseline, index: idx++ });
    cy += r.lineH;
  }

  // --- show lockup + divider placement -----------------------------------

  if (item.type === 'show' && plan.showLock) {
    const { lock, lockGap, divW } = plan.showLock;
    const zoneX = edgeX(py + panelH * 0.45) + padX;
    const centerY = py + panelH / 2;
    plan.lockup = { m: lock, x: zoneX, baselineY: centerY + lock.h / 2 };
    plan.divider = { x: zoneX + lock.w + lockGap, y0: py + 22 * u, y1: panelBottom - 22 * u, w: divW };
  }

  // --- badge (article) — juts up over the top edge, protrudes left -------

  if (item.type === 'article' && String(item.badge ?? '').trim()) {
    const badgeText = theme.flags.uppercaseBadge ? item.badge.toUpperCase() : item.badge;
    const bSize = 29 * u;
    const bTrack = 2.2 * u;
    setFont(ctx, F.displayWeight, bSize, F.display);
    const btw = measureTracked(ctx, badgeText, bTrack);
    const bh = bSize + 25 * u;
    const bw = btw + 46 * u;
    const bBottomY = py + bh * 0.42; // 58% juts above the panel top
    const bx = edgeX(bBottomY) - 14 * u; // bottom-left, protruding left of the edge
    plan.badge = { text: badgeText, x: bx, y: bBottomY - bh, w: bw, h: bh, size: bSize, tracking: bTrack };
  }

  // --- station tab (speaker + article) — juts above the top-right --------

  if (item.type !== 'show' && theme.flags.markOnAll && theme.identity.markStyle !== 'none') {
    const tabCapH = 16 * u;
    const m = lockupMetrics(ctx, theme, tabCapH, opts.assets);
    if (m) {
      const tabPad = 17 * u;
      const th = 45 * u;
      const tw = m.w + tabPad * 2 + lean * th;
      const topRightX = px + lean * panelH + panelW; // panel's top-right corner
      const tabBottomY = py + 2 * u; // tiny overlap, no hairline gap
      const tbx = topRightX - (item.type === 'article' ? 26 * u : 30 * u) - tw;
      plan.tab = { x: tbx, y: tabBottomY - th, w: tw, h: th, m, pad: tabPad };
    }
  }

  // --- accent blade — floats off the left edge, overhangs top & bottom ---

  if (theme.flags.blade) {
    const overhang = 17 * u;
    const bladeW = 14 * u;
    const bladeH = panelH + overhang * 2;
    const bladeBottomY = panelBottom + overhang;
    const bx = edgeX(bladeBottomY) - 26 * u - bladeW;
    plan.blade = { x: bx, y: py - overhang, w: bladeW, h: bladeH };
  }

  // --- stripe tail — streaks out past the bottom-right -------------------

  if (stripes.length) {
    const exts = [150, 92, 46, 24];
    const bands = stripes.map((color, i) => ({
      color,
      y: panelBottom + i * bandH,
      ext: (exts[i] ?? 20) * u,
    }));
    plan.stripeTail = { bands, bandH, startFrac: 0.45 };
  }

  return plan;
}

// ------------------------------------------------------------------- paint ---

/**
 * Draw one frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} t seconds, 0 .. totalDuration(opts)
 * @param {TitleItem} item
 * @param {object} theme
 * @param {object} opts {width,height,inDur,holdDur,outDur,assets?}
 */
export function drawFrame(ctx, t, item, theme, opts) {
  const { width: W, height: H } = opts;
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const plan = computeLayout(ctx, item, theme, opts);
  if (!plan.panel) return;

  const anim = theme.animation ?? 'slide';
  const inP = opts.inDur > 0 ? clamp01(t / opts.inDur) : 1;
  const outStart = opts.inDur + opts.holdDur;
  const outP = opts.outDur > 0 ? clamp01((t - outStart) / opts.outDur) : (t >= outStart ? 1 : 0);
  const u = plan.u;
  const C = theme.colors;
  const lean = plan.shape.lean;
  const P = plan.panel;

  // Group (out) transform
  const og = easeInCubic(outP);
  let gx = 0, gy = 0;
  const galpha = 1 - og;
  if (anim === 'slide' || anim === 'wipe') gx = 60 * u * og;
  if (anim === 'rise') gy = 44 * u * og;
  if (galpha <= 0) return;

  // Panel (in) transform
  const pPanel = ph(inP, 0, 0.72);
  let pdx = 0, pdy = 0;
  let panelAlpha = pPanel;
  if (anim === 'slide') pdx = -70 * u * (1 - pPanel);
  if (anim === 'rise') pdy = 50 * u * (1 - pPanel);
  if (anim === 'wipe') panelAlpha = 1;

  const shadowOn = theme.flags.shadow;
  const setShadow = (blur, dy, a) => {
    if (!shadowOn) return;
    ctx.shadowColor = `rgba(10, 8, 30, ${a})`;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetY = dy;
  };
  const clearShadow = () => {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  };

  ctx.save();
  ctx.translate(gx, gy);

  // Wipe reveal clips the whole card
  if (anim === 'wipe' && inP < 1) {
    const wp = ph(inP, 0, 0.8);
    ctx.beginPath();
    ctx.rect(P.x - 90 * u, P.y - 140 * u, (P.w + lean * P.h + 320 * u) * wp, P.h + 280 * u);
    ctx.clip();
  }

  // --- accent blade (behind everything, early entrance)
  if (plan.blade) {
    const b = plan.blade;
    const bp = ph(inP, 0.02, 0.6);
    ctx.save();
    ctx.globalAlpha = galpha * bp;
    const grow = anim === 'fade' ? 1 : bp;
    const bh = b.h * grow;
    const byTop = b.y + (b.h - bh) / 2; // grows from center
    const bxAdj = b.x + lean * ((b.y + b.h) - (byTop + bh)); // keep on the lean line
    setShadow(10 * u, 4 * u, 0.25);
    paraPath(ctx, bxAdj + pdx * 0.5, byTop + pdy * 0.5, b.w, bh, lean * bh);
    ctx.fillStyle = C.accent;
    ctx.fill();
    clearShadow();
    ctx.restore();
  }

  // --- stripe tail (streaks in with stagger, behind the panel)
  if (plan.stripeTail) {
    const st = plan.stripeTail;
    ctx.save();
    for (let i = 0; i < st.bands.length; i++) {
      const band = st.bands[i];
      const sp = ph(inP, 0.16 + i * 0.07, 0.55);
      if (sp <= 0) continue;
      ctx.globalAlpha = galpha * Math.min(1, sp * 1.6);
      const yTop = band.y;
      const startX = P.x - lean * (yTop + st.bandH - (P.y + P.h)) + P.w * st.startFrac;
      const fullLen = P.w * (1 - st.startFrac) + band.ext;
      const len = fullLen * (anim === 'fade' ? 1 : sp);
      paraPath(ctx, startX + pdx, yTop + pdy, len, st.bandH + 0.5, lean * st.bandH);
      ctx.fillStyle = band.color;
      ctx.fill();
    }
    ctx.restore();
  }

  // --- main panel
  ctx.save();
  ctx.globalAlpha = galpha * (anim === 'fade' ? pPanel : panelAlpha);
  setShadow(26 * u, 10 * u, 0.38);
  shapePath(ctx, plan.shape, P.x + pdx, P.y + pdy, P.w, P.h);
  ctx.fillStyle = C.panel;
  ctx.fill();
  clearShadow();
  ctx.restore();

  // --- badge chip (article)
  if (plan.badge) {
    const b = plan.badge;
    const bp = ph(inP, 0.1, 0.6);
    ctx.save();
    ctx.globalAlpha = galpha * bp;
    const byOff = (anim === 'fade' ? 0 : 18 * u * (1 - bp)) + pdy;
    setShadow(14 * u, 5 * u, 0.28);
    shapePath(ctx, plan.shape, b.x + pdx, b.y + byOff, b.w, b.h);
    ctx.fillStyle = C.badgeBg;
    ctx.fill();
    clearShadow();
    setFont(ctx, theme.fonts.displayWeight, b.size, theme.fonts.display);
    ctx.fillStyle = C.badgeText;
    const btw = measureTracked(ctx, b.text, b.tracking);
    drawTracked(
      ctx, b.text,
      b.x + pdx + plan.shape.lean * b.h * 0.5 + (b.w - btw) / 2,
      b.y + byOff + b.h / 2 + b.size * 0.36,
      b.tracking,
    );
    ctx.restore();
  }

  // --- station tab (speaker + article)
  if (plan.tab) {
    const tb = plan.tab;
    const tp = ph(inP, 0.22, 0.55);
    ctx.save();
    ctx.globalAlpha = galpha * tp;
    const tyOff = (anim === 'fade' ? 0 : 14 * u * (1 - tp)) + pdy;
    shapePath(ctx, plan.shape, tb.x + pdx, tb.y + tyOff, tb.w, tb.h);
    ctx.fillStyle = C.panel;
    ctx.fill();
    const m = tb.m;
    const baselineY = tb.y + tyOff + tb.h / 2 + m.h / 2 - 1 * u;
    drawLockup(ctx, m, tb.x + pdx + plan.shape.lean * tb.h * 0.6 + tb.pad, baselineY, theme, opts.assets);
    ctx.restore();
  }

  // --- show lockup + divider
  if (plan.lockup) {
    const mp = ph(inP, 0.14, 0.6);
    ctx.save();
    ctx.globalAlpha = galpha * mp;
    const mdx = (anim === 'fade' ? 0 : -18 * u * (1 - mp)) + pdx;
    drawLockup(ctx, plan.lockup.m, plan.lockup.x + mdx, plan.lockup.baselineY + pdy, theme, opts.assets);
    if (plan.divider) {
      ctx.globalAlpha = galpha * mp * 0.3;
      const d = plan.divider;
      paraPath(ctx, d.x - lean * (d.y1 - (P.y + P.h)) + mdx, d.y0 + pdy, d.w, d.y1 - d.y0, lean * (d.y1 - d.y0));
      ctx.fillStyle = C.text;
      ctx.fill();
    }
    ctx.restore();
  }

  // --- text
  for (const tx of plan.texts) {
    const tp = ph(inP, 0.2 + tx.index * 0.09, 0.58);
    ctx.save();
    ctx.globalAlpha = galpha * tp;
    const dx = (anim === 'fade' ? 0 : -26 * u * (1 - tp)) + pdx;
    const dy = (anim === 'rise' ? 12 * u * (1 - tp) : 0) + pdy;
    setFont(ctx, tx.weight, tx.size, tx.family);
    ctx.fillStyle = tx.color;
    if (tx.tracking > 0) drawTracked(ctx, tx.text, tx.x + dx, tx.y + dy, tx.tracking);
    else ctx.fillText(tx.text, tx.x + dx, tx.y + dy);
    ctx.restore();
  }

  ctx.restore();
}
