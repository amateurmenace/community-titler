// Small RFC 4180 CSV parser (quotes, embedded commas/newlines) shared by the
// web importer and the Node CLI. Also parses tab-separated text (spreadsheet
// paste). No dependencies.

/** @returns {string[][]} rows of cells */
export function parseCSV(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const s = String(text ?? '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(cell); cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  // drop fully-empty trailing rows
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

export function detectDelimiter(text) {
  const firstLine = String(text ?? '').split(/\r?\n/, 1)[0] ?? '';
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

const HEADER_ALIASES = {
  type: ['type', 'kind', 'template'],
  badge: ['badge', 'number', 'article', 'article number', 'article #', '#', 'no', 'num'],
  primary: ['primary', 'title', 'name', 'text', 'main', 'line1', 'line 1', 'article title', 'speaker', 'show'],
  secondary: ['secondary', 'subtitle', 'role', 'position', 'affiliation', 'organization', 'org', 'line2', 'line 2', 'tag', 'event', 'description'],
  petitioner: ['petitioner', 'petitioners', 'petitioned by', 'sponsor', 'sponsors', 'submitted by', 'filed by', 'proponent'],
};

/**
 * Warrant listings put the petitioner in a trailing parenthetical:
 * "Resolution regarding Vision Zero (Dempsey)". Split it off when it looks
 * like names or a board rather than an acronym such as "(TPOD)".
 * @returns {{title:string, petitioner:string}}
 */
export function splitPetitioner(title) {
  const s = String(title ?? '').trim();
  const m = s.match(/^(.*?)[\s.]*\(([^()]{3,})\)\.?$/);
  if (!m) return { title: s, petitioner: '' };
  const inner = m[2].trim();
  const head = m[1].trim();
  const looksLikeAcronym = /^[A-Z0-9&/-]{2,8}$/.test(inner);
  if (!head || looksLikeAcronym) return { title: s, petitioner: '' };
  const keepPeriod = /\.$/.test(s.slice(0, s.lastIndexOf('(')).trim());
  return { title: keepPeriod && !/[.!?]$/.test(head) ? head + '.' : head, petitioner: inner };
}

/**
 * Map spreadsheet rows to title items.
 * Recognizes a header row by known column names; otherwise treats columns
 * positionally as [type, badge, primary, secondary] or [primary, secondary].
 * @returns {{type:string,badge:string,primary:string,secondary:string,petitioner?:string}[]}
 */
export function rowsToItems(rows, defaults = {}) {
  if (!rows.length) return [];
  const defType = defaults.type ?? 'speaker';
  const defSecondary = defaults.secondary ?? '';

  const norm = (h) => String(h ?? '').trim().toLowerCase();
  const first = rows[0].map(norm);
  const colFor = {};
  let headerHits = 0;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = first.findIndex((h) => aliases.includes(h));
    if (idx !== -1) { colFor[field] = idx; headerHits++; }
  }
  const hasHeader = headerHits >= 2 || (headerHits === 1 && colFor.primary !== undefined);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const items = [];
  for (const r of dataRows) {
    const cell = (i) => (i === undefined ? '' : String(r[i] ?? '').trim());
    let type, badge, primary, secondary, petitioner = '';
    if (hasHeader) {
      type = norm(cell(colFor.type)) || defType;
      badge = cell(colFor.badge);
      primary = cell(colFor.primary);
      secondary = cell(colFor.secondary) || defSecondary;
      petitioner = cell(colFor.petitioner);
    } else if (r.length >= 3) {
      type = norm(String(r[0])) || defType;
      badge = String(r[1] ?? '').trim();
      primary = String(r[2] ?? '').trim();
      secondary = String(r[3] ?? '').trim() || defSecondary;
    } else {
      type = defType;
      badge = '';
      primary = String(r[0] ?? '').trim();
      secondary = String(r[1] ?? '').trim() || defSecondary;
    }
    if (!['show', 'speaker', 'article'].includes(type)) {
      // tolerate things like "warrant article", "speaker id"
      if (type.includes('article') || type.includes('warrant')) type = 'article';
      else if (type.includes('show') || type.includes('event') || type.includes('program')) type = 'show';
      else type = defType;
    }
    // Articles pasted as "5. Title of the article" — split the leading number.
    if (type === 'article' && !badge) {
      const m = primary.match(/^(?:article\s+)?(\d+[A-Za-z]?)[.):\s-]+\s*(.+)$/i);
      if (m) { badge = `Article ${m[1]}`; primary = m[2]; }
    }
    if (type === 'article' && badge && /^\d+[A-Za-z]?$/.test(badge)) badge = `Article ${badge}`;
    // No petitioner column: take it from the title's trailing "(...)".
    if (type === 'article' && !petitioner && colFor.petitioner === undefined) {
      const sp = splitPetitioner(primary);
      primary = sp.title; petitioner = sp.petitioner;
    }
    if (!primary) continue;
    const item = { type, badge, primary, secondary };
    if (petitioner) item.petitioner = petitioner;
    items.push(item);
  }
  return items;
}

/** Filename-safe slug */
export function slugify(s, max = 48) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '') || 'untitled';
}

/** "Article 7" / "ART 12A" / "7" → "07" / "12A"; anything else → null */
export function badgeNumber(badge) {
  const m = String(badge ?? '').trim().match(/(\d+)([A-Za-z]?)$/);
  return m ? m[1].padStart(2, '0') + m[2].toUpperCase() : null;
}

function rawFileBase(item) {
  if (item.type === 'article') {
    const n = badgeNumber(item.badge);
    return n ? `Article-${n}_${slugify(item.primary)}` : `Article_${slugify(`${item.badge ?? ''} ${item.primary}`)}`;
  }
  return `${item.type === 'show' ? 'Show' : 'Speaker'}_${slugify(item.primary)}`;
}

/**
 * File name (without extension) for a title. Articles are named by their
 * article number so the files line up with the warrant ("Article-07_…");
 * show IDs and speakers by what they say. Pass the whole project list as
 * `all` so two titles that would collide get "-2", "-3" suffixes.
 */
export function itemFileBase(item, all = []) {
  const base = rawFileBase(item);
  let dup = 0;
  for (const other of all) {
    if (other === item || (item.id && other.id === item.id)) break;
    if (rawFileBase(other) === base) dup++;
  }
  return dup ? `${base}-${dup + 1}` : base;
}
