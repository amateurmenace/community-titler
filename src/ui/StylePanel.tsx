import { useRef } from 'react';
import { BUILT_IN_THEMES, normalizeTheme } from '../renderer/themes.js';
import { addCustomFont, availableFontFamilies } from '../renderer/fonts';
import type { ThemeDef } from '../types';
import { newId } from '../types';

export default function StylePanel(props: {
  themeId: string;
  customThemes: ThemeDef[];
  theme: ThemeDef; // resolved current theme
  onSelect: (id: string) => void;
  onCustomThemesChange: (themes: ThemeDef[], selectId?: string) => void;
}) {
  const { themeId, customThemes, theme, onSelect, onCustomThemesChange } = props;
  const logoRef = useRef<HTMLInputElement>(null);
  const fontRef = useRef<HTMLInputElement>(null);
  const themeFileRef = useRef<HTMLInputElement>(null);

  const isCustom = customThemes.some((t) => t.id === themeId);

  const customize = () => {
    const clone: ThemeDef = JSON.parse(JSON.stringify(theme));
    clone.id = `custom-${newId()}`;
    clone.name = `${theme.name.replace(/ \(custom\)$/, '')} (custom)`;
    onCustomThemesChange([...customThemes, clone], clone.id);
  };

  const patch = (fn: (t: ThemeDef) => void) => {
    if (!isCustom) return;
    const next = customThemes.map((t) => {
      if (t.id !== themeId) return t;
      const copy = normalizeTheme(JSON.parse(JSON.stringify(t))) as ThemeDef;
      fn(copy);
      return copy;
    });
    onCustomThemesChange(next);
  };

  const removeCustom = (id: string) => {
    onCustomThemesChange(customThemes.filter((t) => t.id !== id), 'big');
  };

  const exportTheme = () => {
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${theme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.theme.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const importTheme = async (file: File) => {
    try {
      const t = normalizeTheme(JSON.parse(await file.text())) as ThemeDef;
      if (!t?.colors?.panel || !t?.fonts?.display) throw new Error('not a theme file');
      t.id = `custom-${newId()}`;
      onCustomThemesChange([...customThemes, t], t.id);
    } catch (e: any) {
      alert(`Could not import theme: ${e?.message ?? e}`);
    }
  };

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
  };

  const uploadFont = async (file: File) => {
    const family = prompt('Font family name (as you want it listed):', file.name.replace(/\.[^.]+$/, ''));
    if (!family) return;
    const weightStr = prompt('Weight of this file (400 = regular, 700 = bold, 800 = extra bold):', '700');
    const weight = parseInt(weightStr || '700', 10) || 700;
    await addCustomFont(file, family, weight);
    patch(() => {}); // trigger re-render/save
    alert(`Added ${family} (${weight}). Pick it in the font dropdowns.\nNote: the CLI batch renderer only knows bundled fonts — for CLI use, drop the file in public/fonts and register it in scripts/render.mjs.`);
  };

  const fam = availableFontFamilies();
  const C = theme.colors;

  const colorField = (label: string, get: () => string, set: (v: string) => void) => (
    <label className="fld">
      <span>{label}</span>
      <input type="color" value={get()} disabled={!isCustom} onChange={(e) => set(e.target.value)} />
    </label>
  );

  return (
    <>
      <h3 className="sect">Style</h3>
      {[...BUILT_IN_THEMES, ...customThemes].map((t) => (
        <div key={t.id} className={`themecard ${t.id === themeId ? 'sel' : ''}`} onClick={() => onSelect(t.id)}>
          <div className="name">
            {t.name}
            {customThemes.some((c) => c.id === t.id) && (
              <button
                className="tiny ghost"
                style={{ marginLeft: 'auto' }}
                onClick={(e) => { e.stopPropagation(); removeCustom(t.id); }}
                title="Delete this custom style"
              >✕</button>
            )}
          </div>
          <div className="desc">{t.description ?? 'Custom style'}</div>
          <div className="chips">
            {[t.colors.panel, t.colors.accent, t.colors.tag, t.colors.text].map((c, i) => (
              <i key={i} style={{ background: c }} />
            ))}
          </div>
        </div>
      ))}

      <div className="row" style={{ marginTop: 10 }}>
        <button onClick={customize}>Duplicate &amp; customize</button>
        <button className="ghost fix" onClick={exportTheme} title="Save this style as a .json file to share">Export</button>
        <button className="ghost fix" onClick={() => themeFileRef.current?.click()} title="Load a style .json">Import</button>
        <input ref={themeFileRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && importTheme(e.target.files[0])} />
      </div>

      {!isCustom && (
        <p className="note" style={{ marginTop: 10 }}>
          Built-in styles are locked — hit <b>Duplicate &amp; customize</b> to make this look your own
          (station name, colors, logo, fonts).
        </p>
      )}

      <div className="editor" style={{ opacity: isCustom ? 1 : 0.55 }}>
        <h4>Station identity</h4>
        <label className="fld"><span>Theme name</span>
          <input value={theme.name} disabled={!isCustom} onChange={(e) => patch((t) => { t.name = e.target.value; })} />
        </label>
        <label className="fld"><span>Station / organization</span>
          <input value={theme.identity.org} disabled={!isCustom} onChange={(e) => patch((t) => { t.identity.org = e.target.value; })} />
        </label>
        <div className="grid2">
          <label className="fld"><span>Short mark</span>
            <input value={theme.identity.short} disabled={!isCustom} onChange={(e) => patch((t) => { t.identity.short = e.target.value; })} />
          </label>
          <label className="fld"><span>URL</span>
            <input value={theme.identity.url} disabled={!isCustom} onChange={(e) => patch((t) => { t.identity.url = e.target.value; })} />
          </label>
        </div>
        <label className="fld"><span>Mark on show IDs</span>
          <select
            value={theme.identity.markStyle}
            disabled={!isCustom}
            onChange={(e) => patch((t) => { t.identity.markStyle = e.target.value as any; })}
          >
            <option value="arches">Rainbow arches (BIG)</option>
            <option value="chip">Short-name chip</option>
            <option value="image">Uploaded logo image</option>
            <option value="none">None</option>
          </select>
        </label>
        <div className="row">
          <button disabled={!isCustom} onClick={() => logoRef.current?.click()}>
            {theme.logoData ? 'Replace logo image' : 'Upload logo image…'}
          </button>
          {theme.logoData && (
            <button className="ghost fix" disabled={!isCustom} onClick={() => patch((t) => { delete t.logoData; if (t.identity.markStyle === 'image') t.identity.markStyle = 'chip'; })}>Clear</button>
          )}
          <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
        </div>

        <h4>Type</h4>
        <div className="grid2">
          <label className="fld"><span>Display font</span>
            <select value={theme.fonts.display} disabled={!isCustom} onChange={(e) => patch((t) => { t.fonts.display = e.target.value; })}>
              {fam.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="fld"><span>Display weight</span>
            <select value={theme.fonts.displayWeight} disabled={!isCustom} onChange={(e) => patch((t) => { t.fonts.displayWeight = +e.target.value; })}>
              {[600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
          <label className="fld"><span>Text font</span>
            <select value={theme.fonts.text} disabled={!isCustom} onChange={(e) => patch((t) => { t.fonts.text = e.target.value; })}>
              {fam.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="fld"><span>Text weight</span>
            <select value={theme.fonts.textWeight} disabled={!isCustom} onChange={(e) => patch((t) => { t.fonts.textWeight = +e.target.value; })}>
              {[400, 500, 600, 700].map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
        </div>
        <button className="ghost" disabled={!isCustom} onClick={() => fontRef.current?.click()}>Add a font file (.ttf / .otf)…</button>
        <input ref={fontRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && uploadFont(e.target.files[0])} />

        <h4>Colors</h4>
        <div className="swatchgrid">
          {colorField('Panel', () => C.panel, (v) => patch((t) => { t.colors.panel = v; }))}
          {colorField('Main text', () => C.text, (v) => patch((t) => { t.colors.text = v; }))}
          {colorField('Secondary text', () => C.secondary, (v) => patch((t) => { t.colors.secondary = v; }))}
          {colorField('Tag / URL line', () => C.tag, (v) => patch((t) => { t.colors.tag = v; }))}
          {colorField('Badge background', () => C.badgeBg, (v) => patch((t) => { t.colors.badgeBg = v; }))}
          {colorField('Badge text', () => C.badgeText, (v) => patch((t) => { t.colors.badgeText = v; }))}
        </div>
        <label className="fld"><span>Stripe colors (comma-separated hex)</span>
          <input
            value={C.stripes.join(', ')}
            disabled={!isCustom}
            onChange={(e) => patch((t) => {
              t.colors.stripes = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
            })}
          />
        </label>

        <h4>Shape, layout &amp; motion</h4>
        <div className="grid2">
          <label className="fld"><span>Panel shape</span>
            <select
              value={theme.shape.style}
              disabled={!isCustom}
              onChange={(e) => patch((t) => {
                t.shape.style = e.target.value as any;
                if (t.shape.style === 'parallelogram' && !(t.shape.skew > 0)) t.shape.skew = 12;
              })}
            >
              <option value="parallelogram">Parallelogram (leaning)</option>
              <option value="rounded">Rounded rectangle</option>
            </select>
          </label>
          <label className="fld">
            <span>{theme.shape.style === 'parallelogram' ? `Lean (${theme.shape.skew}°)` : `Corner radius (${theme.layout.cornerRadius})`}</span>
            {theme.shape.style === 'parallelogram' ? (
              <input type="range" min={4} max={20} value={theme.shape.skew} disabled={!isCustom}
                onChange={(e) => patch((t) => { t.shape.skew = +e.target.value; })} />
            ) : (
              <input type="range" min={0} max={28} value={theme.layout.cornerRadius} disabled={!isCustom}
                onChange={(e) => patch((t) => { t.layout.cornerRadius = +e.target.value; })} />
            )}
          </label>
          <label className="fld"><span>Position</span>
            <select value={theme.layout.position} disabled={!isCustom} onChange={(e) => patch((t) => { t.layout.position = e.target.value as any; })}>
              <option value="left">Lower left</option>
              <option value="center">Lower center</option>
            </select>
          </label>
          <label className="fld"><span>Animation</span>
            <select value={theme.animation} disabled={!isCustom} onChange={(e) => patch((t) => { t.animation = e.target.value as any; })}>
              <option value="slide">Slide</option>
              <option value="rise">Rise</option>
              <option value="wipe">Wipe</option>
              <option value="fade">Fade</option>
            </select>
          </label>
          <label className="fld" style={{ gridColumn: 'span 2' }}><span>Scale ({theme.layout.scale.toFixed(2)}×)</span>
            <input type="range" min={0.7} max={1.4} step={0.05} value={theme.layout.scale} disabled={!isCustom}
              onChange={(e) => patch((t) => { t.layout.scale = +e.target.value; })} />
          </label>
        </div>
        <div className="grid2">
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={theme.flags.stripe} disabled={!isCustom}
              onChange={(e) => patch((t) => { t.flags.stripe = e.target.checked; })} /> Stripe tail
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={theme.flags.blade} disabled={!isCustom}
              onChange={(e) => patch((t) => { t.flags.blade = e.target.checked; })} /> Accent blade
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={theme.flags.markOnAll} disabled={!isCustom}
              onChange={(e) => patch((t) => { t.flags.markOnAll = e.target.checked; })} /> Mark on every title
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={theme.flags.shadow} disabled={!isCustom}
              onChange={(e) => patch((t) => { t.flags.shadow = e.target.checked; })} /> Drop shadow
          </label>
        </div>
      </div>
    </>
  );
}
