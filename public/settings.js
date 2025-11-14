document.addEventListener("DOMContentLoaded", () => {
  const manager = window.AppearanceManager || window.ThemeManager;
  const themeSelect = document.getElementById("settingsThemeSelect");
  const themeStatusEl = document.getElementById("themeSaveStatus");
  const themePreviewEl = document.getElementById("themePreview");
  const layoutSelect = document.getElementById("settingsLayoutSelect");
  const layoutStatusEl = document.getElementById("layoutSaveStatus");
  const layoutPreviewEl = document.getElementById("layoutPreview");

  if (!manager || !themeSelect) {
    if (themeStatusEl) {
      themeStatusEl.textContent = "Unable to load settings controls.";
      themeStatusEl.classList.add("error");
    }
    return;
  }

  const themes = manager.getThemes();
  const layouts = manager.getLayouts();

  function updateThemeStatus(value) {
    if (!themeStatusEl) return;
    const meta = manager.getThemeMeta(value) || { label: value };
    themeStatusEl.textContent = `Theme saved: ${meta.label}`;
    themeStatusEl.classList.remove("error");
  }

  function updateThemePreview(value) {
    if (!themePreviewEl) return;
    const meta = manager.getThemeMeta(value) || { label: value, description: "" };
    const title = themePreviewEl.querySelector("h3");
    const copy = themePreviewEl.querySelector("p");
    if (title) title.textContent = `${meta.label} theme`;
    if (copy) copy.textContent = meta.description || "Applies across every page.";
  }

  function updateLayoutStatus(value) {
    if (!layoutStatusEl) return;
    const meta = manager.getLayoutMeta(value) || { label: value };
    layoutStatusEl.textContent = `Layout saved: ${meta.label}`;
    layoutStatusEl.classList.remove("error");
  }

  function updateLayoutPreview(value) {
    if (!layoutPreviewEl) return;
    const meta = manager.getLayoutMeta(value) || { label: value, description: "" };
    const title = layoutPreviewEl.querySelector("h3");
    const copy = layoutPreviewEl.querySelector("p");
    if (title) title.textContent = meta.label;
    if (copy) copy.textContent = meta.description || "Cards reflow based on your pick.";
  }

  manager.initThemeSelect(themeSelect, {
    onChange: (themeValue) => {
      updateThemeStatus(themeValue);
      updateThemePreview(themeValue);
    },
  });

  if (layoutSelect) {
    manager.initLayoutSelect(layoutSelect, {
      onChange: (layoutValue) => {
        updateLayoutStatus(layoutValue);
        updateLayoutPreview(layoutValue);
      },
    });
  }

  const initialTheme = manager.getStoredTheme() || themes[0].value;
  updateThemeStatus(initialTheme);
  updateThemePreview(initialTheme);

  const initialLayout = manager.getStoredLayout() || layouts[0].value;
  updateLayoutStatus(initialLayout);
  updateLayoutPreview(initialLayout);
});
