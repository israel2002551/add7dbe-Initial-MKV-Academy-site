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
      (user.profile && user.profile.username) ||
      (user.profile && user.profile.full_name) ||
      (user.user_metadata && user.user_metadata.full_name) ||
      user.email ||
      "Student"
    );
  }

  function avatarUrl(user) {
    return (user && user.profile && user.profile.avatar_url) || "";
  }

  function initials(user) {
    return displayName(user).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "MK";
  }

  function generateUsername(fullName, email) {
    const base = String(fullName || (email || "").split("@")[0] || "student")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 14) || "student";
    return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
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
    document.querySelectorAll("[data-auth-student]").forEach((el) => {
      const role = user && user.profile && user.profile.role;
      el.classList.toggle("hidden", role !== "student");
    });
    document.querySelectorAll("[data-auth-name]").forEach((el) => {
      if (user) el.textContent = displayName(user);
    });
    document.querySelectorAll("[data-auth-avatar]").forEach((el) => {
      if (!user) return;
      const image = avatarUrl(user);
      el.innerHTML = image
        ? `<img src="${image}" alt="" class="h-full w-full rounded-full object-cover" />`
        : `<span class="flex h-full w-full items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">${initials(user)}</span>`;
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

  async function markPresence(isOnline) {
    const user = window.MKV_CURRENT_USER;
    if (!user || !window.MKV_SUPABASE?.isConfigured) return;
    await window.MKV_SUPABASE.client
      .from("profiles")
      .update({ is_online: isOnline, last_active_at: new Date().toISOString() })
      .eq("id", user.id);
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

  function friendlyAuthError(error) {
    const message = error && error.message ? error.message : "Authentication failed.";
    const lower = message.toLowerCase();
    if (lower.includes("email not confirmed") || lower.includes("confirm")) {
      return "Email not confirmed. Open the confirmation link sent to your email, or disable email confirmation in Supabase Authentication settings while testing.";
    }
    if (lower.includes("invalid login credentials")) {
      return "Invalid email or password. Check the details and try again.";
    }
    return message;
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

  function resetRedirectUrl() {
    return window.location.href.split("#")[0];
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
          showAuthMessage(friendlyAuthError(error), "error");
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
        const username = generateUsername(fullName, email);
        const { data, error } = await window.MKV_SUPABASE.client.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, username } },
        });
        if (error) {
          showAuthMessage(friendlyAuthError(error), "error");
          return;
        }
        if (data.user) {
          await window.MKV_SUPABASE.client.from("profiles").upsert({
            id: data.user.id,
            email,
            full_name: fullName,
            username,
            role: "student",
          });
        }
        showAuthMessage("Account created. Set up your profile to continue.", "success");
        if (data.session) {
          window.location.href = "profile.html?setup=1";
          return;
        }
        openAuthPanel("login");
      });
    });
  }

  function bindPasswordReset() {
    document.querySelectorAll('[data-auth-form="login"]').forEach((form) => {
      if (form.querySelector("[data-password-reset-trigger]")) return;

      const row = document.createElement("div");
      row.className = "text-right";
      row.innerHTML = '<button type="button" data-password-reset-trigger class="text-sm font-semibold text-brand-700 hover:text-brand-900">Forgot password?</button>';
      const submit = form.querySelector('button[type="submit"]');
      if (submit) form.insertBefore(row, submit);
      else form.appendChild(row);

      row.querySelector("[data-password-reset-trigger]").addEventListener("click", async () => {
        if (!window.MKV_SUPABASE || !window.MKV_SUPABASE.client) {
          showAuthMessage(window.MKV_SUPABASE ? window.MKV_SUPABASE.missingConfigMessage : "Supabase is not loaded.", "error");
          return;
        }

        const emailInput = form.querySelector('input[name="email"]');
        const email = emailInput && emailInput.value.trim()
          ? emailInput.value.trim()
          : window.prompt("Enter the email address on your MKV Academy account.");
        if (!email) return;

        const { error } = await window.MKV_SUPABASE.client.auth.resetPasswordForEmail(email, {
          redirectTo: resetRedirectUrl(),
        });
        if (error) {
          showAuthMessage(friendlyAuthError(error), "error");
          return;
        }
        showAuthMessage("Password reset link sent. Check your email and follow the link to create a new password.", "success");
      });
    });
  }

  async function handlePasswordRecovery() {
    if (!window.MKV_SUPABASE || !window.MKV_SUPABASE.client) return;
    const newPassword = window.prompt("Enter your new password for MKV Academy.");
    if (!newPassword) return;
    if (newPassword.length < 6) {
      showAuthMessage("Password must be at least 6 characters.", "error");
      return;
    }
    const { error } = await window.MKV_SUPABASE.client.auth.updateUser({ password: newPassword });
    if (error) {
      showAuthMessage(friendlyAuthError(error), "error");
      return;
    }
    showAuthMessage("Password updated. You can continue with your account.", "success");
  }

  function initAuth() {
    bindTriggers();
    bindForms();
    bindPasswordReset();
    initPasswordToggles();
    refreshUser();
    setInterval(() => markPresence(true), 60000);
    window.addEventListener("beforeunload", () => markPresence(false));

    if (window.MKV_SUPABASE && window.MKV_SUPABASE.client) {
      window.MKV_SUPABASE.client.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") handlePasswordRecovery();
        refreshUser();
        setTimeout(() => markPresence(true), 500);
      });
    }

    const banner = document.getElementById("preview-mode-banner");
    if (banner && (!window.MKV_SUPABASE || !window.MKV_SUPABASE.isConfigured) && isLocalPreview()) {
      banner.classList.remove("hidden");
    }
  }

  function initPasswordToggles() {
    document.querySelectorAll('input[type="password"]').forEach((input) => {
      if (input.closest(".password-toggle-wrap")) return;
      const wrap = document.createElement("div");
      wrap.className = "password-toggle-wrap relative";
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      input.classList.add("pr-12");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "password-toggle-btn absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-brand-700";
      button.setAttribute("aria-label", "Show password");
      button.innerHTML = '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>';
      button.addEventListener("click", () => {
        const showing = input.type === "text";
        input.type = showing ? "password" : "text";
        button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      });
      wrap.appendChild(button);
    });
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(initAuth, 0));
})();
