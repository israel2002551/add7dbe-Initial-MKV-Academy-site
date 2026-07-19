/* ==========================================================================
   MKV Academy — Animated Counters
   Counts up numeric stats (data-counter-target) once they scroll into view.
   Usage: <span data-counter data-counter-target="1200" data-counter-suffix="+">0</span>
   ========================================================================== */

(function () {
  function animateCounter(el) {
    const target = parseFloat(el.getAttribute("data-counter-target") || "0");
    const suffix = el.getAttribute("data-counter-suffix") || "";
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      const value = Math.floor(eased * target);
      el.textContent = value.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function initCounters() {
    const counters = document.querySelectorAll("[data-counter]");
    if (!counters.length) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !("IntersectionObserver" in window)) {
      counters.forEach((el) => {
        const target = el.getAttribute("data-counter-target") || "0";
        const suffix = el.getAttribute("data-counter-suffix") || "";
        el.textContent = Number(target).toLocaleString() + suffix;
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    counters.forEach((el) => observer.observe(el));
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(initCounters, 0));
})();
