/* ==========================================================================
   MKV Academy — Dark Mode
   Toggles Tailwind's 'dark' class on <html> and remembers the choice.
   Requires tailwind.config.darkMode = 'class' (set inline in each page).
   ========================================================================== */

(function () {
  const STORAGE_KEY = "mkv-theme";

  function applyTheme(theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.querySelectorAll("[data-theme-icon-dark]").forEach((el) => el.classList.toggle("hidden", theme !== "dark"));
    document.querySelectorAll("[data-theme-icon-light]").forEach((el) => el.classList.toggle("hidden", theme === "dark"));
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* localStorage unavailable — theme just won't persist across visits */
    }
  }

  function initDarkMode() {
    const stored = getStoredTheme();
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(stored || (prefersDark ? "dark" : "light"));

    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
        applyTheme(next);
        setStoredTheme(next);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", initDarkMode);
})();
