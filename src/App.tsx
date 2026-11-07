import { useEffect, useMemo, useRef, useState } from 'react';
import TopBar, { type Step } from './ui/TopBar';
import Preview from './ui/Preview';
import { TitlesRail, TitleEditor } from './ui/TitlesStep';
import { LookRail, LookEditor } from './ui/LookStep';
import { ExportRail, ExportRunner } from './ui/ExportStep';
import ImportModal from './ui/ImportModal';
import { getTheme, normalizeTheme } from './renderer/themes.js';
import { getCustomFonts, loadBundledFonts, registerCustomFonts } from './renderer/fonts';
import { defaultProject, emptyProject, exportProjectFile, loadProject, migrateProject, saveProject, SAMPLE_NAME } from './store';
import { STM_TAG } from './data/stm2026';
import type { ExportDestination } from './exporter/run';
import type { ItemType, Project, ThemeDef, TitleItem } from './types';
import { newId } from './types';
import { desktop, joinPath } from './desktop';
import { exportItems } from './exporter/run';
import { getTheme as resolveTheme } from './renderer/themes.js';

export default function App() {
  const [project, setProject] = useState<Project>(() => loadProject());
  const [selectedId, setSelectedId] = useState<string | null>(() => project.items[0]?.id ?? null);
  const [step, setStep] = useState<Step>('titles');
  const [fontsReady, setFontsReady] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [dest, setDest] = useState<ExportDestination | null>(null);
  const [exportSel, setExportSel] = useState<Set<string> | null>(null); // null = everything
  const projectFileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  };

  useEffect(() => {
    (async () => {
      await loadBundledFonts();
      await registerCustomFonts(getCustomFonts());
      setFontsReady(true);
    })();
  }, []);

  useEffect(() => saveProject(project), [project]);

  // Desktop smoke test: `Community Titler --autoexport=<folder>`
  useEffect(() => {
    if (!desktop?.autoExport || !fontsReady) return;
    const dir = desktop.autoExport;
    (async () => {
      const sample = defaultProject();
      const th = resolveTheme('big', []) as ThemeDef;
      const list = [sample.items[0], sample.items[7]];
      const log = (m: string) => console.log(`[autoexport] ${m}`);
      try {
        await new Promise((r) => setTimeout(r, 1200));
        await desktop.capture(joinPath(dir, 'app.png'));
        log('captured app.png');
        for (const format of ['png', 'prores'] as const) {
          const res = await exportItems(list, (it) => sample.items.indexOf(it), th, { ...sample.settings, format, holdDur: 1 },
            { kind: 'folder', path: dir }, (p) => { if (p.phase === 'done' || p.phase === 'error') log(`${format} ${p.label} ${p.phase} ${p.message ?? ''}`); }, { cancelled: false });
          log(`${format}: ${res.done} done, ${res.failed.length} failed`);
        }
        log('finished');
      } catch (e: any) {
        log(`FAILED ${e?.message ?? e}`);
      }
      await desktop.quit();
    })();
  }, [fontsReady]);

  const theme: ThemeDef = useMemo(
    () => getTheme(project.themeId, project.customThemes) as ThemeDef,
    [project.themeId, project.customThemes],
  );
  const isCustom = project.customThemes.some((t) => t.id === project.themeId);

  const selected = project.items.find((i) => i.id === selectedId) ?? project.items[0] ?? null;
  const selectedIndex = selected ? project.items.findIndex((i) => i.id === selected.id) : -1;

  const defaultTag = useMemo(() => {
    const firstArticle = project.items.find((i) => i.type === 'article');
    return firstArticle?.secondary || STM_TAG;
  }, [project.items]);

  // ---- titles ---------------------------------------------------------------
  const setItems = (items: TitleItem[]) => setProject((p) => ({ ...p, items }));

  const patchItem = (id: string, patch: Partial<TitleItem>) =>
    setProject((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));

  const addItem = (type: ItemType) => {
    const n = project.items.filter((i) => i.type === 'article').length + 1;
    const item: TitleItem = {
      id: newId(),
      type,
      badge: type === 'article' ? `Article ${n}` : '',
      primary: type === 'speaker' ? 'Firstname Lastname' : type === 'show' ? 'Program Title' : 'Title of the warrant article',
      secondary: type === 'speaker' ? 'Role or affiliation' : type === 'article' ? defaultTag : '',
    };
    setItems([...project.items, item]);
    setSelectedId(item.id);
    setStep('titles');
  };

  const moveItem = (id: string, dir: -1 | 1) => {
    const idx = project.items.findIndex((i) => i.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= project.items.length) return;
    const next = [...project.items];
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
  };

  const duplicateItem = (id: string) => {
    const idx = project.items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const copy = { ...project.items[idx], id: newId() };
    const next = [...project.items];
    next.splice(idx + 1, 0, copy);
    setItems(next);
    setSelectedId(copy.id);
  };

  const deleteItem = (id: string) => {
    const idx = project.items.findIndex((i) => i.id === id);
    const next = project.items.filter((i) => i.id !== id);
    setItems(next);
    setSelectedId(next[Math.min(idx, next.length - 1)]?.id ?? null);
  };

  const importItems = (items: TitleItem[], replace: boolean) => {
    setProject((p) => ({ ...p, items: replace ? items : [...p.items, ...items] }));
    if (items[0]) setSelectedId(items[0].id);
    showToast(`${replace ? 'Imported' : 'Added'} ${items.length} title${items.length === 1 ? '' : 's'}`);
  };

  // ---- project ------------------------------------------------------------------
  const loadSample = () => {
    if (project.items.length && !confirm(`Replace the current ${project.items.length} titles with the ${SAMPLE_NAME} sample (show ID + 21 warrant articles)? Your look and export settings are kept.`)) return;
    const s = defaultProject();
    setProject((p) => ({ ...p, name: s.name, items: s.items }));
    setSelectedId(s.items[0]?.id ?? null);
    setExportSel(null);
    setStep('titles');
    showToast('Loaded the Brookline Special Town Meeting 2026 titles');
  };

  const newProject = () => {
    if (project.items.length && !confirm('Start a new, empty project? The current titles are cleared (your custom looks are kept).')) return;
    const e = emptyProject();
    setProject((p) => ({ ...p, name: e.name, items: [] }));
    setSelectedId(null);
    setExportSel(null);
    setStep('titles');
  };

  const openProjectFile = async (file: File) => {
    try {
      const p = migrateProject(JSON.parse(await file.text()));
      if (!p) throw new Error('not a Community Titler project file');
      setProject(p);
      setSelectedId(p.items[0]?.id ?? null);
      setExportSel(null);
      showToast(`Opened ${file.name}`);
    } catch (e: any) {
      alert(`Could not open project: ${e?.message ?? e}`);
    }
  };

  const saveProjectFile = async () => {
    const r = await exportProjectFile(project);
    if (r) showToast(desktop ? 'Project saved' : 'Project file downloaded');
  };

  // ---- look ---------------------------------------------------------------------
  const setCustomThemes = (customThemes: ThemeDef[], selectId?: string) =>
    setProject((p) => ({ ...p, customThemes, themeId: selectId ?? p.themeId }));

  const patchTheme = (fn: (t: ThemeDef) => void) => {
    if (!isCustom) return;
    setProject((p) => ({
      ...p,
      customThemes: p.customThemes.map((t) => {
        if (t.id !== p.themeId) return t;
        const copy = normalizeTheme(JSON.parse(JSON.stringify(t))) as ThemeDef;
        fn(copy);
        return copy;
      }),
    }));
  };

  const duplicateTheme = () => {
    const clone: ThemeDef = JSON.parse(JSON.stringify(theme));
    clone.id = `custom-${newId()}`;
    clone.name = `${theme.name.replace(/ \(custom\)$/, '')} (custom)`;
    setCustomThemes([...project.customThemes, clone], clone.id);
    showToast('Duplicated — this look is yours to edit now');
  };

  const deleteCustomTheme = (id: string) => {
    if (!confirm('Delete this custom look?')) return;
    setCustomThemes(project.customThemes.filter((t) => t.id !== id), project.themeId === id ? 'big' : undefined);
  };

  const importTheme = async (file: File) => {
    try {
      const t = normalizeTheme(JSON.parse(await file.text())) as ThemeDef;
      if (!t?.colors?.bar || !t?.fonts?.display) throw new Error('not a style file');
      t.id = `custom-${newId()}`;
      setCustomThemes([...project.customThemes, t], t.id);
      showToast(`Imported look “${t.name}”`);
    } catch (e: any) {
      alert(`Could not import style: ${e?.message ?? e}`);
    }
  };

  const exportTheme = async () => {
    const json = JSON.stringify(theme, null, 2);
    const name = `${theme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.theme.json`;
    if (desktop) {
      const path = await desktop.saveFileDialog({ defaultName: name, filters: [{ name: 'Community Titler style', extensions: ['json'] }] });
      if (!path) return;
      await desktop.writeFile(path, json);
      showToast('Style saved');
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const previewSample: TitleItem = selected ?? { id: 'sample', type: 'speaker', badge: '', primary: 'Jordan Example', secondary: 'Town Moderator' };

  return (
    <div className="app">
      <TopBar
        step={step}
        onStep={setStep}
        titleCount={project.items.length}
        projectName={project.name ?? ''}
        onOpen={() => projectFileRef.current?.click()}
        onSave={saveProjectFile}
        onSample={loadSample}
        onNew={newProject}
      />
      <input
        ref={projectFileRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) openProjectFile(f); }}
      />

      <div className="workspace">
        <aside className="rail">
          {step === 'titles' && (
            <TitlesRail
              items={project.items}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
              onAdd={addItem}
              onImport={() => setImportOpen(true)}
              onLoadSample={loadSample}
            />
          )}
          {step === 'look' && (
            <LookRail
              themeId={project.themeId}
              customThemes={project.customThemes}
              fontsReady={fontsReady}
              previewItem={previewSample}
              onSelect={(id) => setProject((p) => ({ ...p, themeId: id }))}
              onDuplicate={duplicateTheme}
              onImportTheme={importTheme}
              onExportTheme={exportTheme}
              onDeleteCustom={deleteCustomTheme}
            />
          )}
          {step === 'export' && (
            <ExportRail
              settings={project.settings}
              onSettings={(settings) => setProject((p) => ({ ...p, settings }))}
              dest={dest}
              onDest={setDest}
            />
          )}
        </aside>

        <section className="stage">
          <Preview
            item={selected}
            items={project.items}
            theme={theme}
            settings={project.settings}
            fontsReady={fontsReady}
            onPick={setSelectedId}
          />
          {step === 'titles' && (
            <TitleEditor
              item={selected}
              index={selectedIndex}
              count={project.items.length}
              defaultTag={defaultTag}
              onPatch={(patch) => selected && patchItem(selected.id, patch)}
              onMove={(dir) => selected && moveItem(selected.id, dir)}
              onDuplicate={() => selected && duplicateItem(selected.id)}
              onDelete={() => selected && deleteItem(selected.id)}
              onAdd={addItem}
              onImport={() => setImportOpen(true)}
              onNext={() => setStep('look')}
            />
          )}
          {step === 'look' && (
            <LookEditor
              theme={theme}
              isCustom={isCustom}
              onPatch={patchTheme}
              onDuplicate={duplicateTheme}
              onNext={() => setStep('export')}
              showToast={showToast}
            />
          )}
          {step === 'export' && (
            <ExportRunner
              items={project.items}
              selectedId={selected?.id ?? null}
              theme={theme}
              settings={project.settings}
              dest={dest}
              onDest={setDest}
              selection={exportSel}
              onSelection={setExportSel}
              showToast={showToast}
            />
          )}
        </section>
      </div>

      {importOpen && (
        <ImportModal
          defaultTag={defaultTag}
          hasItems={project.items.length > 0}
          onClose={() => setImportOpen(false)}
          onImport={importItems}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
