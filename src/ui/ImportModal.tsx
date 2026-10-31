import { useRef, useState } from 'react';
import { importFromFile, importFromText } from '../importers';
import type { TitleItem } from '../types';

export default function ImportModal(props: {
  defaultTag: string;
  onClose: () => void;
  onImport: (items: TitleItem[], replace: boolean) => void;
}) {
  const { defaultTag, onClose, onImport } = props;
  const [pending, setPending] = useState<TitleItem[]>([]);
  const [replace, setReplace] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const defaults = { secondary: defaultTag, type: 'speaker' };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      setError('');
      const items = await importFromFile(files[0], defaults);
      if (!items.length) setError('No rows found. Check that the file has columns like: type, badge, primary, secondary — or number and title.');
      setPending(items);
    } catch (e: any) {
      setError(`Could not read file: ${e?.message ?? e}`);
    }
  };

  const handlePaste = (text: string) => {
    setPasteText(text);
    try {
      setError('');
      setPending(importFromText(text, defaults));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  };

  return (
    <div className="modalback" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="close ghost" onClick={onClose}>✕ Close</button>
        <h2>Import titles from a spreadsheet</h2>
        <p className="note">
          Works with <b>CSV</b>, <b>Excel (.xlsx)</b>, or a straight <b>copy-paste from Google Sheets</b> (select the
          cells, copy, paste below). Recognized columns: <code>type</code> (show / speaker / article),{' '}
          <code>badge</code> (article number), <code>primary</code> (name or title), <code>secondary</code> (role / tag
          line). Rows like <i>“5. Resolution regarding…”</i> are split into number + title automatically.
        </p>

        <div
          className={`drop ${dragOver ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
        >
          Drop a .csv / .xlsx file here, or click to choose
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.ods"
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        <label className="fld">
          <span>…or paste rows from Google Sheets / Excel</span>
          <textarea
            value={pasteText}
            placeholder={'type\tbadge\tprimary\tsecondary\narticle\tArticle 1\tApproval of unpaid bills…\tSpecial Town Meeting'}
            onChange={(e) => handlePaste(e.target.value)}
          />
        </label>

        {error && <p className="note" style={{ color: 'var(--err)' }}>{error}</p>}

        {pending.length > 0 && (
          <div className="importpreview">
            <b style={{ color: 'var(--text)' }}>{pending.length} titles ready</b>
            <table>
              <thead>
                <tr><th>type</th><th>badge</th><th>primary</th><th>secondary</th></tr>
              </thead>
              <tbody>
                {pending.slice(0, 6).map((i, k) => (
                  <tr key={k}><td>{i.type}</td><td>{i.badge}</td><td>{i.primary}</td><td>{i.secondary}</td></tr>
                ))}
                {pending.length > 6 && (
                  <tr><td colSpan={4}>… {pending.length - 6} more</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <hr className="sep" />
        <div className="row">
          <label className="row fix" style={{ gap: 6 }}>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Replace current list (instead of adding)
          </label>
          <div />
          <button
            className="primary fix"
            disabled={!pending.length}
            onClick={() => { onImport(pending, replace); onClose(); }}
          >
            Import {pending.length || ''} titles
          </button>
        </div>
        <p className="note" style={{ marginBottom: 0 }}>
          Tip: a sample file is in <code>samples/brookline-stm-2026-warrant-articles.csv</code> in the repo —
          or <a href={`${import.meta.env.BASE_URL}samples/brookline-stm-2026-warrant-articles.csv`} download style={{ color: 'var(--yellow)' }}>download it here</a> to
          see the format. From Google Sheets you can also use File → Download → .csv.
        </p>
      </div>
    </div>
  );
}
