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

  function initExternalLinks() {
    const cfg = window.MKV_SUPABASE_CONFIG || {};
    const whatsappUrl = cfg.WHATSAPP_URL || "https://wa.link/qnw9ai";
    const whatsappCommunityUrl = cfg.WHATSAPP_COMMUNITY_URL || whatsappUrl;
    document.querySelectorAll("#whatsapp-float").forEach((link) => {
      link.setAttribute("href", whatsappUrl);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
    });
    document.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
      link.setAttribute("href", whatsappCommunityUrl);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
    });
    document.querySelectorAll("[data-whatsapp-direct-link]").forEach((link) => {
      link.setAttribute("href", whatsappUrl);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
    });
    document.querySelectorAll("[data-mentor-hours-link]").forEach((link) => {
      link.setAttribute("href", cfg.MENTOR_HOURS_URL || "https://zoom.us/");
    });
    document.querySelectorAll("[data-project-review-link]").forEach((link) => {
      link.setAttribute("href", cfg.PROJECT_REVIEW_URL || "students.html#project-review");
    });
  }

  const SUPPORTED_LANGUAGES = ["en", "fr", "de", "es"];

  function initLanguageToggle() {
    const selects = [...document.querySelectorAll("[data-language-toggle]")];
    if (!selects.length) return;
    let lang = "en";
    try {
      lang = localStorage.getItem("mkv-language") || "en";
    } catch (e) {
      /* ignore */
    }
    if (!SUPPORTED_LANGUAGES.includes(lang)) lang = "en";
    selects.forEach((select) => {
      select.value = lang;
    });

    function setTranslationCookie(nextLang) {
      const value = nextLang === "en" ? "/en/en" : `/en/${nextLang}`;
      const expires = nextLang === "en"
        ? "Thu, 01 Jan 1970 00:00:00 GMT"
        : "Fri, 31 Dec 9999 23:59:59 GMT";
      document.cookie = `googtrans=${value}; expires=${expires}; path=/`;
      if (window.location.hostname) {
        document.cookie = `googtrans=${value}; expires=${expires}; path=/; domain=${window.location.hostname}`;
      }
    }

    function syncGoogleTranslate(nextLang) {
      const combo = document.querySelector(".goog-te-combo");
      if (!combo) {
        setTimeout(() => syncGoogleTranslate(nextLang), 500);
        return;
      }
      const value = nextLang === "en" ? "" : nextLang;
      if (combo.value === value) return;
      combo.value = value;
      combo.dispatchEvent(new Event("change"));
    }

    function loadGoogleTranslate(nextLang) {
      if (!document.getElementById("google_translate_element")) {
        const mount = document.createElement("div");
        mount.id = "google_translate_element";
        mount.className = "hidden";
        document.body.appendChild(mount);
      }
      if (!document.querySelector("style[data-google-translate-style]")) {
        const style = document.createElement("style");
        style.setAttribute("data-google-translate-style", "true");
        style.textContent = "#google_translate_element,.goog-te-banner-frame.skiptranslate{display:none!important;}body{top:0!important;}";
        document.head.appendChild(style);
      }

      window.googleTranslateElementInit = function () {
        if (!window.google?.translate?.TranslateElement) return;
        new window.google.translate.TranslateElement({
          pageLanguage: "en",
          includedLanguages: SUPPORTED_LANGUAGES.filter((item) => item !== "en").join(","),
          autoDisplay: false,
        }, "google_translate_element");
        syncGoogleTranslate(nextLang);
      };

      if (window.google?.translate?.TranslateElement) {
        window.googleTranslateElementInit();
        return;
      }
      if (!document.querySelector("script[data-google-translate]")) {
        const script = document.createElement("script");
        script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
        script.async = true;
        script.setAttribute("data-google-translate", "true");
        document.head.appendChild(script);
      }
    }

    function applyLanguage(nextLang) {
      if (!SUPPORTED_LANGUAGES.includes(nextLang)) nextLang = "en";
      document.documentElement.lang = nextLang;
      selects.forEach((select) => {
        select.value = nextLang;
      });
      try {
        localStorage.setItem("mkv-language", nextLang);
      } catch (e) {
        /* ignore */
      }
      setTranslationCookie(nextLang);
      if (nextLang === "en") {
        if (document.querySelector(".goog-te-combo")) syncGoogleTranslate(nextLang);
        return;
      }
      loadGoogleTranslate(nextLang);
    }

    selects.forEach((select) => {
      select.addEventListener("change", () => applyLanguage(select.value));
    });
    applyLanguage(lang);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initLoadingScreen();
    initScrollProgress();
    initBackToTop();
    initCookieBanner();
    initExternalLinks();
    initLanguageToggle();
  });
})();
