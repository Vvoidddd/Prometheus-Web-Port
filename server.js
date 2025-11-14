const express = require("express");
const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const fsSync = require("fs");
const { spawn } = require("child_process");
const { pipeline } = require("stream/promises");
const AdmZip = require("adm-zip");
const tar = require("tar");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PROMETHEUS_DIR = path.join(ROOT_DIR, "Prometheus-master");
const PROMETHEUS_CLI = path.join(PROMETHEUS_DIR, "cli.lua");
const LUA_BIN = process.env.LUA_BIN || "lua";
const APP_VERSION_FILE = path.join(ROOT_DIR, "version.txt");
const PROM_VERSION_FILE = path.join(ROOT_DIR, "prometheus-version.txt");
const REMOTE_APP_VERSION_URL =
  "https://raw.githubusercontent.com/Vvoidddd/Prometheus-Web-Port/main/version.txt";
const REMOTE_APP_VERSION_HTML =
  "https://github.com/Vvoidddd/Prometheus-Web-Port/blob/main/version.txt";
const REMOTE_APP_VERSION_API =
  "https://api.github.com/repos/Vvoidddd/Prometheus-Web-Port/contents/version.txt";
const REMOTE_APP_ZIP_URL =
  "https://codeload.github.com/Vvoidddd/Prometheus-Web-Port/zip/refs/heads/main";
const REMOTE_PROM_TAGS_PAGE = "https://github.com/prometheus-lua/Prometheus/tags";
const REMOTE_PROM_ZIP_BASE = "https://codeload.github.com/prometheus-lua/Prometheus/zip/refs/tags";
const UPDATE_DIR = path.join(ROOT_DIR, "updates");
const GITHUB_HEADERS = {
  "User-Agent": "Prometheus-Web-Port/1.0",
  Accept: "application/vnd.github+json",
};
const GITHUB_RAW_HEADERS = {
  "User-Agent": "Prometheus-Web-Port/1.0",
  Accept: "text/plain",
};
const GITHUB_HTML_HEADERS = {
  "User-Agent": "Prometheus-Web-Port/1.0",
  Accept: "text/html",
};
const LUA_VERSION = "5.2.4";
const LUA_SOURCEFORGE_BASE =
  "https://downloads.sourceforge.net/project/luabinaries/5.2.4/Tools%20Executables";
const LUA_RUNTIME_DIR = path.join(ROOT_DIR, "lua-runtime");
const LUA_RUNTIME_BIN = path.join(
  LUA_RUNTIME_DIR,
  process.platform === "win32" ? "lua.exe" : "lua"
);
const LUA_DOWNLOAD_HEADERS = {
  "User-Agent": "Prometheus-Web-Port/1.0",
  Accept: "*/*",
};

const AVAILABLE_PRESETS = ["Minify", "Weak", "Medium", "Strong"];
const LUA_VERSIONS = ["Lua51", "LuaU"];

app.use((_, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(ROOT_DIR, "public")));

app.get("/api/presets", (_, res) => {
  res.json({
    presets: AVAILABLE_PRESETS,
    luaVersions: LUA_VERSIONS,
  });
});

app.post("/api/obfuscate", async (req, res) => {
  try {
    const {
      source = "",
      preset = "Minify",
      luaVersion = "Lua51",
      prettyPrint = false,
    } = req.body || {};

    if (!source.trim()) {
      return res.status(400).json({ error: "Source code is required." });
    }

    if (!AVAILABLE_PRESETS.includes(preset)) {
      return res
        .status(400)
        .json({ error: `Unknown preset "${preset}".`, presets: AVAILABLE_PRESETS });
    }

    if (!LUA_VERSIONS.includes(luaVersion)) {
      return res
        .status(400)
        .json({ error: `Unsupported Lua version "${luaVersion}".`, luaVersions: LUA_VERSIONS });
    }

    const result = await runPrometheus({
      source,
      preset,
      luaVersion,
      prettyPrint: Boolean(prettyPrint),
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Unknown error" });
  }
});

app.get("/api/version", async (_, res) => {
  res.json({
    appVersion: readVersionFile(APP_VERSION_FILE, "unknown"),
    prometheusVersion: readVersionFile(PROM_VERSION_FILE, "unknown"),
  });
});

app.get("/api/check-updates", async (_, res) => {
  try {
    const updates = await checkForUpdates();
    res.json(updates);
  } catch (error) {
    console.error("Update check failed", error);
    res.status(500).json({ error: error.message || "Unable to check updates" });
  }
});

app.post("/api/download-app-update", async (_, res) => {
  try {
    const updates = await checkForUpdates();
    if (!updates.app.updateAvailable) {
      return res.json({
        downloaded: false,
        message: "Already on the latest Web Port version.",
      });
    }

    await fs.mkdir(UPDATE_DIR, { recursive: true });
    const target = path.join(UPDATE_DIR, "Prometheus-Web-Port-main.zip");
    await downloadFile(REMOTE_APP_ZIP_URL, target);
    res.json({
      downloaded: true,
      savedTo: target,
      message: "Latest Web Port sources downloaded. Unzip manually to update.",
    });
  } catch (error) {
    console.error("App download failed", error);
    res.status(500).json({ error: error.message || "Unable to download update" });
  }
});

app.post("/api/update-prometheus", async (_, res) => {
  try {
    const latest = await fetchPrometheusRemoteVersion();
    if (!latest) {
      return res.status(500).json({ error: "Unable to resolve latest Prometheus tag." });
    }
    const current = readVersionFile(PROM_VERSION_FILE, "unknown");
    if (current === latest) {
      return res.json({
        updated: false,
        message: "Prometheus core already matches latest release.",
        version: latest,
      });
    }
    await installPrometheusFromTag(latest);
    await fs.writeFile(PROM_VERSION_FILE, latest, "utf8");
    res.json({
      updated: true,
      version: latest,
      message: "Prometheus core updated successfully.",
    });
  } catch (error) {
    console.error("Prometheus update failed", error);
    res.status(500).json({ error: error.message || "Unable to update Prometheus core" });
  }
});

app.get("/api/lua-status", async (_, res) => {
  const installed = await luaRuntimeExists();
  res.json({
    installed,
    binary: installed ? LUA_RUNTIME_BIN : null,
    version: LUA_VERSION,
  });
});

app.post("/api/install-lua", async (_, res) => {
  try {
    const binary = await installLuaRuntime();
    res.json({
      installed: true,
      binary,
      version: LUA_VERSION,
      message: "Lua runtime downloaded.",
    });
  } catch (error) {
    console.error("Lua install failed", error);
    res.status(500).json({ error: error.message || "Unable to install Lua runtime" });
  }
});

app.post("/api/run-lua", async (req, res) => {
  const { source = "" } = req.body || {};
  if (!source.trim()) {
    return res.status(400).json({ error: "Lua source is required." });
  }
  let tempDir;
  try {
    const luaBinary = await ensureLuaRuntime();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "lua-runner-"));
    const scriptPath = path.join(tempDir, "runner.lua");
    await fs.writeFile(scriptPath, source, "utf8");
    const result = await spawnAsync(luaBinary, [scriptPath], {
      cwd: ROOT_DIR,
      processName: "Lua runtime",
    });
    res.json({
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    });
  } catch (error) {
    console.error("Lua runner failed", error);
    res.status(500).json({ error: error.message || "Unable to run Lua code" });
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
});

app.get("/api/health", (_, res) => {
  res.json({ status: "ok" });
});

app.get(/^\/(?!api).*/, (_, res) => {
  res.sendFile(path.join(ROOT_DIR, "public", "index.html"));
});

async function runPrometheus({ source, preset, luaVersion, prettyPrint }) {
  await ensurePrometheusInstalled();

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prom-web-"));
  const inputFile = path.join(tempDir, "input.lua");
  const outputFile = path.join(tempDir, "output.lua");

  await fs.writeFile(inputFile, source, "utf8");

  const args = [
    PROMETHEUS_CLI,
    "--preset",
    preset,
    "--out",
    outputFile,
  ];

  if (prettyPrint) {
    args.push("--pretty");
  }

  if (luaVersion === "LuaU") {
    args.push("--LuaU");
  } else {
    args.push("--Lua51");
  }

  args.push(inputFile);

  const { stdout, stderr } = await spawnAsync(LUA_BIN, args, {
    cwd: ROOT_DIR,
    processName: "Prometheus",
  });

  let obfuscated = "";
  try {
    obfuscated = await fs.readFile(outputFile, "utf8");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  return {
    output: obfuscated,
    stdout,
    stderr,
  };
}

async function ensurePrometheusInstalled() {
  try {
    await fs.access(PROMETHEUS_CLI);
  } catch {
    throw new Error(
      "Prometheus CLI was not found. Make sure Prometheus-master is in the project root."
    );
  }
}

function readVersionFile(file, fallback = "unknown") {
  try {
    return fsSync.readFileSync(file, "utf8").trim();
  } catch {
    return fallback;
  }
}

async function checkForUpdates() {
  const [localApp, localProm] = [
    readVersionFile(APP_VERSION_FILE, "0.0.0"),
    readVersionFile(PROM_VERSION_FILE, "unknown"),
  ];

  const remoteAppVersion = (await fetchRemoteVersionSafe()) || localApp;
  const promRemote = await fetchPrometheusRemoteVersionSafe();
  const latestProm = promRemote || localProm;

  return {
    app: {
      current: localApp,
      latest: remoteAppVersion || localApp,
      updateAvailable: compareVersions(remoteAppVersion, localApp) > 0,
    },
    prometheus: {
      current: localProm,
      latest: latestProm,
      updateAvailable:
        latestProm !== "unknown" && latestProm !== localProm,
    },
  };
}

async function fetchRemoteVersionSafe() {
  try {
    return await fetchRemoteVersion();
  } catch {
    return null;
  }
}

async function fetchRemoteVersion() {
  const apiRes = await fetch(REMOTE_APP_VERSION_API, { headers: GITHUB_HEADERS });
  if (apiRes.ok) {
    const payload = await apiRes.json();
    if (payload && payload.content) {
      const buffer = Buffer.from(payload.content, payload.encoding || "base64");
      const version = buffer.toString("utf8").trim();
      if (version) {
        return version;
      }
    }
  }

  const rawRes = await fetch(REMOTE_APP_VERSION_URL, { headers: GITHUB_RAW_HEADERS });
  if (rawRes.ok) {
    const version = (await rawRes.text()).trim();
    if (version) {
      return version;
    }
  }

  // fallback to HTML page parsing when raw file is unavailable
  const htmlRes = await fetch(REMOTE_APP_VERSION_HTML, { headers: GITHUB_HTML_HEADERS });
  if (!htmlRes.ok) {
    throw new Error(`Failed to fetch remote version (${rawRes.status}/${htmlRes.status})`);
  }
  const html = await htmlRes.text();
  const match = html.match(/>(\d+\.\d+(?:\.\d+)?)</);
  if (!match) {
    throw new Error("Unable to parse version from HTML response");
  }
  return match[1].trim();
}

async function fetchPrometheusRemoteVersion() {
  const res = await fetch(REMOTE_PROM_TAGS_PAGE, { headers: GITHUB_HTML_HEADERS });
  if (!res.ok) {
    throw new Error(`Failed to fetch Prometheus tags (${res.status})`);
  }
  const html = await res.text();
  const match =
    html.match(/releases\/tag\/(v[\d.]+)/i) ||
    html.match(/>(v\d+\.\d+\.\d+)</i);
  return match ? match[1] : null;
}

async function fetchPrometheusRemoteVersionSafe() {
  try {
    return await fetchPrometheusRemoteVersion();
  } catch {
    return null;
  }
}

async function downloadFile(url, destination, options = {}) {
  const { headers = GITHUB_HEADERS } = options;
  const response = await fetch(url, { headers });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download file (${response.status})`);
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await pipeline(response.body, fsSync.createWriteStream(destination));
}

function compareVersions(a = "0.0.0", b = "0.0.0") {
  const clean = (v) =>
    v
      .replace(/^v/, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);
  const av = clean(a);
  const bv = clean(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    const diff = (av[i] || 0) - (bv[i] || 0);
    if (diff !== 0) {
      return diff > 0 ? 1 : -1;
    }
  }
  return 0;
}

async function installPrometheusFromTag(tag) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prom-update-"));
  const zipPath = path.join(tempDir, "prom.zip");
  const extractDir = path.join(tempDir, "extract");
  try {
    const zipUrl = `${REMOTE_PROM_ZIP_BASE}/${tag}`;
    await downloadFile(zipUrl, zipPath);
    const zip = new AdmZip(zipPath);
    await fs.mkdir(extractDir, { recursive: true });
    zip.extractAllTo(extractDir, true);
    const entries = await fs.readdir(extractDir);
    if (!entries.length) {
      throw new Error("Extracted archive was empty.");
    }
    const extractedRoot = path.join(extractDir, entries[0]);
    await fs.rm(PROMETHEUS_DIR, { recursive: true, force: true });
    await fs.cp(extractedRoot, PROMETHEUS_DIR, { recursive: true });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function ensureLuaRuntime() {
  if (await luaRuntimeExists()) {
    return LUA_RUNTIME_BIN;
  }
  return installLuaRuntime();
}

async function installLuaRuntime() {
  const meta = resolveLuaArchive();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "lua-install-"));
  const archivePath = path.join(tempDir, meta.filename);
  try {
    const downloadUrl = `${LUA_SOURCEFORGE_BASE}/${meta.filename}?via=direct`;
    await downloadFile(downloadUrl, archivePath, { headers: LUA_DOWNLOAD_HEADERS });
    await extractLuaArchive(meta, archivePath, tempDir);
    const candidate = await findLuaExecutable(tempDir);
    if (!candidate) {
      throw new Error("Lua binary was not found inside the downloaded archive.");
    }
    await fs.mkdir(LUA_RUNTIME_DIR, { recursive: true });
    await fs.copyFile(
      candidate,
      process.platform === "win32"
        ? path.join(LUA_RUNTIME_DIR, "lua.exe")
        : path.join(LUA_RUNTIME_DIR, "lua")
    );
    await fs.chmod(LUA_RUNTIME_BIN, 0o755);
    return LUA_RUNTIME_BIN;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function resolveLuaArchive() {
  const platform = process.platform;
  const arch = os.arch();
  if (platform === "win32") {
    return {
      filename: arch === "ia32" ? "lua-5.2.4_Win32_bin.zip" : "lua-5.2.4_Win64_bin.zip",
      type: "zip",
    };
  }
  if (platform === "darwin") {
    return { filename: "lua-5.2.4_MacOS1011_bin.tar.gz", type: "tar" };
  }
  if (platform === "linux") {
    return {
      filename: arch === "x64" ? "lua-5.2.4_Linux515_64_bin.tar.gz" : "lua-5.2.4_Linux32_bin.tar.gz",
      type: "tar",
    };
  }
  throw new Error(`Automatic Lua install is not supported on ${platform}.`);
}

async function extractLuaArchive(meta, archivePath, extractDir) {
  if (meta.type === "zip") {
    const zip = new AdmZip(archivePath);
    zip.extractAllTo(extractDir, true);
    return;
  }
  await tar.x({ cwd: extractDir, file: archivePath });
}

async function findLuaExecutable(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findLuaExecutable(entryPath);
      if (nested) return nested;
      continue;
    }
    if (/lua(?:52)?(?:\.exe)?$/i.test(entry.name)) {
      return entryPath;
    }
  }
  return null;
}

async function luaRuntimeExists() {
  try {
    await fs.access(LUA_RUNTIME_BIN, fsSync.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function spawnAsync(command, args, options = {}) {
  const { processName = "Process", ...spawnOptions } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, spawnOptions);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const error = new Error(
          `${processName} exited with code ${code}${stderr ? `: ${stderr}` : ""}`
        );
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
  });
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`WebObfuscator running on http://localhost:${PORT}`);
  });
}

module.exports = app;
