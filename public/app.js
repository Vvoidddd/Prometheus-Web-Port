const presetSelect = document.getElementById("preset");
const luaVersionSelect = document.getElementById("luaVersion");
const prettyPrintToggle = document.getElementById("prettyPrint");
const sourceInput = document.getElementById("source");
const outputArea = document.getElementById("result");
const logWindow = document.getElementById("logWindow");
const obfuscateBtn = document.getElementById("obfuscateBtn");
const sampleBtn = document.getElementById("sampleBtn");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const sourceHighlight = document.getElementById("sourceHighlight");
const resultHighlight = document.getElementById("resultHighlight");
const statFilesEl = document.getElementById("statFiles");
const statLinesEl = document.getElementById("statLines");

let totalFilesObfuscated = 0;
let totalLinesProcessed = 0;

const LUA_KEYWORDS = new Set([
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
  "pairs",
  "ipairs",
]);

const SAMPLE_SNIPPET = `-- iron brew cpu test demo
-- stresses arithmetic, tables, and coroutine churn

local cycles = 1e5
local summary = {}

local function scramble(n)
  local acc = n
  for i = 1, 32 do
    acc = (acc * 3.141592653) % 1e4
    acc = (acc + i * math.sin(acc)) % 1e6
  end
  return acc
end

local function cpu_test()
  local t = os.clock()
  for i = 1, cycles do
    local key = "core_" .. (i % 64)
    summary[key] = scramble(i + (summary[key] or 0))
  end
  return os.clock() - t
end

local function coroutine_mix()
  local co = coroutine.create(function()
    for i = 1, 120 do
      coroutine.yield(scramble(i * 11))
    end
  end)

  local total = 0
  while true do
    local ok, value = coroutine.resume(co)
    if not ok then
      return error("coroutine error: " .. tostring(value))
    end
    if value == nil then
      break
    end
    total = total + value
  end
  return total
end

local delta = cpu_test()
local sum = coroutine_mix()

print("[IRON BREW TEST] cycles:", cycles)
print("[IRON BREW TEST] time delta:", string.format("%.4fs", delta))
print("[IRON BREW TEST] mix checksum:", string.format("%.4f", sum))`;

async function bootstrap() {
  await loadPresets();
  registerEvents();
  syncHighlight(sourceInput, sourceHighlight);
  syncHighlight(outputArea, resultHighlight);
}

async function loadPresets() {
  try {
    const res = await fetch("/api/presets");
    if (!res.ok) throw new Error("Failed to fetch presets");

    const data = await res.json();
    fillSelect(presetSelect, data.presets);
    fillSelect(luaVersionSelect, data.luaVersions);
  } catch (error) {
    logWindow.textContent = `Unable to load presets: ${error.message}`;
  }
}

function fillSelect(select, values = []) {
  select.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function registerEvents() {
  sampleBtn.addEventListener("click", () => {
    sourceInput.value = SAMPLE_SNIPPET;
    syncHighlight(sourceInput, sourceHighlight);
  });

  obfuscateBtn.addEventListener("click", handleObfuscate);
  copyBtn.addEventListener("click", handleCopy);
  downloadBtn.addEventListener("click", handleDownload);

  sourceInput.addEventListener("input", () => syncHighlight(sourceInput, sourceHighlight));
  sourceInput.addEventListener("scroll", () => syncScroll(sourceInput, sourceHighlight));
  outputArea.addEventListener("scroll", () => syncScroll(outputArea, resultHighlight));
}

async function handleObfuscate() {
  if (!sourceInput.value.trim()) {
    alert("Please paste some Lua code first.");
    return;
  }

  setLoading(true);
  logWindow.textContent = "Running Prometheus CLI...";

  try {
    const payload = {
      source: sourceInput.value,
      preset: presetSelect.value,
      luaVersion: luaVersionSelect.value,
      prettyPrint: prettyPrintToggle.checked,
    };

    const res = await fetch("/api/obfuscate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Prometheus failed");
    }

    outputArea.value = data.output || "";
    outputArea.scrollTop = 0;
    syncHighlight(outputArea, resultHighlight);
    syncScroll(outputArea, resultHighlight);
    writeLog(data);
    const lineCount = countLines(sourceInput.value);
    updateStats(lineCount);
  } catch (error) {
    logWindow.textContent = `Failed: ${error.message}`;
    outputArea.value = "";
    syncHighlight(outputArea, resultHighlight);
    syncScroll(outputArea, resultHighlight);
  } finally {
    setLoading(false);
  }
}

function writeLog({ stdout = "", stderr = "" }) {
  const parts = [];
  if (stdout.trim()) {
    parts.push("STDOUT\n------\n" + stdout.trim());
  }
  if (stderr.trim()) {
    parts.push("STDERR\n------\n" + stderr.trim());
  }
  logWindow.textContent = parts.join("\n\n") || "Prometheus finished with no console output.";
}

async function handleCopy() {
  if (!outputArea.value) return;
  try {
    await navigator.clipboard.writeText(outputArea.value);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy Output"), 1500);
  } catch {
    alert("Clipboard permissions denied.");
  }
}

function handleDownload() {
  if (!outputArea.value) return;
  const blob = new Blob([outputArea.value], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "obfuscated.lua";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function setLoading(isLoading) {
  obfuscateBtn.disabled = isLoading;
  obfuscateBtn.textContent = isLoading ? "Obfuscating..." : "Obfuscate";
}

function syncHighlight(textarea, highlightEl) {
  if (!highlightEl) return;
  const highlighted = highlightLua(textarea.value || "");
  highlightEl.innerHTML = highlighted || "&nbsp;";
  syncScroll(textarea, highlightEl);
}

function syncScroll(textarea, highlightEl) {
  if (!highlightEl) return;
  const x = textarea.scrollLeft;
  const y = textarea.scrollTop;
  highlightEl.style.transform = `translate(${-x}px, ${-y}px)`;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightLua(code) {
  const tokens = [];
  let i = 0;

  while (i < code.length) {
    const char = code[i];
    const next = code[i + 1];

    if (char === "-" && next === "-") {
      const start = i;
      i += 2;
      while (i < code.length && code[i] !== "\n") i++;
      tokens.push({ type: "comment", value: code.slice(start, i) });
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      let start = i;
      i++;
      while (i < code.length) {
        if (code[i] === "\\" && i + 1 < code.length) {
          i += 2;
          continue;
        }
        if (code[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      tokens.push({ type: "string", value: code.slice(start, i) });
      continue;
    }

    if (/[0-9]/.test(char)) {
      let start = i;
      while (i < code.length && /[0-9xXa-fA-F._]/.test(code[i])) i++;
      tokens.push({ type: "number", value: code.slice(start, i) });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let start = i;
      while (i < code.length && /[A-Za-z0-9_]/.test(code[i])) i++;
      const word = code.slice(start, i);
      if (LUA_KEYWORDS.has(word)) {
        tokens.push({ type: "keyword", value: word });
      } else {
        tokens.push({ type: "plain", value: word });
      }
      continue;
    }

    tokens.push({ type: "plain", value: char });
    i++;
  }

  return tokens
    .map(({ type, value }) => {
      const escaped = escapeHTML(value);
      switch (type) {
        case "keyword":
          return `<span class="hl-keyword">${escaped}</span>`;
        case "string":
          return `<span class="hl-string">${escaped}</span>`;
        case "number":
          return `<span class="hl-number">${escaped}</span>`;
        case "comment":
          return `<span class="hl-comment">${escaped}</span>`;
        default:
          return escaped;
      }
    })
    .join("");
}

function countLines(source) {
  if (!source.trim()) return 0;
  return source.replace(/\r\n/g, "\n").split("\n").length;
}

function updateStats(lineCount) {
  totalFilesObfuscated += 1;
  totalLinesProcessed += lineCount;
  if (statFilesEl) statFilesEl.textContent = totalFilesObfuscated.toLocaleString();
  if (statLinesEl) statLinesEl.textContent = totalLinesProcessed.toLocaleString();
}

bootstrap();
