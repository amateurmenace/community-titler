// Loads the bundled Montserrat family (and any uploaded custom fonts) into
// document.fonts so canvas text renders correctly before the first frame.

const BUNDLED: Array<[string, number, string]> = [
  ['Montserrat', 400, 'Montserrat-Regular.ttf'],
  ['Montserrat', 500, 'Montserrat-Medium.ttf'],
  ['Montserrat', 600, 'Montserrat-SemiBold.ttf'],
  ['Montserrat', 700, 'Montserrat-Bold.ttf'],
  ['Montserrat', 800, 'Montserrat-ExtraBold.ttf'],
  ['Montserrat', 900, 'Montserrat-Black.ttf'],
];

let loaded = false;

export async function loadBundledFonts(): Promise<void> {
  if (loaded) return;
  const base = `${import.meta.env.BASE_URL}fonts/`;
  await Promise.all(
    BUNDLED.map(async ([family, weight, file]) => {
      try {
        const face = new FontFace(family, `url("${base}${file}")`, { weight: String(weight) });
        await face.load();
        document.fonts.add(face);
      } catch (e) {
        console.warn('font failed to load', file, e);
      }
    }),
  );
  loaded = true;
}

export const CUSTOM_FONT_KEY = 'community-titler.customFonts.v1';

export interface CustomFont {
  family: string;
  weight: number;
  dataUrl: string;
}

export function getCustomFonts(): CustomFont[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_FONT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export async function registerCustomFonts(fonts: CustomFont[]): Promise<void> {
  await Promise.all(
    fonts.map(async (f) => {
      try {
        const face = new FontFace(f.family, `url("${f.dataUrl}")`, { weight: String(f.weight) });
        await face.load();
        document.fonts.add(face);
      } catch (e) {
        console.warn('custom font failed', f.family, e);
      }
    }),
  );
}

export async function addCustomFont(file: File, family: string, weight: number): Promise<CustomFont | null> {
  if (file.size > 1.5 * 1024 * 1024) {
    alert('Font file is larger than 1.5 MB — too big to store in the browser. Smaller TTF/OTF files work best.');
    return null;
  }
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const font: CustomFont = { family, weight, dataUrl };
  const all = getCustomFonts().filter((f) => !(f.family === family && f.weight === weight));
  all.push(font);
  try {
    localStorage.setItem(CUSTOM_FONT_KEY, JSON.stringify(all));
  } catch {
    alert('Could not save the font in browser storage (storage full). It will work until you reload.');
  }
  await registerCustomFonts([font]);
  return font;
}

export function availableFontFamilies(): string[] {
  const customs = getCustomFonts().map((f) => f.family);
  return ['Montserrat', ...Array.from(new Set(customs))];
}
