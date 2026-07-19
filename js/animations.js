/* ==========================================================================
   MKV Academy — Scroll Reveal Animations
   Elements marked with [data-reveal] fade/slide up once when they enter
   the viewport. Respects prefers-reduced-motion by revealing immediately.
   ========================================================================== */

(function () {
  function initReveal() {
    const items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = entry.target.getAttribute("data-reveal-delay") || 0;
            setTimeout(() => entry.target.classList.add("is-visible"), Number(delay));
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    items.forEach((el) => observer.observe(el));
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(initReveal, 0));
})();
