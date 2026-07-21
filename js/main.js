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

  const TRANSLATIONS = {
    fr: {
      "Home": "Accueil",
      "Courses": "Cours",
      "Services": "Services",
      "About": "A propos",
      "Community": "Communaute",
      "Chat": "Chat",
      "Contact": "Contact",
      "Student Login": "Connexion etudiant",
      "My Portal": "Mon portail",
      "Admin": "Admin",
      "Instructor": "Formateur",
      "Instructor Dashboard": "Tableau formateur",
      "Talk to Someone": "Parler a quelqu'un",
      "Log Out": "Deconnexion",
      "Explore Courses": "Explorer les cours",
      "View All Courses": "Voir tous les cours",
      "Preview": "Apercu",
      "Enroll Now": "S'inscrire",
      "Coming Soon": "Bientot disponible",
      "Messages": "Messages",
      "Conversations": "Conversations",
      "New Conversation": "Nouvelle conversation",
      "Delete": "Supprimer",
      "Send": "Envoyer",
      "Community options": "Options communaute",
      "Check Community": "Voir communaute",
      "Join the Meeting": "Rejoindre la reunion",
    },
  };

  function initLanguageToggle() {
    const selects = [...document.querySelectorAll("[data-language-toggle]")];
    if (!selects.length) return;
    let lang = "en";
    try {
      lang = localStorage.getItem("mkv-language") || "en";
    } catch (e) {
      /* ignore */
    }
    selects.forEach((select) => {
      select.value = lang;
    });

    function applyLanguage(nextLang) {
      document.documentElement.lang = nextLang;
      selects.forEach((select) => {
        select.value = nextLang;
      });
      const dictionary = TRANSLATIONS[nextLang] || {};
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const original = el.getAttribute("data-i18n");
        el.textContent = dictionary[original] || original;
      });
      try {
        localStorage.setItem("mkv-language", nextLang);
      } catch (e) {
        /* ignore */
      }
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
