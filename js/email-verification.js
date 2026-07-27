/* ==========================================================================
   MKV Academy - Email Verification Page
   ========================================================================== */

(function () {
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || "").trim());
  }

  function status(message, type) {
    const el = document.getElementById("verification-status");
    if (!el) return;
    el.textContent = message;
    el.className =
      "mt-4 text-sm rounded-lg px-4 py-3 " +
      (type === "success"
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
        : "bg-red-50 text-red-700 border border-red-200");
  }

  function verificationRedirectUrl() {
    if (window.location.protocol === "file:") return window.location.href.split(/[?#]/)[0];
    return `${window.location.origin}${window.location.pathname}`;
  }

  function pendingEmail() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("email") || "";
    try {
      return fromQuery || window.localStorage.getItem("mkv_pending_verification_email") || "";
    } catch (error) {
      return fromQuery;
    }
  }

  function rememberEmail(email) {
    try {
      window.localStorage.setItem("mkv_pending_verification_email", email);
    } catch (error) {
      console.warn("Could not store pending verification email", error);
    }
  }

  async function detectVerifiedSession() {
    if (!window.MKV_SUPABASE?.client) return;
    const { data } = await window.MKV_SUPABASE.client.auth.getSession();
    const user = data?.session?.user;
    if (!user || !(user.email_confirmed_at || user.confirmed_at)) return;
    const title = document.getElementById("verification-title");
    const copy = document.getElementById("verification-copy");
    if (title) title.textContent = "Email verified";
    if (copy) copy.textContent = "Your MKV Academy account is active. Continue to profile setup before entering the Student Portal.";
    status("Verification complete. You can continue to profile setup.", "success");
    const resend = document.getElementById("resend-verification");
    if (resend) {
      resend.textContent = "Continue to Profile Setup";
      resend.onclick = () => {
        window.location.href = "profile.html?setup=1";
      };
    }
  }

  async function resendVerification() {
    const input = document.getElementById("verification-email");
    const btn = document.getElementById("resend-verification");
    const email = String(input?.value || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      status("Enter a valid email address so we can resend the verification link.", "error");
      return;
    }
    if (!window.MKV_SUPABASE?.client) {
      status(window.MKV_SUPABASE?.missingConfigMessage || "Supabase is not configured.", "error");
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sending...";
    }
    const { error } = await window.MKV_SUPABASE.client.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: verificationRedirectUrl() },
    });
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Resend Verification Email";
    }
    if (error) {
      status(error.message || "Could not resend verification email.", "error");
      return;
    }
    rememberEmail(email);
    status("Verification email resent. Check your inbox and spam folder.", "success");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("verification-email");
    if (input) input.value = pendingEmail();
    document.getElementById("resend-verification")?.addEventListener("click", resendVerification);
    detectVerifiedSession();
  });
})();
