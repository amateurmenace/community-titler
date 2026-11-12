import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExportFormat, ExportSettings, ThemeDef, TitleItem } from '../types';
import { exportItems, type ExportController, type ExportDestination, type JobProgress } from '../exporter/run';
import { pickDirectory, supportsFolderExport } from '../exporter/save';
import { desktop } from '../desktop';
import { badgeNumber } from '../shared/csv.js';
import { IDownload, IFolder, IStop } from './icons';

/** Short label for a checklist row: "Art. 7", "Show ID" or "Speaker". */
function rowTag(i: TitleItem): string {
  if (i.type === 'article') {
    const n = badgeNumber(i.badge);
    return n ? `Art. ${n.replace(/^0+(?=\d)/, '')}` : 'Article';
  }
  return i.type === 'show' ? 'Show ID' : 'Speaker';
}

const FORMATS: Array<{ id: ExportFormat; name: string; ext: string; desc: string; tag?: string }> = [
  { id: 'prores', name: 'ProRes 4444', ext: '.mov', tag: 'Recommended', desc: 'The broadcast workhorse: flawless alpha, decodes effortlessly in OBS Media Source and for DeckLink key/fill. Big files.' },
  { id: 'webm', name: 'WebM with alpha', ext: '.webm', desc: 'Small files for OBS overlay scenes. In the browser this encodes slowly (VP8); the desktop app and CLI are fast.' },
  { id: 'png', name: 'PNG still', ext: '.png', desc: 'One transparent frame per title (mid-hold). Instant — for stills, slides, or a quick check.' },
  { id: 'pngseq', name: 'PNG sequence', ext: '.zip / folder', desc: 'Every frame as numbered PNGs — for NLEs and CasparCG. The desktop app writes a folder; the browser zips it.' },
];

export function ExportRail(props: {
  settings: ExportSettings;
  onSettings: (s: ExportSettings) => void;
  dest: ExportDestination | null;
  onDest: (d: ExportDestination | null) => void;
}) {
  const { settings, onSettings, dest, onDest } = props;
  const set = (patch: Partial<ExportSettings>) => onSettings({ ...settings, ...patch });
  const isVideo = settings.format === 'prores' || settings.format === 'webm';
  const total = settings.inDur + settings.holdDur + settings.outDur;

  const pickDest = async () => {
    if (desktop) {
      const path = await desktop.pickFolder();
      if (path) onDest({ kind: 'folder', path });
    } else if (supportsFolderExport()) {
      const handle = await pickDirectory();
      if (handle) onDest({ kind: 'browser-dir', handle });
    }
  };

  return (
    <>
      <div className="rail-head">
        <h2>Export</h2>
      </div>
      <p className="rail-intro">Every format carries a real alpha channel. Pick one, set the timing, choose where the files go.</p>

      <div>
        <span className="kicker" style={{ marginBottom: 8 }}>◆ Format</span>
        <div className="formatgrid">
          {FORMATS.map((f) => (
            <div key={f.id} className={`format-card ${settings.format === f.id ? 'sel' : ''}`} onClick={() => set({ format: f.id })} role="radio" aria-checked={settings.format === f.id} tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set({ format: f.id }); } }}>
              <span className="radio" />
              <div>
                <div className="t">{f.name} <span className="ext">{f.ext}</span> {f.tag && <span className="badge" style={{ fontSize: 9 }}>{f.tag}</span>}</div>
                <div className="d">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <span className="kicker" style={{ marginBottom: 8 }}>◆ Timing &amp; size</span>
        <div className="card tight flat">
          <div className="grid3">
            <label className="fld"><span>In</span>
              <input type="number" min={0} max={4} step={0.1} value={settings.inDur} disabled={settings.format === 'png'} onChange={(e) => set({ inDur: Math.max(0, +e.target.value || 0) })} />
            </label>
            <label className="fld"><span>Hold</span>
              <input type="number" min={0.5} max={300} step={0.5} value={settings.holdDur} disabled={settings.format === 'png'} onChange={(e) => set({ holdDur: Math.max(0.5, +e.target.value || 6) })} />
            </label>
            <label className="fld"><span>Out</span>
              <input type="number" min={0} max={4} step={0.1} value={settings.outDur} disabled={settings.format === 'png'} onChange={(e) => set({ outDur: Math.max(0, +e.target.value || 0) })} />
            </label>
            <label className="fld"><span>Size</span>
              <select value={`${settings.width}x${settings.height}`} onChange={(e) => { const [w, h] = e.target.value.split('x').map(Number); set({ width: w, height: h }); }}>
                <option value="1920x1080">1920 × 1080</option>
                <option value="1280x720">1280 × 720</option>
                <option value="3840x2160">3840 × 2160</option>
              </select>
            </label>
            <label className="fld"><span>Frame rate</span>
              <select value={settings.fps} disabled={!isVideo && settings.format !== 'pngseq'} onChange={(e) => set({ fps: +e.target.value })}>
                <option value={29.97}>29.97</option>
                <option value={30}>30</option>
                <option value={59.94}>59.94</option>
                <option value={60}>60</option>
              </select>
            </label>
            <div className="fld">
              <span className="fldlabel">Clip length</span>
              <div className="mono" style={{ padding: '9px 0', fontWeight: 700 }}>{total.toFixed(1)} s</div>
            </div>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>Seconds. The hold is how long the title sits on screen before it animates out — make it long for a key/fill feed you cut away from manually.</p>
        </div>
      </div>

      <div>
        <span className="kicker" style={{ marginBottom: 8 }}>◆ Destination</span>
        {desktop || supportsFolderExport() ? (
          <div className="fields">
            <div className="outpath">
              <IFolder />
              <span className="path">{dest?.kind === 'folder' ? dest.path : dest?.kind === 'browser-dir' ? dest.handle.name : 'No folder chosen yet'}</span>
            </div>
            <button className="btn sm" onClick={pickDest}><IFolder /> {dest ? 'Change folder…' : 'Choose a folder…'}</button>
          </div>
        ) : (
          <p className="hint">This browser saves each file as a download. Chrome and Edge can write straight into a folder, and the desktop app always does.</p>
        )}
      </div>
    </>
  );
}

export function ExportRunner(props: {
  items: TitleItem[];
  selectedId: string | null;
  theme: ThemeDef;
  settings: ExportSettings;
  dest: ExportDestination | null;
  onDest: (d: ExportDestination | null) => void;
  selection: Set<string> | null;
  onSelection: (s: Set<string> | null) => void;
  showToast: (msg: string) => void;
}) {
  const { items, selectedId, theme, settings, dest, onDest, selection, onSelection, showToast } = props;
  const [jobs, setJobs] = useState<Record<string, JobProgress>>({});
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState('');
  const [lastDest, setLastDest] = useState<ExportDestination | null>(null);
  const ctlRef = useRef<ExportController>({ cancelled: false });
  const [ffmpegNative, setFfmpegNative] = useState<boolean | null>(null);

  useEffect(() => {
    if (desktop) desktop.ffmpegAvailable().then(setFfmpegNative).catch(() => setFfmpegNative(false));
  }, []);

  const chosen = useMemo(() => (selection ? items.filter((i) => selection.has(i.id)) : items), [items, selection]);
  const isChecked = (id: string) => (selection ? selection.has(id) : true);
  const toggle = (id: string) => {
    const next = new Set(selection ?? items.map((i) => i.id));
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelection(next.size === items.length ? null : next);
  };

  const run = async (list: TitleItem[]) => {
    if (!list.length || running) return;
    let d: ExportDestination | null = dest;
    if (desktop) {
      if (!d) {
        const path = await desktop.pickFolder();
        if (!path) return;
        d = { kind: 'folder', path };
        onDest(d);
      }
    } else if (supportsFolderExport()) {
      if (!d) {
        const handle = await pickDirectory();
        if (handle) { d = { kind: 'browser-dir', handle }; onDest(d); }
        else {
          if (list.length > 3 && !confirm(`No folder chosen — ${list.length} files will come through as individual browser downloads. Continue?`)) return;
          d = { kind: 'downloads' };
        }
      }
    } else {
      d = { kind: 'downloads' };
    }
    ctlRef.current = { cancelled: false };
    setJobs({});
    setSummary('');
    setRunning(true);
    setLastDest(d);
    const t0 = performance.now();
    try {
      const res = await exportItems(list, items, theme, settings, d, (p) => setJobs((j) => ({ ...j, [p.label]: p })), ctlRef.current);
      const secs = ((performance.now() - t0) / 1000).toFixed(0);
      const where = d.kind === 'folder' ? d.path : d.kind === 'browser-dir' ? `the “${d.handle.name}” folder` : 'your downloads';
      setSummary(
        ctlRef.current.cancelled
          ? `Cancelled — ${res.done} of ${list.length} finished (${secs}s).`
          : `Done: ${res.done} of ${list.length} exported to ${where} in ${secs}s${res.failed.length ? ` · failed: ${res.failed.join(', ')}` : ''}.`,
      );
      if (!ctlRef.current.cancelled) showToast(`Exported ${res.done} title${res.done === 1 ? '' : 's'}`);
    } finally {
      setRunning(false);
    }
  };

  const fmt = FORMATS.find((f) => f.id === settings.format)!;
  const selectedItem = items.find((i) => i.id === selectedId) ?? null;
  const nativeNote = desktop
    ? ffmpegNative === false
      ? 'Native ffmpeg is missing from this build — video exports fall back to the slower in-app encoder.'
      : 'The desktop app renders straight into native ffmpeg — ProRes exports take seconds per title.'
    : settings.format === 'webm'
      ? 'In-browser WebM encoding is slow (about 2 seconds per frame). For big batches use ProRes, the desktop app, or the CLI.'
      : settings.format === 'prores'
        ? 'In-browser ProRes encoding takes roughly 30 seconds per title. The desktop app is much faster.'
        : '';

  return (
    <div className="card">
      <div className="editor-head">
        <div>
          <span className="kicker">◆ Step 3 of 3 · {fmt.name} · {settings.width}×{settings.height}{settings.format === 'png' ? '' : ` · ${settings.fps} fps`}</span>
          <h2 style={{ fontSize: 17 }}>Which titles?</h2>
        </div>
        <div className="spacer" />
        <button className="btn xs ghost" onClick={() => onSelection(null)} disabled={!selection}>All</button>
        <button className="btn xs ghost" onClick={() => onSelection(new Set())} disabled={selection?.size === 0}>None</button>
      </div>

      {items.length === 0 ? (
        <div className="empty"><b>Nothing to export yet</b>Go back to Titles and add or import some.</div>
      ) : (
        <div className="checklist">
          {items.map((i) => (
            <label key={i.id}>
              <input type="checkbox" checked={isChecked(i.id)} onChange={() => toggle(i.id)} disabled={running} />
              <span className={`badge ${i.type === 'article' ? 'purple' : i.type === 'show' ? 'sky' : ''}`} style={{ fontSize: 9, whiteSpace: 'nowrap' }}>{rowTag(i)}</span>
              <span className="txt">
                <b>{i.primary || '(empty)'}</b>
                {i.secondary && <span className="muted"> — {i.secondary}</span>}
              </span>
            </label>
          ))}
        </div>
      )}

      <hr className="sep" />
      <div className="btnrow">
        <button className="btn lime lg" disabled={!chosen.length || running} onClick={() => run(chosen)}>
          <IDownload /> Export {chosen.length === items.length ? `all ${chosen.length}` : chosen.length} title{chosen.length === 1 ? '' : 's'}
        </button>
        <button className="btn" disabled={!selectedItem || running} onClick={() => selectedItem && run([selectedItem])} title="Export just the title shown in the preview">
          Only the previewed title
        </button>
        {running && <button className="btn danger" onClick={() => { ctlRef.current.cancelled = true; }}><IStop /> Cancel</button>}
        <div className="grow" />
        {lastDest?.kind === 'folder' && !running && summary && (
          <button className="btn sm" onClick={() => desktop?.openPath(lastDest.path)}><IFolder /> Open folder</button>
        )}
      </div>
      {nativeNote && <p className="hint" style={{ marginTop: 10 }}>{nativeNote}</p>}

      {(running || Object.keys(jobs).length > 0) && (
        <>
          <hr className="sep" />
          <div className="progress">
            {Object.values(jobs).map((j) => (
              <div key={j.label} className="job">
                <span className="label" title={j.label}>{j.label}</span>
                <span className="bar"><i style={{ width: `${Math.round((j.phase === 'done' ? 1 : j.progress) * 100)}%` }} /></span>
                <span className={`state ${j.phase === 'error' ? 'err' : j.phase === 'done' ? 'ok' : ''}`}>
                  {j.phase === 'done' ? '✓ done' : j.phase === 'error' ? (j.message === 'cancelled' ? 'stopped' : '✕ failed') : j.phase === 'render' ? `${Math.round(j.progress * 100)}%` : j.phase}
                </span>
              </div>
            ))}
            {summary && <div className="summary">{summary}</div>}
          </div>
        </>
      )}
    </div>
  );
}
