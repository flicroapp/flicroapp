export type Theme = "light" | "dark";

const KEY = "flicro-theme";

export function loadTheme(): Theme {
  if (typeof localStorage === "undefined") return "light";
  return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const dark = theme === "dark";
  if (dark) document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  document.documentElement.style.background = dark ? "#000000" : "#2f7cf6";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#000000" : "#2f7cf6");
  try {
    localStorage.setItem(KEY, dark ? "dark" : "light");
  } catch {
    /* private mode */
  }
}
