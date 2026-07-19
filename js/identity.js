/* ==========================================================================
   MKV Academy - Student Login (Supabase Auth)
   Handles login, signup, logout, profile lookup, and gated pages.
   ========================================================================== */

(function () {
  const LOCAL_PREVIEW_USER = {
    id: "local-preview-user",
    email: "preview@local",
    user_metadata: { full_name: "Preview Student" },
    profile: { role: "student", full_name: "Preview Student" },
  };

  function isLocalPreview() {
    return (
      window.location.protocol === "file:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    );
  }

  function displayName(user) {
    if (!user) return "";
    return (
      (user.profile && user.profile.full_name) ||
      (user.user_metadata && user.user_metadata.full_name) ||
      user.email ||
      "Student"
    );
  }

  function updateAuthUI(user) {
    window.MKV_CURRENT_USER = user;

    document.querySelectorAll("[data-auth-logged-out]").forEach((el) => el.classList.toggle("hidden", !!user));
    document.querySelectorAll("[data-auth-logged-in]").forEach((el) => el.classList.toggle("hidden", !user));
    document.querySelectorAll("[data-auth-admin]").forEach((el) => {
      const role = user && user.profile && user.profile.role;
      el.classList.toggle("hidden", !(role === "admin" || role === "owner"));
    });
    document.querySelectorAll("[data-auth-instructor]").forEach((el) => {
      const role = user && user.profile && user.profile.role;
      el.classList.toggle("hidden", !(role === "instructor" || role === "admin" || role === "owner"));
    });
    document.querySelectorAll("[data-auth-name]").forEach((el) => {
      if (user) el.textContent = displayName(user);
    });

    if (document.body.hasAttribute("data-requires-login")) {
      const gate = document.getElementById("login-gate");
      const content = document.getElementById("gated-content");
      if (user) {
        if (gate) gate.classList.add("hidden");
        if (content) content.classList.remove("hidden");
      } else {
        if (gate) gate.classList.remove("hidden");
        if (content) content.classList.add("hidden");
      }
    }

    document.dispatchEvent(new CustomEvent("mkv:auth-updated", { detail: { user } }));
  }

  function showAuthMessage(message, type) {
    const target = document.querySelector("[data-auth-message]");
    if (!target) {
      if (type === "error") window.alert(message);
      return;
    }
    target.textContent = message;
    target.className =
      "mt-4 text-sm rounded-lg px-4 py-3 " +
      (type === "success"
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
        : "bg-red-50 text-red-700 border border-red-200");
  }

  function openAuthPanel(mode) {
    const panel = document.getElementById("auth-panel");
    if (!panel) {
      window.location.href = "students.html";
      return;
    }
    panel.classList.remove("hidden");
    const loginTab = panel.querySelector('[data-auth-tab="login"]');
    const signupTab = panel.querySelector('[data-auth-tab="signup"]');
    const loginForm = panel.querySelector('[data-auth-form="login"]');
    const signupForm = panel.querySelector('[data-auth-form="signup"]');
    const isSignup = mode === "signup";

    loginTab && loginTab.classList.toggle("bg-brand-600", !isSignup);
    loginTab && loginTab.classList.toggle("text-white", !isSignup);
    loginTab && loginTab.classList.toggle("bg-slate-100", isSignup);
    loginTab && loginTab.classList.toggle("text-slate-600", isSignup);
    signupTab && signupTab.classList.toggle("bg-brand-600", isSignup);
    signupTab && signupTab.classList.toggle("text-white", isSignup);
    signupTab && signupTab.classList.toggle("bg-slate-100", !isSignup);
    signupTab && signupTab.classList.toggle("text-slate-600", !isSignup);
    loginForm && loginForm.classList.toggle("hidden", isSignup);
    signupForm && signupForm.classList.toggle("hidden", !isSignup);
  }

  async function refreshUser() {
    const supa = window.MKV_SUPABASE;
    if (!supa || !supa.isConfigured) {
      updateAuthUI(isLocalPreview() ? LOCAL_PREVIEW_USER : null);
      return;
    }

    const { user } = await supa.getCurrentUser();
    if (!user) {
      updateAuthUI(null);
      return;
    }

    const profileResult = await supa.getProfile(user.id);
    user.profile = profileResult.data || {
      role: "student",
      full_name: user.user_metadata && user.user_metadata.full_name,
    };
    updateAuthUI(user);
  }

  function bindTriggers() {
    document.querySelectorAll("[data-login-trigger]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openAuthPanel("login");
      });
    });

    document.querySelectorAll("[data-signup-trigger]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openAuthPanel("signup");
      });
    });

    document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
      btn.addEventListener("click", () => openAuthPanel(btn.getAttribute("data-auth-tab")));
    });

    document.querySelectorAll("[data-logout-trigger]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (window.MKV_SUPABASE && window.MKV_SUPABASE.client) {
          await window.MKV_SUPABASE.client.auth.signOut();
        }
        updateAuthUI(null);
        if (document.body.hasAttribute("data-requires-login")) window.location.href = "index.html";
      });
    });
  }

  function bindForms() {
    document.querySelectorAll('[data-auth-form="login"]').forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!window.MKV_SUPABASE || !window.MKV_SUPABASE.client) {
          showAuthMessage(window.MKV_SUPABASE ? window.MKV_SUPABASE.missingConfigMessage : "Supabase is not loaded.", "error");
          return;
        }
        const formData = new FormData(form);
        const { error } = await window.MKV_SUPABASE.client.auth.signInWithPassword({
          email: formData.get("email"),
          password: formData.get("password"),
        });
        if (error) {
          showAuthMessage(error.message, "error");
          return;
        }
        showAuthMessage("Login successful. Opening your dashboard...", "success");
        await refreshUser();
      });
    });

    document.querySelectorAll('[data-auth-form="signup"]').forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!window.MKV_SUPABASE || !window.MKV_SUPABASE.client) {
          showAuthMessage(window.MKV_SUPABASE ? window.MKV_SUPABASE.missingConfigMessage : "Supabase is not loaded.", "error");
          return;
        }
        const formData = new FormData(form);
        const fullName = formData.get("full_name");
        const email = formData.get("email");
        const password = formData.get("password");
        const { data, error } = await window.MKV_SUPABASE.client.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) {
          showAuthMessage(error.message, "error");
          return;
        }
        if (data.user) {
          await window.MKV_SUPABASE.client.from("profiles").upsert({
            id: data.user.id,
            email,
            full_name: fullName,
            role: "student",
          });
        }
        showAuthMessage("Account created. Check your email if confirmation is enabled, then log in.", "success");
        openAuthPanel("login");
      });
    });
  }

  function initAuth() {
    bindTriggers();
    bindForms();
    refreshUser();

    if (window.MKV_SUPABASE && window.MKV_SUPABASE.client) {
      window.MKV_SUPABASE.client.auth.onAuthStateChange(() => refreshUser());
    }

    const banner = document.getElementById("preview-mode-banner");
    if (banner && (!window.MKV_SUPABASE || !window.MKV_SUPABASE.isConfigured) && isLocalPreview()) {
      banner.classList.remove("hidden");
    }
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(initAuth, 0));
})();
