/* ==========================================================================
   MKV Academy — Navigation
   Mobile menu toggle + subtle scroll-aware navbar elevation.
   Depends on components.js having injected #site-navbar into the DOM.
   ========================================================================== */

(function () {
  function initMobileMenu() {
    const toggle = document.getElementById("mobile-menu-toggle");
    const panel = document.getElementById("mobile-nav");
    const iconMenu = document.getElementById("icon-menu");
    const iconClose = document.getElementById("icon-close");
    if (!toggle || !panel) return;

    toggle.addEventListener("click", () => {
      const isOpen = panel.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      iconMenu.classList.toggle("hidden", isOpen);
      iconClose.classList.toggle("hidden", !isOpen);
    });

    // Close mobile menu when a link inside it is clicked
    panel.addEventListener("click", (e) => {
      if (e.target.closest("a")) {
        panel.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        iconMenu.classList.remove("hidden");
        iconClose.classList.add("hidden");
      }
    });
  }

  function initScrollShadow() {
    const navbar = document.getElementById("site-navbar");
    if (!navbar) return;
    const onScroll = () => {
      if (window.scrollY > 8) {
        navbar.classList.add("shadow-md");
      } else {
        navbar.classList.remove("shadow-md");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Components are injected on DOMContentLoaded by components.js; run just after.
  document.addEventListener("DOMContentLoaded", () => {
    // Defer one tick so #site-navbar/#mobile-nav exist in the DOM already.
    setTimeout(() => {
      initMobileMenu();
      initScrollShadow();
    }, 0);
  });
})();
