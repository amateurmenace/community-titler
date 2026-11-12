// Community Titler — pure canvas renderer.
// Framework-free and environment-free: runs in the browser (Canvas 2D), in
// Electron, and in Node (@napi-rs/canvas) so the app preview, exports and the
// CLI batch renderer all draw pixel-identical frames.
//
// Everything is a deterministic function of time `t` (seconds) across the
// timeline: [animate in][hold][animate out].
//
// Design language ("tile build"): a rounded station tile carrying the mark,
// an optional badge tile (article number), then a stack of bars — the name bar,
// a thin brand stripe, and a light sub bar. The build-in animation assembles
// the title piece by piece: the tile pops in, the arches draw on, the name bar
// extends out of the tile, the name wipes in, the stripe draws, the sub bar
// wipes out underneath and its text settles. The out reverses the build.

/** @typedef {{id?:string,type:'show'|'speaker'|'article',badge:string,primary:string,secondary:string,size?:'auto'|'standard'|'large',textScale?:number}} TitleItem */

// ---------------------------------------------------------------- easing ---

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOutQuint = (x) => 1 - Math.pow(1 - x, 5);
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x) => x * x * x;
const easeInQuad = (x) => x * x;
const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeInBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * x * x * x - c1 * x * x;
};

/** Progress of a sub-animation that runs from `a` to `b` (fractions of the phase). */
function stage(p, a, b, ease = easeOutCubic) {
  if (b <= a) return p >= b ? 1 : 0;
  return ease(clamp01((p - a) / (b - a)));
}

// ---------------------------------------------------------------- helpers ---

function rrect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Rounded rect with per-corner radii {tl,tr,br,bl}. */
function rrectCorners(ctx, x, y, w, h, c) {
  const lim = (r) => Math.max(0, Math.min(r, w / 2, h / 2));
  const tl = lim(c.tl), tr = lim(c.tr), br = lim(c.br), bl = lim(c.bl);
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr); else ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - br);
  if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br); else ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + bl, y + h);
  if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl); else ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + tl);
  if (tl) ctx.arcTo(x, y, x + tl, y, tl); else ctx.lineTo(x, y);
  ctx.closePath();
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
    if (lines.some((l) => measure(ctx, l) > maxWidth) && size > minSize) continue;
    return { size, lines: lines.map((l) => ({ text: l, width: measure(ctx, l) })), truncated: false };
  }
  // Last resort: hard-clip at min size (and say so, so the layout can go large)
  setFont(ctx, weight, minSize, family);
  const lines = [];
  let line = '';
  for (const word of words) {
    const probe = line ? line + ' ' + word : word;
    if (measure(ctx, probe) <= maxWidth || !line) line = probe;
    else { lines.push(line); line = word; if (lines.length >= maxLines) break; }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const used = lines.reduce((n, l) => n + l.split(' ').length, 0);
  return { size: minSize, lines: lines.map((l) => ({ text: l, width: measure(ctx, l) })), truncated: used < words.length };
}

/** Split "Article 7" / "ART 12A" / "7" into {word, num}; anything else → {single}. */
function splitBadge(text) {
  const s = String(text ?? '').trim();
  let m = s.match(/^([A-Za-z.]+)\s+#?(\d+[A-Za-z]?)$/);
  if (m) return { word: m[1], num: m[2] };
  m = s.match(/^#?(\d+[A-Za-z]?)$/);
  if (m) return { word: '', num: m[1] };
  return { single: s };
}

// ----------------------------------------------------------------- arches ---

/**
 * Station arches: three concentric stroked half-rings (outer → inner), flat
 * along baseY, centered on cx. `draw` 0..1 sweeps each ring on from its left
 * end over the top to the right. R is the outer radius, `sw` the stroke width.
 */
export function drawArches(ctx, cx, baseY, R, colors, sw, draws = [1, 1, 1]) {
  const radii = [R - sw / 2, R - sw * 1.5 - sw * 0.35, R - sw * 2.5 - sw * 0.7];
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineWidth = sw;
  for (let i = 0; i < 3; i++) {
    const d = clamp01(draws[i] ?? 1);
    if (d <= 0) continue;
    ctx.beginPath();
    ctx.strokeStyle = colors[i] ?? colors[colors.length - 1] ?? '#fff';
    ctx.arc(cx, baseY, radii[i], Math.PI, Math.PI + Math.PI * d, false);
    ctx.stroke();
  }
  ctx.restore();
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
 * Pure measurement — no painting.
 */
function computeLayout(ctx, item, theme, opts) {
  const W = opts.width;
  const H = opts.height;
  const u = (H / 1080) * (theme.layout.scale ?? 1);
  const C = theme.colors;
  const F = theme.fonts;
  const L = theme.layout;
  const FL = theme.flags;
  const id = theme.identity;

  // Size multipliers: per look (fonts.*Size, 1 = default) and per title
  // (textScale nudges the main text only).
  const kDisplay = (F.displaySize ?? 1) * (item.textScale ?? 1);
  const kText = (F.textSize ?? 1) * (item.textScale ?? 1);
  const kSub = F.subSize ?? 1;
  const kLabel = F.labelSize ?? 1;
  const kBadge = F.badgeSize ?? 1;

  const mx = (L.marginX ?? 128) * (H / 1080);
  const my = (L.marginY ?? 104) * (H / 1080);
  const r = (L.cornerRadius ?? 14) * u;

  const TILE = 140 * u;
  const GAP = 10 * u;
  const STRIPE_H = 6 * u;
  const PAD_X = 38 * u;
  const SUB_PAD_X = 34 * u;

  const type = item.type;
  const wantImage = id.markStyle === 'image' && opts.assets?.logo;
  const markStyle = wantImage ? 'image' : (id.markStyle === 'image' ? 'chip' : (id.markStyle ?? 'arches'));
  const showTile = markStyle !== 'none' && (type === 'show' || FL.markOnAll !== false);

  /** @type {any} */
  const plan = { u, W, H, r, type, large: false, tile: null, badge: null, bar: null, stripe: null, sub: null };

  // --- badge (article number) -------------------------------------------
  let badge = null;
  if (type === 'article' && String(item.badge ?? '').trim()) {
    const raw = FL.uppercaseBadge !== false ? item.badge.toUpperCase() : item.badge;
    const parts = splitBadge(raw);
    if (parts.single !== undefined) {
      const size = 24 * u * kBadge;
      setFont(ctx, F.labelWeight ?? 700, size, F.label ?? F.text);
      const tw = measureTracked(ctx, parts.single, 1.5 * u);
      badge = { single: parts.single, size, tracking: 1.5 * u, w: Math.max(TILE * 0.8, tw + 36 * u) };
    } else {
      const wordSize = 15 * u * kBadge;
      const numSize = (parts.num.length > 2 ? 50 : 58) * u * kBadge;
      setFont(ctx, F.labelWeight ?? 700, wordSize, F.label ?? F.text);
      const ww = parts.word ? measureTracked(ctx, parts.word, 2.2 * u) : 0;
      setFont(ctx, 800, numSize, F.label ?? F.text);
      const nw = measure(ctx, parts.num);
      badge = { word: parts.word, num: parts.num, wordSize, numSize, tracking: 2.2 * u, w: Math.max(110 * u, Math.max(ww, nw) + 40 * u) };
    }
  }

  // --- bars x origin -----------------------------------------------------
  let x = mx;
  const tileX = x;
  if (showTile) x += TILE + GAP;
  const badgeX = x;
  if (badge) x += badge.w + GAP;
  const barsX = x;

  // --- name bar content --------------------------------------------------
  // Two sizes. Standard keeps the bars inside maxWidthFrac of the frame
  // (articles get an extra fifth). Large runs the bars out to a matching
  // right margin, raises the type sizes and allows an extra line — for the
  // long warrant articles that would otherwise shrink into illegibility.
  // 'auto' tries standard first and goes large when the text came out small.
  const measureBar = (large) => {
    const frac = Math.min(0.94, (L.maxWidthFrac ?? 0.6) + (type === 'article' ? 0.2 : 0));
    const availW = Math.max(240 * u, (large ? W - mx : W * frac) - barsX);
    const BAR_H = (large ? 108 : 96) * u;
    let family = F.display, weight = F.displayWeight, fit, lineK, floor;
    if (type === 'speaker') {
      fit = fitLines(ctx, item.primary, {
        family, weight, maxSize: (large ? 72 : 60) * u * kDisplay, minSize: (large ? 44 : 38) * u * kDisplay,
        maxWidth: availW - PAD_X * 2, maxLines: large ? 2 : 1,
      });
      lineK = 1.1; floor = 50 * u * kDisplay;
    } else if (type === 'show') {
      fit = fitLines(ctx, item.primary, {
        family, weight, maxSize: (large ? 66 : 56) * u * kDisplay, minSize: (large ? 40 : 34) * u * kDisplay,
        maxWidth: availW - PAD_X * 2, maxLines: 2,
      });
      lineK = 1.12; floor = 48 * u * kDisplay;
    } else {
      family = F.text; weight = F.textWeight ?? 600;
      fit = fitLines(ctx, item.primary, {
        family, weight, maxSize: (large ? 46 : 36) * u * kText, minSize: (large ? 32 : 24) * u * kText,
        maxWidth: availW - PAD_X * 2, maxLines: large ? 4 : 3,
      });
      lineK = 1.2; floor = 35 * u * kText; // i.e. go large as soon as standard has to shrink
    }
    const lines = fit.lines.length ? fit.lines : [{ text: '', width: 0 }];
    const lineH = fit.size * lineK;
    const padY = Math.max((large ? 26 : 22) * u, (BAR_H - lineH) / 2);
    const barH = Math.max(BAR_H, padY * 2 + lines.length * lineH);
    const textW = Math.max(...lines.map((l) => l.width));
    const barW = Math.max(220 * u, textW + PAD_X * 2);
    const cramped = fit.truncated || fit.size < floor;
    return { large, availW, lines, size: fit.size, family, weight, lineH, padY, barH, barW, cramped };
  };
  const sizeMode = item.size ?? 'auto';
  let bar = measureBar(sizeMode === 'large');
  if (sizeMode === 'auto' && bar.cramped) bar = measureBar(true);
  const large = bar.large;
  plan.large = large;
  const { availW, lines, size, family, weight, lineH, padY, barH, barW } = bar;

  // --- sub bar -----------------------------------------------------------
  let subText = String(item.secondary ?? '').trim();
  if (type === 'show' && !subText) {
    subText = `${id.org ?? ''}${id.url ? ' · ' + id.url : ''}`.trim();
  }
  if (type === 'article' && FL.uppercaseTag) subText = subText.toUpperCase();
  let sub = null;
  if (subText && FL.subBar !== false) {
    const SUB_H = (large ? 52 : 46) * u * Math.max(0.8, Math.min(1.5, kSub));
    const tracking = type === 'article' && FL.uppercaseTag ? 1.4 * u : 0;
    const fit = fitLines(ctx, subText, {
      family: F.text, weight: F.textWeight, maxSize: (large ? 28 : 26) * u * kSub, minSize: 18 * u * kSub,
      maxWidth: availW - SUB_PAD_X * 2, maxLines: 1,
    });
    const text = fit.lines[0]?.text ?? '';
    setFont(ctx, F.textWeight, fit.size, F.text);
    const w = tracking ? measureTracked(ctx, text, tracking) : measure(ctx, text);
    sub = { text, size: fit.size, tracking, w: w + SUB_PAD_X * 2, h: SUB_H };
  }

  // --- vertical stack ----------------------------------------------------
  const stripeOn = FL.stripe !== false && (C.stripes?.length ?? 0) > 0;
  const stripeH = stripeOn ? STRIPE_H : 0;
  const stackH = barH + stripeH + (sub ? sub.h : 0);
  const tileH = Math.max(TILE, stackH - 8 * u);
  const groupH = Math.max(stackH, tileH);
  const bottom = H - my;
  const stackY = bottom - groupH + (groupH - stackH) / 2;
  const tileY = bottom - groupH + (groupH - tileH) / 2;

  // --- horizontal centering (optional) ----------------------------------
  const rightEdge = barsX + Math.max(barW, sub ? sub.w : 0);
  let shift = 0;
  if (L.position === 'center') shift = (W - (rightEdge - tileX)) / 2 - tileX;

  // --- assemble ----------------------------------------------------------
  if (showTile) {
    const mark = { style: markStyle, short: id.short || 'TV' };
    if (markStyle === 'image') {
      const img = opts.assets.logo;
      const pad = 16 * u;
      const bw = TILE - pad * 2, bh = tileH - pad * 2;
      const s = Math.min(bw / img.width, bh / img.height);
      mark.img = img; mark.w = img.width * s; mark.h = img.height * s;
    } else if (markStyle === 'arches') {
      // The rainbow over the short name set big and tight — as in the BIG
      // logo, the word runs a touch wider than the arches.
      mark.R = 48 * u; mark.sw = 13 * u;
      mark.labelSize = 56 * u * kLabel; mark.tracking = 1 * u;
      setFont(ctx, F.labelWeight ?? 700, mark.labelSize, F.label ?? F.text);
      mark.labelW = measureTracked(ctx, mark.short, mark.tracking);
      const maxW = TILE - 18 * u;
      if (mark.labelW > maxW) {
        mark.labelSize *= maxW / mark.labelW;
        setFont(ctx, F.labelWeight ?? 700, mark.labelSize, F.label ?? F.text);
        mark.labelW = measureTracked(ctx, mark.short, mark.tracking);
      }
    } else { // chip — the short name, big
      mark.labelSize = (mark.short.length > 3 ? 34 : 44) * u * kLabel;
      mark.tracking = 1.5 * u;
      setFont(ctx, F.labelWeight ?? 700, mark.labelSize, F.label ?? F.text);
      mark.labelW = measureTracked(ctx, mark.short, mark.tracking);
      if (mark.labelW > TILE - 20 * u) {
        mark.labelSize *= (TILE - 20 * u) / mark.labelW;
        setFont(ctx, F.labelWeight ?? 700, mark.labelSize, F.label ?? F.text);
        mark.labelW = measureTracked(ctx, mark.short, mark.tracking);
      }
    }
    plan.tile = { x: tileX + shift, y: tileY, w: TILE, h: tileH, mark };
  }
  if (badge) {
    plan.badge = { ...badge, x: badgeX + shift, y: tileY, h: tileH };
  }
  plan.bar = {
    x: barsX + shift, y: stackY, w: barW, h: barH,
    padX: PAD_X, padY, lines, size, lineH, family, weight,
  };
  if (stripeOn) {
    plan.stripe = { x: barsX + shift, y: stackY + barH, w: barW, h: stripeH, colors: C.stripes };
  }
  if (sub) {
    plan.sub = { ...sub, x: barsX + shift, y: stackY + barH + stripeH, padX: SUB_PAD_X };
  }
  plan.stackY = stackY;
  plan.stackH = stackH;
  return plan;
}

// ------------------------------------------------------------- choreography ---

/**
 * Per-element progress (0 = absent, 1 = at rest) for the build animation.
 * `inP` / `outP` are the raw phase fractions.
 */
function buildStages(inP, outP) {
  const inPhase = inP < 1;
  const outPhase = outP > 0;
  const S = (a, b, ease, a2, b2, ease2) => {
    if (inPhase) return stage(inP, a, b, ease);
    if (outPhase) return 1 - stage(outP, a2, b2, ease2);
    return 1;
  };
  return {
    tile: S(0.0, 0.3, easeOutBack, 0.72, 1.0, easeInBack),
    arcs: [
      S(0.12, 0.42, easeOutCubic, 0.62, 0.84, easeInCubic),
      S(0.18, 0.48, easeOutCubic, 0.56, 0.78, easeInCubic),
      S(0.24, 0.54, easeOutCubic, 0.50, 0.72, easeInCubic),
    ],
    label: S(0.36, 0.56, easeOutCubic, 0.44, 0.62, easeInQuad),
    badge: S(0.2, 0.48, easeOutBack, 0.5, 0.78, easeInBack),
    bar: S(0.3, 0.62, easeOutQuint, 0.34, 0.64, easeInCubic),
    name: S(0.5, 0.8, easeOutCubic, 0.18, 0.44, easeInCubic),
    stripe: [
      S(0.6, 0.72, easeOutCubic, 0.26, 0.38, easeInCubic),
      S(0.66, 0.78, easeOutCubic, 0.19, 0.31, easeInCubic),
      S(0.72, 0.84, easeOutCubic, 0.12, 0.24, easeInCubic),
      S(0.78, 0.9, easeOutCubic, 0.06, 0.18, easeInCubic),
    ],
    sub: S(0.64, 0.9, easeOutQuint, 0.08, 0.36, easeInCubic),
    subText: S(0.8, 1.0, easeOutCubic, 0.0, 0.18, easeInQuad),
  };
}

const AT_REST = {
  tile: 1, arcs: [1, 1, 1], label: 1, badge: 1, bar: 1, name: 1, stripe: [1, 1, 1, 1], sub: 1, subText: 1,
};

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
  const u = plan.u;
  const C = theme.colors;
  const F = theme.fonts;
  const r = plan.r;

  const anim = theme.animation ?? 'build';
  const inP = opts.inDur > 0 ? clamp01(t / opts.inDur) : 1;
  const outStart = opts.inDur + opts.holdDur;
  const outP = opts.outDur > 0 ? clamp01((t - outStart) / opts.outDur) : (t >= outStart ? 1 : 0);
  if (outP >= 1) return;

  const build = anim === 'build';
  const st = build ? buildStages(inP, outP) : AT_REST;

  // Group transform for the simple animations
  let gx = 0, gy = 0, galpha = 1;
  let clipW = null;
  if (!build) {
    const pi = easeOutQuint(inP);
    const po = easeInCubic(outP);
    galpha = Math.min(pi, 1 - po);
    if (anim === 'slide') gx = -80 * u * (1 - pi) + 60 * u * po;
    if (anim === 'rise') gy = 50 * u * (1 - pi) + 40 * u * po;
    if (anim === 'wipe') { galpha = 1 - po; clipW = inP < 1 ? easeOutQuint(inP) : null; }
    if (galpha <= 0) return;
  }

  const shadowOn = theme.flags.shadow !== false;
  const setShadow = (a = 0.32) => {
    if (!shadowOn) return;
    ctx.shadowColor = `rgba(0, 0, 0, ${a})`;
    ctx.shadowBlur = 22 * u;
    ctx.shadowOffsetY = 8 * u;
  };
  const clearShadow = () => {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  };

  ctx.save();
  ctx.translate(gx, gy);
  ctx.globalAlpha = galpha;

  if (clipW !== null) {
    const left = (plan.tile?.x ?? plan.bar.x) - 60 * u;
    const right = Math.max(plan.bar.x + plan.bar.w, plan.sub ? plan.sub.x + plan.sub.w : 0) + 60 * u;
    ctx.beginPath();
    ctx.rect(left, 0, (right - left) * clipW, H);
    ctx.clip();
  }

  const labelFont = F.label ?? F.text;
  const labelWeight = F.labelWeight ?? 700;

  // --- station tile -------------------------------------------------------
  if (plan.tile && st.tile > 0) {
    const T = plan.tile;
    const s = st.tile;
    const cx = T.x + T.w / 2, cy = T.y + T.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.001, s), Math.max(0.001, s));
    ctx.translate(-cx, -cy);
    setShadow();
    rrect(ctx, T.x, T.y, T.w, T.h, r);
    ctx.fillStyle = C.tile;
    ctx.fill();
    clearShadow();

    const m = T.mark;
    if (m.style === 'image') {
      ctx.drawImage(m.img, cx - m.w / 2, cy - m.h / 2, m.w, m.h);
    } else if (m.style === 'arches') {
      const gap = 8 * u;
      const capH = m.labelSize * 0.72;
      const blockH = m.R + gap + capH;
      const top = cy - blockH / 2;
      const baseY = top + m.R;
      drawArches(ctx, cx, baseY, m.R, C.archColors ?? C.stripes ?? ['#fff'], m.sw, st.arcs);
      if (st.label > 0) {
        ctx.save();
        ctx.globalAlpha *= st.label;
        setFont(ctx, labelWeight, m.labelSize, labelFont);
        ctx.fillStyle = C.label ?? C.text;
        const ly = baseY + gap + capH + 6 * u * (1 - st.label);
        drawTracked(ctx, m.short, cx - m.labelW / 2, ly, m.tracking);
        ctx.restore();
      }
    } else if (st.label > 0) { // chip
      ctx.save();
      ctx.globalAlpha *= st.label;
      setFont(ctx, labelWeight, m.labelSize, labelFont);
      ctx.fillStyle = C.label ?? C.text;
      drawTracked(ctx, m.short, cx - m.labelW / 2, cy + m.labelSize * 0.36, m.tracking);
      ctx.restore();
    }
    ctx.restore();
  }

  // --- badge tile (article number) ------------------------------------------
  if (plan.badge && st.badge > 0) {
    const B = plan.badge;
    const s = st.badge;
    const cx = B.x + B.w / 2, cy = B.y + B.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.001, s), Math.max(0.001, s));
    ctx.translate(-cx, -cy);
    setShadow();
    rrect(ctx, B.x, B.y, B.w, B.h, r);
    ctx.fillStyle = C.badgeBg;
    ctx.fill();
    clearShadow();
    ctx.fillStyle = C.badgeText;
    if (B.single !== undefined) {
      setFont(ctx, labelWeight, B.size, labelFont);
      const tw = measureTracked(ctx, B.single, B.tracking);
      drawTracked(ctx, B.single, cx - tw / 2, cy + B.size * 0.36, B.tracking);
    } else {
      const wordH = B.word ? B.wordSize * 0.74 : 0;
      const numH = B.numSize * 0.72;
      const gap = B.word ? 10 * u : 0;
      const top = cy - (wordH + gap + numH) / 2;
      if (B.word) {
        setFont(ctx, labelWeight, B.wordSize, labelFont);
        const ww = measureTracked(ctx, B.word, B.tracking);
        drawTracked(ctx, B.word, cx - ww / 2, top + wordH, B.tracking);
      }
      setFont(ctx, 800, B.numSize, labelFont);
      const nw = measure(ctx, B.num);
      ctx.fillText(B.num, cx - nw / 2, top + wordH + gap + numH);
    }
    ctx.restore();
  }

  // --- name bar ---------------------------------------------------------------
  const bar = plan.bar;
  const barW = bar.w * st.bar;
  const subOn = plan.sub && st.sub > 0;
  const stripeOn = plan.stripe && st.stripe.some((v) => v > 0);
  if (st.bar > 0) {
    ctx.save();
    setShadow();
    // bottom corners are square when a stripe or sub bar continues the stack
    const squareBottom = !!(plan.stripe || plan.sub);
    rrectCorners(ctx, bar.x, bar.y, Math.max(1, barW), bar.h, { tl: r, tr: r, br: squareBottom ? 0 : r, bl: squareBottom ? 0 : r });
    ctx.fillStyle = C.bar;
    ctx.fill();
    clearShadow();
    ctx.restore();
  }

  // --- stripe ------------------------------------------------------------------
  if (stripeOn) {
    const S = plan.stripe;
    const n = S.colors.length;
    const segW = S.w / n;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const d = st.stripe[Math.min(i, st.stripe.length - 1)];
      if (d <= 0) continue;
      ctx.fillStyle = S.colors[i];
      ctx.fillRect(S.x + segW * i, S.y, segW * d + (i < n - 1 ? 0.5 : 0), S.h);
    }
    ctx.restore();
  }

  // --- sub bar -----------------------------------------------------------------
  if (subOn) {
    const Sb = plan.sub;
    const w = Sb.w * st.sub;
    ctx.save();
    setShadow(0.28);
    rrectCorners(ctx, Sb.x, Sb.y, Math.max(1, w), Sb.h, { tl: 0, tr: 0, br: r, bl: r });
    ctx.fillStyle = C.subBar;
    ctx.fill();
    clearShadow();
    if (st.subText > 0) {
      ctx.beginPath();
      ctx.rect(Sb.x, Sb.y, Math.max(1, w), Sb.h);
      ctx.clip();
      ctx.globalAlpha *= st.subText;
      setFont(ctx, F.textWeight, Sb.size, F.text);
      ctx.fillStyle = C.subText;
      const ty = Sb.y + Sb.h / 2 + Sb.size * 0.36 + 6 * u * (1 - st.subText);
      if (Sb.tracking > 0) drawTracked(ctx, Sb.text, Sb.x + Sb.padX, ty, Sb.tracking);
      else ctx.fillText(Sb.text, Sb.x + Sb.padX, ty);
    }
    ctx.restore();
  }

  // --- name text (clipped to the bar, wipes in from the left) --------------------
  if (st.bar > 0 && st.name > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bar.x, bar.y - 40 * u, Math.max(1, barW) * (build ? Math.max(st.name, 0.001) : 1), bar.h + 80 * u);
    ctx.clip();
    ctx.globalAlpha *= Math.min(1, st.name * 1.5);
    setFont(ctx, bar.weight, bar.size, bar.family);
    ctx.fillStyle = C.text;
    const rise = 10 * u * (1 - st.name);
    let y = bar.y + bar.padY + bar.size * 0.78;
    for (const l of bar.lines) {
      ctx.fillText(l.text, bar.x + bar.padX, y + rise);
      y += bar.lineH;
    }
    ctx.restore();
  }

  ctx.restore();
}
