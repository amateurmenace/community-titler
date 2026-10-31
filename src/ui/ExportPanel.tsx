import { useRef, useState } from 'react';
import type { ExportFormat, ExportSettings, ThemeDef, TitleItem } from '../types';
import { exportItems, type ExportController, type JobProgress } from '../exporter/run';
import { pickDirectory, supportsFolderExport, type DirHandle } from '../exporter/save';

const FORMATS: Array<[ExportFormat, string, string]> = [
  ['prores', 'ProRes 4444 (.mov)', 'Best for OBS Media Source + DeckLink key/fill. Big files, pristine alpha.'],
  ['webm', 'WebM + alpha (.webm)', 'Small files; OBS Media Source decodes the alpha. In-browser encoding is slow (~2 s/frame) — ProRes or the CLI is much faster.'],
  ['png', 'PNG still (.png)', 'One transparent frame (mid-hold) per title — instant.'],
  ['pngseq', 'PNG sequence (.zip)', 'Every frame as numbered PNGs, zipped — for NLEs and CasparCG.'],
];

export default function ExportPanel(props: {
  items: TitleItem[];
  selected: TitleItem | null;
  theme: ThemeDef;
  settings: ExportSettings;
  onSettings: (s: ExportSettings) => void;
}) {
  const { items, selected, theme, settings, onSettings } = props;
  const [jobs, setJobs] = useState<Record<string, JobProgress>>({});
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState('');
  const ctlRef = useRef<ExportController>({ cancelled: false });

  const set = (patch: Partial<ExportSettings>) => onSettings({ ...settings, ...patch });

  const run = async (list: TitleItem[]) => {
    if (!list.length || running) return;
    let dir: DirHandle | null = null;
    if (supportsFolderExport()) {
      dir = await pickDirectory(); // null = cancelled → fall back to downloads
      if (dir === null && list.length > 3) {
        if (!confirm(`No folder chosen — ${list.length} files will come through as individual browser downloads. Continue?`)) return;
      }
    }
    ctlRef.current = { cancelled: false };
    setJobs({});
    setSummary('');
    setRunning(true);
    const indexOf = (item: TitleItem) => items.findIndex((i) => i.id === item.id);
    try {
      const res = await exportItems(
        list, indexOf, theme, settings, dir,
        (p) => setJobs((j) => ({ ...j, [p.label]: p })),
        ctlRef.current,
      );
      setSummary(
        ctlRef.current.cancelled
          ? `Cancelled — ${res.done} of ${list.length} finished.`
          : `Done: ${res.done} of ${list.length} exported${res.failed.length ? ` · failed: ${res.failed.join(', ')}` : ''}${dir ? ' → chosen folder' : ' → downloads'}.`,
      );
    } finally {
      setRunning(false);
    }
  };

  const fmtInfo = FORMATS.find(([f]) => f === settings.format)?.[2] ?? '';
  const isVideo = settings.format === 'prores' || settings.format === 'webm';

  return (
    <div className="exportpanel">
      <h3 className="sect" style={{ marginTop: 0 }}>Export — transparent alpha for OBS / key &amp; fill</h3>
      <div className="controls">
        <label className="fld" style={{ gridColumn: 'span 2' }}>
          <span>Format</span>
          <select value={settings.format} onChange={(e) => set({ format: e.target.value as ExportFormat })}>
            {FORMATS.map(([f, label]) => <option key={f} value={f}>{label}</option>)}
          </select>
        </label>
        <label className="fld">
          <span>Size</span>
          <select
            value={`${settings.width}x${settings.height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split('x').map(Number);
              set({ width: w, height: h });
            }}
          >
            <option value="1920x1080">1920 × 1080</option>
            <option value="1280x720">1280 × 720</option>
          </select>
        </label>
        <label className="fld">
          <span>Frame rate</span>
          <select value={settings.fps} disabled={!isVideo && settings.format !== 'pngseq'} onChange={(e) => set({ fps: +e.target.value })}>
            <option value={29.97}>29.97</option>
            <option value={30}>30</option>
            <option value={59.94}>59.94</option>
            <option value={60}>60</option>
          </select>
        </label>
        <label className="fld">
          <span>In (s)</span>
          <input type="number" min={0} max={3} step={0.1} value={settings.inDur}
            onChange={(e) => set({ inDur: Math.max(0, +e.target.value || 0) })} />
        </label>
        <label className="fld">
          <span>Hold (s)</span>
          <input type="number" min={0.5} max={120} step={0.5} value={settings.holdDur}
            onChange={(e) => set({ holdDur: Math.max(0.5, +e.target.value || 6) })} />
        </label>
      </div>

      <div className="buttons">
        <button className="primary" disabled={!selected || running} onClick={() => selected && run([selected])}>
          Export selected
        </button>
        <button className="accent" disabled={!items.length || running} onClick={() => run(items)}>
          Export all ({items.length})
        </button>
        {running && (
          <button onClick={() => { ctlRef.current.cancelled = true; }}>Cancel</button>
        )}
        <span className="note" style={{ flex: 1, minWidth: 220 }}>
          {fmtInfo}{' '}
          {supportsFolderExport()
            ? 'You will be asked to pick an output folder.'
            : 'This browser saves each file as a download (Chrome/Edge can export straight to a folder).'}
          {' '}Out: {settings.outDur}s.
        </span>
      </div>

      {(running || Object.keys(jobs).length > 0) && (
        <div className="progress">
          {Object.values(jobs).map((j) => (
            <div key={j.label} className="job">
              <span style={{ minWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.label}</span>
              <span className="bar"><i style={{ width: `${Math.round(j.progress * 100)}%` }} /></span>
              <span className={j.phase === 'error' ? 'err' : j.phase === 'done' ? 'ok' : ''} style={{ minWidth: 58 }}>
                {j.phase === 'done' ? '✓ done' : j.phase === 'error' ? '✕ failed' : j.phase}
              </span>
            </div>
          ))}
          {summary && <div className="note">{summary}</div>}
        </div>
      )}
    </div>
  );
}
