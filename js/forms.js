/* ==========================================================================
   MKV Academy - Forms
   Lightweight client-side validation + success/error UI feedback.
   The current static flow simulates submission feedback until a production
   form endpoint is connected.
   ========================================================================== */

(function () {
  const cfg = window.MKV_SUPABASE_CONFIG || {};
  const COMPANY_EMAIL = cfg.COMPANY_EMAIL || "mkvconsultingofficial@gmail.com";
  const WHATSAPP_URL = cfg.WHATSAPP_URL || "https://wa.link/qnw9ai";

  function showFormMessage(container, message, type) {
    let msgEl = container.querySelector("[data-form-message]");
    if (!msgEl) {
      msgEl = document.createElement("p");
      msgEl.setAttribute("data-form-message", "");
      msgEl.className = "mt-4 text-sm rounded-lg px-4 py-3";
      container.appendChild(msgEl);
    }
    msgEl.textContent = message;
    msgEl.className =
      "mt-4 text-sm rounded-lg px-4 py-3 " +
      (type === "success"
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
        : "bg-red-50 text-red-700 border border-red-200");
  }

  function fieldError(field, message) {
    field.classList.add("border-red-400");
    field.setAttribute("aria-invalid", "true");
    let err = field.parentElement.querySelector("[data-field-error]");
    if (!err) {
      err = document.createElement("p");
      err.setAttribute("data-field-error", "");
      err.className = "mt-1.5 text-xs text-red-600";
      field.insertAdjacentElement("afterend", err);
    }
    err.textContent = message;
  }

  function clearFieldError(field) {
    field.classList.remove("border-red-400");
    field.removeAttribute("aria-invalid");
    const err = field.parentElement.querySelector("[data-field-error]");
    if (err) err.remove();
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validateForm(form) {
    let valid = true;
    form.querySelectorAll("[required]").forEach((field) => {
      clearFieldError(field);
      if (!field.value.trim()) {
        fieldError(field, "This field is required.");
        valid = false;
      } else if (field.type === "email" && !isValidEmail(field.value.trim())) {
        fieldError(field, "Enter a valid email address.");
        valid = false;
      }
    });
    return valid;
  }

  function buildWhatsAppMessage(form) {
    const formData = new FormData(form);
    const lines = ["Hello MKV Academy, I just submitted this message:"];
    formData.forEach((value, key) => {
      if (String(value || "").trim()) lines.push(`${key}: ${value}`);
    });
    return `${WHATSAPP_URL}?text=${encodeURIComponent(lines.join("\n"))}`;
  }

  async function saveLead(form) {
    if (!window.MKV_SUPABASE || !window.MKV_SUPABASE.isConfigured) return;
    const formData = new FormData(form);
    const payload = {
      source: form.getAttribute("data-form-source") || (form.querySelector("textarea") ? "contact" : "newsletter"),
      name: formData.get("name") || "",
      email: formData.get("email") || "",
      reason: formData.get("reason") || "",
      message: formData.get("message") || "",
      notify_email: COMPANY_EMAIL,
    };
    const { data, error } = await window.MKV_SUPABASE.client.from("lead_submissions").insert(payload).select("id").single();
    if (error) throw error;
    if (data?.id) {
      await window.MKV_SUPABASE.client.functions.invoke("send-lead-notification", {
        body: { lead_id: data.id },
      });
    }
  }

  function initForm(form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validateForm(form)) return;

      const submitBtn = form.querySelector('[type="submit"]');
      const originalLabel = submitBtn ? submitBtn.textContent : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }

      saveLead(form)
        .catch((error) => {
          console.warn("Lead capture failed:", error);
        })
        .finally(() => {
        showFormMessage(form, `Thanks - your details were captured. You can also reach us at ${COMPANY_EMAIL}.`, "success");
        if (form.querySelector("textarea")) {
          window.location.href = buildWhatsAppMessage(form);
        }
        form.reset();
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        }
      });
    });

    form.querySelectorAll("input, textarea, select").forEach((field) => {
      field.addEventListener("input", () => clearFieldError(field));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-validate-form]").forEach(initForm);
  });
})();
