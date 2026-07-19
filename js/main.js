/* ==========================================================================
   MKV Academy — Main
   Site-wide, page-agnostic behaviors that don't belong to a single feature
   file: loading screen, scroll progress bar, back-to-top, WhatsApp float,
   and the cookie consent banner.
   ========================================================================== */

(function () {
  function initLoadingScreen() {
    const screen = document.getElementById("loading-screen");
    if (!screen) return;
    window.addEventListener("load", () => {
      setTimeout(() => screen.classList.add("loaded"), 250);
    });
    // Safety net in case 'load' already fired before this script ran.
    if (document.readyState === "complete") screen.classList.add("loaded");
  }

  function initScrollProgress() {
    const bar = document.getElementById("scroll-progress");
    if (!bar) return;
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = pct + "%";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function initBackToTop() {
    const btn = document.getElementById("back-to-top");
    if (!btn) return;
    window.addEventListener(
      "scroll",
      () => btn.classList.toggle("visible", window.scrollY > 480),
      { passive: true }
    );
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function initCookieBanner() {
    const banner = document.getElementById("cookie-banner");
    if (!banner) return;
    const KEY = "mkv-cookie-consent";
    let dismissed = false;
    try {
      dismissed = !!localStorage.getItem(KEY);
    } catch (e) {
      /* ignore — banner will just show every visit if storage is unavailable */
    }
    if (!dismissed) {
      setTimeout(() => banner.classList.add("show"), 1200);
    }

    document.querySelectorAll("[data-cookie-accept], [data-cookie-dismiss]").forEach((btn) => {
      btn.addEventListener("click", () => {
        banner.classList.remove("show");
        try {
          localStorage.setItem(KEY, "1");
        } catch (e) {
          /* ignore */
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initLoadingScreen();
    initScrollProgress();
    initBackToTop();
    initCookieBanner();
  });
})();
