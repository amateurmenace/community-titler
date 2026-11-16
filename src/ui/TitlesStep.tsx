import type { DatePlace, ExportSettings, ItemSize, ItemType, TitleItem } from '../types';
import { badgeNumber } from '../shared/csv.js';
import { IArrowRight, ICopy, IDown, IPlus, ISparkle, ITrash, IUp, IUpload } from './icons';

const TYPE_LABEL: Record<ItemType, string> = { show: 'Show ID', speaker: 'Speaker', article: 'Article' };
const TYPE_TONE: Record<ItemType, string> = { show: 'sky', speaker: '', article: 'purple' };
const SIZE_LABEL: Record<ItemSize, string> = { auto: 'Auto', standard: 'Standard', large: 'Large' };
const DATE_LABEL: Record<DatePlace, string> = { off: 'Off', title: 'On the title', corner: 'Top-left corner' };

/** "Article 7" → "7", "Article 12A" → "12A", anything without a number → null */
const artNo = (badge: string): string | null => {
  const n = badgeNumber(badge);
  return n ? n.replace(/^0+(?=\d)/, '') : null;
};

export function TitlesRail(props: {
  items: TitleItem[];
  selectedId: string | null;
  settings: ExportSettings;
  onSettings: (settings: ExportSettings) => void;
  onSelect: (id: string) => void;
  onAdd: (type: ItemType) => void;
  onImport: () => void;
  onLoadSample: () => void;
}) {
  const { items, selectedId, settings, onSettings, onSelect, onAdd, onImport, onLoadSample } = props;
  const place: DatePlace = settings.datePlace ?? 'off';
  const dateText = settings.dateText ?? '';
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

      <div className="datecard">
        <div className="datecard-head">
          <span className="fldlabel">Date on every title</span>
          <div className="typepick" role="radiogroup" aria-label="Date placement">
            {(['off', 'title', 'corner'] as DatePlace[]).map((p) => (
              <button key={p} className={place === p ? 'on' : ''} onClick={() => onSettings({ ...settings, datePlace: p })} role="radio" aria-checked={place === p}>
                {DATE_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
        {place !== 'off' && (
          <>
            <input
              placeholder="November 17, 2026 — or leave blank for an empty plate"
              value={dateText}
              onChange={(e) => onSettings({ ...settings, dateText: e.target.value })}
              aria-label="Date text"
            />
            <p className="hint">
              {dateText.trim()
                ? (place === 'title' ? 'A tab on the top-left of the name bar, on every title.' : 'A chip in the top-left corner of the frame, on every title.')
                : 'Blank: an empty plate is drawn so a text source in OBS can show the date live. Its pixel position is shown above the preview'
                  + (place === 'title' ? ' — it moves with each title, so use the corner placement for OBS.' : '.')}
            </p>
          </>
        )}
      </div>

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
          {items.map((item) => {
            const sel = item.id === selectedId;
            const no = item.type === 'article' ? artNo(item.badge) : null;
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
                  {no && <span className="artno">{no}</span>}
                </div>
                <div className="main">
                  <div className="primary">
                    {item.type === 'article' && item.badge && !no ? <span className="muted">{item.badge} · </span> : null}
                    {item.primary || <span className="muted">(empty)</span>}
                  </div>
                  {(item.secondary || item.size === 'large') && (
                    <div className="secondary">{item.size === 'large' ? 'Large · ' : ''}{item.secondary}</div>
                  )}
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
          <span>
            {item.type === 'speaker' ? 'Name' : item.type === 'show' ? 'Program title' : 'Article title'}
            <span className="val">Enter starts a new line</span>
          </span>
          {item.type === 'article' ? (
            <textarea
              className="multiline"
              rows={2}
              value={item.primary}
              onChange={(e) => onPatch({ primary: e.target.value })}
              placeholder="Full title of the warrant article (wraps to three lines, four in Large)"
            />
          ) : (
            <textarea
              className="multiline input-lg"
              rows={1}
              placeholder={item.type === 'speaker' ? 'Jordan Example' : 'Select Board Meeting'}
              value={item.primary}
              onChange={(e) => onPatch({ primary: e.target.value })}
            />
          )}
        </label>
        {item.type === 'article' && (
          <label className="fld">
            <span>Petitioner <span className="val">tab above the title, right-aligned — blank for none</span></span>
            <input
              placeholder="Select Board · or · Gordon, TMM1, Friedman, TMM12"
              value={item.petitioner ?? ''}
              onChange={(e) => onPatch({ petitioner: e.target.value })}
            />
          </label>
        )}
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

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="fld">
          <span className="fldlabel">Size on screen</span>
          <div className="typepick" role="radiogroup" aria-label="Size on screen">
            {(['auto', 'standard', 'large'] as ItemSize[]).map((s) => (
              <button key={s} className={(item.size ?? 'auto') === s ? 'on' : ''} onClick={() => onPatch({ size: s })} role="radio" aria-checked={(item.size ?? 'auto') === s}>
                {SIZE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <label className="fld">
          <span>Text size <span className="val">{Math.round((item.textScale ?? 1) * 100)}%</span></span>
          <input type="range" min={0.8} max={1.4} step={0.05} value={item.textScale ?? 1} onChange={(e) => onPatch({ textScale: +e.target.value })} />
        </label>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        <b>Large</b> uses bigger type and extra lines, growing upward rather than sideways so the lower-right corner stays clear for captions — the right choice for long warrant articles.
        <b> Auto</b> switches to it on its own when a title would otherwise come out small. Fonts and the sizes for a whole look live in the Look step.
      </p>

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
