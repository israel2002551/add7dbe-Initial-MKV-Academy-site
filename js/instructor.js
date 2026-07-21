/* MKV Academy - Instructor Dashboard */
(function () {
  let instructorCourses = [];

  function isInstructor(user) {
    const role = user && user.profile && user.profile.role;
    return role === "instructor" || role === "admin" || role === "owner";
  }

  function show(allowed) {
    document.getElementById("instructor-denied")?.classList.toggle("hidden", allowed);
    document.getElementById("instructor-workspace")?.classList.toggle("hidden", !allowed);
    document.getElementById("instructor-submissions-panel")?.classList.toggle("hidden", !allowed);
  }

  function message(text, type) {
    const el = document.getElementById("instructor-message");
    if (!el) return;
    el.textContent = text;
    el.className = "mt-4 text-sm rounded-lg px-4 py-3 " + (type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700");
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[char]);
  }

  async function loadCourses() {
    const user = window.MKV_CURRENT_USER;
    const select = document.getElementById("instructor-course-select");
    const list = document.getElementById("instructor-course-list");
    if (!user || !select || !list || !window.MKV_SUPABASE?.client) return;

    const role = user.profile && user.profile.role;
    const query = role === "admin" || role === "owner"
      ? window.MKV_SUPABASE.client.from("courses").select("id, title, description").order("title")
      : window.MKV_SUPABASE.client.from("course_instructors").select("courses(id, title, description)").eq("instructor_id", user.id);

    const { data, error } = await query;
    if (error) {
      list.innerHTML = `<p class="py-4 text-sm text-red-600">${error.message}</p>`;
      return;
    }

    instructorCourses = role === "admin" || role === "owner"
      ? data || []
      : (data || []).map((row) => row.courses).filter(Boolean);

    select.innerHTML = instructorCourses.map((course) => `<option value="${course.id}">${course.title}</option>`).join("");
    list.innerHTML = instructorCourses.length
      ? instructorCourses.map((course) => `<div class="py-4"><p class="font-semibold text-slate-900">${course.title}</p><p class="mt-1 text-sm text-slate-500">${course.description || ""}</p></div>`).join("")
      : `<p class="py-4 text-sm text-slate-400">No assigned courses yet.</p>`;
  }

  async function loadSubmissions() {
    const list = document.getElementById("instructor-submissions-list");
    if (!list || !window.MKV_SUPABASE?.client || !instructorCourses.length) return;
    const courseIds = instructorCourses.map((course) => course.id);
    const { data, error } = await window.MKV_SUPABASE.client
      .from("assignment_submissions")
      .select("id, user_id, course_id, file_bucket, file_path, note, status, grade, feedback, created_at, lessons(title)")
      .in("course_id", courseIds)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      list.innerHTML = `<p class="py-4 text-sm text-red-600">${error.message}</p>`;
      return;
    }
    list.innerHTML = (data || []).length
      ? data.map(submissionMarkup).join("")
      : `<p class="py-4 text-sm text-slate-400">No submissions yet.</p>`;
    bindSubmissionActions();
  }

  function submissionMarkup(submission) {
    const lesson = Array.isArray(submission.lessons) ? submission.lessons[0] : submission.lessons;
    return `
      <article class="py-5">
        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p class="font-semibold text-slate-900">${escapeHtml(lesson?.title || submission.course_id)}</p>
            <p class="mt-1 text-xs text-slate-400">${escapeHtml(submission.user_id)} - ${escapeHtml(submission.course_id)} - ${escapeHtml(submission.status)}</p>
            ${submission.note ? `<p class="mt-2 text-sm text-slate-600">${escapeHtml(submission.note)}</p>` : ""}
          </div>
          <button type="button" data-download-submission data-bucket="${escapeHtml(submission.file_bucket)}" data-path="${escapeHtml(submission.file_path)}" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg px-4 py-2">Download</button>
        </div>
        <form data-review-form="${submission.id}" class="mt-4 grid md:grid-cols-4 gap-3">
          <select name="status" class="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            ${["submitted", "reviewed", "needs_revision", "approved"].map((status) => `<option value="${status}" ${submission.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <input name="grade" value="${escapeHtml(submission.grade || "")}" placeholder="Grade / score" class="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input name="feedback" value="${escapeHtml(submission.feedback || "")}" placeholder="Feedback" class="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button type="submit" class="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Save Review</button>
        </form>
      </article>
    `;
  }

  function bindSubmissionActions() {
    document.querySelectorAll("[data-download-submission]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const { data, error } = await window.MKV_SUPABASE.signedDownloadUrl(
          btn.getAttribute("data-bucket"),
          btn.getAttribute("data-path"),
          3600
        );
        if (error) {
          window.alert(error.message);
          return;
        }
        window.open(data.signedUrl, "_blank", "noopener");
      });
    });

    document.querySelectorAll("[data-review-form]").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const { error } = await window.MKV_SUPABASE.client
          .from("assignment_submissions")
          .update({
            status: formData.get("status"),
            grade: formData.get("grade"),
            feedback: formData.get("feedback"),
            reviewed_by: window.MKV_CURRENT_USER && window.MKV_CURRENT_USER.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", form.getAttribute("data-review-form"));
        if (error) {
          message(error.message, "error");
          return;
        }
        message("Submission review saved.", "success");
        await loadSubmissions();
      });
    });
  }

  function bindQuizForm() {
    const form = document.getElementById("instructor-quiz-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = window.MKV_CURRENT_USER;
      const formData = new FormData(form);
      const { data: quiz, error } = await window.MKV_SUPABASE.client.from("quizzes").insert({
        course_id: formData.get("course_id"),
        title: formData.get("title"),
        pass_mark: Number(formData.get("pass_mark") || 70),
        created_by: user && user.id,
      }).select("id").single();
      if (error) {
        message(error.message, "error");
        return;
      }
      const questionText = String(formData.get("question") || "").trim();
      const optionA = String(formData.get("option_a") || "").trim();
      const optionB = String(formData.get("option_b") || "").trim();
      if (questionText && optionA && optionB) {
        const { data: question } = await window.MKV_SUPABASE.client.from("quiz_questions").insert({
          quiz_id: quiz.id,
          question: questionText,
          sort_order: 1,
        }).select("id").single();
        await window.MKV_SUPABASE.client.from("quiz_options").insert([
          { question_id: question.id, option_text: optionA, is_correct: true, sort_order: 1 },
          { question_id: question.id, option_text: optionB, is_correct: false, sort_order: 2 },
        ]);
      }
      form.reset();
      message("Quiz saved.", "success");
    });
  }

  async function init() {
    if (!document.getElementById("instructor-workspace")) return;
    const user = window.MKV_CURRENT_USER;
    if (!user || !window.MKV_SUPABASE?.isConfigured) {
      show(false);
      return;
    }
    if (!isInstructor(user)) {
      show(false);
      return;
    }
    document.getElementById("instructor-status").textContent = `Signed in as ${user.email}`;
    show(true);
    await loadCourses();
    await loadSubmissions();
  }

  document.addEventListener("mkv:auth-updated", init);
  document.addEventListener("DOMContentLoaded", () => {
    bindQuizForm();
    setTimeout(init, 0);
  });
})();
