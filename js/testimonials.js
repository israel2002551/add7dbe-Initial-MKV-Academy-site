/* ==========================================================================
   MKV Academy — Testimonials Slider
   Fetches data/testimonials.json (falls back to an embedded copy if the
   page is opened directly from disk, where fetch() of local files is
   blocked by the browser's CORS policy). Renders into #testimonials-track
   and wires up prev/next + dot controls.
   ========================================================================== */

(function () {
  // Fallback mirrors data/testimonials.json — keep both in sync when editing content.
  const FALLBACK_TESTIMONIALS = [
    { id: "testimonial-1", name: "CAD Bootcamp Graduate", role: "SolidWorks: Beginner to CSWA", quote: "The program made parametric modeling feel structured. I now build parts with cleaner sketches, stronger feature trees, and more confidence preparing for certification.", rating: 5 },
    { id: "testimonial-2", name: "Mechanical Design Learner", role: "Advanced Part & Assembly Design", quote: "The advanced assembly sessions helped me understand how professional CAD files are organized, reviewed, and prepared for real production work.", rating: 5 },
    { id: "testimonial-3", name: "Simulation Track Student", role: "FEA Simulation & Mechanics", quote: "The mentor feedback was direct and practical. I learned how to explain assumptions, inspect mesh quality, and make better design decisions from simulation results.", rating: 5 },
    { id: "testimonial-4", name: "Engineering Team Lead", role: "Corporate Training Client", quote: "The training gave our team a clearer modeling standard and a more reliable way to review CAD files before they move into manufacturing discussions.", rating: 5 },
  ];

  function starRow(rating) {
    return Array.from({ length: 5 })
      .map((_, i) => `<svg class="w-4 h-4 ${i < rating ? "text-brand-600" : "text-slate-200"}" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.163c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.363 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.196-1.539-1.118l1.286-3.957a1 1 0 00-.363-1.118L2.98 9.385c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.95-.69l1.286-3.958z"/></svg>`)
      .join("");
  }

  function cardMarkup(t) {
    return `
      <div class="testimonial-slide w-full flex-shrink-0 px-2" role="group" aria-roledescription="slide">
        <div class="mkv-card p-8 lg:p-10 h-full flex flex-col">
          <div class="flex items-center gap-1 mb-4">${starRow(t.rating || 5)}</div>
          <p class="text-slate-700 text-lg leading-relaxed flex-1">&ldquo;${t.quote}&rdquo;</p>
          <div class="mt-6 flex items-center gap-3 pt-6 border-t border-slate-100">
            <div class="h-11 w-11 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold font-technical">
              ${t.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <div>
              <p class="font-semibold text-slate-900 text-sm">${t.name}</p>
              <p class="text-slate-500 text-xs">${t.role}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function initSlider(testimonials) {
    const track = document.getElementById("testimonials-track");
    const dotsWrap = document.getElementById("testimonials-dots");
    const prevBtn = document.getElementById("testimonials-prev");
    const nextBtn = document.getElementById("testimonials-next");
    if (!track) return;

    track.innerHTML = testimonials.map(cardMarkup).join("");
    track.style.display = "flex";
    track.style.transition = "transform 0.5s ease";

    let index = 0;
    const total = testimonials.length;

    function renderDots() {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = testimonials
        .map((_, i) => `<button class="w-2.5 h-2.5 rounded-full transition-all ${i === index ? "bg-brand-600 w-6" : "bg-slate-300"}" data-dot-index="${i}" aria-label="Go to testimonial ${i + 1}"></button>`)
        .join("");
      dotsWrap.querySelectorAll("[data-dot-index]").forEach((btn) => {
        btn.addEventListener("click", () => goTo(Number(btn.getAttribute("data-dot-index"))));
      });
    }

    function goTo(i) {
      index = (i + total) % total;
      track.style.transform = `translateX(-${index * 100}%)`;
      renderDots();
    }

    prevBtn && prevBtn.addEventListener("click", () => goTo(index - 1));
    nextBtn && nextBtn.addEventListener("click", () => goTo(index + 1));

    renderDots();
    goTo(0);

    // Gentle autoplay, paused on hover/focus for accessibility and control.
    let autoplay = setInterval(() => goTo(index + 1), 7000);
    const wrap = track.closest("[data-testimonials-wrap]");
    if (wrap) {
      wrap.addEventListener("mouseenter", () => clearInterval(autoplay));
      wrap.addEventListener("mouseleave", () => (autoplay = setInterval(() => goTo(index + 1), 7000)));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const track = document.getElementById("testimonials-track");
    if (!track) return;

    fetch("data/testimonials.json")
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((data) => initSlider(data))
      .catch(() => initSlider(FALLBACK_TESTIMONIALS));
  });
})();
