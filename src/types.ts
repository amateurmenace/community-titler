export type ItemType = 'show' | 'speaker' | 'article';

export interface TitleItem {
  id: string;
  type: ItemType;
  badge: string; // e.g. "Article 5" (article type)
  primary: string; // name / show title / article title
  secondary: string; // role / org line / event tag
}

export type MarkStyle = 'arches' | 'chip' | 'image' | 'none';

export interface ThemeIdentity {
  org: string;
  short: string;
  url: string;
  markStyle: MarkStyle;
}

export type Animation = 'build' | 'slide' | 'rise' | 'fade' | 'wipe';

export interface ThemeFonts {
  /** names and show titles */
  display: string;
  displayWeight: number;
  /** article titles and the sub bar */
  text: string;
  textWeight: number;
  /** the station short name on the tile and the badge */
  label: string;
  labelWeight: number;
}

export interface ThemeColors {
  tile: string;
  bar: string;
  text: string;
  subBar: string;
  subText: string;
  label: string;
  badgeBg: string;
  badgeText: string;
  stripes: string[];
  archColors: string[];
}

export interface ThemeDef {
  id: string;
  name: string;
  description?: string;
  identity: ThemeIdentity;
  fonts: ThemeFonts;
  colors: ThemeColors;
  layout: {
    position: 'left' | 'center';
    marginX: number;
    marginY: number;
    maxWidthFrac: number;
    cornerRadius: number;
    scale: number;
  };
  flags: {
    stripe: boolean;
    shadow: boolean;
    uppercaseBadge: boolean;
    uppercaseTag: boolean;
    markOnAll: boolean;
    subBar: boolean;
  };
  animation: Animation;
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
  version: 2;
  name?: string;
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
  inDur: 1.1,
  holdDur: 6,
  outDur: 0.9,
};

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
