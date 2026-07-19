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
      .select("id, user_id, course_id, note, status, grade, feedback, created_at, lessons(title)")
      .in("course_id", courseIds)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      list.innerHTML = `<p class="py-4 text-sm text-red-600">${error.message}</p>`;
      return;
    }
    list.innerHTML = (data || []).length
      ? data.map((s) => `<div class="py-4"><p class="font-semibold text-slate-900">${s.lessons?.title || s.course_id}</p><p class="mt-1 text-xs text-slate-400">${s.user_id} - ${s.status}</p><p class="mt-2 text-sm text-slate-600">${s.note || ""}</p></div>`).join("")
      : `<p class="py-4 text-sm text-slate-400">No submissions yet.</p>`;
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
      const { data: question } = await window.MKV_SUPABASE.client.from("quiz_questions").insert({
        quiz_id: quiz.id,
        question: formData.get("question"),
        sort_order: 1,
      }).select("id").single();
      if (question) {
        await window.MKV_SUPABASE.client.from("quiz_options").insert([
          { question_id: question.id, option_text: formData.get("option_a"), is_correct: true, sort_order: 1 },
          { question_id: question.id, option_text: formData.get("option_b"), is_correct: false, sort_order: 2 },
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
