(function (global) {
  const KEYWORDS = new Set([
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
    "const",
    "let",
    "var",
    "async",
    "await",
    "switch",
    "case",
    "default",
  ]);

  function escapeHTML(str = "") {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function highlightCode(code = "") {
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

      if (char === "/" && next === "/") {
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
        if (KEYWORDS.has(word)) {
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

  global.HighlightEngine = {
    highlightCode,
    escapeHTML,
  };
})(window);
