import { useRef, useState } from 'react';
import { BUILT_IN_THEMES } from '../renderer/themes.js';
import { addCustomFont, availableFontFamilies } from '../renderer/fonts';
import type { Animation, MarkStyle, ThemeDef, TitleItem } from '../types';
import { Slider } from './Slider';
import ThemeThumb from './ThemeThumb';
import { IArrowRight, IChevron, ICopy, IDownload, ITrash, IUpload } from './icons';

const WEIGHTS = [400, 500, 600, 700, 800, 900];

/**
 * The left column of the Look step: every adjustment to the current look,
 * in accordions. It scrolls on its own, so the preview on the right stays
 * in view while a slider is dragged.
 */
export function LookRail(props: {
  theme: ThemeDef;
  isCustom: boolean;
  onPatch: (fn: (t: ThemeDef) => void) => void;
  onDuplicate: () => void;
  onImportTheme: (file: File) => void;
  onExportTheme: () => void;
  showToast: (msg: string) => void;
}) {
  const { theme, isCustom, onPatch: patch, onDuplicate, onImportTheme, onExportTheme, showToast } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const fontRef = useRef<HTMLInputElement>(null);
  const [pendingFont, setPendingFont] = useState<File | null>(null);
  const [fontFamily, setFontFamily] = useState('');
  const [fontWeight, setFontWeight] = useState(700);
  const [, bump] = useState(0);

  const C = theme.colors;
  const F = theme.fonts;
  const L = theme.layout;
  const fam = availableFontFamilies();

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) return alert('Choose an image file (PNG with transparency works best).');
    if (file.size > 2 * 1024 * 1024) return alert('Keep the logo under 2 MB.');
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    patch((t) => { t.logoData = dataUrl; t.identity.markStyle = 'image'; });
    showToast('Logo added to the tile');
  };

  const confirmFont = async () => {
    if (!pendingFont || !fontFamily.trim()) return;
    const f = await addCustomFont(pendingFont, fontFamily.trim(), fontWeight);
    if (f) {
      showToast(`Added ${f.family} ${f.weight} — pick it in the font menus`);
      bump((x) => x + 1);
    }
    setPendingFont(null);
    setFontFamily('');
  };

  const color = (label: string, get: () => string, set: (v: string) => void) => (
    <label className="fld">
      <span>{label}</span>
      <input type="color" value={get()} onChange={(e) => set(e.target.value)} />
    </label>
  );

  const size = (label: string, val: number | undefined, set: (v: number) => void) => (
    <Slider label={label} value={val ?? 1} onChange={set} min={50} max={200} scale={100} unit="%" />
  );

  const fontPick = (label: string, family: string, weight: number, setFamily: (v: string) => void, setWeight: (v: number) => void) => (
    <div className="fontrow">
      <label className="fld"><span>{label}</span>
        <select value={family} onChange={(e) => setFamily(e.target.value)}>
          {fam.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
      <label className="fld"><span>Weight</span>
        <select value={weight} onChange={(e) => setWeight(+e.target.value)}>
          {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
      </label>
    </div>
  );

  return (
    <>
      <div className="rail-head">
        <h2>Look</h2>
        <div className="spacer" />
        <button className="btn xs" onClick={onExportTheme} title="Save this look as a .theme.json to share"><IDownload /> Export</button>
        <button className="btn xs" onClick={() => fileRef.current?.click()} title="Load a .theme.json"><IUpload /> Import</button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImportTheme(f); }} />
      </div>
      <p className="rail-intro">
        Adjusting <b>{theme.name}</b>
        {isCustom ? ' — your own copy, saved with the project.' : ' — a built-in look. The first change makes your own copy; the built-in stays as it is.'}
        {' '}Pick a different look under the preview.
      </p>
      {!isCustom && (
        <button className="btn sm primary" onClick={onDuplicate}><ICopy /> Duplicate &amp; customize</button>
      )}

      <details className="acc" open>
        <summary>Placement &amp; size <IChevron className="chev" /></summary>
        <div className="body">
          <div className="grid2">
            <Slider label="Max width" value={L.maxWidth ?? 0.75} onChange={(v) => patch((t) => { t.layout.maxWidth = v; })} min={40} max={94} scale={100} unit="%" />
            <Slider label="Scale" value={L.scale} onChange={(v) => patch((t) => { t.layout.scale = v; })} min={50} max={200} scale={100} unit="%" />
            <Slider label="Bar height" value={L.barHeight ?? 1} onChange={(v) => patch((t) => { t.layout.barHeight = v; })} min={60} max={200} scale={100} unit="%" />
            <Slider label="Corner radius" value={L.cornerRadius} onChange={(v) => patch((t) => { t.layout.cornerRadius = v; })} min={0} max={40} />
            <Slider label="Left margin" value={L.marginX} onChange={(v) => patch((t) => { t.layout.marginX = v; })} min={0} max={400} unit="px" />
            <Slider label="Bottom margin" value={L.marginY} onChange={(v) => patch((t) => { t.layout.marginY = v; })} min={0} max={400} unit="px" />
            <label className="fld"><span>Position</span>
              <select value={L.position} onChange={(e) => patch((t) => { t.layout.position = e.target.value as 'left' | 'center'; })}>
                <option value="left">Lower left</option>
                <option value="center">Lower center</option>
              </select>
            </label>
          </div>
          <p className="hint">
            <b>Max width</b> keeps the lower-right of the frame clear for closed captions. <b>Scale</b> sizes the whole title; <b>Bar height</b> thickens or slims the name and sub bars around type of the same size (a bar never gets shorter than its text).
            Margins are measured at 1080p and default to 64 / 56 px — inside action-safe, not title-safe.
            Type an exact number in any box; the arrow keys move a slider by one step, Shift + arrow by ten. Type sizes are under <b>Type</b>; per-title Large and text-size nudges live in the Titles step.
          </p>
        </div>
      </details>

      <details className="acc" open>
        <summary>Type <IChevron className="chev" /></summary>
        <div className="body">
          {fontPick('Names & show titles', F.display, F.displayWeight, (v) => patch((t) => { t.fonts.display = v; }), (v) => patch((t) => { t.fonts.displayWeight = v; }))}
          {fontPick('Article titles, sub bar & tabs', F.text, F.textWeight, (v) => patch((t) => { t.fonts.text = v; }), (v) => patch((t) => { t.fonts.textWeight = v; }))}
          {fontPick('Tile mark & badge', F.label, F.labelWeight, (v) => patch((t) => { t.fonts.label = v; }), (v) => patch((t) => { t.fonts.labelWeight = v; }))}
          <div className="grid2">
            {size('Name / show title size', F.displaySize, (v) => patch((t) => { t.fonts.displaySize = v; }))}
            {size('Article title size', F.textSize, (v) => patch((t) => { t.fonts.textSize = v; }))}
            {size('Sub bar & tab size', F.subSize, (v) => patch((t) => { t.fonts.subSize = v; }))}
            {size('Tile mark size', F.labelSize, (v) => patch((t) => { t.fonts.labelSize = v; }))}
            {size('Badge size', F.badgeSize, (v) => patch((t) => { t.fonts.badgeSize = v; }))}
            <div className="fld">
              <span className="fldlabel">&nbsp;</span>
              <button className="btn xs ghost" onClick={() => patch((t) => { t.fonts.displaySize = 1; t.fonts.textSize = 1; t.fonts.subSize = 1; t.fonts.labelSize = 1; t.fonts.badgeSize = 1; })}>Reset sizes</button>
            </div>
          </div>
          <div className="btnrow">
            <button className="btn sm" onClick={() => fontRef.current?.click()}><IUpload /> Add a font file (.ttf / .otf)…</button>
            <input ref={fontRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setPendingFont(f); setFontFamily(f.name.replace(/\.[^.]+$/, '').replace(/[-_](Bold|Regular|Medium|Black|Light|SemiBold|ExtraBold)$/i, '')); } }} />
          </div>
          <span className="hint">Fonts you add live in this browser/app only. The CLI batch renderer uses the files in <code>public/fonts</code>.</span>
          {pendingFont && (
            <div className="note-box">
              <div className="grid2" style={{ alignItems: 'end' }}>
                <label className="fld"><span>Family name</span>
                  <input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} />
                </label>
                <label className="fld"><span>Weight of this file</span>
                  <select value={fontWeight} onChange={(e) => setFontWeight(+e.target.value)}>
                    {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </label>
              </div>
              <div className="btnrow" style={{ marginTop: 10 }}>
                <button className="btn sm primary" onClick={confirmFont} disabled={!fontFamily.trim()}>Add {pendingFont.name}</button>
                <button className="btn sm ghost" onClick={() => setPendingFont(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </details>

      <details className="acc">
        <summary>Colors <IChevron className="chev" /></summary>
        <div className="body">
          <div className="swatchgrid">
            {color('Tile', () => C.tile, (v) => patch((t) => { t.colors.tile = v; }))}
            {color('Name bar', () => C.bar, (v) => patch((t) => { t.colors.bar = v; }))}
            {color('Name text', () => C.text, (v) => patch((t) => { t.colors.text = v; }))}
            {color('Sub bar & tab', () => C.subBar, (v) => patch((t) => { t.colors.subBar = v; }))}
            {color('Sub bar text', () => C.subText, (v) => patch((t) => { t.colors.subText = v; }))}
            {color('Tile mark text', () => C.label, (v) => patch((t) => { t.colors.label = v; }))}
            {color('Badge', () => C.badgeBg, (v) => patch((t) => { t.colors.badgeBg = v; }))}
            {color('Badge text', () => C.badgeText, (v) => patch((t) => { t.colors.badgeText = v; }))}
          </div>
          <label className="fld"><span>Stripe colors <span className="val">comma-separated hex</span></span>
            <input value={C.stripes.join(', ')} onChange={(e) => patch((t) => { t.colors.stripes = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); })} />
          </label>
          <label className="fld"><span>Arch colors <span className="val">outer → inner</span></span>
            <input value={C.archColors.join(', ')} onChange={(e) => patch((t) => { t.colors.archColors = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); })} />
          </label>
        </div>
      </details>

      <details className="acc">
        <summary>Station identity <IChevron className="chev" /></summary>
        <div className="body">
          <label className="fld"><span>Look name</span>
            <input value={theme.name} onChange={(e) => patch((t) => { t.name = e.target.value; })} />
          </label>
          <label className="fld"><span>Station / organization</span>
            <input value={theme.identity.org} onChange={(e) => patch((t) => { t.identity.org = e.target.value; })} />
          </label>
          <div className="grid2">
            <label className="fld"><span>Short mark <span className="val">on the tile</span></span>
              <input value={theme.identity.short} maxLength={6} onChange={(e) => patch((t) => { t.identity.short = e.target.value; })} />
            </label>
            <label className="fld"><span>Website</span>
              <input value={theme.identity.url} placeholder="yourstation.org" onChange={(e) => patch((t) => { t.identity.url = e.target.value; })} />
            </label>
          </div>
          <label className="check">
            <input type="checkbox" checked={theme.flags.urlTab !== false} onChange={(e) => patch((t) => { t.flags.urlTab = e.target.checked; })} />
            Website on a tab at the top-left of every title
          </label>
          <span className="hint">The tab rises out of the tile in its colour. Off, the website goes on the show ID's second line instead.</span>
          <label className="fld"><span>Tile mark</span>
            <select value={theme.identity.markStyle} onChange={(e) => patch((t) => { t.identity.markStyle = e.target.value as MarkStyle; })}>
              <option value="arches">Rainbow arches + short mark</option>
              <option value="chip">Short mark only</option>
              <option value="image" disabled={!theme.logoData}>Uploaded logo image</option>
              <option value="none">No tile</option>
            </select>
          </label>
          <div className="fld">
            <span className="fldlabel">Logo image</span>
            <div className="btnrow">
              <button className="btn sm" onClick={() => logoRef.current?.click()}>
                <IUpload /> {theme.logoData ? 'Replace…' : 'Upload PNG…'}
              </button>
              {theme.logoData && (
                <button className="btn sm ghost" onClick={() => patch((t) => { delete t.logoData; if (t.identity.markStyle === 'image') t.identity.markStyle = 'chip'; })}>Remove</button>
              )}
            </div>
            <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadLogo(f); }} />
          </div>
          <label className="check">
            <input type="checkbox" checked={theme.flags.markOnAll} onChange={(e) => patch((t) => { t.flags.markOnAll = e.target.checked; })} />
            Show the station tile on speaker and article titles too
          </label>
        </div>
      </details>

      <details className="acc">
        <summary>Motion &amp; extras <IChevron className="chev" /></summary>
        <div className="body">
          <label className="fld"><span>Animation</span>
            <select value={theme.animation} onChange={(e) => patch((t) => { t.animation = e.target.value as Animation; })}>
              <option value="build">Build (tile, arches, bars assemble)</option>
              <option value="slide">Slide</option>
              <option value="rise">Rise</option>
              <option value="wipe">Wipe</option>
              <option value="fade">Fade</option>
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={theme.flags.stripe} onChange={(e) => patch((t) => { t.flags.stripe = e.target.checked; })} /> Brand stripe under the name bar</label>
          <label className="check"><input type="checkbox" checked={theme.flags.subBar} onChange={(e) => patch((t) => { t.flags.subBar = e.target.checked; })} /> Sub bar (role / tag line)</label>
          <label className="check"><input type="checkbox" checked={theme.flags.petitionerTab !== false} onChange={(e) => patch((t) => { t.flags.petitionerTab = e.target.checked; })} /> Petitioner tab on articles</label>
          <label className="check" style={{ marginLeft: 25 }}><input type="checkbox" checked={theme.flags.petitionerKicker !== false} onChange={(e) => patch((t) => { t.flags.petitionerKicker = e.target.checked; })} /> with the word PETITIONER</label>
          <label className="check"><input type="checkbox" checked={theme.flags.shadow} onChange={(e) => patch((t) => { t.flags.shadow = e.target.checked; })} /> Drop shadow</label>
          <label className="check"><input type="checkbox" checked={theme.flags.uppercaseTag} onChange={(e) => patch((t) => { t.flags.uppercaseTag = e.target.checked; })} /> Uppercase article tag line</label>
          <label className="check"><input type="checkbox" checked={theme.flags.uppercaseBadge} onChange={(e) => patch((t) => { t.flags.uppercaseBadge = e.target.checked; })} /> Uppercase badge</label>
          <p className="hint">The date on every title is set in the Titles step, since it belongs to the project rather than the look.</p>
        </div>
      </details>
    </>
  );
}

/**
 * Under the preview: the gallery of looks as a filmstrip. Clicking one
 * applies it; the adjustments are in the left column.
 */
export function LookStage(props: {
  themeId: string;
  customThemes: ThemeDef[];
  fontsReady: boolean;
  previewItem: TitleItem;
  onSelect: (id: string) => void;
  onDeleteCustom: (id: string) => void;
  onNext: () => void;
}) {
  const { themeId, customThemes, fontsReady, previewItem, onSelect, onDeleteCustom, onNext } = props;
  const all = [...(BUILT_IN_THEMES as ThemeDef[]), ...customThemes];

  return (
    <div className="card">
      <div className="editor-head">
        <div>
          <span className="kicker">◆ Step 2 of 3 · {all.length} looks</span>
          <h2 style={{ fontSize: 17 }}>Choose a look</h2>
        </div>
        <div className="spacer" />
        <button className="btn lime sm" onClick={onNext}>Next: export <IArrowRight /></button>
      </div>
      <p className="hint" style={{ marginBottom: 12 }}>
        Click a look to apply it to every title. Fine-tune placement, type, colors and the station mark in the left column — the preview updates as you drag.
      </p>
      <div className="lookstrip">
        {all.map((t) => {
          const custom = customThemes.some((c) => c.id === t.id);
          return (
            <div
              key={t.id}
              className={`theme-card ${t.id === themeId ? 'sel' : ''}`}
              onClick={() => onSelect(t.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(t.id); } }}
            >
              <ThemeThumb theme={t} item={previewItem} fontsReady={fontsReady} />
              <div className="body">
                <div className="name">
                  {t.name}
                  {custom && <span className="badge amber" style={{ fontSize: 9 }}>Custom</span>}
                  <span className="spacer" />
                  {custom && (
                    <button className="btn xs ghost danger" onClick={(e) => { e.stopPropagation(); onDeleteCustom(t.id); }} title="Delete this custom look">
                      <ITrash style={{ width: 13, height: 13 }} />
                    </button>
                  )}
                </div>
                <div className="desc">{t.description ?? 'Custom look'}</div>
                <div className="chips">
                  {[t.colors.tile, t.colors.bar, t.colors.subBar, t.colors.badgeBg, ...t.colors.stripes.slice(0, 3)].map((c, i) => (
                    <i key={i} style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
