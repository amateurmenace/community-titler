import { useEffect, useRef, useState } from 'react';
import { drawFrame, totalDuration, holdTime } from '../renderer/core.js';
import { loadAssets, type RenderAssets } from '../exporter/frames';
import type { ExportSettings, ThemeDef, TitleItem } from '../types';
import { IPlay, IStop } from './icons';

type Bg = 'checker' | 'photo' | 'dark' | 'navy' | 'light' | 'green';

const TYPE_LABEL: Record<TitleItem['type'], string> = { show: 'Show ID', speaker: 'Speaker', article: 'Article' };

export default function Preview(props: {
  item: TitleItem | null;
  items: TitleItem[];
  theme: ThemeDef;
  settings: ExportSettings;
  fontsReady: boolean;
  onPick: (id: string) => void;
}) {
  const { item, items, theme, settings, fontsReady, onPick } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bg, setBg] = useState<Bg>('checker');
  const [safe, setSafe] = useState(false);
  const [loop, setLoop] = useState(false);
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const rafRef = useRef(0);
  const [clock, setClock] = useState(0);
  const assetsRef = useRef<RenderAssets>({});
  const [assetsTick, setAssetsTick] = useState(0);

  useEffect(() => {
    let alive = true;
    loadAssets(theme)
      .then((a) => { if (alive) { assetsRef.current = a; setAssetsTick((x) => x + 1); } })
      .catch(() => { assetsRef.current = {}; });
    return () => { alive = false; };
  }, [theme.logoData, theme.identity.markStyle]);

  const T = totalDuration(settings);

  const paint = (t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== settings.width) canvas.width = settings.width;
    if (canvas.height !== settings.height) canvas.height = settings.height;
    const ctx = canvas.getContext('2d')!;
    if (!item) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    drawFrame(ctx, t, item, theme, { ...settings, assets: assetsRef.current });
    if (safe) drawSafeGuides(ctx, settings.width, settings.height);
  };

  // Static hold frame whenever inputs change (and not playing)
  useEffect(() => {
    if (playingRef.current) return;
    paint(holdTime(settings));
    setClock(holdTime(settings));
  }, [item, theme, settings, safe, fontsReady, assetsTick]);

  const stop = () => {
    playingRef.current = false;
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
    paint(holdTime(settings));
    setClock(holdTime(settings));
  };

  const play = () => {
    if (!item) return;
    cancelAnimationFrame(rafRef.current);
    playingRef.current = true;
    setPlaying(true);
    const t0 = performance.now();
    const tick = (now: number) => {
      if (!playingRef.current) return;
      let t = (now - t0) / 1000;
      if (t >= T) {
        if (loopRef.current) {
          t = t - Math.floor(t / T) * T;
        } else {
          paint(T);
          setClock(T);
          playingRef.current = false;
          setPlaying(false);
          // settle back on the hold frame after a beat
          setTimeout(() => { if (!playingRef.current) { paint(holdTime(settings)); setClock(holdTime(settings)); } }, 350);
          return;
        }
      }
      paint(t);
      setClock(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const scrub = (t: number) => {
    if (playingRef.current) { playingRef.current = false; setPlaying(false); cancelAnimationFrame(rafRef.current); }
    paint(t);
    setClock(t);
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Space toggles playback when focus isn't in a field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return;
      e.preventDefault();
      if (playingRef.current) stop(); else play();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const bgs: Array<[Bg, string, string]> = [
    ['checker', 'sw-checker', 'Transparency checkerboard'],
    ['photo', 'sw-photo', 'Grey gradient (like a room shot)'],
    ['dark', 'sw-dark', 'Black'],
    ['navy', 'sw-navy', 'Navy'],
    ['light', 'sw-light', 'Light'],
    ['green', 'sw-green', 'Green'],
  ];

  const phase = clock < settings.inDur ? 'in' : clock < settings.inDur + settings.holdDur ? 'hold' : 'out';

  return (
    <div className="card preview-card">
      <div className="preview-top">
        <h2>Preview</h2>
        {items.length > 0 ? (
          <select
            value={item?.id ?? ''}
            onChange={(e) => onPick(e.target.value)}
            style={{ width: 'auto', maxWidth: 420, padding: '6px 32px 6px 10px', fontSize: 13, fontWeight: 600 }}
            aria-label="Title to preview"
          >
            {items.map((i, k) => (
              <option key={i.id} value={i.id}>
                {k + 1}. {TYPE_LABEL[i.type]} — {i.type === 'article' && i.badge ? `${i.badge} · ` : ''}{i.primary || '(empty)'}
              </option>
            ))}
          </select>
        ) : (
          <span className="now muted">No titles yet</span>
        )}
        <div className="spacer" />
        <span className="fine">Exports are transparent · background is preview-only</span>
      </div>

      <div className={`canvasbox ${bg}`}>
        <canvas ref={canvasRef} width={settings.width} height={settings.height} />
      </div>

      <div className="transport">
        {playing ? (
          <button className="btn primary sm" onClick={stop}><IStop /> Stop</button>
        ) : (
          <button className="btn lime sm" onClick={play} disabled={!item}><IPlay /> Play</button>
        )}
        <input
          className="scrub"
          type="range"
          min={0}
          max={T}
          step={0.01}
          value={Math.min(clock, T)}
          onChange={(e) => scrub(+e.target.value)}
          aria-label="Scrub the timeline"
        />
        <span className="time">{clock.toFixed(2)}s / {T.toFixed(2)}s <span className="muted">· {phase}</span></span>
        <label className="check"><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop</label>
        <label className="check" title="Broadcast action/title-safe guides (preview only — never exported)">
          <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} /> Safe areas
        </label>
        <div className="grow" />
        <div className="bgpick" title="Preview background (not exported)">
          {bgs.map(([b, cls, tip]) => (
            <button key={b} className={`${cls} ${bg === b ? 'on' : ''}`} title={tip} onClick={() => setBg(b)} aria-label={tip} />
          ))}
        </div>
      </div>
    </div>
  );
}

function drawSafeGuides(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.strokeRect(w * 0.035, h * 0.035, w * 0.93, h * 0.93); // action safe
  ctx.strokeStyle = 'rgba(74,222,128,0.6)';
  ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9); // title safe
  ctx.restore();
}
