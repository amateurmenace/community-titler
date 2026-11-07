import type { ItemType, TitleItem } from '../types';
import { IArrowRight, ICopy, IDown, IPlus, ISparkle, ITrash, IUp, IUpload } from './icons';

const TYPE_LABEL: Record<ItemType, string> = { show: 'Show ID', speaker: 'Speaker', article: 'Article' };
const TYPE_TONE: Record<ItemType, string> = { show: 'sky', speaker: '', article: 'purple' };

export function TitlesRail(props: {
  items: TitleItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (type: ItemType) => void;
  onImport: () => void;
  onLoadSample: () => void;
}) {
  const { items, selectedId, onSelect, onAdd, onImport, onLoadSample } = props;
  return (
    <>
      <div className="rail-head">
        <h2>Titles</h2>
        <span className="count">{items.length}</span>
        <div className="spacer" />
      </div>
      <p className="rail-intro">Add titles one at a time, or import a whole spreadsheet. Click a title to preview and edit it.</p>

      <div className="addmenu">
        <button className="btn sm" onClick={() => onAdd('speaker')}><IPlus /> Speaker</button>
        <button className="btn sm" onClick={() => onAdd('show')}><IPlus /> Show ID</button>
        <button className="btn sm" onClick={() => onAdd('article')}><IPlus /> Article</button>
      </div>
      <button className="btn primary block" onClick={onImport}><IUpload /> Import spreadsheet · CSV · paste</button>

      {items.length === 0 ? (
        <div className="empty">
          <b>No titles yet</b>
          Add one above, import a spreadsheet, or start from the Brookline town meeting warrant.
          <div style={{ marginTop: 12 }}>
            <button className="btn lime sm" onClick={onLoadSample}><ISparkle /> Load Town Meeting 2026 sample</button>
          </div>
        </div>
      ) : (
        <div className="titlelist">
          {items.map((item, idx) => {
            const sel = item.id === selectedId;
            return (
              <div
                key={item.id}
                className={`title-card ${sel ? 'sel' : ''}`}
                onClick={() => onSelect(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(item.id); } }}
              >
                <div className="lead">
                  <span className={`badge ${TYPE_TONE[item.type]}`}>{TYPE_LABEL[item.type]}</span>
                  <span className="idx">{String(idx + 1).padStart(2, '0')}</span>
                </div>
                <div className="main">
                  <div className="primary">
                    {item.type === 'article' && item.badge ? <span className="muted">{item.badge} · </span> : null}
                    {item.primary || <span className="muted">(empty)</span>}
                  </div>
                  {item.secondary && <div className="secondary">{item.secondary}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export function TitleEditor(props: {
  item: TitleItem | null;
  index: number;
  count: number;
  defaultTag: string;
  onPatch: (patch: Partial<TitleItem>) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAdd: (type: ItemType) => void;
  onImport: () => void;
  onNext: () => void;
}) {
  const { item, index, count, defaultTag, onPatch, onMove, onDuplicate, onDelete, onAdd, onImport, onNext } = props;

  if (!item) {
    return (
      <div className="card">
        <div className="card-head">
          <div>
            <span className="kicker">◆ Step 1 of 3</span>
            <h2>Start with a title</h2>
          </div>
        </div>
        <p className="soft" style={{ marginBottom: 14 }}>
          Three kinds of lower third: a <b>Speaker</b> ID (name + role), a <b>Show ID</b> (program title + your station line), and a
          <b> Warrant article</b> (number badge + full article title + meeting tag). Everything exports with a real alpha channel.
        </p>
        <div className="btnrow">
          <button className="btn" onClick={() => onAdd('speaker')}><IPlus /> Speaker</button>
          <button className="btn" onClick={() => onAdd('show')}><IPlus /> Show ID</button>
          <button className="btn" onClick={() => onAdd('article')}><IPlus /> Article</button>
          <button className="btn primary" onClick={onImport}><IUpload /> Import a spreadsheet</button>
        </div>
      </div>
    );
  }

  const setType = (type: ItemType) => {
    const patch: Partial<TitleItem> = { type };
    if (type === 'article' && !item.badge) patch.badge = 'Article 1';
    if (type === 'article' && !item.secondary) patch.secondary = defaultTag;
    onPatch(patch);
  };

  return (
    <div className="card">
      <div className="editor-head">
        <div>
          <span className="kicker">◆ Step 1 of 3 · editing title {index + 1} of {count}</span>
          <h2 style={{ fontSize: 17 }}>What should it say?</h2>
        </div>
        <div className="spacer" />
        <div className="typepick" role="radiogroup" aria-label="Title type">
          {(['speaker', 'show', 'article'] as ItemType[]).map((t) => (
            <button key={t} className={item.type === t ? 'on' : ''} onClick={() => setType(t)} role="radio" aria-checked={item.type === t}>
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="fields">
        {item.type === 'article' && (
          <div className="grid2">
            <label className="fld">
              <span>Article number <span className="val">shown on the badge</span></span>
              <input placeholder="Article 5" value={item.badge} onChange={(e) => onPatch({ badge: e.target.value })} />
            </label>
            <label className="fld">
              <span>Meeting tag <span className="val">sub bar</span></span>
              <input placeholder="Special Town Meeting · November 2026" value={item.secondary} onChange={(e) => onPatch({ secondary: e.target.value })} />
            </label>
          </div>
        )}
        <label className="fld">
          <span>{item.type === 'speaker' ? 'Name' : item.type === 'show' ? 'Program title' : 'Article title'}</span>
          {item.type === 'article' ? (
            <textarea
              rows={2}
              style={{ fontFamily: 'var(--font)', fontSize: 15, fontWeight: 600, minHeight: 64 }}
              value={item.primary}
              onChange={(e) => onPatch({ primary: e.target.value })}
              placeholder="Full title of the warrant article (wraps to up to three lines)"
            />
          ) : (
            <input
              className="input-lg"
              placeholder={item.type === 'speaker' ? 'Jordan Example' : 'Select Board Meeting'}
              value={item.primary}
              onChange={(e) => onPatch({ primary: e.target.value })}
            />
          )}
        </label>
        {item.type !== 'article' && (
          <label className="fld">
            <span>
              {item.type === 'speaker' ? 'Role or affiliation' : 'Second line'}
              {item.type === 'show' && <span className="val">leave blank for station name + URL</span>}
            </span>
            <input
              placeholder={item.type === 'speaker' ? 'Town Moderator' : 'Brookline Interactive Group · brooklineinteractive.org'}
              value={item.secondary}
              onChange={(e) => onPatch({ secondary: e.target.value })}
            />
          </label>
        )}
      </div>

      <hr className="sep" />
      <div className="btnrow">
        <button className="btn sm" onClick={() => onMove(-1)} disabled={index <= 0} title="Move up"><IUp /> Up</button>
        <button className="btn sm" onClick={() => onMove(1)} disabled={index >= count - 1} title="Move down"><IDown /> Down</button>
        <button className="btn sm" onClick={onDuplicate}><ICopy /> Duplicate</button>
        <button className="btn sm danger" onClick={onDelete}><ITrash /> Delete</button>
        <div className="grow" />
        <button className="btn lime" onClick={onNext}>Next: choose a look <IArrowRight /></button>
      </div>
    </div>
  );
}
