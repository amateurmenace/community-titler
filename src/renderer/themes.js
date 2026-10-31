// Built-in themes. A theme is plain JSON-serializable data — stations can
// duplicate one in the Style panel, change colors/fonts/identity, and export
// it as a .json file to share or commit.

export const BUILT_IN_THEMES = [
  {
    id: 'big',
    name: 'BIG — Brookline Interactive',
    description: 'Brookline Interactive Group brand: leaning navy parallelograms, rainbow arches and stripe tails, Montserrat (Gotham-style) type.',
    identity: {
      org: 'Brookline Interactive Group',
      short: 'BIG',
      url: 'brooklineinteractive.org',
      markStyle: 'arches',
    },
    fonts: { display: 'Montserrat', displayWeight: 800, text: 'Montserrat', textWeight: 500 },
    colors: {
      panel: '#262262',
      text: '#FFFFFF',
      secondary: '#D9DCF2',
      tag: '#FEEE32',
      accent: '#C74C9C',
      badgeBg: '#C74C9C',
      badgeText: '#FFFFFF',
      stripes: ['#C74C9C', '#F68B1F', '#FEEE32'],
      archColors: ['#C74C9C', '#F68B1F', '#FEEE32'],
      archCenter: '#FFFFFF',
    },
    shape: { style: 'parallelogram', skew: 12 },
    layout: { position: 'left', marginX: 96, marginY: 84, maxWidthFrac: 0.68, cornerRadius: 12, scale: 1 },
    flags: { stripe: true, shadow: true, uppercaseBadge: true, uppercaseTag: true, markOnAll: true, blade: true },
    animation: 'slide',
  },
  {
    id: 'slate',
    name: 'Broadcast Slate',
    description: 'Neutral modern news look: leaning charcoal panels, electric blue accents. A good starting point for any station.',
    identity: { org: 'Your Community Station', short: 'TV', url: 'yourstation.org', markStyle: 'chip' },
    fonts: { display: 'Montserrat', displayWeight: 800, text: 'Montserrat', textWeight: 500 },
    colors: {
      panel: '#15181E',
      text: '#FFFFFF',
      secondary: '#B8C0CC',
      tag: '#6EA8FE',
      accent: '#2563EB',
      badgeBg: '#2563EB',
      badgeText: '#FFFFFF',
      stripes: ['#2563EB', '#6EA8FE'],
      archColors: ['#2563EB', '#6EA8FE', '#B8C0CC'],
      archCenter: '#FFFFFF',
    },
    shape: { style: 'parallelogram', skew: 12 },
    layout: { position: 'left', marginX: 96, marginY: 84, maxWidthFrac: 0.66, cornerRadius: 6, scale: 1 },
    flags: { stripe: true, shadow: true, uppercaseBadge: true, uppercaseTag: true, markOnAll: true, blade: true },
    animation: 'slide',
  },
  {
    id: 'townhall',
    name: 'Town Hall',
    description: 'Civic classic: square cream panels, deep green text, gold rule. Feels at home over a select board meeting.',
    identity: { org: 'Your Community Station', short: 'TV', url: 'yourstation.org', markStyle: 'chip' },
    fonts: { display: 'Montserrat', displayWeight: 700, text: 'Montserrat', textWeight: 500 },
    colors: {
      panel: '#F7F3E6',
      text: '#1E3A2A',
      secondary: '#51604F',
      tag: '#8C6D1F',
      accent: '#C19A3D',
      badgeBg: '#1E3A2A',
      badgeText: '#F7F3E6',
      stripes: ['#C19A3D'],
      archColors: ['#1E3A2A', '#C19A3D', '#8C6D1F'],
      archCenter: '#1E3A2A',
    },
    shape: { style: 'rounded', skew: 0 },
    layout: { position: 'left', marginX: 96, marginY: 84, maxWidthFrac: 0.66, cornerRadius: 4, scale: 1 },
    flags: { stripe: true, shadow: true, uppercaseBadge: true, uppercaseTag: true, markOnAll: true, blade: true },
    animation: 'rise',
  },
  {
    id: 'minimal',
    name: 'Minimal Light',
    description: 'Just the facts: white panel, near-black text, thin accent. Quiet enough for any program.',
    identity: { org: 'Your Community Station', short: 'TV', url: 'yourstation.org', markStyle: 'none' },
    fonts: { display: 'Montserrat', displayWeight: 700, text: 'Montserrat', textWeight: 400 },
    colors: {
      panel: '#FFFFFF',
      text: '#16181D',
      secondary: '#5A616C',
      tag: '#9A2C5C',
      accent: '#9A2C5C',
      badgeBg: '#16181D',
      badgeText: '#FFFFFF',
      stripes: ['#9A2C5C'],
      archColors: ['#16181D', '#5A616C', '#9A2C5C'],
      archCenter: '#16181D',
    },
    shape: { style: 'rounded', skew: 0 },
    layout: { position: 'left', marginX: 96, marginY: 84, maxWidthFrac: 0.62, cornerRadius: 2, scale: 1 },
    flags: { stripe: true, shadow: true, uppercaseBadge: true, uppercaseTag: false, markOnAll: false, blade: false },
    animation: 'fade',
  },
];

/**
 * Fill in fields older saved themes (localStorage projects, exported .json)
 * may not have, so they keep working as the renderer grows.
 */
export function normalizeTheme(t) {
  if (!t) return t;
  const out = { ...t };
  out.shape = { style: 'rounded', skew: 0, ...(t.shape ?? {}) };
  if (out.shape.style === 'parallelogram' && !(out.shape.skew > 0)) out.shape.skew = 12;
  out.flags = { stripe: true, shadow: true, uppercaseBadge: true, uppercaseTag: true, markOnAll: false, blade: false, ...(t.flags ?? {}) };
  out.layout = { position: 'left', marginX: 96, marginY: 84, maxWidthFrac: 0.66, cornerRadius: 10, scale: 1, ...(t.layout ?? {}) };
  return out;
}

export function getTheme(id, customThemes = []) {
  const t =
    customThemes.find((x) => x.id === id) ??
    BUILT_IN_THEMES.find((x) => x.id === id) ??
    BUILT_IN_THEMES[0];
  return normalizeTheme(t);
}
