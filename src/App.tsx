import { useEffect, useMemo, useRef, useState } from 'react';
import ExportPanel from './ui/ExportPanel';
import ImportModal from './ui/ImportModal';
import ItemList from './ui/ItemList';
import PreviewPane from './ui/PreviewPane';
import StylePanel from './ui/StylePanel';
import { getTheme } from './renderer/themes.js';
import { getCustomFonts, loadBundledFonts, registerCustomFonts } from './renderer/fonts';
import { defaultProject, exportProjectFile, loadProject, saveProject } from './store';
import { STM_TAG } from './data/stm2026';
import type { Project, ThemeDef, TitleItem } from './types';

export default function App() {
  const [project, setProject] = useState<Project>(() => loadProject());
  const [selectedId, setSelectedId] = useState<string | null>(() => project.items[0]?.id ?? null);
  const [fontsReady, setFontsReady] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const projectFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      await loadBundledFonts();
      await registerCustomFonts(getCustomFonts());
      setFontsReady(true);
    })();
  }, []);

  useEffect(() => saveProject(project), [project]);

  const theme: ThemeDef = useMemo(
    () => getTheme(project.themeId, project.customThemes) as ThemeDef,
    [project.themeId, project.customThemes],
  );

  const selected = project.items.find((i) => i.id === selectedId) ?? project.items[0] ?? null;

  const setItems = (items: TitleItem[]) => setProject((p) => ({ ...p, items }));

  const importItems = (items: TitleItem[], replace: boolean) => {
    setProject((p) => ({ ...p, items: replace ? items : [...p.items, ...items] }));
    if (items[0]) setSelectedId(items[0].id);
  };

  const resetSample = () => {
    if (!confirm('Replace the current list and settings with the bundled Brookline Special Town Meeting 2026 sample project?')) return;
    const p = defaultProject();
    setProject(p);
    setSelectedId(p.items[0]?.id ?? null);
  };

  const openProjectFile = async (file: File) => {
    try {
      const p = JSON.parse(await file.text()) as Project;
      if (p?.version !== 1 || !Array.isArray(p.items)) throw new Error('not a Community Titler project file');
      setProject({ ...defaultProject(), ...p });
      setSelectedId(p.items[0]?.id ?? null);
    } catch (e: any) {
      alert(`Could not open project: ${e?.message ?? e}`);
    }
  };

  const defaultTag = useMemo(() => {
    const firstArticle = project.items.find((i) => i.type === 'article');
    return firstArticle?.secondary || STM_TAG;
  }, [project.items]);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          Community Titler
          <span className="sub">animated lower thirds for community media</span>
        </div>
        <div className="spacer" />
        <button className="ghost" onClick={() => projectFileRef.current?.click()}>Open project…</button>
        <input ref={projectFileRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && openProjectFile(e.target.files[0])} />
        <button className="ghost" onClick={() => exportProjectFile(project)}>Save project file</button>
        <button className="ghost" onClick={resetSample} title="Load the bundled Brookline STM 2026 sample">Load sample</button>
        <div className="stripes" aria-hidden>
          <i style={{ background: '#C74C9C' }} />
          <i style={{ background: '#F68B1F' }} />
          <i style={{ background: '#FEEE32' }} />
        </div>
      </header>

      <div className="main">
        <aside className="col items">
          <ItemList
            items={project.items}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            onChange={setItems}
            onImportClick={() => setImportOpen(true)}
            defaultTag={defaultTag}
          />
        </aside>

        <section className="col center">
          <PreviewPane item={selected} theme={theme} settings={project.settings} fontsReady={fontsReady} />
          <ExportPanel
            items={project.items}
            selected={selected}
            theme={theme}
            settings={project.settings}
            onSettings={(settings) => setProject((p) => ({ ...p, settings }))}
          />
        </section>

        <aside className="col style">
          <StylePanel
            themeId={project.themeId}
            customThemes={project.customThemes}
            theme={theme}
            onSelect={(themeId) => setProject((p) => ({ ...p, themeId }))}
            onCustomThemesChange={(customThemes, selectId) =>
              setProject((p) => ({ ...p, customThemes, themeId: selectId ?? p.themeId }))
            }
          />
        </aside>
      </div>

      {importOpen && (
        <ImportModal
          defaultTag={defaultTag}
          onClose={() => setImportOpen(false)}
          onImport={importItems}
        />
      )}
    </div>
  );
}
