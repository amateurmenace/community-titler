import { useEffect, useRef } from 'react';
import { drawFrame, holdTime } from '../renderer/core.js';
import { loadAssets } from '../exporter/frames';
import type { ThemeDef, TitleItem } from '../types';

const SETTINGS = { width: 1920, height: 1080, fps: 30, inDur: 1, holdDur: 2, outDur: 1 };

/**
 * A close-up thumbnail of a look: renders the title at full 1080p into an
 * offscreen canvas, then crops the lower-left region into a small canvas.
 */
export default function ThemeThumb(props: { theme: ThemeDef; item: TitleItem; fontsReady: boolean }) {
  const { theme, item, fontsReady } = props;
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const assets = await loadAssets(theme).catch(() => ({}));
      if (!alive || !ref.current) return;
      const off = document.createElement('canvas');
      off.width = SETTINGS.width;
      off.height = SETTINGS.height;
      const octx = off.getContext('2d')!;
      drawFrame(octx, holdTime(SETTINGS), item, theme, { ...SETTINGS, assets });
      const c = ref.current;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      // crop: generous box around the lower-left title
      const sx = 60, sy = 560, sw = 1380, sh = 480;
      ctx.drawImage(off, sx, sy, sw, sh, 0, 0, c.width, c.height);
    })();
    return () => { alive = false; };
  }, [theme, item, fontsReady]);

  return <canvas ref={ref} className="thumb" width={690} height={240} aria-hidden />;
}
