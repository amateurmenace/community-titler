import type { ItemType, TitleItem } from '../types';
import { newId } from '../types';

const TYPE_LABEL: Record<ItemType, string> = { show: 'Show', speaker: 'Speaker', article: 'Article' };

export default function ItemList(props: {
  items: TitleItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (items: TitleItem[]) => void;
  onImportClick: () => void;
  defaultTag: string;
}) {
  const { items, selectedId, onSelect, onChange, onImportClick, defaultTag } = props;

  const add = (type: ItemType) => {
    const item: TitleItem = {
      id: newId(),
      type,
      badge: type === 'article' ? `Article ${items.filter((i) => i.type === 'article').length + 1}` : '',
      primary: type === 'speaker' ? 'Firstname Lastname' : type === 'show' ? 'Program Title' : 'Title of the warrant article',
      secondary: type === 'speaker' ? 'Role or affiliation' : type === 'article' ? defaultTag : '',
    };
    onChange([...items, item]);
    onSelect(item.id);
  };

  const update = (id: string, patch: Partial<TitleItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  const duplicate = (item: TitleItem) => {
    const idx = items.findIndex((i) => i.id === item.id);
    const copy = { ...item, id: newId() };
    const next = [...items];
    next.splice(idx + 1, 0, copy);
    onChange(next);
    onSelect(copy.id);
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  return (
    <>
      <h3 className="sect">Titles ({items.length})</h3>
      <div className="addrow">
        <button onClick={() => add('speaker')}>+ Speaker</button>
        <button onClick={() => add('show')}>+ Show ID</button>
        <button onClick={() => add('article')}>+ Article</button>
      </div>
      <div className="addrow">
        <button className="accent" onClick={onImportClick} style={{ flex: 1 }}>
          ⇪ Import spreadsheet (CSV · Excel · paste)
        </button>
      </div>

      {items.map((item) => {
        const sel = item.id === selectedId;
        return (
          <div key={item.id} className={`item ${sel ? 'sel' : ''}`}>
            <div className="head" onClick={() => onSelect(item.id)}>
              <span className={`typechip ${item.type}`}>{TYPE_LABEL[item.type]}</span>
              <span className="label">
                {item.type === 'article' && item.badge ? <small>{item.badge} · </small> : null}
                {item.primary || <small>(empty)</small>}
              </span>
            </div>
            {sel && (
              <div className="edit" onClick={(e) => e.stopPropagation()}>
                <div className="row">
                  <select value={item.type} onChange={(e) => update(item.id, { type: e.target.value as ItemType })}>
                    <option value="speaker">Speaker ID</option>
                    <option value="show">Show / event identifier</option>
                    <option value="article">Warrant article</option>
                  </select>
                  {item.type === 'article' && (
                    <input
                      placeholder="Article 5"
                      value={item.badge}
                      onChange={(e) => update(item.id, { badge: e.target.value })}
                    />
                  )}
                </div>
                <input
                  placeholder={item.type === 'speaker' ? 'Name' : 'Title'}
                  value={item.primary}
                  onChange={(e) => update(item.id, { primary: e.target.value })}
                />
                <input
                  placeholder={
                    item.type === 'speaker'
                      ? 'Role / affiliation'
                      : item.type === 'article'
                        ? 'Tag line (e.g. meeting + date)'
                        : 'Second line — leave blank for station name + URL'
                  }
                  value={item.secondary}
                  onChange={(e) => update(item.id, { secondary: e.target.value })}
                />
                <div className="actions">
                  <button className="tiny ghost" title="Move up" onClick={() => move(item.id, -1)}>↑</button>
                  <button className="tiny ghost" title="Move down" onClick={() => move(item.id, 1)}>↓</button>
                  <button className="tiny" onClick={() => duplicate(item)}>Duplicate</button>
                  <button className="tiny" onClick={() => remove(item.id)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
