# Prometheus Web Port

Black terminal-esque front-end + Express server for the official [Prometheus Lua obfuscator](https://github.com/prometheus-lua/Prometheus).
Everything runs locally: you paste Lua in the browser, Express shells out to `lua ./Prometheus-master/cli.lua`, the output streams back, and
the temp files are shredded.

## Requirements

- Node.js 18+ (for `fetch`, `fs/promises`, and native `stream/promises`)
- Lua 5.1 binary on `PATH` (override with `LUA_BIN=/path/to/lua`)
- Prometheus sources unpacked in `./Prometheus-master` (or use the built-in updater)

## Getting started

```
npm install
npm start
```

Visit [http://localhost:3000](http://localhost:3000). Paste Lua, pick a preset (Minify / Weak / Medium / Strong), choose the Lua target (Lua51 or LuaU),
optionally toggle pretty-printing, and click **Obfuscate**. Logs from the Prometheus CLI show up in the UI so you can audit every run.

## Versioning & updates

- Local Web Port version lives in `version.txt` (currently `1.2`).
- Prometheus core version lives in `prometheus-version.txt` (currently `v0.2.6`).
- The UI calls `/api/check-updates` on load. That endpoint fetches:
  - `https://raw.githubusercontent.com/Vvoidddd/Prometheus-Web-Port/main/version.txt` for the latest UI build.
  - `https://api.github.com/repos/prometheus-lua/Prometheus/tags?per_page=1` for the newest Prometheus tag.
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
| POST | `/api/update-prometheus` | Downloads + installs the newest Prometheus release. |

## Privacy stance

There is no telemetry, no analytics, and no hidden calls beyond the explicit update checks described above. Everything happens on the same machine
that serves the page. To audit the behavior, inspect `server.js` (Express routes + Prometheus runner) and `public/app.js` (front-end wiring).
