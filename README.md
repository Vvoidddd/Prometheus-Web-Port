# Prometheus Web Port

Black terminal-esque front-end + Express server for the official [Prometheus Lua obfuscator](https://github.com/prometheus-lua/Prometheus).
Everything runs locally: you paste Lua in the browser, Express shells out to `lua ./Prometheus-master/cli.lua`, the output streams back, and
the temp files are shredded.

## Requirements

- Node.js 18+ (for `fetch`, `fs/promises`, and native `stream/promises`)
- (Optional) Lua 5.2 runtime; the built-in runner can download it automatically.
- Prometheus sources unpacked in `./Prometheus-master` (or use the built-in updater)

## Getting started

```
npm install
npm start
```

Visit [http://localhost:3000](http://localhost:3000). Paste Lua, pick a preset (Minify / Weak / Medium / Strong), choose the Lua target (Lua51 or LuaU),
optionally toggle pretty-printing, and click **Obfuscate**. Logs from the Prometheus CLI show up in the UI so you can audit every run.

### Quality-of-life highlights

- “Version control” panel checks GitHub for Web Port + Prometheus updates, downloads them on demand, and never touches third-party endpoints.
- Session assistant (clear, reload last session, reset, paste clipboard) plus autosave to `localStorage` so your work survives reloads.
- Keyboard shortcuts: `Ctrl/⌘ + Enter` (run), `Ctrl/⌘ + Shift + L` (load sample), `Ctrl/⌘ + Shift + C` (copy result).
- Dual editor status bars (line/char counts) and synchronized syntax highlighting for both source and output panes.
- Classic logbook mirrors the CLI output exactly as Prometheus prints it.
- Built-in Lua runner (with automated SourceForge downloads) lives under the editors so you can sanity-check snippets without leaving the page.
- Six layout templates (Classic, Compact, Stacked, Focus, Wide, Minimal) + the settings page let you reshape the UI without touching CSS.

## Versioning & updates

- Local Web Port version lives in `version.txt` (currently `1.6`).
- Prometheus core version lives in `prometheus-version.txt`.
- The UI calls `/api/check-updates` on load. That endpoint fetches:
  - `https://raw.githubusercontent.com/Vvoidddd/Prometheus-Web-Port/main/version.txt` (or the GitHub HTML fallback) for the latest UI build.
  - `https://github.com/prometheus-lua/Prometheus/tags` and parses the newest `vX.X.X` tag.
- If a newer Web Port build exists you can download the latest `.zip` directly from the UI (`/api/download-app-update`).
- Updating Prometheus is fully automated: `/api/update-prometheus` downloads the newest tag zip, extracts it, replaces `./Prometheus-master`,
  and refreshes `prometheus-version.txt`.

All update downloads are saved under `./updates` so you can inspect or archive them.

## API

| Method | Route | Description |
| ------ | ----- | ----------- |
| GET | `/api/presets` | Returns available presets + Lua targets. |
| POST | `/api/obfuscate` | Body `{ source, preset, luaVersion, prettyPrint }`. Runs Prometheus and returns `{ output, stdout, stderr }`. |
| GET | `/api/version` | Returns local UI + Prometheus versions. |
| GET | `/api/check-updates` | Checks remote sources and reports update availability. |
| POST | `/api/download-app-update` | Downloads the latest Web Port zip into `./updates`. |
| POST | /api/update-prometheus | Downloads + installs the newest Prometheus release. |
| GET | /api/lua-status | Returns whether the standalone Lua runtime is installed plus the expected version. |
| POST | /api/install-lua | Detects the OS, downloads the appropriate Lua 5.2.4 build from SourceForge, and extracts it into ./lua-runtime. |
| POST | /api/run-lua | Runs arbitrary Lua snippets through the downloaded runtime and returns stdout/stderr. |

## Privacy stance

There is no telemetry, no analytics, and no hidden calls beyond the explicit update checks described above (documented on the Dev Notes page).

- Obfuscation requests never leave `localhost`. Source code is written to a temp directory, Prometheus runs against it, and the directory is deleted.
- Update requests only target GitHub endpoints listed earlier and save downloaded archives to `./updates` for inspection.
- Session storage is local-only (`localStorage`), and you can clear it from the UI at any time via “Reset session”.
- To audit the behavior, read `server.js` (Express routes + update/downloader helpers) and `public/app.js` (front-end wiring + autosave logic).


