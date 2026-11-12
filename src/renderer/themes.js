// Built-in looks. A theme is plain JSON-serializable data — stations can
// duplicate one in the Look step, change colors/fonts/identity, and export it
// as a .theme.json file to share or commit.
//
// Theme format v2 ("tile build"): tile + bar + stripe + sub bar colors.
// normalizeTheme() upgrades v1 themes (panel/secondary/tag/accent) in place.

const LAYOUT = { position: 'left', marginX: 128, marginY: 104, maxWidthFrac: 0.6, cornerRadius: 14, scale: 1 };
const FLAGS = { stripe: true, shadow: true, uppercaseBadge: true, uppercaseTag: false, markOnAll: true, subBar: true };

export const BUILT_IN_THEMES = [
  {
    id: 'big',
    name: 'BIG — Brookline Interactive',
    description: 'Navy tile with the rainbow arches over a big Montserrat BIG, a tri-color stripe and a white role bar. Fraunces serif names, DM Sans text.',
    identity: { org: 'Brookline Interactive Group', short: 'BIG', url: 'brooklineinteractive.org', markStyle: 'arches' },
    fonts: { display: 'Fraunces', displayWeight: 800, text: 'DM Sans', textWeight: 600, label: 'Montserrat', labelWeight: 900 },
    colors: {
      tile: '#262262',
      bar: '#262262',
      text: '#FFFFFF',
      subBar: '#FFFFFF',
      subText: '#262262',
      label: '#FFFFFF',
      badgeBg: '#C74C9C',
      badgeText: '#FFFFFF',
      stripes: ['#C74C9C', '#F68B1F', '#FEEE32'],
      archColors: ['#C74C9C', '#F68B1F', '#FEEE32'],
    },
    layout: { ...LAYOUT },
    flags: { ...FLAGS },
    animation: 'build',
  },
  {
    id: 'civic',
    name: 'Civic Green',
    description: 'The Community AI Project look: forest green, lime stripe, cream sub bar, Inter headlines with a mono station mark.',
    identity: { org: 'Your Community Station', short: 'TV', url: 'yourstation.org', markStyle: 'chip' },
    fonts: { display: 'Inter', displayWeight: 900, text: 'Inter', textWeight: 600, label: 'JetBrains Mono', labelWeight: 700 },
    colors: {
      tile: '#052E16',
      bar: '#052E16',
      text: '#FDF9F0',
      subBar: '#FDF9F0',
      subText: '#052E16',
      label: '#4ADE80',
      badgeBg: '#4ADE80',
      badgeText: '#052E16',
      stripes: ['#4ADE80', '#34D399'],
      archColors: ['#4ADE80', '#34D399', '#FDF9F0'],
    },
    layout: { ...LAYOUT, cornerRadius: 12 },
    flags: { ...FLAGS, uppercaseTag: true },
    animation: 'build',
  },
  {
    id: 'slate',
    name: 'Broadcast Slate',
    description: 'Neutral news look: charcoal tiles, electric blue badge and stripe, DM Sans throughout. A good starting point for any station.',
    identity: { org: 'Your Community Station', short: 'TV', url: 'yourstation.org', markStyle: 'chip' },
    fonts: { display: 'DM Sans', displayWeight: 700, text: 'DM Sans', textWeight: 500, label: 'DM Sans', labelWeight: 700 },
    colors: {
      tile: '#15181E',
      bar: '#15181E',
      text: '#FFFFFF',
      subBar: '#FFFFFF',
      subText: '#15181E',
      label: '#6EA8FE',
      badgeBg: '#2563EB',
      badgeText: '#FFFFFF',
      stripes: ['#2563EB', '#6EA8FE'],
      archColors: ['#2563EB', '#6EA8FE', '#FFFFFF'],
    },
    layout: { ...LAYOUT, cornerRadius: 8 },
    flags: { ...FLAGS, uppercaseTag: true },
    animation: 'build',
  },
  {
    id: 'townhall',
    name: 'Town Hall',
    description: 'Civic classic: cream name bar, deep green tile and sub bar, a gold stripe. Feels at home over a select board meeting.',
    identity: { org: 'Your Community Station', short: 'TV', url: 'yourstation.org', markStyle: 'chip' },
    fonts: { display: 'Fraunces', displayWeight: 800, text: 'Inter', textWeight: 500, label: 'Inter', labelWeight: 700 },
    colors: {
      tile: '#1E3A2A',
      bar: '#F7F3E6',
      text: '#1E3A2A',
      subBar: '#1E3A2A',
      subText: '#F7F3E6',
      label: '#F7F3E6',
      badgeBg: '#C19A3D',
      badgeText: '#1E3A2A',
      stripes: ['#C19A3D'],
      archColors: ['#C19A3D', '#F7F3E6', '#8C6D1F'],
    },
    layout: { ...LAYOUT, cornerRadius: 6 },
    flags: { ...FLAGS },
    animation: 'build',
  },
  {
    id: 'minimal',
    name: 'Minimal Light',
    description: 'Just the facts: white bars, near-black text, a single thin accent line and no tile. Quiet enough for any program.',
    identity: { org: 'Your Community Station', short: 'TV', url: 'yourstation.org', markStyle: 'none' },
    fonts: { display: 'Inter', displayWeight: 700, text: 'Inter', textWeight: 500, label: 'Inter', labelWeight: 700 },
    colors: {
      tile: '#16181D',
      bar: '#FFFFFF',
      text: '#16181D',
      subBar: '#16181D',
      subText: '#FFFFFF',
      label: '#FFFFFF',
      badgeBg: '#16181D',
      badgeText: '#FFFFFF',
      stripes: ['#9A2C5C'],
      archColors: ['#16181D', '#5A616C', '#9A2C5C'],
    },
    layout: { ...LAYOUT, cornerRadius: 4 },
    flags: { ...FLAGS, markOnAll: false },
    animation: 'fade',
  },
];

function isDark(hex) {
  const m = String(hex ?? '').replace('#', '');
  if (m.length < 6) return true;
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 140;
}

/**
 * Fill in fields older saved themes (localStorage projects, exported .json)
 * may not have, and upgrade v1 themes to the v2 tile/bar/sub-bar model.
 */
export function normalizeTheme(t) {
  if (!t) return t;
  const out = { ...t };
  const c = { ...(t.colors ?? {}) };
  const isV1 = c.panel !== undefined && c.bar === undefined;
  if (isV1) {
    const dark = isDark(c.panel);
    c.tile = c.panel;
    c.bar = c.panel;
    c.text = c.text ?? (dark ? '#FFFFFF' : '#16181D');
    c.subBar = dark ? '#FFFFFF' : (c.badgeBg ?? '#16181D');
    c.subText = dark ? c.panel : (c.badgeText ?? '#FFFFFF');
    c.label = c.text;
    c.archColors = c.archColors ?? c.stripes ?? [];
    delete c.panel; delete c.secondary; delete c.tag; delete c.accent; delete c.archCenter;
  }
  out.colors = {
    tile: '#262262', bar: '#262262', text: '#FFFFFF', subBar: '#FFFFFF', subText: '#262262', label: '#FFFFFF',
    badgeBg: '#C74C9C', badgeText: '#FFFFFF', stripes: ['#C74C9C', '#F68B1F', '#FEEE32'], archColors: ['#C74C9C', '#F68B1F', '#FEEE32'],
    ...c,
  };
  if (!Array.isArray(out.colors.stripes)) out.colors.stripes = [];
  if (!Array.isArray(out.colors.archColors) || !out.colors.archColors.length) out.colors.archColors = out.colors.stripes.length ? out.colors.stripes : ['#C74C9C', '#F68B1F', '#FEEE32'];

  const f = { ...(t.fonts ?? {}) };
  const k = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 1);
  out.fonts = {
    display: f.display ?? 'Fraunces', displayWeight: f.displayWeight ?? 800,
    text: f.text ?? 'DM Sans', textWeight: f.textWeight ?? 600,
    label: f.label ?? f.text ?? 'DM Sans', labelWeight: f.labelWeight ?? 700,
    // size multipliers (1 = the look's default sizes)
    displaySize: k(f.displaySize), textSize: k(f.textSize), subSize: k(f.subSize),
    labelSize: k(f.labelSize), badgeSize: k(f.badgeSize),
  };
  out.identity = { org: 'Your Community Station', short: 'TV', url: '', markStyle: 'chip', ...(t.identity ?? {}) };
  out.flags = { ...FLAGS, ...(t.flags ?? {}) };
  if (isV1) {
    // v1 only showed the mark on show IDs unless markOnAll — the tile is the
    // whole point of v2, so turn it on for upgraded themes.
    out.flags.markOnAll = true;
    out.flags.uppercaseTag = false;
  }
  const l = { ...(t.layout ?? {}) };
  if (isV1) { delete l.marginX; delete l.marginY; delete l.cornerRadius; delete l.maxWidthFrac; }
  out.layout = { ...LAYOUT, ...l };
  const anims = ['build', 'slide', 'rise', 'fade', 'wipe'];
  out.animation = isV1 ? 'build' : (anims.includes(t.animation) ? t.animation : 'build');
  delete out.shape;
  return out;
}

export function getTheme(id, customThemes = []) {
  const t =
    customThemes.find((x) => x.id === id) ??
    BUILT_IN_THEMES.find((x) => x.id === id) ??
    BUILT_IN_THEMES[0];
  return normalizeTheme(t);
}

export function isBuiltIn(id) {
  return BUILT_IN_THEMES.some((t) => t.id === id);
}
