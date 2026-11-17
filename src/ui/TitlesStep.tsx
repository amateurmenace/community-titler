import { Slider } from './Slider';
import type { DatePlace, ExportSettings, ItemSize, ItemType, TitleItem } from '../types';
import { badgeNumber } from '../shared/csv.js';
import { IArrowRight, ICopy, IDown, IDownload, IPlus, ISparkle, ITrash, IUp, IUpload } from './icons';

const OBS_DATE_SCRIPT_URL = 'https://obsproject.com/forum/resources/k_styers-dynamic-time-and-date-display-for-obs-en-multi-8.1946/';

const TYPE_LABEL: Record<ItemType, string> = { show: 'Show ID', speaker: 'Speaker', article: 'Article' };
const TYPE_TONE: Record<ItemType, string> = { show: 'sky', speaker: '', article: 'purple' };
const SIZE_LABEL: Record<ItemSize, string> = { auto: 'Auto', standard: 'Standard', large: 'Large' };
const DATE_LABEL: Record<DatePlace, string> = { off: 'Off', sub: 'After the tag line' };

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
  onDateOverlay: () => void;
  onSelect: (id: string) => void;
  onAdd: (type: ItemType) => void;
  onImport: () => void;
  onLoadSample: () => void;
}) {
  const { items, selectedId, settings, onSettings, onDateOverlay, onSelect, onAdd, onImport, onLoadSample } = props;
  const place: DatePlace = settings.datePlace && settings.datePlace !== 'off' ? 'sub' : 'off';
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
          <div className="typepick" role="radiogroup" aria-label="Date on every title">
            {(['off', 'sub'] as DatePlace[]).map((p) => (
              <button key={p} className={place === p ? 'on' : ''} onClick={() => onSettings({ ...settings, datePlace: p })} role="radio" aria-checked={place === p}>
                {DATE_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
        {place !== 'off' && (
          <>
            <input
              placeholder="November 17, 2026 — or leave blank for a live date from OBS"
              value={dateText}
              onChange={(e) => onSettings({ ...settings, dateText: e.target.value })}
              aria-label="Date text"
            />
            {dateText.trim() ? (
              <p className="hint">
                Continues the tag or role line after a dot — <i>Brookline Special Town Meeting · {dateText.trim()}</i>. A month, year or date the line already ends with is replaced. Clear it to fill the date in from OBS instead.
              </p>
            ) : (
              <div className="obsnote">
                <b>Blank = a live date from OBS.</b> The tag line ends with a dot and an empty slot (its pixel box is printed above the preview). To put today's date in it:
                <ol>
                  <li><button className="linkish" onClick={onDateOverlay}>Download the OBS date overlay</button> — an HTML file that prints the date in the slot, in this look's type and colours, and updates itself at midnight. It is measured on the first article; titles whose tag reads differently put the slot elsewhere.</li>
                  <li>In OBS: <b>Sources → + → Browser</b>, tick <b>Local file</b>, choose that file, set width {settings.width} and height {settings.height}, and keep it above your title sources.</li>
                  <li>Prefer a Text source? <a href={OBS_DATE_SCRIPT_URL} target="_blank" rel="noreferrer">K_STYER's Dynamic Time and Date Display</a> (OBS forum, <b>Tools → Scripts</b>) keeps a Text (GDI+) source showing the date; place it in the slot.</li>
                </ol>
                <button className="btn sm primary" onClick={onDateOverlay}><IDownload /> Download OBS date overlay (.html)</button>
              </div>
            )}
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
              {item.type === 'show' && <span className="val">leave blank for your station line</span>}
            </span>
            <input
              placeholder={item.type === 'speaker' ? 'Town Moderator' : 'Brookline Interactive Group'}
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
        <Slider label="Text size" value={item.textScale ?? 1} onChange={(v) => onPatch({ textScale: v })} min={50} max={200} scale={100} unit="%" />
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
