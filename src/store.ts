import { DEFAULT_SETTINGS, type Project } from './types';
import { stm2026Items } from './data/stm2026';
import { normalizeTheme } from './renderer/themes.js';
import { desktop } from './desktop';

const KEY = 'community-titler.project.v2';
const KEY_V1 = 'community-titler.project.v1';

export const SAMPLE_NAME = 'Brookline Special Town Meeting 2026';

export function defaultProject(): Project {
  return {
    version: 2,
    name: SAMPLE_NAME,
    items: stm2026Items(),
    themeId: 'big',
    customThemes: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function emptyProject(): Project {
  return {
    version: 2,
    name: 'Untitled project',
    items: [],
    themeId: 'big',
    customThemes: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Accepts a v1 or v2 project object; returns a v2 project or null if unusable. */
export function migrateProject(raw: any): Project | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return null;
  const customThemes = Array.isArray(raw.customThemes) ? raw.customThemes.map((t: any) => normalizeTheme(t)) : [];
  if (raw.version === 2) {
    return {
      ...emptyProject(),
      ...raw,
      customThemes,
      settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
    };
  }
  if (raw.version === 1) {
    const s = { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) };
    // v1 timings were tuned for the old slide; the build needs a little longer.
    if (!raw.settings || raw.settings.inDur === 0.8) s.inDur = DEFAULT_SETTINGS.inDur;
    if (!raw.settings || raw.settings.outDur === 0.6) s.outDur = DEFAULT_SETTINGS.outDur;
    return {
      version: 2,
      name: raw.name,
      items: raw.items,
      themeId: raw.themeId ?? 'big',
      customThemes,
      settings: s,
    };
  }
  return null;
}

export function loadProject(): Project {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(KEY_V1);
    if (!raw) return defaultProject();
    return migrateProject(JSON.parse(raw)) ?? defaultProject();
  } catch {
    return defaultProject();
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveProject(p: Project): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch (e) {
      console.warn('could not save project', e);
    }
  }, 300);
}

function slug(s: string): string {
  return (s || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'project';
}

/** Save the project as a portable .json (native dialog on desktop, download on web). Returns the path/name or null. */
export async function exportProjectFile(p: Project): Promise<string | null> {
  const json = JSON.stringify(p, null, 2);
  const name = `${slug(p.name ?? 'community-titler')}.titler.json`;
  if (desktop) {
    const path = await desktop.saveFileDialog({ defaultName: name, filters: [{ name: 'Community Titler project', extensions: ['json'] }] });
    if (!path) return null;
    await desktop.writeFile(path, json);
    return path;
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return name;
}
