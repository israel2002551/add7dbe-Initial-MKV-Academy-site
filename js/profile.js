/* ==========================================================================
   MKV Academy - Profile Setup
   ========================================================================== */

(function () {
  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[char]);
  }

  function displayName(user) {
    return user?.profile?.username || user?.profile?.full_name || user?.email || "Student";
  }

  function initials(user) {
    return displayName(user).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "MK";
  }

  function renderAvatar(user, previewUrl) {
    const wrap = document.getElementById("profile-avatar-preview");
    if (!wrap || !user) return;
    const image = previewUrl || user.profile?.avatar_url || "";
    wrap.innerHTML = image
      ? `<img src="${image}" alt="" class="h-full w-full rounded-full object-cover" />`
      : `<span class="flex h-full w-full items-center justify-center rounded-full bg-brand-600 text-2xl font-extrabold text-white">${initials(user)}</span>`;
  }

  function setStatus(message, type) {
    const el = document.getElementById("profile-status");
    if (!el) return;
    el.textContent = message;
    el.className =
      "text-sm rounded-lg px-4 py-3 " +
      (type === "success"
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
        : "bg-red-50 text-red-700 border border-red-200");
  }

  async function usernameIsAvailable(username, userId) {
    const { data, error } = await window.MKV_SUPABASE.client
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return !data;
  }

  async function uploadAvatar(userId, file) {
    if (!file) return "";
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const path = `${userId}/avatar-${Date.now()}.${extension}`;
    const { error } = await window.MKV_SUPABASE.client.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: true });
    if (error) {
      if (String(error.message || "").toLowerCase().includes("bucket not found")) {
        throw new Error("Avatar storage is not ready. Run database/upgrade-profile-presence.sql in Supabase, then try again.");
      }
      throw error;
    }
    const { data } = window.MKV_SUPABASE.client.storage.from("avatars").getPublicUrl(path);
    return data?.publicUrl || "";
  }

  function fillForm(user) {
    const form = document.getElementById("profile-form");
    if (!form || !user) return;
    form.elements.username.value = user.profile?.username || "";
    form.elements.full_name.value = user.profile?.full_name || user.user_metadata?.full_name || "";
    renderAvatar(user);
  }

  function bindForm() {
    const form = document.getElementById("profile-form");
    if (!form) return;

    form.elements.avatar?.addEventListener("change", () => {
      const file = form.elements.avatar.files?.[0];
      if (file) renderAvatar(window.MKV_CURRENT_USER, URL.createObjectURL(file));
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const user = window.MKV_CURRENT_USER;
      if (!user || !window.MKV_SUPABASE?.isConfigured) {
        setStatus("Supabase must be configured before profiles can be saved.", "error");
        return;
      }

      const username = String(form.elements.username.value || "").trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        setStatus("Choose a username with 3-24 letters, numbers, or underscores.", "error");
        return;
      }

      const submit = form.querySelector('button[type="submit"]');
      if (submit) {
        submit.disabled = true;
        submit.textContent = "Saving...";
      }

      try {
        const available = await usernameIsAvailable(username, user.id);
        if (!available) {
          setStatus("That username is already taken. Choose another one.", "error");
          return;
        }
        const avatarFile = form.elements.avatar.files?.[0];
        const avatarUrl = avatarFile ? await uploadAvatar(user.id, avatarFile) : user.profile?.avatar_url || "";
        const payload = {
          id: user.id,
          email: user.email,
          username,
          full_name: String(form.elements.full_name.value || "").trim(),
          avatar_url: avatarUrl || null,
          role: user.profile?.role || "student",
        };
        const { error } = await window.MKV_SUPABASE.client.from("profiles").upsert(payload);
        if (error) throw error;
        user.profile = { ...(user.profile || {}), ...payload };
        document.dispatchEvent(new CustomEvent("mkv:auth-updated", { detail: { user } }));
        setStatus("Profile saved. You can continue to the Student Portal.", "success");
      } catch (error) {
        setStatus(escapeHtml(error.message || "Could not save profile."), "error");
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = "Save Profile";
        }
      }
    });
  }

  document.addEventListener("mkv:auth-updated", (event) => fillForm(event.detail.user));
  document.addEventListener("DOMContentLoaded", bindForm);
})();
