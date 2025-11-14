const express = require("express");
const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PROMETHEUS_DIR = path.join(ROOT_DIR, "Prometheus-master");
const PROMETHEUS_CLI = path.join(PROMETHEUS_DIR, "cli.lua");
const LUA_BIN = process.env.LUA_BIN || "lua";

const AVAILABLE_PRESETS = ["Minify", "Weak", "Medium", "Strong"];
const LUA_VERSIONS = ["Lua51", "LuaU"];

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

function spawnAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
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
          `Prometheus exited with code ${code}${stderr ? `: ${stderr}` : ""}`
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
