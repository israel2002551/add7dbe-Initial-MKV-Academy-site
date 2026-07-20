/* ==========================================================================
   MKV Academy - Components
   Reusable markup rendered from JS template functions and injected into
   shared containers (e.g. <div id="navbar"></div>) on every page.
   This keeps navbar/footer/cards defined in exactly one place, while still
   letting every page be plain static HTML that works without a build step
   or local server (no fetch()/CORS issues when opened directly).

   To edit the navbar or footer site-wide: edit the functions below only.
   ========================================================================== */

const MKV_NAV_LINKS = [
  { label: "Home", href: "index.html" },
  { label: "Courses", href: "courses.html" },
  { label: "Services", href: "services.html" },
  { label: "About", href: "about.html" },
  { label: "Community", href: "community.html" },
  { label: "Chat", href: "chat.html" },
  { label: "Contact", href: "contact.html" },
];

const MKV_FOOTER_COLUMNS = [
  {
    heading: "Academy",
    links: [
      { label: "About MKV Academy", href: "about.html" },
      { label: "Founders", href: "founders.html" },
      { label: "Instructors", href: "instructors.html" },
      { label: "Courses", href: "courses.html" },
      { label: "Testimonials", href: "testimonials.html" },
    ],
  },
  {
    heading: "Consulting",
    links: [
      { label: "Engineering Services", href: "services.html" },
      { label: "Hardware Startups", href: "hardware-startups.html" },
      { label: "Manufacturers", href: "manufacturers.html" },
      { label: "Team Training", href: "services.html#team-training" },
    ],
  },
  {
    heading: "Community",
    links: [
      { label: "Community", href: "community.html" },
      { label: "Student Portal", href: "students.html" },
      { label: "Student Chat", href: "chat.html" },
      { label: "FAQ", href: "faq.html" },
      { label: "Contact Us", href: "contact.html" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "privacy.html" },
      { label: "Terms of Service", href: "terms.html" },
    ],
  },
];

/** Returns the current page's filename, defaulting to index.html for "/" */
function mkvCurrentPage() {
  const path = window.location.pathname.split("/").pop();
  return path === "" ? "index.html" : path;
}

function mkvRenderLogo() {
  return `
    <a href="index.html" class="flex items-center gap-3 group" aria-label="MKV Academy - Home">
      <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white font-extrabold font-technical text-sm tracking-tight shadow-lg shadow-brand-600/25 group-hover:bg-brand-700 transition-colors">
        MKV
      </span>
      <span class="text-lg font-extrabold tracking-tight text-slate-900">
        ACADEMY
      </span>
    </a>
  `;
}

function mkvRenderNavbar() {
  const current = mkvCurrentPage();
  const desktopLinks = MKV_NAV_LINKS.map((link) => {
    const isActive = link.href === current;
    return `
      <a href="${link.href}"
         class="relative text-sm font-medium transition-colors hover:text-brand-700 ${isActive ? "text-brand-700" : "text-slate-700"}"
         ${isActive ? 'aria-current="page"' : ""}>
        ${link.label}
        <span class="absolute -bottom-1.5 left-0 h-0.5 rounded-full bg-brand-600 transition-all ${isActive ? "w-full" : "w-0 group-hover:w-full"}"></span>
      </a>
    `;
  }).join("");

  const mobileLinks = MKV_NAV_LINKS.map((link) => {
    const isActive = link.href === current;
    return `
      <a href="${link.href}"
         class="block rounded-lg px-4 py-3 text-base font-medium ${isActive ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"}">
        ${link.label}
      </a>
    `;
  }).join("");

  return `
    <header id="site-navbar" class="fixed top-0 w-full z-50 h-20 bg-white/95 backdrop-blur-md shadow-sm">
      <div class="container-mkv h-full flex items-center justify-between">
        ${mkvRenderLogo()}

        <nav class="hidden lg:flex items-center gap-8" aria-label="Primary">
          ${desktopLinks}
        </nav>

        <div class="hidden lg:flex items-center gap-4">
          <button data-theme-toggle type="button" aria-label="Toggle dark mode"
                  class="h-10 w-10 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
            <svg data-theme-icon-light class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
            <svg data-theme-icon-dark class="w-5 h-5 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
          </button>

          <button data-login-trigger data-auth-logged-out type="button"
                  class="text-sm font-medium text-slate-700 hover:text-brand-700 transition-colors">
            Student Login
          </button>

          <div class="flex items-center gap-3">
            <a href="students.html" data-auth-logged-in class="hidden text-sm font-medium text-slate-700 hover:text-brand-700 transition-colors">
              My Portal
            </a>
            <a href="admin.html" data-auth-admin class="hidden text-sm font-medium text-slate-700 hover:text-brand-700 transition-colors">
              Admin
            </a>
            <a href="instructor.html" data-auth-instructor class="hidden text-sm font-medium text-slate-700 hover:text-brand-700 transition-colors">
              Instructor
            </a>
            <button data-logout-trigger data-auth-logged-in type="button" class="hidden text-sm text-slate-400 hover:text-slate-600 transition-colors" aria-label="Log out">
              Log Out
            </button>
          </div>

          <a href="contact.html"
             class="group inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl px-5 py-2.5 shadow-lg shadow-brand-600/25 hover:shadow-xl transition-all">
            Talk to Someone
            <svg class="w-4 h-4 icon-nudge" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>

        <button id="mobile-menu-toggle" type="button"
                class="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg text-slate-700 hover:bg-slate-100"
                aria-expanded="false" aria-controls="mobile-nav" aria-label="Toggle navigation menu">
          <svg id="icon-menu" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <svg id="icon-close" class="w-6 h-6 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div id="mobile-nav" class="lg:hidden bg-white border-t border-slate-100">
        <nav class="container-mkv py-3 space-y-1" aria-label="Mobile">
          ${mobileLinks}

          <button data-login-trigger data-auth-logged-out type="button"
                  class="block w-full text-left rounded-lg px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50">
            Student Login
          </button>
          <div data-auth-logged-in class="hidden">
            <a href="students.html" class="block rounded-lg px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50">
              My Portal
            </a>
            <a href="admin.html" data-auth-admin class="hidden block rounded-lg px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50">
              Admin Studio
            </a>
            <a href="instructor.html" data-auth-instructor class="hidden block rounded-lg px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50">
              Instructor
            </a>
            <button data-logout-trigger type="button" class="block w-full text-left rounded-lg px-4 py-3 text-base font-medium text-slate-400 hover:bg-slate-50">
              Log Out
            </button>
          </div>

          <a href="contact.html" class="block mt-2 text-center bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl px-5 py-3 shadow-lg shadow-brand-600/25 transition-all">
            Talk to Someone
          </a>
        </nav>
      </div>
    </header>
  `;
}


function mkvRenderFooter() {
  const columns = MKV_FOOTER_COLUMNS.map((col) => `
    <div>
      <h3 class="text-sm font-semibold text-white tracking-wide uppercase font-technical">${col.heading}</h3>
      <ul class="mt-4 space-y-3">
        ${col.links.map((l) => `<li><a href="${l.href}" class="text-slate-400 hover:text-white text-sm transition-colors">${l.label}</a></li>`).join("")}
      </ul>
    </div>
  `).join("");

  return `
    <footer class="bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900 text-white">
      <div class="container-mkv py-16 lg:py-20">
        <div class="grid sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10">
          <div class="sm:col-span-2 lg:col-span-1">
            <div class="flex items-center gap-3">
              <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-cyan-300 font-extrabold font-technical text-sm">MKV</span>
              <span class="text-lg font-extrabold tracking-tight">ACADEMY</span>
            </div>
            <p class="mt-4 text-sm text-slate-400 leading-relaxed">
              The educational arm of MKV Consulting - building Africa's next generation of practical, industry-ready engineers.
            </p>
            <div class="mt-5 inline-flex items-center gap-2 bg-brand-600/20 text-brand-100 border border-brand-600/30 px-3.5 py-1.5 rounded-full text-xs font-technical">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Admissions Open</span>
            </div>
          </div>
          ${columns}
        </div>

        <div class="section-divider opacity-10 my-10"></div>

        <div class="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <p>&copy; <span id="footer-year"></span> MKV Academy. A division of MKV Consulting. All rights reserved.</p>
          <div class="flex items-center gap-5">
            <a href="contact.html" class="hover:text-white transition-colors" aria-label="Contact MKV Academy">Contact</a>
            <a href="community.html" class="hover:text-white transition-colors" aria-label="Visit the MKV Academy community">Community</a>
            <a href="courses.html" class="hover:text-white transition-colors" aria-label="View MKV Academy courses">Courses</a>
            <a href="https://www.linkedin.com/company/mkv-series/" target="_blank" rel="noopener" class="hover:text-white transition-colors" aria-label="MKV Consulting on LinkedIn">
              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.32 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.1 20.45H3.54V9H7.1v11.45z"/></svg>
            </a>
            <a href="https://www.youtube.com/@MKVCONSULTING" target="_blank" rel="noopener" class="hover:text-white transition-colors" aria-label="MKV Consulting on YouTube">
              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.13C19.54 3.57 12 3.57 12 3.57s-7.54 0-9.4.5A3 3 0 0 0 .5 6.2 31.25 31.25 0 0 0 0 12a31.25 31.25 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.13c1.86.5 9.4.5 9.4.5s7.54 0 9.4-.5a3 3 0 0 0 2.1-2.13A31.25 31.25 0 0 0 24 12a31.25 31.25 0 0 0-.5-5.8zM9.6 15.57V8.43L15.82 12 9.6 15.57z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  `;
}

function mkvInjectComponents() {
  const navSlot = document.getElementById("navbar");
  const footerSlot = document.getElementById("footer");
  if (navSlot) navSlot.innerHTML = mkvRenderNavbar();
  if (footerSlot) footerSlot.innerHTML = mkvRenderFooter();

  const yearEl = document.getElementById("footer-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

document.addEventListener("DOMContentLoaded", mkvInjectComponents);
