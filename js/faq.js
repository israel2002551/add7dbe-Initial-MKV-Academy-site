/* ==========================================================================
   MKV Academy — FAQ Accordion
   Toggles .faq-panel visibility next to any .faq-trigger button.
   Used on index.html (preview) and faq.html (full list).
   ========================================================================== */

(function () {
  function initFaq() {
    document.querySelectorAll(".faq-trigger").forEach((btn) => {
      btn.addEventListener("click", () => {
        const panel = btn.nextElementSibling;
        const isOpen = !panel.classList.contains("hidden");
        panel.classList.toggle("hidden");
        btn.setAttribute("aria-expanded", String(!isOpen));
        const icon = btn.querySelector("svg");
        if (icon) icon.style.transform = isOpen ? "" : "rotate(180deg)";
      });
    });
  }

  document.addEventListener("DOMContentLoaded", initFaq);
})();
