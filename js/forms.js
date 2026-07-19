/* ==========================================================================
   MKV Academy - Forms
   Lightweight client-side validation + success/error UI feedback.
   The current static flow simulates submission feedback until a production
   form endpoint is connected.
   ========================================================================== */

(function () {
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

      setTimeout(() => {
        showFormMessage(form, "Thanks - your message has been received. Our team will be in touch shortly.", "success");
        form.reset();
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        }
      }, 900);
    });

    form.querySelectorAll("input, textarea, select").forEach((field) => {
      field.addEventListener("input", () => clearFieldError(field));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-validate-form]").forEach(initForm);
  });
})();
