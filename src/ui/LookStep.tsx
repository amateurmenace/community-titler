import { useRef, useState } from 'react';
import { BUILT_IN_THEMES } from '../renderer/themes.js';
import { addCustomFont, availableFontFamilies } from '../renderer/fonts';
import type { Animation, MarkStyle, ThemeDef, TitleItem } from '../types';
import ThemeThumb from './ThemeThumb';
import { IArrowRight, IChevron, ICopy, IDownload, ITrash, IUpload } from './icons';

export function LookRail(props: {
  themeId: string;
  customThemes: ThemeDef[];
  fontsReady: boolean;
  previewItem: TitleItem;
  onSelect: (id: string) => void;
  onDuplicate: () => void;
  onImportTheme: (file: File) => void;
  onExportTheme: () => void;
  onDeleteCustom: (id: string) => void;
}) {
  const { themeId, customThemes, fontsReady, previewItem, onSelect, onDuplicate, onImportTheme, onExportTheme, onDeleteCustom } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const all = [...(BUILT_IN_THEMES as ThemeDef[]), ...customThemes];

  return (
    <>
      <div className="rail-head">
        <h2>Look</h2>
        <span className="count">{all.length}</span>
      </div>
      <p className="rail-intro">Pick a built-in look, or duplicate one and make it your station's own — colors, fonts, logo, motion.</p>

      <div className="btnrow">
        <button className="btn sm primary" onClick={onDuplicate}><ICopy /> Duplicate &amp; customize</button>
        <button className="btn sm" onClick={onExportTheme} title="Save this look as a .theme.json to share"><IDownload /> Export</button>
        <button className="btn sm" onClick={() => fileRef.current?.click()} title="Load a .theme.json"><IUpload /> Import</button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImportTheme(f); }} />
      </div>

      <div className="themegrid">
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
    </>
  );
}

const WEIGHTS = [400, 500, 600, 700, 800, 900];

export function LookEditor(props: {
  theme: ThemeDef;
  isCustom: boolean;
  onPatch: (fn: (t: ThemeDef) => void) => void;
  onDuplicate: () => void;
  onNext: () => void;
  showToast: (msg: string) => void;
}) {
  const { theme, isCustom, onPatch: patch, onDuplicate, onNext, showToast } = props;
  const logoRef = useRef<HTMLInputElement>(null);
  const fontRef = useRef<HTMLInputElement>(null);
  const [pendingFont, setPendingFont] = useState<File | null>(null);
  const [fontFamily, setFontFamily] = useState('');
  const [fontWeight, setFontWeight] = useState(700);
  const [, bump] = useState(0);

  const C = theme.colors;
  const F = theme.fonts;
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
    <label className="fld">
      <span>{label} <span className="val">{Math.round((val ?? 1) * 100)}%</span></span>
      <input type="range" min={0.7} max={1.5} step={0.05} value={val ?? 1} onChange={(e) => set(+e.target.value)} />
    </label>
  );

  return (
    <div className="card">
      <div className="editor-head">
        <div>
          <span className="kicker">◆ Step 2 of 3 · {theme.name}</span>
          <h2 style={{ fontSize: 17 }}>{isCustom ? 'Make it yours' : 'Built-in look'}</h2>
        </div>
        <div className="spacer" />
        {!isCustom && <button className="btn primary sm" onClick={onDuplicate}><ICopy /> Duplicate &amp; customize</button>}
        <button className="btn lime sm" onClick={onNext}>Next: export <IArrowRight /></button>
      </div>

      {!isCustom && (
        <div className="note-box lime" style={{ marginBottom: 14 }}>
          This is a built-in look. Change anything below — station name, type sizes, fonts, colors, logo, motion — and it becomes <b>your own copy</b>, saved with the project. The built-in stays as it is.
        </div>
      )}

      <div>
        <details className="acc" open>
          <summary>Station identity <IChevron className="chev" /></summary>
          <div className="body">
            <div className="grid2">
              <label className="fld"><span>Look name</span>
                <input value={theme.name} onChange={(e) => patch((t) => { t.name = e.target.value; })} />
              </label>
              <label className="fld"><span>Station / organization</span>
                <input value={theme.identity.org} onChange={(e) => patch((t) => { t.identity.org = e.target.value; })} />
              </label>
              <label className="fld"><span>Short mark <span className="val">on the tile</span></span>
                <input value={theme.identity.short} maxLength={6} onChange={(e) => patch((t) => { t.identity.short = e.target.value; })} />
              </label>
              <label className="fld"><span>URL <span className="val">show ID second line</span></span>
                <input value={theme.identity.url} onChange={(e) => patch((t) => { t.identity.url = e.target.value; })} />
              </label>
              <label className="fld"><span>Tile mark</span>
                <select value={theme.identity.markStyle} onChange={(e) => patch((t) => { t.identity.markStyle = e.target.value as MarkStyle; })}>
                  <option value="arches">Rainbow arches + short mark</option>
                  <option value="chip">Short mark only</option>
                  <option value="image" disabled={!theme.logoData}>Uploaded logo image</option>
                  <option value="none">No tile</option>
                </select>
              </label>
              <label className="fld"><span>Logo image</span>
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
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={theme.flags.markOnAll} onChange={(e) => patch((t) => { t.flags.markOnAll = e.target.checked; })} />
              Show the station tile on speaker and article titles too
            </label>
          </div>
        </details>

        <details className="acc">
          <summary>Type <IChevron className="chev" /></summary>
          <div className="body">
            <div className="grid3">
              <label className="fld"><span>Names &amp; show titles</span>
                <select value={F.display} onChange={(e) => patch((t) => { t.fonts.display = e.target.value; })}>
                  {fam.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="fld"><span>Weight</span>
                <select value={F.displayWeight} onChange={(e) => patch((t) => { t.fonts.displayWeight = +e.target.value; })}>
                  {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </label>
              <div />
              <label className="fld"><span>Article titles &amp; sub bar</span>
                <select value={F.text} onChange={(e) => patch((t) => { t.fonts.text = e.target.value; })}>
                  {fam.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="fld"><span>Weight</span>
                <select value={F.textWeight} onChange={(e) => patch((t) => { t.fonts.textWeight = +e.target.value; })}>
                  {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </label>
              <div />
              <label className="fld"><span>Tile mark &amp; badge</span>
                <select value={F.label} onChange={(e) => patch((t) => { t.fonts.label = e.target.value; })}>
                  {fam.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="fld"><span>Weight</span>
                <select value={F.labelWeight} onChange={(e) => patch((t) => { t.fonts.labelWeight = +e.target.value; })}>
                  {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </label>
            </div>
            <div className="grid3" style={{ marginTop: 12 }}>
              {size('Name / show title size', F.displaySize, (v) => patch((t) => { t.fonts.displaySize = v; }))}
              {size('Article title size', F.textSize, (v) => patch((t) => { t.fonts.textSize = v; }))}
              {size('Sub bar size', F.subSize, (v) => patch((t) => { t.fonts.subSize = v; }))}
              {size('Tile mark size', F.labelSize, (v) => patch((t) => { t.fonts.labelSize = v; }))}
              {size('Badge size', F.badgeSize, (v) => patch((t) => { t.fonts.badgeSize = v; }))}
              <div className="fld">
                <span className="fldlabel">&nbsp;</span>
                <button className="btn xs ghost" onClick={() => patch((t) => { t.fonts.displaySize = 1; t.fonts.textSize = 1; t.fonts.subSize = 1; t.fonts.labelSize = 1; t.fonts.badgeSize = 1; })}>Reset sizes</button>
              </div>
            </div>
            <p className="hint" style={{ margin: '4px 0 10px' }}>Sizes are multipliers on the look's defaults. The per-title <b>Large</b> setting and text-size nudge in the Titles step stack on top of them.</p>
            <div className="btnrow">
              <button className="btn sm" onClick={() => fontRef.current?.click()}><IUpload /> Add a font file (.ttf / .otf)…</button>
              <input ref={fontRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setPendingFont(f); setFontFamily(f.name.replace(/\.[^.]+$/, '').replace(/[-_](Bold|Regular|Medium|Black|Light|SemiBold|ExtraBold)$/i, '')); } }} />
              <span className="hint">Fonts you add live in this browser/app only. The CLI batch renderer uses the files in <code>public/fonts</code>.</span>
            </div>
            {pendingFont && (
              <div className="note-box">
                <div className="grid3" style={{ alignItems: 'end' }}>
                  <label className="fld"><span>Family name</span>
                    <input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} />
                  </label>
                  <label className="fld"><span>Weight of this file</span>
                    <select value={fontWeight} onChange={(e) => setFontWeight(+e.target.value)}>
                      {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </label>
                  <div className="btnrow">
                    <button className="btn sm primary" onClick={confirmFont} disabled={!fontFamily.trim()}>Add {pendingFont.name}</button>
                    <button className="btn sm ghost" onClick={() => setPendingFont(null)}>Cancel</button>
                  </div>
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
              {color('Sub bar', () => C.subBar, (v) => patch((t) => { t.colors.subBar = v; }))}
              {color('Sub bar text', () => C.subText, (v) => patch((t) => { t.colors.subText = v; }))}
              {color('Tile mark text', () => C.label, (v) => patch((t) => { t.colors.label = v; }))}
              {color('Badge', () => C.badgeBg, (v) => patch((t) => { t.colors.badgeBg = v; }))}
              {color('Badge text', () => C.badgeText, (v) => patch((t) => { t.colors.badgeText = v; }))}
            </div>
            <div className="grid2">
              <label className="fld"><span>Stripe colors <span className="val">comma-separated hex</span></span>
                <input value={C.stripes.join(', ')} onChange={(e) => patch((t) => { t.colors.stripes = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); })} />
              </label>
              <label className="fld"><span>Arch colors <span className="val">outer → inner</span></span>
                <input value={C.archColors.join(', ')} onChange={(e) => patch((t) => { t.colors.archColors = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); })} />
              </label>
            </div>
          </div>
        </details>

        <details className="acc">
          <summary>Layout &amp; motion <IChevron className="chev" /></summary>
          <div className="body">
            <div className="grid3">
              <label className="fld"><span>Animation</span>
                <select value={theme.animation} onChange={(e) => patch((t) => { t.animation = e.target.value as Animation; })}>
                  <option value="build">Build (tile, arches, bars assemble)</option>
                  <option value="slide">Slide</option>
                  <option value="rise">Rise</option>
                  <option value="wipe">Wipe</option>
                  <option value="fade">Fade</option>
                </select>
              </label>
              <label className="fld"><span>Position</span>
                <select value={theme.layout.position} onChange={(e) => patch((t) => { t.layout.position = e.target.value as 'left' | 'center'; })}>
                  <option value="left">Lower left</option>
                  <option value="center">Lower center</option>
                </select>
              </label>
              <label className="fld"><span>Corner radius <span className="val">{theme.layout.cornerRadius}</span></span>
                <input type="range" min={0} max={30} value={theme.layout.cornerRadius} onChange={(e) => patch((t) => { t.layout.cornerRadius = +e.target.value; })} />
              </label>
              <label className="fld"><span>Scale <span className="val">{theme.layout.scale.toFixed(2)}×</span></span>
                <input type="range" min={0.7} max={1.4} step={0.05} value={theme.layout.scale} onChange={(e) => patch((t) => { t.layout.scale = +e.target.value; })} />
              </label>
              <label className="fld"><span>Side margin <span className="val">{theme.layout.marginX}px</span></span>
                <input type="range" min={40} max={300} step={4} value={theme.layout.marginX} onChange={(e) => patch((t) => { t.layout.marginX = +e.target.value; })} />
              </label>
              <label className="fld"><span>Bottom margin <span className="val">{theme.layout.marginY}px</span></span>
                <input type="range" min={40} max={300} step={4} value={theme.layout.marginY} onChange={(e) => patch((t) => { t.layout.marginY = +e.target.value; })} />
              </label>
            </div>
            <div className="grid2">
              <label className="check"><input type="checkbox" checked={theme.flags.stripe} onChange={(e) => patch((t) => { t.flags.stripe = e.target.checked; })} /> Brand stripe under the name bar</label>
              <label className="check"><input type="checkbox" checked={theme.flags.subBar} onChange={(e) => patch((t) => { t.flags.subBar = e.target.checked; })} /> Sub bar (role / tag line)</label>
              <label className="check"><input type="checkbox" checked={theme.flags.shadow} onChange={(e) => patch((t) => { t.flags.shadow = e.target.checked; })} /> Drop shadow</label>
              <label className="check"><input type="checkbox" checked={theme.flags.uppercaseTag} onChange={(e) => patch((t) => { t.flags.uppercaseTag = e.target.checked; })} /> Uppercase article tag line</label>
              <label className="check"><input type="checkbox" checked={theme.flags.uppercaseBadge} onChange={(e) => patch((t) => { t.flags.uppercaseBadge = e.target.checked; })} /> Uppercase badge</label>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
