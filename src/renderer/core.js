// Community Titler — pure canvas renderer.
// Framework-free and environment-free: runs in the browser (Canvas 2D) and in
// Node (@napi-rs/canvas) so the app preview, in-browser exports, and the CLI
// batch renderer all draw pixel-identical frames.
//
// Everything is a deterministic function of time `t` (seconds) across the
// timeline: [animate in][hold][animate out].

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

  const mx = (L.marginX ?? 96) * (H / 1080);
  const my = (L.marginY ?? 72) * (H / 1080);
  const stripeBandH = theme.flags.stripe ? 6 * u : 0;
  const stripeH = theme.flags.stripe ? stripeBandH * (C.stripes?.length ?? 4) : 0;
  const padX = 44 * u;
  const radius = (L.cornerRadius ?? 10) * u;

  /** @type {any} */
  const plan = {
    u, W, H, radius, stripeH, stripeBandH, padX,
    type: item.type,
    texts: [], // {kind:'line'|'secondary'|'tag', text, x, y(baseline), size, weight, family, color, tracking, index}
    badge: null,
    mark: null,
    panel: null,
  };

  const maxFrac = L.maxWidthFrac ?? (item.type === 'article' ? 0.68 : 0.56);
  const maxTextW = W * maxFrac - padX * 2;

  if (item.type === 'speaker') {
    const name = fitLines(ctx, item.primary, {
      family: F.display, weight: F.displayWeight, maxSize: 58 * u, minSize: 36 * u,
      maxWidth: maxTextW, maxLines: 1,
    });
    const hasRole = !!String(item.secondary ?? '').trim();
    const role = hasRole
      ? fitLines(ctx, item.secondary, {
          family: F.text, weight: F.textWeight, maxSize: 33 * u, minSize: 22 * u,
          maxWidth: maxTextW, maxLines: 1,
        })
      : null;

    const padTop = 30 * u;
    const padBottom = 28 * u + stripeH;
    const gap = hasRole ? 12 * u : 0;
    const nameH = name.size * 1.04;
    const roleH = role ? role.size * 1.1 : 0;
    const contentW = Math.max(
      name.lines[0]?.width ?? 0,
      role?.lines[0]?.width ?? 0,
      300 * u,
    );
    const panelW = contentW + padX * 2;
    const panelH = padTop + nameH + gap + roleH + padBottom;
    const px = L.position === 'center' ? (W - panelW) / 2 : mx;
    const py = H - my - panelH;
    plan.panel = { x: px, y: py, w: panelW, h: panelH };

    let ty = py + padTop + name.size * 0.82;
    plan.texts.push({
      kind: 'line', index: 0, text: name.lines[0]?.text ?? '', x: px + padX, y: ty,
      size: name.size, weight: F.displayWeight, family: F.display, color: C.text, tracking: 0,
    });
    if (role) {
      ty += nameH * 0.22 + gap + role.size * 0.82;
      plan.texts.push({
        kind: 'secondary', index: 1, text: role.lines[0]?.text ?? '', x: px + padX, y: ty,
        size: role.size, weight: F.textWeight, family: F.text, color: C.secondary, tracking: 0,
      });
    }
  }

  if (item.type === 'article') {
    const badgeText = theme.flags.uppercaseBadge ? String(item.badge ?? '').toUpperCase() : String(item.badge ?? '');
    const badgeSize = 30 * u;
    const badgeTracking = 2.2 * u;
    setFont(ctx, F.displayWeight, badgeSize, F.display);
    const badgeTextW = badgeText ? measureTracked(ctx, badgeText, badgeTracking) : 0;
    const badgePadX = 24 * u;
    const badgeH = badgeSize + 26 * u;
    const badgeW = badgeText ? badgeTextW + badgePadX * 2 : 0;

    const title = fitLines(ctx, item.primary, {
      family: F.text, weight: 600, maxSize: 40 * u, minSize: 25 * u,
      maxWidth: maxTextW, maxLines: 3,
    });
    const hasTag = !!String(item.secondary ?? '').trim();
    const tagText = theme.flags.uppercaseTag ? String(item.secondary ?? '').toUpperCase() : String(item.secondary ?? '');
    const tagSize = 21.5 * u;
    const tagTracking = 1.6 * u;
    setFont(ctx, 600, tagSize, F.text);
    const tagW = hasTag ? measureTracked(ctx, tagText, tagTracking) : 0;

    const lineH = title.size * 1.22;
    const padTop = (badgeText ? badgeH / 2 : 0) + 24 * u;
    const padBottom = 26 * u + stripeH;
    const gapTag = hasTag ? 18 * u : 0;
    const contentW = Math.max(...title.lines.map((l) => l.width), tagW, badgeW + 40 * u, 480 * u);
    const panelW = Math.min(contentW + padX * 2, W * maxFrac);
    const panelH = padTop + title.lines.length * lineH + gapTag + (hasTag ? tagSize * 1.25 : 0) + padBottom;
    const px = L.position === 'center' ? (W - panelW) / 2 : mx;
    const py = H - my - panelH;
    plan.panel = { x: px, y: py, w: panelW, h: panelH };

    if (badgeText) {
      plan.badge = {
        text: badgeText, x: px + 36 * u, y: py - badgeH / 2, w: badgeW, h: badgeH,
        size: badgeSize, tracking: badgeTracking, r: 10 * u,
      };
    }

    let ty = py + padTop + title.size * 0.85;
    title.lines.forEach((l, i) => {
      plan.texts.push({
        kind: 'line', index: i, text: l.text, x: px + padX, y: ty + i * lineH,
        size: title.size, weight: 600, family: F.text, color: C.text, tracking: 0,
      });
    });
    if (hasTag) {
      plan.texts.push({
        kind: 'tag', index: title.lines.length, text: tagText, x: px + padX,
        y: py + padTop + title.lines.length * lineH + gapTag + tagSize * 0.8,
        size: tagSize, weight: 600, family: F.text, color: C.tag, tracking: tagTracking,
      });
    }
  }

  if (item.type === 'show') {
    // Station mark zone (arches/logo/chip) + divider + event title / org line
    const markStyle = opts.assets?.logo ? 'image' : (theme.identity.markStyle ?? 'arches');
    let markW = 0;
    let mark = null;
    if (markStyle === 'arches') {
      const R = 56 * u;
      setFont(ctx, F.displayWeight, 40 * u, F.display);
      const bigW = measure(ctx, theme.identity.short || 'BIG');
      markW = Math.max(2 * R, bigW);
      mark = { style: 'arches', R, w: markW, shortSize: 40 * u };
    } else if (markStyle === 'image') {
      const img = opts.assets.logo;
      const targetH = 108 * u;
      const iw = (img.width / img.height) * targetH;
      markW = iw;
      mark = { style: 'image', w: iw, h: targetH };
    } else if (markStyle === 'chip') {
      setFont(ctx, F.displayWeight, 44 * u, F.display);
      markW = measure(ctx, theme.identity.short || 'TV') + 36 * u;
      mark = { style: 'chip', w: markW, size: 44 * u };
    }
    const divGap = mark ? 32 * u : 0;
    const divW = mark ? 2 * u : 0;

    const textMaxW = W * (L.maxWidthFrac ?? 0.62) - padX * 2 - markW - divGap * 2 - divW;
    const title = fitLines(ctx, item.primary, {
      family: F.display, weight: F.displayWeight, maxSize: 54 * u, minSize: 32 * u,
      maxWidth: textMaxW, maxLines: 2,
    });
    const sub = String(item.secondary ?? '').trim() ||
      `${theme.identity.org}${theme.identity.url ? ' · ' + theme.identity.url : ''}`;
    const subFit = fitLines(ctx, sub, {
      family: F.text, weight: F.textWeight, maxSize: 28 * u, minSize: 20 * u,
      maxWidth: textMaxW, maxLines: 1,
    });

    const lineH = title.size * 1.12;
    const padTop = 30 * u;
    const padBottom = 28 * u + stripeH;
    const gap = 14 * u;
    const textW = Math.max(...title.lines.map((l) => l.width), subFit.lines[0]?.width ?? 0);
    const panelW = (mark ? markW + divGap * 2 + divW : 0) + textW + padX * 2;
    const panelH = padTop + title.lines.length * lineH + gap + subFit.size * 1.2 + padBottom;
    const px = L.position === 'center' ? (W - panelW) / 2 : mx;
    const py = H - my - panelH;
    plan.panel = { x: px, y: py, w: panelW, h: panelH };

    const contentH = panelH - stripeH;
    if (mark) {
      plan.mark = { ...mark, x: px + padX, cy: py + contentH / 2 };
      plan.divider = { x: px + padX + markW + divGap, y0: py + 26 * u, y1: py + contentH - 26 * u, w: divW };
    }
    const tx = px + padX + (mark ? markW + divGap * 2 + divW : 0);
    let ty = py + padTop + title.size * 0.84;
    title.lines.forEach((l, i) => {
      plan.texts.push({
        kind: 'line', index: i, text: l.text, x: tx, y: ty + i * lineH,
        size: title.size, weight: F.displayWeight, family: F.display, color: C.text, tracking: 0,
      });
    });
    plan.texts.push({
      kind: 'secondary', index: title.lines.length, text: subFit.lines[0]?.text ?? '', x: tx,
      y: py + padTop + title.lines.length * lineH + gap + subFit.size * 0.82,
      size: subFit.size, weight: F.textWeight, family: F.text, color: C.tag, tracking: 0,
    });
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

  // Group (out) transform
  const og = easeInCubic(outP);
  let gx = 0, gy = 0;
  const galpha = 1 - og;
  if (anim === 'slide' || anim === 'wipe') gx = 60 * u * og;
  if (anim === 'rise') gy = 44 * u * og;
  if (galpha <= 0) return;

  // Panel (in) transform
  const pPanel = ph(inP, 0, 0.72);
  let px = 0, py = 0;
  let panelAlpha = pPanel;
  if (anim === 'slide') px = -70 * u * (1 - pPanel);
  if (anim === 'rise') py = 50 * u * (1 - pPanel);
  if (anim === 'wipe') { px = 0; panelAlpha = 1; }

  const P = plan.panel;

  ctx.save();
  ctx.translate(gx + px, gy + py);

  // Wipe reveal clips the whole card
  if (anim === 'wipe' && inP < 1) {
    const wp = ph(inP, 0, 0.8);
    ctx.beginPath();
    ctx.rect(P.x - 40 * u, P.y - 120 * u, (P.w + 80 * u) * wp, P.h + 200 * u);
    ctx.clip();
  }

  // --- panel
  ctx.globalAlpha = galpha * (anim === 'fade' ? pPanel : panelAlpha);
  if (theme.flags.shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(10, 8, 30, 0.38)';
    ctx.shadowBlur = 26 * u;
    ctx.shadowOffsetY = 10 * u;
    roundRectPath(ctx, P.x, P.y, P.w, P.h, plan.radius);
    ctx.fillStyle = C.panel;
    ctx.fill();
    ctx.restore();
  } else {
    roundRectPath(ctx, P.x, P.y, P.w, P.h, plan.radius);
    ctx.fillStyle = C.panel;
    ctx.fill();
  }

  // --- stripes (clipped to panel, along bottom edge)
  if (plan.stripeH > 0 && C.stripes?.length) {
    ctx.save();
    roundRectPath(ctx, P.x, P.y, P.w, P.h, plan.radius);
    ctx.clip();
    const n = C.stripes.length;
    for (let i = 0; i < n; i++) {
      const sp = ph(inP, 0.1 + i * 0.07, 0.55);
      ctx.globalAlpha = galpha * sp;
      const y = P.y + P.h - plan.stripeH + i * plan.stripeBandH;
      ctx.fillStyle = C.stripes[i];
      ctx.fillRect(P.x, y, P.w * (anim === 'fade' ? 1 : sp), plan.stripeBandH + 0.6);
    }
    ctx.restore();
  }

  // --- badge chip
  if (plan.badge) {
    const b = plan.badge;
    const bp = ph(inP, 0.1, 0.6);
    ctx.save();
    ctx.globalAlpha = galpha * bp;
    const byOff = anim === 'fade' ? 0 : 16 * u * (1 - bp);
    if (theme.flags.shadow) {
      ctx.shadowColor = 'rgba(10, 8, 30, 0.28)';
      ctx.shadowBlur = 14 * u;
      ctx.shadowOffsetY = 5 * u;
    }
    roundRectPath(ctx, b.x, b.y + byOff, b.w, b.h, b.r);
    ctx.fillStyle = C.badgeBg;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    setFont(ctx, theme.fonts.displayWeight, b.size, theme.fonts.display);
    ctx.fillStyle = C.badgeText;
    drawTracked(ctx, b.text, b.x + (b.w - measureTracked(ctx, b.text, b.tracking)) / 2, b.y + byOff + b.h / 2 + b.size * 0.36, b.tracking);
    ctx.restore();
  }

  // --- station mark (show type)
  if (plan.mark) {
    const m = plan.mark;
    const mp = ph(inP, 0.14, 0.6);
    ctx.save();
    ctx.globalAlpha = galpha * mp;
    if (m.style === 'arches') {
      const archBaseY = m.cy + 6 * u;
      drawArches(ctx, m.x + m.w / 2, archBaseY - m.shortSize * 0.95, m.R, C.archColors ?? C.stripes, C.archCenter ?? C.text);
      setFont(ctx, theme.fonts.displayWeight, m.shortSize, theme.fonts.display);
      ctx.fillStyle = C.text;
      const sw = measure(ctx, theme.identity.short || 'BIG');
      ctx.fillText(theme.identity.short || 'BIG', m.x + (m.w - sw) / 2, archBaseY + m.shortSize * 0.42);
    } else if (m.style === 'image' && opts.assets?.logo) {
      ctx.drawImage(opts.assets.logo, m.x, m.cy - m.h / 2, m.w, m.h);
    } else if (m.style === 'chip') {
      setFont(ctx, theme.fonts.displayWeight, m.size, theme.fonts.display);
      ctx.fillStyle = C.accent;
      roundRectPath(ctx, m.x, m.cy - m.size * 0.78, m.w, m.size * 1.56, 10 * u);
      ctx.fill();
      ctx.fillStyle = C.badgeText;
      const sw = measure(ctx, theme.identity.short || 'TV');
      ctx.fillText(theme.identity.short || 'TV', m.x + (m.w - sw) / 2, m.cy + m.size * 0.36);
    }
    ctx.restore();
    if (plan.divider) {
      ctx.save();
      ctx.globalAlpha = galpha * mp * 0.3;
      ctx.fillStyle = C.text;
      ctx.fillRect(plan.divider.x, plan.divider.y0, plan.divider.w, plan.divider.y1 - plan.divider.y0);
      ctx.restore();
    }
  }

  // --- text
  for (const tx of plan.texts) {
    const tp = ph(inP, 0.2 + tx.index * 0.09, 0.58);
    ctx.save();
    ctx.globalAlpha = galpha * tp;
    const dx = anim === 'fade' ? 0 : -26 * u * (1 - tp);
    const dy = anim === 'rise' ? 12 * u * (1 - tp) : 0;
    setFont(ctx, tx.weight, tx.size, tx.family);
    ctx.fillStyle = tx.color;
    if (tx.tracking > 0) drawTracked(ctx, tx.text, tx.x + dx, tx.y + dy, tx.tracking);
    else ctx.fillText(tx.text, tx.x + dx, tx.y + dy);
    ctx.restore();
  }

  ctx.restore();
}
