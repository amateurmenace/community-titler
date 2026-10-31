import { parseCSV, detectDelimiter, rowsToItems } from './shared/csv.js';
import { newId, type TitleItem } from './types';

export interface ImportDefaults {
  type?: string;
  secondary?: string;
}

function toTitleItems(raw: { type: string; badge: string; primary: string; secondary: string }[]): TitleItem[] {
  return raw.map((r) => ({ id: newId(), ...r }) as TitleItem);
}

export function importFromText(text: string, defaults: ImportDefaults = {}): TitleItem[] {
  const rows = parseCSV(text, detectDelimiter(text));
  return toTitleItems(rowsToItems(rows, defaults));
}

export async function importFromFile(file: File, defaults: ImportDefaults = {}): Promise<TitleItem[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.ods')) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' }) as string[][];
    return toTitleItems(rowsToItems(rows, defaults));
  }
  const text = await file.text();
  return importFromText(text, defaults);
}
