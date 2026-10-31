import { useEffect, useRef, useState } from 'react';
import { drawFrame, totalDuration, holdTime } from '../renderer/core.js';
import { loadAssets, type RenderAssets } from '../exporter/frames';
import type { ExportSettings, ThemeDef, TitleItem } from '../types';

type Bg = 'checker' | 'dark' | 'navy' | 'light' | 'green';

export default function PreviewPane(props: {
  item: TitleItem | null;
  theme: ThemeDef;
  settings: ExportSettings;
  fontsReady: boolean;
}) {
  const { item, theme, settings, fontsReady } = props;
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

  const paint = (t: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !item) return;
    if (canvas.width !== settings.width) canvas.width = settings.width;
    if (canvas.height !== settings.height) canvas.height = settings.height;
    const ctx = canvas.getContext('2d')!;
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
    const T = totalDuration(settings);
    const t0 = performance.now();
    const tick = (now: number) => {
      if (!playingRef.current) return;
      let t = (now - t0) / 1000;
      if (t >= T) {
        if (loopRef.current) {
          const cycles = Math.floor(t / T);
          t = t - cycles * T;
        } else {
          paint(T);
          setClock(T);
          playingRef.current = false;
          setPlaying(false);
          return;
        }
      }
      paint(t);
      setClock(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const T = totalDuration(settings);
  const bgs: Array<[Bg, string, string]> = [
    ['checker', 'sw-checker', 'Transparency checkerboard'],
    ['dark', 'sw-dark', 'Black'],
    ['navy', 'sw-navy', 'Navy'],
    ['light', 'sw-light', 'Light'],
    ['green', 'sw-green', 'Green'],
  ];

  return (
    <div className="previewwrap">
      <div className={`canvasbox ${bg}`}>
        <canvas ref={canvasRef} width={settings.width} height={settings.height} />
      </div>
      <div className="transport">
        {playing ? (
          <button onClick={stop}>◼ Stop</button>
        ) : (
          <button className="primary" onClick={play} disabled={!item}>▶ Play animation</button>
        )}
        <span className="time">
          {clock.toFixed(2)}s / {T.toFixed(2)}s
        </span>
        <label className="row fix" style={{ gap: 5 }}>
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> loop
        </label>
        <label className="row fix" style={{ gap: 5 }} title="Broadcast action/title-safe guides (preview only — never exported)">
          <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} /> safe areas
        </label>
        <div className="grow" />
        <div className="bgpick" title="Preview background (not exported — exports are transparent)">
          {bgs.map(([b, cls, tip]) => (
            <button key={b} className={`${cls} ${bg === b ? 'on' : ''}`} title={tip} onClick={() => setBg(b)} />
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
  ctx.strokeStyle = 'rgba(254,238,50,0.5)';
  ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9); // title safe
  ctx.restore();
}
