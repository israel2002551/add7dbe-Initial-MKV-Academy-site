/* ==========================================================================
   MKV Academy - Course Catalog
   Fetches data/courses.json (with an embedded fallback for direct file
   access), renders searchable/filterable course cards into #courses-grid.
   ========================================================================== */

(function () {
  let coursesCache = [];
  let checkoutState = { course: null, coupon: null, discount: 0 };
  // Fallback mirrors data/courses.json; keep both in sync when editing content.
  const FALLBACK_COURSES = [
    { id: "solidworks-beginner-cswa", title: "SolidWorks: Beginner to CSWA", category: "SOLIDWORKS", level: "Beginner", duration: "6 Weeks", badge: "Popular", cardStyle: "brand", icon: "cube", paymentLink: "https://flutterwave.com/pay/hwtqgnslu4bd", description: "Learn fundamental 3D parametric modeling and master your first official certification.", highlights: ["Sketch Relations & Master Parametrics", "Bottom-up Assemblies & Drawings", "Live CSWA Prep & Practice Exam Mockups"] },
    { id: "advanced-part-assembly-design", title: "Advanced Part & Assembly Design", category: "Advanced SOLIDWORKS", level: "Intermediate", duration: "8 Weeks", badge: "", cardStyle: "dark", icon: "cog", paymentLink: "https://flutterwave.com/pay/heqechxtiofy", description: "Level up to multi-body master-modeling, structural weldments, and complex sheet metal.", highlights: ["Multi-body Master-Model Workflows", "Weldments & Sheet Metal Engineering", "Preparation for CSWP Specialist Levels"] },
    { id: "fea-simulation-mechanics", title: "FEA Simulation & Mechanics", category: "Engineering Simulation", level: "Advanced", duration: "4 Weeks", badge: "", cardStyle: "slate", icon: "chart", paymentLink: "", description: "Validate your designs. Run stress analysis, fatigue, and structural optimization simulations.", highlights: ["Static Linear Stress Analysis (FEA)", "Mesh Convergence & Refinement Strategies", "Real-world Fatigue & Factor-of-Safety Reports"] },
    { id: "autocad-fundamentals", title: "AutoCAD Fundamentals", category: "AutoCAD", level: "Beginner", duration: "5 Weeks", badge: "", cardStyle: "brand", icon: "ruler", paymentLink: "", description: "Build precise 2D technical drawings and layer standards used on real production floors.", highlights: ["Layers, Blocks & Dimensioning Standards", "Technical Drafting Conventions", "Title Blocks & Sheet Sets"] },
    { id: "design-for-manufacturing", title: "Design for Manufacturing (DFM)", category: "Design for Manufacturing", level: "Intermediate", duration: "6 Weeks", badge: "", cardStyle: "dark", icon: "factory", paymentLink: "", description: "Design parts that survive contact with the manufacturing floor - first time, every time.", highlights: ["Tolerance Stacks & GD&T Basics", "Injection Molding & Sheet Metal DFM Rules", "Cost-driven Design Decisions"] },
    { id: "manufacturing-drawings", title: "Manufacturing Drawings & GD&T", category: "Manufacturing Drawings", level: "Intermediate", duration: "4 Weeks", badge: "", cardStyle: "slate", icon: "document", paymentLink: "", description: "Produce drawings a machinist can pick up and build from without a single phone call.", highlights: ["Dimensioning & Tolerancing Standards", "Section, Detail & Assembly Views", "Revision Control Practices"] },
    { id: "product-design-fundamentals", title: "Product Design Fundamentals", category: "Product Design", level: "Beginner", duration: "6 Weeks", badge: "", cardStyle: "brand", icon: "lightbulb", paymentLink: "", description: "Move from concept sketch to a manufacturable product with a repeatable design process.", highlights: ["Concept Development & Iteration", "Materials & Process Selection", "Prototyping Workflows"] },
    { id: "mechanical-design-projects", title: "Mechanical Design: Real Projects", category: "Mechanical Design", level: "Advanced", duration: "10 Weeks", badge: "New", cardStyle: "dark", icon: "gear", paymentLink: "", description: "Apply everything to a capstone mechanical assembly, reviewed like a real engineering project.", highlights: ["End-to-end Assembly Ownership", "Design Reviews with Working Engineers", "Portfolio-ready Final Deliverable"] },
    { id: "embedded-systems-intro", title: "Embedded Systems Foundations", category: "Embedded Systems", level: "Beginner", duration: "7 Weeks", badge: "", cardStyle: "slate", icon: "chip", paymentLink: "", description: "Bridge mechanical and electrical engineering with practical embedded fundamentals.", highlights: ["Microcontroller Basics & Circuits", "Sensors, Actuators & Signal Flow", "Mechatronic Integration Projects"] },
    { id: "cad-best-practices", title: "CAD Best Practices & Standards", category: "CAD Best Practices", level: "All Levels", duration: "3 Weeks", badge: "", cardStyle: "brand", icon: "check", paymentLink: "", description: "The workflow discipline that keeps feature trees clean and models from breaking.", highlights: ["Feature Tree Hygiene", "Parametric Modeling Standards", "File & Revision Management"] },
    { id: "engineering-capstone-projects", title: "Engineering Projects Studio", category: "Engineering Projects", level: "Advanced", duration: "12 Weeks", badge: "", cardStyle: "dark", icon: "rocket", paymentLink: "", description: "A guided studio where you take one product from brief to manufacturing-ready package.", highlights: ["Full Product Development Lifecycle", "Cross-discipline Team Collaboration", "Final Client-style Presentation"] },
  ];

  const ICONS = {
    cube: '<path d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9V21" stroke-linecap="round" stroke-linejoin="round"/>',
    cog: '<path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>',
    chart: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.5l4.5-4.5 4 4L21 4.5M3 20.25h18M7.5 20.25v-6M12.5 20.25v-9M17.5 20.25v-4.5"/>',
    ruler: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5v10.5H3.75zM7.5 6.75v3M11.25 6.75v5M15 6.75v3"/>',
    factory: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 21V10.5L9 15v-4.5l6 4.5V6l6 4.5V21H3z"/>',
    document: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>',
    lightbulb: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17.25v-1.5a3.75 3.75 0 116 0v1.5M9 20.25h6M12 3v.75M6.75 6.75L6 6M17.25 6.75L18 6"/>',
    gear: '<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 3.75h1.5l.5 2.25 2.1.9 1.9-1.3 1.06 1.06-1.3 1.9.9 2.1 2.25.5v1.5l-2.25.5-.9 2.1 1.3 1.9-1.06 1.06-1.9-1.3-2.1.9-.5 2.25h-1.5l-.5-2.25-2.1-.9-1.9 1.3-1.06-1.06 1.3-1.9-.9-2.1-2.25-.5v-1.5l2.25-.5.9-2.1-1.3-1.9 1.06-1.06 1.9 1.3 2.1-.9z"/>',
    chip: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2.25M15 3v2.25M9 18.75V21M15 18.75V21M3 9h2.25M3 15h2.25M18.75 9H21M18.75 15H21M7.5 7.5h9v9h-9z"/>',
    check: '<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>',
    rocket: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.72m5.96 5.65a14.98 14.98 0 01-5.96-5.65m0 0a14.98 14.98 0 00-5.16 5.96m5.16-5.96L4.31 15.9M9.63 8.72L4.32 15.9"/>',
  };

  function cardTopClass(style) {
    if (style === "dark") return "from-slate-950 via-slate-800 to-slate-700";
    if (style === "slate") return "from-slate-700 via-slate-500 to-cyan-500";
    return "from-brand-900 via-brand-700 to-cyan-500";
  }

  function enrollCta(course) {
    if (window.MKV_SUPABASE && window.MKV_SUPABASE.isConfigured) {
      return `
        <button type="button" data-start-checkout data-course-id="${course.id}" class="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-brand-700">
          Enroll
        </button>
      `;
    }

    // Courses without a payment link are intentionally disabled until the
    // owner activates checkout for that course.
    if (course.paymentLink) {
      return `
        <a href="${course.paymentLink}" class="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-brand-700">
          Enroll
        </a>
      `;
    }
    return `
      <span class="inline-flex w-full items-center justify-center rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-400 cursor-not-allowed" title="Payment link coming soon">
        Coming Soon
      </span>
    `;
  }

  function formatMoney(amount, currency) {
    if (amount === null || amount === undefined || amount === "") return "Price TBA";
    const value = Number(amount || 0);
    const code = currency || "NGN";
    if (value <= 0) return "Free";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
        maximumFractionDigits: value % 1 === 0 ? 0 : 2,
      }).format(value);
    } catch (error) {
      return `${code} ${value.toLocaleString()}`;
    }
  }

  function courseCardMarkup(course) {
    const thumbnail = course.thumbnailUrl
      ? `<img src="${course.thumbnailUrl}" alt="" class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />`
      : `<div class="absolute inset-0 opacity-20" style="background-image: linear-gradient(to right, rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.5) 1px, transparent 1px); background-size: 28px 28px;"></div>`;
    return `
      <article class="mkv-card group flex min-w-0 cursor-pointer flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl" data-preview-course="${course.id}" data-category="${course.category}" data-title="${course.title.toLowerCase()}">
        <div class="relative aspect-[4/3] overflow-hidden bg-gradient-to-br ${cardTopClass(course.cardStyle)} text-white">
          ${thumbnail}
          <div class="absolute inset-0 bg-slate-950/20"></div>
          <div class="relative z-10 flex h-full items-center justify-center p-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-cyan-100 ring-1 ring-white/20 md:h-16 md:w-16">
              <svg class="h-7 w-7 md:h-9 md:w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.4">${ICONS[course.icon] || ICONS.cube}</svg>
            </div>
          </div>
        </div>
        <div class="flex flex-1 flex-col bg-white p-2.5 md:p-4">
          <div class="flex items-start justify-between gap-2">
            <span class="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 md:text-xs">${escapeText(course.level)}</span>
            <span class="text-[10px] font-semibold text-slate-400 md:text-xs">${course.enrolledCount.toLocaleString()} students</span>
          </div>
          <h3 class="mt-2 line-clamp-2 text-xs font-extrabold leading-snug text-slate-900 md:text-base">${escapeText(course.title)}</h3>
          <p class="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-500 md:text-sm">${escapeText(course.description)}</p>
          <div class="mt-auto pt-3">
            <p class="mb-2 text-xs font-extrabold text-slate-900 md:text-base">${formatMoney(course.price, course.currency)}</p>
            ${enrollCta(course)}
          </div>
        </div>
      </article>
    `;
  }

  function renderCourses(courses) {
    const grid = document.getElementById("courses-grid");
    if (!grid) return;
    coursesCache = courses;
    grid.innerHTML = courses.length
      ? courses.map(courseCardMarkup).join("")
      : `<p class="col-span-full text-center text-slate-500 py-12">No courses match your search yet - try a different keyword or category.</p>`;
    bindPreviewButtons();
  }

  function groupSyllabusRows(rows) {
    const chapters = new Map();
    (rows || []).forEach((row) => {
      const title = row.chapter_title || "General";
      const order = Number(row.chapter_order || 1);
      if (!chapters.has(title)) chapters.set(title, { title, order, lessons: [] });
      chapters.get(title).lessons.push(row);
    });
    return [...chapters.values()]
      .sort((a, b) => a.order - b.order)
      .map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
      }));
  }

  function fallbackSyllabusRows(course) {
    return (course.lectures || []).map((lecture, index) => ({
      chapter_title: lecture.chapter_title || lecture.title || `Chapter ${index + 1}`,
      chapter_order: lecture.chapter_order || index + 1,
      title: lecture.lesson_title || lecture.title || `Lesson ${index + 1}`,
      description: lecture.description || "",
      sort_order: lecture.sort_order || 1,
    }));
  }

  function syllabusMarkup(course, rows) {
    const chapters = groupSyllabusRows(rows && rows.length ? rows : fallbackSyllabusRows(course));
    if (!chapters.length) {
      return `<p class="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">Detailed syllabus will be added soon.</p>`;
    }
    return `<div class="divide-y divide-slate-100 rounded-xl border border-slate-100">${chapters.map((chapter, index) => `
      <details class="group p-4" ${index === 0 ? "open" : ""}>
        <summary class="cursor-pointer list-none font-semibold text-slate-900">Chapter ${chapter.order}: ${escapeText(chapter.title)}</summary>
        <ol class="mt-3 space-y-2">
          ${chapter.lessons.map((lesson) => `
            <li class="rounded-lg bg-slate-50 px-3 py-2">
              <p class="text-sm font-semibold text-slate-800">Lesson ${escapeText(lesson.sort_order || "")}: ${escapeText(lesson.title || "Untitled lesson")}</p>
              ${lesson.description ? `<p class="mt-1 text-xs text-slate-500">${escapeText(lesson.description)}</p>` : ""}
            </li>
          `).join("")}
        </ol>
      </details>
    `).join("")}</div>`;
  }

  function courseObjectives(course) {
    return course.objectives && course.objectives.length
      ? course.objectives
      : (course.highlights && course.highlights.length ? course.highlights : ["Build practical portfolio-ready skills", "Complete structured lessons and assignments", "Prepare for real engineering workflows"]);
  }

  function courseSkills(course) {
    return course.skills && course.skills.length
      ? course.skills
      : [course.category, course.level, "Project workflow"].filter(Boolean);
  }

  async function loadCourseSyllabus(courseId) {
    if (!window.MKV_SUPABASE?.isConfigured) return [];
    const { data, error } = await window.MKV_SUPABASE.client.rpc("get_public_course_syllabus", {
      p_course_id: courseId,
    });
    if (error) {
      console.warn("Could not load course syllabus", error);
      return [];
    }
    return data || [];
  }

  function escapeText(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[char]);
  }

  async function openCoursePreview(courseId) {
    const course = coursesCache.find((item) => item.id === courseId);
    const modal = document.getElementById("course-preview-modal");
    const content = document.getElementById("course-preview-content");
    if (!course || !modal || !content) return;
    const syllabusId = `course-syllabus-${course.id}`;
    content.innerHTML = `
      <div class="relative min-h-60 bg-gradient-to-br ${cardTopClass(course.cardStyle)} p-6 text-white">
        ${course.thumbnailUrl ? `<img src="${course.thumbnailUrl}" alt="" class="absolute inset-0 h-full w-full object-cover" /><div class="absolute inset-0 bg-slate-950/50"></div>` : ""}
        <button type="button" data-close-course-preview class="absolute right-4 top-4 z-10 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/25">Close</button>
        <div class="relative z-10 max-w-2xl pt-16">
          <p class="font-technical text-xs uppercase tracking-widest text-cyan-100">${escapeText(course.category)}</p>
          <h2 class="mt-3 text-3xl font-extrabold tracking-tight">${escapeText(course.title)}</h2>
          <p class="mt-3 text-sm leading-relaxed text-slate-100">${escapeText(course.description)}</p>
        </div>
      </div>
      <div class="grid gap-6 p-6 lg:grid-cols-[1fr_280px]">
        <div class="space-y-6">
          <section>
            <h3 class="text-lg font-bold text-slate-900">Full Description</h3>
            <p class="mt-2 text-sm leading-relaxed text-slate-600">${escapeText(course.fullDescription || course.description)}</p>
          </section>
          <section>
            <h3 class="text-lg font-bold text-slate-900">Learning Objectives</h3>
            <ul class="mt-3 grid gap-2 sm:grid-cols-2">
              ${courseObjectives(course).map((item) => `<li class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeText(item)}</li>`).join("")}
            </ul>
          </section>
          <section>
            <h3 class="text-lg font-bold text-slate-900">Course Curriculum</h3>
            <div id="${syllabusId}" class="mt-4">${syllabusMarkup(course, [])}</div>
          </section>
          <section>
            <h3 class="text-lg font-bold text-slate-900">Skills To Be Gained</h3>
            <div class="mt-3 flex flex-wrap gap-2">
              ${courseSkills(course).map((skill) => `<span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">${escapeText(skill)}</span>`).join("")}
            </div>
          </section>
          <section class="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <h3 class="text-sm font-bold text-slate-900">Student Reviews</h3>
            <p class="mt-2 text-sm text-slate-500">${course.rating ? `${escapeText(course.rating)} average rating from students.` : "Student reviews and ratings will appear here when enabled."}</p>
          </section>
        </div>
        <aside class="rounded-xl border border-slate-100 bg-slate-50 p-5">
          <p class="text-xs font-semibold uppercase text-slate-400">Level</p>
          <p class="mt-1 font-bold text-slate-900">${escapeText(course.level)}</p>
          <p class="mt-4 text-xs font-semibold uppercase text-slate-400">Duration</p>
          <p class="mt-1 font-bold text-slate-900">${escapeText(course.duration)}</p>
          <p class="mt-4 text-xs font-semibold uppercase text-slate-400">Instructor</p>
          <p class="mt-1 text-sm text-slate-600">MKV Academy instructor team</p>
          <p class="mt-4 text-xs font-semibold uppercase text-slate-400">Students Enrolled</p>
          <p class="mt-1 font-bold text-slate-900">${course.enrolledCount.toLocaleString()}</p>
          <p class="mt-4 text-xs font-semibold uppercase text-slate-400">Prerequisites</p>
          <p class="mt-1 text-sm text-slate-600">${escapeText(course.prerequisites || "No strict prerequisites. Start at the listed difficulty level.")}</p>
          <p class="mt-4 text-xs font-semibold uppercase text-slate-400">Price</p>
          <p class="mt-1 text-2xl font-extrabold text-slate-900">${formatMoney(course.price, course.currency)}</p>
          <div class="mt-5">${enrollCta(course).replace(">Enroll<", ">Enroll Now<")}</div>
        </aside>
      </div>
    `;
    modal.classList.remove("hidden");
    content.querySelector("[data-close-course-preview]")?.addEventListener("click", closeCoursePreview);
    const syllabus = document.getElementById(syllabusId);
    if (syllabus && window.MKV_SUPABASE?.isConfigured) {
      syllabus.innerHTML = `<p class="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">Loading course chapters...</p>`;
      const rows = await loadCourseSyllabus(course.id);
      syllabus.innerHTML = syllabusMarkup(course, rows);
    }
  }

  function closeCoursePreview() {
    document.getElementById("course-preview-modal")?.classList.add("hidden");
  }

  function closeCheckout() {
    document.getElementById("course-checkout-modal")?.classList.add("hidden");
    checkoutState = { course: null, coupon: null, discount: 0 };
  }

  function checkoutTotal() {
    const price = Number(checkoutState.course?.price || 0);
    return Math.max(0, price - Number(checkoutState.discount || 0));
  }

  function checkoutMessage(message, type) {
    const el = document.getElementById("checkout-coupon-message");
    if (!el) return;
    el.textContent = message || "";
    el.className =
      "mt-3 text-sm rounded-lg px-3 py-2 " +
      (type === "success"
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
        : type === "error"
          ? "bg-red-50 text-red-700 border border-red-200"
          : "bg-slate-50 text-slate-500 border border-slate-100");
  }

  function renderCheckoutTotals() {
    const discount = document.getElementById("checkout-discount");
    const total = document.getElementById("checkout-total");
    if (discount) discount.textContent = `-${formatMoney(checkoutState.discount, checkoutState.course?.currency)}`;
    if (total) total.textContent = formatMoney(checkoutTotal(), checkoutState.course?.currency);
  }

  function openCheckout(courseId) {
    const course = coursesCache.find((item) => item.id === courseId);
    const modal = document.getElementById("course-checkout-modal");
    const content = document.getElementById("course-checkout-content");
    if (!course || !modal || !content) return;
    checkoutState = { course, coupon: null, discount: 0 };
    content.innerHTML = `
      <div class="border-b border-slate-100 p-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="font-technical text-xs uppercase tracking-widest text-brand-700">Checkout</p>
            <h2 class="mt-1 text-xl font-bold text-slate-900">${escapeText(course.title)}</h2>
            <p class="mt-1 text-sm text-slate-500">${escapeText(course.level)} - ${escapeText(course.duration)}</p>
          </div>
          <button type="button" data-close-checkout class="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">Close</button>
        </div>
      </div>
      <div class="p-5">
        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div class="flex items-center justify-between text-sm">
            <span class="text-slate-500">Course price</span>
            <span class="font-bold text-slate-900">${formatMoney(course.price, course.currency)}</span>
          </div>
          <div class="mt-2 flex items-center justify-between text-sm">
            <span class="text-slate-500">Discount</span>
            <span id="checkout-discount" class="font-bold text-emerald-600">-${formatMoney(0, course.currency)}</span>
          </div>
          <div class="mt-4 border-t border-slate-200 pt-4 flex items-center justify-between">
            <span class="font-bold text-slate-900">Total</span>
            <span id="checkout-total" class="text-2xl font-extrabold text-slate-900">${formatMoney(course.price, course.currency)}</span>
          </div>
        </div>
        <div class="mt-5">
          <label for="checkout-coupon-code" class="block text-sm font-semibold text-slate-700 mb-2">Coupon code</label>
          <div class="flex gap-2">
            <input id="checkout-coupon-code" autocomplete="off" placeholder="WELCOME20" class="min-w-0 flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600" />
            <button type="button" data-apply-checkout-coupon class="rounded-lg bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-200">Apply</button>
          </div>
          <p id="checkout-coupon-message" class="mt-3 hidden"></p>
        </div>
        <button type="button" data-confirm-checkout class="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-5 py-3 font-bold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700">Enroll Now</button>
      </div>
    `;
    modal.classList.remove("hidden");
    content.querySelector("[data-close-checkout]")?.addEventListener("click", closeCheckout);
    content.querySelector("[data-apply-checkout-coupon]")?.addEventListener("click", applyCheckoutCoupon);
    content.querySelector("[data-confirm-checkout]")?.addEventListener("click", startCheckout);
  }

  async function applyCheckoutCoupon() {
    const input = document.getElementById("checkout-coupon-code");
    const btn = document.querySelector("[data-apply-checkout-coupon]");
    const code = (input?.value || "").trim().toUpperCase();
    checkoutState.coupon = null;
    checkoutState.discount = 0;
    renderCheckoutTotals();
    if (!code) {
      checkoutMessage("Enter a coupon code to apply it.", "error");
      return;
    }
    if (!window.MKV_SUPABASE?.isConfigured) {
      checkoutMessage("Coupon validation is available when Supabase is configured.", "error");
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Checking...";
    }
    const { data, error } = await window.MKV_SUPABASE.client
      .from("coupons")
      .select("code, discount_type, discount_value, max_redemptions, redeemed_count, expires_at, is_active")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Apply";
    }
    const expired = data?.expires_at && new Date(data.expires_at).getTime() < Date.now();
    const maxed = data?.max_redemptions && Number(data.redeemed_count || 0) >= Number(data.max_redemptions);
    if (error || !data || expired || maxed) {
      checkoutMessage("This coupon is invalid, expired, or fully redeemed.", "error");
      return;
    }
    const price = Number(checkoutState.course.price || 0);
    const rawDiscount = data.discount_type === "percent"
      ? (price * Number(data.discount_value || 0)) / 100
      : Number(data.discount_value || 0);
    checkoutState.coupon = data.code;
    checkoutState.discount = Math.min(price, Math.max(0, rawDiscount));
    renderCheckoutTotals();
    checkoutMessage(`${data.code} applied. Your price has been updated.`, "success");
  }

  async function startCheckout(event) {
    const btn = event.currentTarget;
    if (!checkoutState.course) return;
    btn.disabled = true;
    btn.textContent = "Opening checkout...";
    const { data, error } = await window.MKV_SUPABASE.client.functions.invoke("create-flutterwave-checkout", {
      body: { course_id: checkoutState.course.id, coupon_code: checkoutState.coupon || "" },
    });
    btn.disabled = false;
    btn.textContent = "Enroll Now";

    if (error || !data || !data.payment_link) {
      checkoutMessage((error && error.message) || (data && data.error) || "Could not start checkout.", "error");
      return;
    }
    window.location.href = data.payment_link;
  }

  function bindPreviewButtons() {
    document.querySelectorAll("[data-preview-course]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        if (event.target.closest("[data-start-checkout]")) return;
        openCoursePreview(btn.getAttribute("data-preview-course"));
      });
    });
  }

  document.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-start-checkout]");
    if (!btn) return;

    if (!window.MKV_CURRENT_USER) {
      window.location.href = "students.html";
      return;
    }

    openCheckout(btn.getAttribute("data-course-id"));
  });

  function populateCategoryFilter(courses) {
    const select = document.getElementById("course-category-filter");
    if (!select) return;
    const categories = ["All Categories", ...new Set(courses.map((c) => c.category))];
    select.innerHTML = categories
      .map((cat) => `<option value="${cat === "All Categories" ? "" : cat}">${cat}</option>`)
      .join("");
  }

  function initCourseControls(allCourses) {
    const searchInput = document.getElementById("course-search");
    const categorySelect = document.getElementById("course-category-filter");

    function applyFilters() {
      const term = (searchInput && searchInput.value.trim().toLowerCase()) || "";
      const category = (categorySelect && categorySelect.value) || "";
      const filtered = allCourses.filter((c) => {
        const matchesTerm = !term || c.title.toLowerCase().includes(term) || c.description.toLowerCase().includes(term);
        const matchesCategory = !category || c.category === category;
        return matchesTerm && matchesCategory;
      });
      renderCourses(filtered);
    }

    searchInput && searchInput.addEventListener("input", applyFilters);
    categorySelect && categorySelect.addEventListener("change", applyFilters);
  }

  function bootstrap(courses) {
    const normalized = courses.map(normalizeCourse);
    renderCourses(normalized);
    populateCategoryFilter(normalized);
    initCourseControls(normalized);
  }

  function getCourseThumbnailUrl(course) {
    if (course.thumbnailUrl || course.thumbnail_url) return course.thumbnailUrl || course.thumbnail_url;
    if (!course.thumbnail_path || !window.MKV_SUPABASE?.client) return "";
    const { data } = window.MKV_SUPABASE.client.storage.from("course-thumbnails").getPublicUrl(course.thumbnail_path);
    return data?.publicUrl || "";
  }

  function normalizeCourse(course) {
    return {
      id: course.id,
      title: course.title || "Untitled Course",
      category: course.category || "MKV Academy",
      level: course.level || "All Levels",
      duration: course.duration || "Self-paced",
      badge: course.badge || "",
      cardStyle: course.cardStyle || course.card_style || "brand",
      icon: course.icon || "cube",
      paymentLink: course.paymentLink || course.payment_link || "",
      thumbnailUrl: getCourseThumbnailUrl(course),
      description: course.description || "A practical MKV Academy course with private lessons and assignments.",
      fullDescription: course.full_description || course.fullDescription || course.description || "",
      highlights: course.highlights || [],
      objectives: course.objectives || course.learning_objectives || [],
      skills: course.skills || course.skills_gained || [],
      prerequisites: course.prerequisites || "",
      rating: course.rating || course.average_rating || "",
      enrolledCount: Number(course.enrolled_count || course.enrolledCount || course.students_enrolled || 0),
      price: course.price ?? null,
      currency: course.currency || "NGN",
      lectures: course.lectures || [],
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("courses-grid");
    if (!grid) return;

    if (window.MKV_SUPABASE && window.MKV_SUPABASE.isConfigured) {
      window.MKV_SUPABASE.client
        .from("courses")
        .select("*")
        .eq("is_active", true)
        .order("title", { ascending: true })
        .then(({ data, error }) => {
          if (error || !data || !data.length) throw error || new Error("No Supabase courses yet");
          bootstrap(data);
        })
        .catch(() => loadFallbackCourses());
      return;
    }

    loadFallbackCourses();
  });

  document.addEventListener("click", (event) => {
    const modal = document.getElementById("course-preview-modal");
    if (modal && event.target === modal) closeCoursePreview();
    const checkoutModal = document.getElementById("course-checkout-modal");
    if (checkoutModal && event.target === checkoutModal) closeCheckout();
  });

  function loadFallbackCourses() {
    fetch("data/courses.json")
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((data) => bootstrap(data))
      .catch(() => bootstrap(FALLBACK_COURSES));
  }
})();
