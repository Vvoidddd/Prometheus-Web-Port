# WebObfuscator

A lightweight Express server + single-page UI that shells out to the official [Prometheus](Prometheus-master) Lua obfuscator.

## Requirements

- Node.js 18 or newer (for the built-in `fetch` and `fs/promises` APIs)
- Lua 5.1 executable available on `PATH` (override with `LUA_BIN=/path/to/lua` if needed)
- The Prometheus sources placed in `./Prometheus-master` (already moved here)

## Getting started

```powershell
npm install
npm start
```

The app will listen on [http://localhost:3000](http://localhost:3000). Paste your Lua script, pick a preset (Minify/Weak/Medium/Strong), choose the Lua target (Lua51 or LuaU), and click **Obfuscate**. The backend writes your snippet to a temporary file, invokes `lua ./Prometheus-master/cli.lua`, then streams the obfuscated output back to the browser.

## API

- `GET /api/presets` &rarr; Available presets and Lua targets.
- `POST /api/obfuscate` with JSON `{ source, preset, luaVersion, prettyPrint }`.

Both endpoints return JSON responses suitable for integrating the obfuscator into other tools or CLIs.
