export type ItemType = 'show' | 'speaker' | 'article';

export interface TitleItem {
  id: string;
  type: ItemType;
  badge: string; // e.g. "Article 5" (article type)
  primary: string; // name / show title / article title
  secondary: string; // role / org line / event tag
}

export interface ThemeIdentity {
  org: string;
  short: string;
  url: string;
  markStyle: 'arches' | 'chip' | 'image' | 'none';
}

export interface ThemeDef {
  id: string;
  name: string;
  description?: string;
  identity: ThemeIdentity;
  fonts: { display: string; displayWeight: number; text: string; textWeight: number };
  colors: {
    panel: string;
    text: string;
    secondary: string;
    tag: string;
    accent: string;
    badgeBg: string;
    badgeText: string;
    stripes: string[];
    archColors: string[];
    archCenter: string;
  };
  layout: {
    position: 'left' | 'center';
    marginX: number;
    marginY: number;
    maxWidthFrac: number;
    cornerRadius: number;
    scale: number;
  };
  flags: { stripe: boolean; shadow: boolean; uppercaseBadge: boolean; uppercaseTag: boolean };
  animation: 'slide' | 'fade' | 'rise' | 'wipe';
  /** data-URL of an uploaded station logo (PNG with alpha recommended) */
  logoData?: string;
}

export type ExportFormat = 'prores' | 'webm' | 'png' | 'pngseq';

export interface ExportSettings {
  format: ExportFormat;
  fps: number;
  width: number;
  height: number;
  inDur: number;
  holdDur: number;
  outDur: number;
}

export interface Project {
  version: 1;
  items: TitleItem[];
  themeId: string;
  customThemes: ThemeDef[];
  settings: ExportSettings;
}

export const DEFAULT_SETTINGS: ExportSettings = {
  format: 'prores',
  fps: 30,
  width: 1920,
  height: 1080,
  inDur: 0.8,
  holdDur: 6,
  outDur: 0.6,
};

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
