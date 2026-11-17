export type ItemType = 'show' | 'speaker' | 'article';

/** On-screen size. 'large' uses bigger type on more lines (never wider — the
 *  lower-right corner stays clear for captions); 'auto' picks it when a title would
 *  otherwise get small. */
export type ItemSize = 'auto' | 'standard' | 'large';

export interface TitleItem {
  id: string;
  type: ItemType;
  badge: string; // e.g. "Article 5" (article type)
  primary: string; // name / show title / article title
  secondary: string; // role / org line / event tag
  petitioner?: string; // articles: who filed it - shown on a tab above the title
  size?: ItemSize; // default 'auto'
  textScale?: number; // per-title nudge of the main text size, 1 = the look's default
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
  /** size multipliers, 1 = default */
  displaySize: number;
  textSize: number;
  subSize: number;
  labelSize: number;
  badgeSize: number;
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
    maxWidth: number;
    cornerRadius: number;
    /** overall size of the title, 1 = as designed for 1080p */
    scale: number;
    /** thickness of the name and sub bars around type of the same size, 1 = default */
    barHeight: number;
  };
  flags: {
    stripe: boolean;
    shadow: boolean;
    uppercaseBadge: boolean;
    uppercaseTag: boolean;
    markOnAll: boolean;
    subBar: boolean;
    petitionerTab: boolean;
    petitionerKicker: boolean;
    /** the station website on a tab at the top-left of every title (off: show IDs carry it on line 2) */
    urlTab: boolean;
  };
  animation: Animation;
  /** data-URL of an uploaded station logo (PNG with alpha recommended) */
  logoData?: string;
}

export type ExportFormat = 'prores' | 'webm' | 'png' | 'pngseq';

/** 'sub': the date continues the sub bar line after a dot ('title' / 'corner' are 2.3 pre-release values, read as 'sub') */
export type DatePlace = 'off' | 'sub';

export interface ExportSettings {
  format: ExportFormat;
  fps: number;
  width: number;
  height: number;
  inDur: number;
  holdDur: number;
  outDur: number;
  /** a date on every title, continuing the sub bar after a dot */
  datePlace?: DatePlace;
  /** the date text; blank leaves an empty slot in the sub bar for an OBS text source */
  dateText?: string;
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
  datePlace: 'off',
  dateText: '',
};

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
