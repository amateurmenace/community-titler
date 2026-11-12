# Community Titler

**Animated lower thirds with real transparency — built for community media stations.**

Type your titles in (or import a whole spreadsheet), pick a look, and export broadcast-ready graphics with alpha channels for OBS, vMix, CasparCG, your NLE, or a key/fill DeckLink output into a video switcher.

Made by [Brookline Interactive Group](https://brooklineinteractive.org) for every community access station. Free, open source (MIT). Runs as a **desktop app (Windows + macOS)**, in your **browser**, or from the **command line** — and nothing is ever uploaded anywhere.

![Community Titler](docs/examples/app.png)

## Get it

| | |
|---|---|
| **Windows** | [`Community-Titler-<version>-win-setup.exe`](https://github.com/amateurmenace/community-titler/releases/latest) (installer) or the `-win-portable.exe` (no install) |
| **macOS, Apple silicon** | [`Community-Titler-<version>-mac-arm64.dmg`](https://github.com/amateurmenace/community-titler/releases/latest) |
| **macOS, Intel** | [`Community-Titler-<version>-mac-x64.dmg`](https://github.com/amateurmenace/community-titler/releases/latest) |
| **Browser (no install)** | **https://amateurmenace.github.io/community-titler/** |

The desktop app bundles its own ffmpeg, so ProRes and WebM exports take seconds per title instead of the browser's slower in-page encoder.

> **First launch on macOS:** the app is not notarized, so macOS will say it “cannot be opened”. Right-click the app → **Open** → **Open** once (on macOS 15+: System Settings → Privacy & Security → **Open Anyway**). On Windows, SmartScreen may ask you to click **More info → Run anyway**.

## What it makes

Three kinds of lower thirds. Each one *builds* on screen — the station tile pops in, the arches draw on, the name bar extends out of the tile, the name wipes in, the brand stripe draws, and the role bar slides out underneath — then holds, then reverses out.

| Type | For | Example |
|---|---|---|
| **Speaker** | Who's talking — name + role | *Jordan Example · Town Moderator* |
| **Show ID** | Opening a program — title + your station line | *Brookline Special Town Meeting 2026 · Brookline Interactive Group · brooklineinteractive.org* |
| **Article** | Dense info cards — number badge + full article title + meeting tag. Long titles switch to a **Large** layout on their own: bars across the frame, bigger type, up to four lines | *Article 7 · Create a new Section 8.XX of the General By-Laws banning cryptocurrency kiosks…* |

![Examples](docs/examples/montage.png)

## Three steps

1. **Titles** — add speakers, show IDs and articles one at a time, or **Import spreadsheet** (CSV, Excel, or paste straight from Google Sheets). Click any title to preview and edit it. Each title has a **Size on screen** (Auto / Standard / Large) and a text-size nudge; Auto goes Large whenever a title would otherwise come out small.
2. **Look** — pick a built-in look and change anything: station name and mark, logo, fonts and **type sizes** (names, article titles, sub bar, tile mark, badge), colors, corner radius, position, animation. The first change makes the look your own copy; the built-in stays as it is.
3. **Export** — choose a format, timing and a folder, tick the titles you want, and **Export**. Press <kbd>Space</kbd> anywhere to play the preview.

Projects auto-save in the app; **Project → Save project file** writes a portable `.titler.json` you can archive or move between machines.

### Regenerating the Brookline town meeting titles

The app ships with the full warrant for the **Brookline Special Town Meeting (November 2026)** — the show ID plus all 21 articles. To regenerate the set at any time:

1. **Project → Load Brookline Town Meeting 2026** (the sample replaces the title list; your look and export settings stay).
2. Make sure the look is **BIG — Brookline Interactive**.
3. **Export → Export all 22 titles.**

The long articles (6, 9, 10, 11, 14…) render in the **Large** layout automatically so they read on a TV; switch any title between Standard and Large in the Titles step. Files are named by article number — `Article-07_Create-a-new-Section-8-XX….mov` — so the folder lines up with the warrant, and the show ID is `Show_Brookline-Special-Town-Meeting-2026.mov`.

The same list is in [`public/samples/brookline-stm-2026-warrant-articles.csv`](public/samples/brookline-stm-2026-warrant-articles.csv) for the CLI (`npm run render -- --sample`). When the next warrant is posted, paste the article list into a sheet and import it — rows like `5. Resolution regarding…` are split into badge + title automatically.

## Bulk titles from a spreadsheet

1. Put your titles in Google Sheets, Excel, or any CSV with columns:

   | type | badge | primary | secondary |
   |---|---|---|---|
   | `show` | | Brookline Special Town Meeting 2026 | *(blank = station name + URL)* |
   | `speaker` | | Jordan Example | Town Moderator |
   | `article` | Article 5 | Resolution urging the Select Board… | Special Town Meeting · November 2026 |

2. **Titles → Import spreadsheet** → drop the `.csv`/`.xlsx`, or paste the cells.
3. **Export.**

Header names are flexible (`name`, `title`, `number`, `role`… are all recognized), plain numbers become “Article N”, and a sheet with just two columns is read as name + role. Sample files live in [`public/samples/`](public/samples/).

## Exporting alpha for OBS and key/fill

Every format carries a real alpha channel:

- **ProRes 4444 (.mov)** — the broadcast workhorse. Big files, flawless alpha, decodes effortlessly in OBS. **Recommended for key/fill playout.**
- **WebM (.webm)** — small files, great for OBS overlay scenes.
- **PNG still (.png)** — one transparent frame per title, instantly.
- **PNG sequence** — every frame as numbered PNGs (a folder from the desktop app, a `.zip` from the browser) for NLEs and CasparCG.

Timing defaults to a 1.1 s build, a 6 s hold and a 0.9 s out. For a key/fill feed you cut away from by hand, make the hold long.

**File names.** Articles are named by their number (`Article-07_Create-a-new-Section….mov`), speakers and show IDs by what they say (`Speaker_Jordan-Example.mov`, `Show_Select-Board-Meeting.mov`). Two titles that would get the same name are suffixed `-2`, `-3`.

### OBS setup

1. **Sources → + → Media Source** → pick your `.mov` or `.webm` → check **“Show nothing when playback ends”**. The transparency just works — put it over your program scene.
2. Restart the clip to take it on air: select the source and **Restart** (or hotkey it: Settings → Hotkeys → *Restart media*).

### Key/fill out a DeckLink to your switcher

1. **Tools → Decklink Output** in OBS.
2. Pick your DeckLink device and format, and set **Keyer: External** (needs a keyer-capable card: Duo 2, Quad 2, 4K Extreme, 8K Pro…).
3. The card now sends **fill** on one SDI and **key** on the other — take them into your switcher (e.g. an ATEM aux/keyer pair as a luma/linear key) and cut graphics like a TV truck.

Tip: for key/fill, build an OBS scene containing *only* the title graphics (transparent everywhere else) and route that scene's Decklink output.

## Looks & making it yours

Five built-in looks: **BIG — Brookline Interactive** (navy tiles, the rainbow arches over a big Montserrat **BIG**, tri-color stripe, Fraunces serif names), **Civic Green** (the [Community AI Project](https://github.com/amateurmenace/community-ai-project) palette — forest green, lime, cream), neutral **Broadcast Slate**, civic **Town Hall**, and **Minimal Light**.

To rebrand for your station: in **Look**, start changing things — the first edit turns the built-in into your own copy, saved with the project. Set your station name, short mark and URL, upload a **logo PNG** for the tile, pick fonts and weights (Fraunces, DM Sans, Inter, JetBrains Mono and Montserrat are bundled; add your own `.ttf`), set the **type sizes** (name / show title, article title, sub bar, tile mark, badge — each a percentage of the look's default), set every color, and choose the motion. **Export** the look as a `.theme.json` to share with your team — or open a PR to add your station's look as a built-in.

## CLI batch rendering

If you have [ffmpeg](https://ffmpeg.org) on your PATH, the CLI renders the same pixels as the app:

```bash
npm run render -- --csv mytitles.csv --format prores --out exports/tonight
```

```bash
npm run render -- --sample --format webm --theme big --hold 8
```

Formats: `prores`, `webm`, `png`, `pngseq`. Run `npm run render -- --help` for every flag (`--theme your-station.theme.json`, `--size 1280x720`, `--fps 59.94`, `--only 3,5`, …).

## For developers

```bash
git clone https://github.com/amateurmenace/community-titler.git
cd community-titler
npm install
npm run dev        # web app at http://localhost:5173
npm run app        # the desktop app, hot-reloading against the dev server
npm run dist:win   # Windows installer + portable exe  → release/
npm run dist:mac   # macOS dmg + zip (run on a Mac)     → release/
```

- Vite + React + TypeScript. The drawing lives in [`src/renderer/core.js`](src/renderer/core.js) — a pure, dependency-free canvas renderer used identically by the preview, the desktop and in-browser exporters, and the Node CLI, so what you preview is exactly what exports. Looks are plain data in [`src/renderer/themes.js`](src/renderer/themes.js).
- The app chrome follows the Community AI Project's **Civic UI** design system (cream canvas, deep green, lime, hard offset shadows, Inter + JetBrains Mono) — tokens in [`src/styles.css`](src/styles.css).
- The desktop shell is [`electron/main.cjs`](electron/main.cjs) + [`electron/preload.cjs`](electron/preload.cjs); it streams raw frames into a bundled ffmpeg (`ffmpeg-static`). The browser build encodes with ffmpeg.wasm (single-threaded core, served same-origin — works offline and on GitHub Pages).
- **Releasing:** bump `version` in `package.json`, then push a tag — `git tag v2.0.1 && git push --tags`. The [`Build desktop apps`](.github/workflows/release.yml) workflow builds the Windows installer and both macOS apps and attaches them to the GitHub Release. Pushes to `main` deploy the web app to GitHub Pages.

PRs welcome — new looks, new title layouts, translations, CasparCG/HTML output, whatever your station needs.

## License

MIT. Bundled fonts — [Fraunces](https://github.com/undercasetype/Fraunces), [DM Sans](https://github.com/googlefonts/dm-fonts), [Inter](https://github.com/rsms/inter), [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) and [Montserrat](https://github.com/JulietaUla/Montserrat) — are SIL OFL 1.1 (licenses in `public/fonts/`). The BIG look is included with Brookline Interactive Group's blessing; your station's logo and branding remain, of course, your own.
