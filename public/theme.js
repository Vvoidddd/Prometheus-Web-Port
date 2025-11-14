(function (global) {
  const THEME_STORAGE_KEY = "prom-web-theme";
  const LAYOUT_STORAGE_KEY = "prom-web-layout";

  const THEMES = [
    { value: "terminal", label: "Terminal", description: "Retro CRT black + cyan glow." },
    { value: "vapor", label: "Vaporwave", description: "Neon pinks and blues with gradients." },
    { value: "paper", label: "Paper", description: "Bright white surfaces with blue accents." },
    { value: "synth", label: "Synthwave", description: "Purple neon circuitry inspired palette." },
    { value: "ocean", label: "Abyssal", description: "Deep blues with aqua typography." },
    { value: "carbon", label: "Carbon", description: "Soft charcoal and teal highlights." },
  ];

  const LAYOUTS = [
    { value: "classic", label: "Classic Grid", description: "Balanced grids with cards side by side." },
    { value: "compact", label: "Compact", description: "Tighter gaps and condensed panels." },
    { value: "stacked", label: "Stacked", description: "Single-column layout for narrow screens." },
    { value: "wide", label: "Wide Canvas", description: "Extra width and breathing room." },
    { value: "focus", label: "Editor Focus", description: "Workbench first with stretched editor." },
    { value: "minimal", label: "Minimal", description: "Flat cards, no shadows, subdued chrome." },
  ];

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function setStoredTheme(value) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }

  function normalizeTheme(value) {
    return THEMES.some((theme) => theme.value === value) ? value : THEMES[0].value;
  }

  function applyTheme(value) {
    const next = normalizeTheme(value);
    document.documentElement.dataset.theme = next;
    return next;
  }

  function getThemes() {
    return THEMES.map((theme) => ({ ...theme }));
  }

  function getThemeMeta(value) {
    return THEMES.find((theme) => theme.value === value);
  }

  function initThemeSelect(selectEl, { onChange } = {}) {
    if (!selectEl) return;
    const current = applyTheme(getStoredTheme() || THEMES[0].value);
    selectEl.innerHTML = "";
    THEMES.forEach(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      selectEl.appendChild(option);
    });
    selectEl.value = current;
    selectEl.addEventListener("change", (event) => {
      const chosen = normalizeTheme(event.target.value);
      applyTheme(chosen);
      setStoredTheme(chosen);
      if (typeof onChange === "function") {
        onChange(chosen);
      }
    });
  }

  function getStoredLayout() {
    try {
      return localStorage.getItem(LAYOUT_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function setStoredLayout(value) {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }

  function normalizeLayout(value) {
    return LAYOUTS.some((layout) => layout.value === value) ? value : LAYOUTS[0].value;
  }

  function applyLayout(value) {
    const next = normalizeLayout(value);
    document.documentElement.dataset.layout = next;
    return next;
  }

  function getLayouts() {
    return LAYOUTS.map((layout) => ({ ...layout }));
  }

  function getLayoutMeta(value) {
    return LAYOUTS.find((layout) => layout.value === value);
  }

  function initLayoutSelect(selectEl, { onChange } = {}) {
    if (!selectEl) return;
    const current = applyLayout(getStoredLayout() || LAYOUTS[0].value);
    selectEl.innerHTML = "";
    LAYOUTS.forEach(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      selectEl.appendChild(option);
    });
    selectEl.value = current;
    selectEl.addEventListener("change", (event) => {
      const chosen = normalizeLayout(event.target.value);
      applyLayout(chosen);
      setStoredLayout(chosen);
      if (typeof onChange === "function") {
        onChange(chosen);
      }
    });
  }

  const manager = {
    // Theme helpers
    getThemes,
    getThemeMeta,
    getStoredTheme,
    setStoredTheme,
    applyTheme,
    initThemeSelect,
    THEME_STORAGE_KEY,
    // Layout helpers
    getLayouts,
    getLayoutMeta,
    getStoredLayout,
    setStoredLayout,
    applyLayout,
    initLayoutSelect,
    LAYOUT_STORAGE_KEY,
  };

  global.AppearanceManager = manager;
  global.ThemeManager = manager;
})(window);
