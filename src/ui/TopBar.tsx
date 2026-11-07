import { useEffect, useRef, useState } from 'react';
import { desktop, openLink } from '../desktop';
import { IChevron, IDownload, IFile, IHelp, IMore, IPlus, ISparkle, Mark } from './icons';

export type Step = 'titles' | 'look' | 'export';

const STEPS: Array<[Step, string]> = [
  ['titles', 'Titles'],
  ['look', 'Look'],
  ['export', 'Export'],
];

export default function TopBar(props: {
  step: Step;
  onStep: (s: Step) => void;
  titleCount: number;
  projectName: string;
  onOpen: () => void;
  onSave: () => void;
  onSample: () => void;
  onNew: () => void;
}) {
  const { step, onStep, titleCount, projectName, onOpen, onSave, onSample, onNew } = props;
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const order = STEPS.map(([s]) => s);
  const cur = order.indexOf(step);

  return (
    <header className="topbar">
      <div className="wordmark">
        <div className="logo"><Mark /></div>
        <div>
          <div className="name">Community Titler</div>
          <div className="tag">◆ Lower thirds for community media</div>
        </div>
      </div>

      <nav className="stepper" aria-label="Steps">
        {STEPS.map(([s, label], i) => (
          <span key={s} style={{ display: 'contents' }}>
            {i > 0 && <span className="step-arrow" aria-hidden>→</span>}
            <button
              className={`step ${step === s ? 'active' : ''} ${i < cur ? 'done' : ''}`}
              onClick={() => onStep(s)}
              title={s === 'titles' ? 'Type or import your titles' : s === 'look' ? 'Pick and customize a look' : 'Export transparent video or PNGs'}
            >
              <span className="num">{i < cur ? '✓' : i + 1}</span>
              {label}
              {s === 'titles' && titleCount > 0 && <span className="mono" style={{ fontSize: 11, opacity: 0.75 }}>{titleCount}</span>}
            </button>
          </span>
        ))}
      </nav>

      <div className="spacer" />

      <div className="right">
        <span className="small soft" style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={projectName}>
          {projectName}
        </span>
        <div className="menu-wrap" ref={menuRef}>
          <button className="btn sm" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}>
            <IFile /> Project <IChevron style={{ width: 13, height: 13 }} />
          </button>
          {menu && (
            <div className="menu" role="menu">
              <button onClick={() => { setMenu(false); onOpen(); }}><IFile /> Open project file…</button>
              <button onClick={() => { setMenu(false); onSave(); }}><IDownload /> Save project file</button>
              <div className="sep" />
              <button onClick={() => { setMenu(false); onSample(); }}><ISparkle /> Load Brookline Town Meeting 2026 <small>sample</small></button>
              <button onClick={() => { setMenu(false); onNew(); }}><IPlus /> New empty project</button>
              <div className="sep" />
              <button onClick={() => { setMenu(false); openLink('https://github.com/amateurmenace/community-titler#readme'); }}><IHelp /> Help &amp; OBS setup guide</button>
              {desktop && <button disabled style={{ opacity: 0.6 }}><IMore /> Desktop app <small>v{desktop.version}</small></button>}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
