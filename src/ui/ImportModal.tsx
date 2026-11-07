import { useRef, useState } from 'react';
import { importFromFile, importFromText } from '../importers';
import type { TitleItem } from '../types';
import { IClose, IUpload } from './icons';

export default function ImportModal(props: {
  defaultTag: string;
  hasItems: boolean;
  onClose: () => void;
  onImport: (items: TitleItem[], replace: boolean) => void;
}) {
  const { defaultTag, hasItems, onClose, onImport } = props;
  const [pending, setPending] = useState<TitleItem[]>([]);
  const [replace, setReplace] = useState(!hasItems);
  const [pasteText, setPasteText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const defaults = { secondary: defaultTag, type: 'speaker' };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      setError('');
      const items = await importFromFile(files[0], defaults);
      if (!items.length) setError('No rows found. Check that the file has columns like: type, badge, primary, secondary — or number and title.');
      setPending(items);
      setSource(files[0].name);
    } catch (e: any) {
      setError(`Could not read file: ${e?.message ?? e}`);
    }
  };

  const handlePaste = (text: string) => {
    setPasteText(text);
    try {
      setError('');
      setPending(importFromText(text, defaults));
      setSource('pasted rows');
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  };

  return (
    <div className="modalback" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Import titles">
        <div className="modal-head">
          <div>
            <span className="kicker">◆ Bulk titles</span>
            <h2>Import from a spreadsheet</h2>
          </div>
          <div className="spacer" />
          <button className="btn icon ghost" onClick={onClose} aria-label="Close"><IClose /></button>
        </div>
        <p className="soft" style={{ marginBottom: 14 }}>
          Works with <b>CSV</b>, <b>Excel (.xlsx)</b>, or a straight <b>copy-paste from Google Sheets</b>. Columns:{' '}
          <code>type</code> (show / speaker / article), <code>badge</code> (article number), <code>primary</code> (name or title),{' '}
          <code>secondary</code> (role / tag line). Header names are flexible, and rows like <i>“5. Resolution regarding…”</i> split into number + title automatically.
        </p>

        <div
          className={`drop ${dragOver ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
        >
          <b><IUpload style={{ verticalAlign: '-2px' }} /> Drop a .csv or .xlsx here</b>
          or click to choose a file
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.ods" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
        </div>

        <label className="fld" style={{ marginTop: 14 }}>
          <span>…or paste rows from Google Sheets / Excel</span>
          <textarea
            value={pasteText}
            placeholder={'type\tbadge\tprimary\tsecondary\narticle\tArticle 1\tApproval of unpaid bills…\tSpecial Town Meeting'}
            onChange={(e) => handlePaste(e.target.value)}
          />
        </label>

        {error && <div className="note-box rose" style={{ marginTop: 10 }}>{error}</div>}

        {pending.length > 0 && (
          <div className="importpreview" style={{ marginTop: 14 }}>
            <b>{pending.length} titles ready</b> <span className="muted">from {source}</span>
            <table>
              <thead>
                <tr><th>type</th><th>badge</th><th>primary</th><th>secondary</th></tr>
              </thead>
              <tbody>
                {pending.slice(0, 6).map((i, k) => (
                  <tr key={k}><td>{i.type}</td><td>{i.badge}</td><td>{i.primary}</td><td>{i.secondary}</td></tr>
                ))}
                {pending.length > 6 && <tr><td colSpan={4} className="muted">… {pending.length - 6} more</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <hr className="sep" />
        <div className="btnrow">
          <label className="check">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Replace the current list {hasItems ? '' : '(it is empty)'}
          </label>
          <div className="grow" />
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn lime" disabled={!pending.length} onClick={() => { onImport(pending, replace); onClose(); }}>
            Import {pending.length || ''} title{pending.length === 1 ? '' : 's'}
          </button>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          Sample files: <a href={`${import.meta.env.BASE_URL}samples/brookline-stm-2026-warrant-articles.csv`} download>warrant articles</a> ·{' '}
          <a href={`${import.meta.env.BASE_URL}samples/speakers-example.csv`} download>speakers</a>. From Google Sheets you can also use File → Download → .csv.
        </p>
      </div>
    </div>
  );
}
