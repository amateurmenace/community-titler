import { DEFAULT_SETTINGS, type Project } from './types';
import { stm2026Items } from './data/stm2026';

const KEY = 'community-titler.project.v1';

export function defaultProject(): Project {
  return {
    version: 1,
    items: stm2026Items(),
    themeId: 'big',
    customThemes: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function loadProject(): Project {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProject();
    const p = JSON.parse(raw) as Project;
    if (!p || p.version !== 1 || !Array.isArray(p.items)) return defaultProject();
    p.settings = { ...DEFAULT_SETTINGS, ...p.settings };
    p.customThemes = p.customThemes ?? [];
    return p;
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

export function exportProjectFile(p: Project): void {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'community-titler-project.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
