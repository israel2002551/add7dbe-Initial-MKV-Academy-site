/* ==========================================================================
   MKV Academy - Admin Studio
   Course creation and lesson video/assignment uploads for Supabase.
   ========================================================================== */

(function () {
  let adminCourses = [];
  let selectedStudent = null;
  let selectedInstructor = null;

  function isAdmin(user) {
    const role = user && user.profile && user.profile.role;
    return role === "admin" || role === "owner";
  }

  function setMessage(message, type) {
    const el = document.getElementById("admin-message");
    if (!el) return;
    el.textContent = message;
    el.className =
      "mt-4 text-sm rounded-lg px-4 py-3 " +
      (type === "success"
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
        : "bg-red-50 text-red-700 border border-red-200");
  }

  function setStatus(message) {
    const el = document.getElementById("admin-status");
    if (el) el.textContent = message || "";
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

  function showWorkspace(allowed) {
    const denied = document.getElementById("admin-denied");
    const workspace = document.getElementById("admin-workspace");
    const lessons = document.getElementById("admin-lessons-panel");
    const landingVideos = document.getElementById("admin-landing-videos-panel");
    const coupons = document.getElementById("admin-coupons-panel");
    const students = document.getElementById("admin-students-panel");
    const instructors = document.getElementById("admin-instructors-panel");
    const submissions = document.getElementById("admin-submissions-panel");
    denied && denied.classList.toggle("hidden", allowed);
    workspace && workspace.classList.toggle("hidden", !allowed);
    lessons && lessons.classList.toggle("hidden", !allowed);
    landingVideos && landingVideos.classList.toggle("hidden", !allowed);
    coupons && coupons.classList.toggle("hidden", !allowed);
    students && students.classList.toggle("hidden", !allowed);
    instructors && instructors.classList.toggle("hidden", !allowed);
    submissions && submissions.classList.toggle("hidden", !allowed);
  }

  async function loadCourses() {
    const select = document.getElementById("admin-course-select");
    if (!select || !window.MKV_SUPABASE || !window.MKV_SUPABASE.client) return;

    const { data, error } = await window.MKV_SUPABASE.client
      .from("courses")
      .select("id, title")
      .order("title", { ascending: true });

    if (error) {
      select.innerHTML = `<option value="">${error.message}</option>`;
      return;
    }

    adminCourses = data || [];
    select.innerHTML = adminCourses
      .map((course) => `<option value="${course.id}">${course.title}</option>`)
      .join("");
  }

  async function loadLessons() {
    const list = document.getElementById("admin-lessons-list");
    if (!list || !window.MKV_SUPABASE || !window.MKV_SUPABASE.client) return;

    const { data, error } = await window.MKV_SUPABASE.client
      .from("lessons")
      .select("title, course_id, video_provider, video_path, stream_embed_url, assignment_path, created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      list.innerHTML = `<p class="py-4 text-sm text-red-600">${error.message}</p>`;
      return;
    }

    list.innerHTML = (data || []).length
      ? data
          .map(
            (lesson) => `
        <div class="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <p class="font-semibold text-slate-900">${lesson.title}</p>
            <p class="text-xs text-slate-400">${lesson.course_id}</p>
          </div>
          <div class="flex flex-wrap gap-2 text-xs">
            ${lesson.video_path ? `<span class="bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full">video saved</span>` : ""}
            ${lesson.stream_embed_url ? `<span class="bg-cyan-50 text-cyan-700 px-2.5 py-1 rounded-full">${lesson.video_provider} stream</span>` : ""}
            ${lesson.assignment_path ? `<span class="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">assignment saved</span>` : ""}
          </div>
        </div>`
          )
          .join("")
      : `<p class="py-4 text-sm text-slate-400">No lessons uploaded yet.</p>`;
  }

  async function loadLandingVideos() {
    const list = document.getElementById("admin-landing-videos-list");
    if (!list || !window.MKV_SUPABASE || !window.MKV_SUPABASE.client) return;

    const { data, error } = await window.MKV_SUPABASE.client
      .from("landing_videos")
      .select("*")
      .order("sort_order", { ascending: true })
      .limit(4);

    if (error) {
      list.innerHTML = `<p class="py-4 text-sm text-red-600">${error.message}</p>`;
      return;
    }

    list.innerHTML = (data || []).length
      ? data
          .map(
            (video) => `
        <div class="py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p class="font-semibold text-slate-900">${video.sort_order}. ${video.title}</p>
            <p class="mt-1 text-sm text-slate-500">${video.description || "No description"}</p>
            <p class="mt-1 text-xs text-slate-400">${video.video_path || video.video_url || "No video file"}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-technical ${video.is_active ? "text-emerald-600" : "text-slate-400"}">${video.is_active ? "active" : "inactive"}</span>
            <button type="button" data-toggle-landing-video="${video.id}" data-active="${video.is_active}" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-3 py-2">${video.is_active ? "Hide" : "Show"}</button>
          </div>
        </div>`
          )
          .join("")
      : `<p class="py-4 text-sm text-slate-400">No welcome videos uploaded yet.</p>`;

    list.querySelectorAll("[data-toggle-landing-video]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const active = btn.getAttribute("data-active") === "true";
        const { error: updateError } = await window.MKV_SUPABASE.client
          .from("landing_videos")
          .update({ is_active: !active })
          .eq("id", btn.getAttribute("data-toggle-landing-video"));
        if (updateError) window.alert(updateError.message);
        await loadLandingVideos();
      });
    });
  }

  async function countTable(table, filters) {
    let query = window.MKV_SUPABASE.client.from(table).select("*", { count: "exact", head: true });
    (filters || []).forEach(([col, op, val]) => {
      if (op === "eq") query = query.eq(col, val);
    });
    const { count } = await query;
    return count || 0;
  }

  async function loadAnalytics() {
    const grid = document.getElementById("admin-analytics-grid");
    if (!grid || !window.MKV_SUPABASE?.client) return;
    const [{ data: paidOrders }, students, enrollments, submissions, paymentEvents] = await Promise.all([
      window.MKV_SUPABASE.client.from("orders").select("amount").eq("status", "paid"),
      countTable("profiles", [["role", "eq", "student"]]),
      countTable("enrollments"),
      countTable("assignment_submissions"),
      countTable("payment_events"),
    ]);
    const revenue = (paidOrders || []).reduce((sum, order) => sum + Number(order.amount || 0), 0);
    const cards = [
      ["Revenue", `NGN ${revenue.toLocaleString()}`],
      ["Students", students],
      ["Enrollments", enrollments],
      ["Submissions", submissions],
      ["Payment Events", paymentEvents],
    ];
    grid.innerHTML = cards.map(([label, value]) => `<div class="rounded-lg border border-slate-100 bg-slate-50 p-4"><p class="text-xs font-technical text-slate-400 uppercase">${label}</p><p class="mt-2 text-2xl font-extrabold text-slate-900">${value}</p></div>`).join("");
  }

  async function loadCoupons() {
    const list = document.getElementById("admin-coupons-list");
    if (!list || !window.MKV_SUPABASE?.client) return;
    const { data, error } = await window.MKV_SUPABASE.client.from("coupons").select("*").order("created_at", { ascending: false });
    if (error) {
      list.innerHTML = `<p class="py-4 text-sm text-red-600">${error.message}</p>`;
      return;
    }
    list.innerHTML = (data || []).length
      ? data.map((c) => `<div class="py-4 flex items-center justify-between gap-4"><div><p class="font-semibold text-slate-900">${c.code}</p><p class="text-xs text-slate-400">${c.discount_value} ${c.discount_type} - ${c.redeemed_count}/${c.max_redemptions || "unlimited"}</p></div><span class="text-xs font-technical ${c.is_active ? "text-emerald-600" : "text-slate-400"}">${c.is_active ? "active" : "inactive"}</span></div>`).join("")
      : `<p class="py-4 text-sm text-slate-400">No coupons yet.</p>`;
  }

  async function uploadFile(bucket, courseId, file) {
    if (!file) return "";
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const cleanName = window.MKV_SUPABASE.slugify(file.name.replace(/\.[^.]+$/, ""));
    const path = `${courseId}/${Date.now()}-${cleanName}.${extension}`;
    const { error } = await window.MKV_SUPABASE.client.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    return path;
  }

  function bindCourseForm() {
    const form = document.getElementById("admin-course-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const formData = new FormData(form);
        const title = formData.get("title");
        const id = formData.get("id") || window.MKV_SUPABASE.slugify(title);
        const payload = {
          id,
          title,
          description: formData.get("description"),
          price: Number(formData.get("price") || 0),
          currency: formData.get("currency") || "NGN",
          is_active: true,
        };

        const { error } = await window.MKV_SUPABASE.client.from("courses").upsert(payload);
        if (error) throw error;

        setMessage("Course saved.", "success");
        form.reset();
        await loadCourses();
      } catch (error) {
        setMessage(error.message, "error");
      }
    });
  }

  function bindLessonForm() {
    const form = document.getElementById("admin-lesson-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const user = window.MKV_CURRENT_USER;
        const formData = new FormData(form);
        const courseId = formData.get("course_id");
        const videoProvider = formData.get("video_provider") || "storage";
        const video = formData.get("video");
        const assignment = formData.get("assignment");

        setMessage("Uploading files. Please keep this tab open.", "success");

        const videoPath = video && video.size ? await uploadFile("course-videos", courseId, video) : "";
        const assignmentPath =
          assignment && assignment.size ? await uploadFile("course-assignments", courseId, assignment) : "";

        const { error } = await window.MKV_SUPABASE.client.from("lessons").insert({
          course_id: courseId,
          title: formData.get("title"),
          description: formData.get("description"),
          video_provider: videoProvider,
          video_bucket: "course-videos",
          video_path: videoPath,
          video_url: formData.get("stream_embed_url") || "",
          stream_embed_url: formData.get("stream_embed_url") || "",
          assignment_bucket: "course-assignments",
          assignment_path: assignmentPath,
          sort_order: Number(formData.get("sort_order") || 0),
          created_by: user && user.id,
        });
        if (error) throw error;

        setMessage("Lesson uploaded and saved.", "success");
        form.reset();
        await loadLessons();
      } catch (error) {
        setMessage(error.message, "error");
      }
    });
  }

  function bindLandingVideoForm() {
    const form = document.getElementById("admin-landing-video-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const user = window.MKV_CURRENT_USER;
        const formData = new FormData(form);
        const slot = Number(formData.get("sort_order") || 1);
        const video = formData.get("video");
        const poster = formData.get("poster");

        setMessage("Uploading welcome video. Please keep this tab open.", "success");

        const videoPath = video && video.size ? await uploadFile("welcome-videos", `landing/slot-${slot}`, video) : "";
        const posterPath = poster && poster.size ? await uploadFile("welcome-videos", `landing/slot-${slot}`, poster) : "";

        await window.MKV_SUPABASE.client
          .from("landing_videos")
          .update({ is_active: false })
          .eq("sort_order", slot);

        const { error } = await window.MKV_SUPABASE.client.from("landing_videos").insert({
          title: formData.get("title"),
          description: formData.get("description"),
          video_bucket: "welcome-videos",
          video_path: videoPath,
          poster_bucket: "welcome-videos",
          poster_path: posterPath,
          sort_order: slot,
          is_active: true,
          created_by: user && user.id,
        });
        if (error) throw error;

        setMessage("Welcome video uploaded.", "success");
        form.reset();
        await loadLandingVideos();
      } catch (error) {
        setMessage(error.message, "error");
      }
    });
  }

  function bindCouponForm() {
    const form = document.getElementById("admin-coupon-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const { error } = await window.MKV_SUPABASE.client.from("coupons").upsert({
        code: String(formData.get("code") || "").trim().toUpperCase(),
        discount_type: formData.get("discount_type"),
        discount_value: Number(formData.get("discount_value") || 0),
        max_redemptions: formData.get("max_redemptions") ? Number(formData.get("max_redemptions")) : null,
        is_active: true,
        created_by: window.MKV_CURRENT_USER && window.MKV_CURRENT_USER.id,
      }, { onConflict: "code" });
      if (error) {
        setMessage(error.message, "error");
        return;
      }
      form.reset();
      setMessage("Coupon saved.", "success");
      loadCoupons();
    });
  }

  async function loadStudents() {
    const list = document.getElementById("admin-students-list");
    if (!list || !window.MKV_SUPABASE || !window.MKV_SUPABASE.client) return;

    const term = (document.getElementById("admin-student-search")?.value || "").trim();
    let query = window.MKV_SUPABASE.client
      .from("profiles")
      .select("id, full_name, email, role, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

    const { data, error } = await query;
    if (error) {
      list.innerHTML = `<p class="p-4 text-sm text-red-600">${error.message}</p>`;
      return;
    }

    list.innerHTML = (data || []).length
      ? data
          .map(
            (student) => `
        <button type="button" data-student-id="${student.id}" class="w-full text-left p-4 hover:bg-slate-50">
          <span class="block text-sm font-semibold text-slate-900">${student.full_name || "Unnamed student"}</span>
          <span class="block mt-1 text-xs text-slate-400">${student.email || student.id}</span>
          <span class="inline-block mt-2 text-[11px] font-technical text-slate-400">${student.role}</span>
        </button>`
          )
          .join("")
      : `<p class="p-4 text-sm text-slate-400">No students found.</p>`;

    list.querySelectorAll("[data-student-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedStudent = (data || []).find((student) => student.id === btn.getAttribute("data-student-id"));
        renderStudentDetail();
      });
    });
  }

  async function renderStudentDetail() {
    const detail = document.getElementById("admin-student-detail");
    if (!detail || !selectedStudent) return;

    const { data: enrollments, error } = await window.MKV_SUPABASE.client
      .from("enrollments")
      .select("id, course_id, created_at")
      .eq("user_id", selectedStudent.id);

    if (error) {
      detail.innerHTML = `<p class="text-red-600">${error.message}</p>`;
      return;
    }

    const enrolledIds = new Set((enrollments || []).map((item) => item.course_id));
    detail.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h3 class="text-lg font-bold text-slate-900">${selectedStudent.full_name || "Unnamed student"}</h3>
          <p class="mt-1 text-sm text-slate-500">${selectedStudent.email || selectedStudent.id}</p>
        </div>
        <span class="text-xs font-technical text-slate-400">${selectedStudent.role}</span>
      </div>

      <div class="mt-6">
        <p class="text-sm font-semibold text-slate-900">Course Access</p>
        <div class="mt-3 space-y-2">
          ${adminCourses
            .map((course) => {
              const hasAccess = enrolledIds.has(course.id);
              return `
                <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
                  <span class="text-sm text-slate-700">${course.title}</span>
                  <button type="button" data-access-action="${hasAccess ? "revoke" : "grant"}" data-course-id="${course.id}"
                          class="${hasAccess ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-brand-600 text-white hover:bg-brand-700"} text-xs font-semibold rounded-lg px-3 py-2">
                    ${hasAccess ? "Revoke" : "Grant"}
                  </button>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;

    detail.querySelectorAll("[data-access-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const courseId = btn.getAttribute("data-course-id");
        const action = btn.getAttribute("data-access-action");
        if (action === "grant") {
          await grantAccess(selectedStudent.id, courseId);
        } else {
          await revokeAccess(selectedStudent.id, courseId);
        }
        await renderStudentDetail();
      });
    });
  }

  async function grantAccess(userId, courseId) {
    const { error } = await window.MKV_SUPABASE.client.from("enrollments").upsert({
      user_id: userId,
      course_id: courseId,
    });
    if (error) {
      window.alert(error.message);
      return;
    }
    await createNotification(userId, "Course access granted", "An MKV Academy admin has added a course to your dashboard.", "students.html");
  }

  async function revokeAccess(userId, courseId) {
    const { error } = await window.MKV_SUPABASE.client
      .from("enrollments")
      .delete()
      .eq("user_id", userId)
      .eq("course_id", courseId);
    if (error) window.alert(error.message);
  }

  async function createNotification(userId, title, body, actionUrl) {
    await window.MKV_SUPABASE.client.from("notifications").insert({
      user_id: userId,
      type: "admin",
      title,
      body,
      action_url: actionUrl || "",
    });
  }

  async function loadInstructorUsers() {
    const list = document.getElementById("admin-instructors-list");
    if (!list || !window.MKV_SUPABASE?.client) return;

    const term = (document.getElementById("admin-instructor-search")?.value || "").trim();
    let query = window.MKV_SUPABASE.client
      .from("profiles")
      .select("id, full_name, email, role, created_at")
      .order("created_at", { ascending: false })
      .limit(80);

    if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

    const { data, error } = await query;
    if (error) {
      list.innerHTML = `<p class="p-4 text-sm text-red-600">${escapeHtml(error.message)}</p>`;
      return;
    }

    const users = data || [];
    list.innerHTML = users.length
      ? users
          .map((user) => {
            const active = selectedInstructor && selectedInstructor.id === user.id;
            const canTeach = user.role === "instructor" || user.role === "admin" || user.role === "owner";
            return `
              <button type="button" data-instructor-user-id="${user.id}" class="w-full text-left p-4 hover:bg-slate-50 ${active ? "bg-brand-50" : ""}">
                <span class="block text-sm font-semibold text-slate-900">${escapeHtml(user.full_name || "Unnamed user")}</span>
                <span class="block mt-1 text-xs text-slate-400">${escapeHtml(user.email || user.id)}</span>
                <span class="inline-flex mt-2 items-center rounded-full px-2 py-0.5 text-[11px] font-technical ${canTeach ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}">${escapeHtml(user.role || "student")}</span>
              </button>
            `;
          })
          .join("")
      : `<p class="p-4 text-sm text-slate-400">No users found.</p>`;

    list.querySelectorAll("[data-instructor-user-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedInstructor = users.find((user) => user.id === btn.getAttribute("data-instructor-user-id"));
        renderInstructorDetail();
        loadInstructorUsers();
      });
    });
  }

  async function getInstructorAssignments(userId) {
    const { data, error } = await window.MKV_SUPABASE.client
      .from("course_instructors")
      .select("course_id")
      .eq("instructor_id", userId);
    if (error) throw error;
    return new Set((data || []).map((row) => row.course_id));
  }

  async function renderInstructorDetail() {
    const detail = document.getElementById("admin-instructor-detail");
    if (!detail || !selectedInstructor) return;

    const role = selectedInstructor.role || "student";
    const canTeach = role === "instructor" || role === "admin" || role === "owner";
    const protectedRole = role === "admin" || role === "owner";
    let assignedIds = new Set();

    try {
      assignedIds = await getInstructorAssignments(selectedInstructor.id);
    } catch (error) {
      detail.innerHTML = `<p class="text-red-600">${escapeHtml(error.message)}</p>`;
      return;
    }

    detail.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h3 class="text-lg font-bold text-slate-900">${escapeHtml(selectedInstructor.full_name || "Unnamed user")}</h3>
          <p class="mt-1 text-sm text-slate-500">${escapeHtml(selectedInstructor.email || selectedInstructor.id)}</p>
        </div>
        <span class="self-start rounded-full px-2.5 py-1 text-xs font-technical ${canTeach ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}">${escapeHtml(role)}</span>
      </div>

      <div class="mt-5 flex flex-col sm:flex-row gap-3">
        ${
          canTeach
            ? `<button type="button" data-instructor-role-action="remove" ${protectedRole ? "disabled" : ""} class="${protectedRole ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-red-50 text-red-700 hover:bg-red-100"} rounded-lg px-4 py-2 text-sm font-semibold">Remove Instructor Access</button>`
            : `<button type="button" data-instructor-role-action="promote" class="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2 text-sm font-semibold">Make Instructor</button>`
        }
        ${protectedRole ? `<p class="text-xs text-slate-400 sm:self-center">Admin and owner accounts already have instructor access.</p>` : ""}
      </div>

      <div class="mt-6">
        <p class="text-sm font-semibold text-slate-900">Assigned Courses</p>
        <div class="mt-3 space-y-2">
          ${adminCourses.length
            ? adminCourses
                .map((course) => {
                  const assigned = assignedIds.has(course.id);
                  return `
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
                      <span class="text-sm text-slate-700">${escapeHtml(course.title)}</span>
                      <button type="button" data-instructor-course-action="${assigned ? "unassign" : "assign"}" data-course-id="${course.id}" ${!canTeach ? "disabled" : ""}
                              class="${!canTeach ? "cursor-not-allowed bg-slate-100 text-slate-400" : assigned ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-brand-600 text-white hover:bg-brand-700"} text-xs font-semibold rounded-lg px-3 py-2">
                        ${assigned ? "Unassign" : "Assign"}
                      </button>
                    </div>
                  `;
                })
                .join("")
            : `<p class="py-3 text-sm text-slate-400">Create a course before assigning instructors.</p>`}
        </div>
      </div>
    `;

    detail.querySelector("[data-instructor-role-action]")?.addEventListener("click", async (event) => {
      const action = event.currentTarget.getAttribute("data-instructor-role-action");
      if (action === "promote") await updateInstructorRole(selectedInstructor.id, "instructor");
      if (action === "remove" && !protectedRole) await updateInstructorRole(selectedInstructor.id, "student");
    });

    detail.querySelectorAll("[data-instructor-course-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = btn.getAttribute("data-instructor-course-action");
        const courseId = btn.getAttribute("data-course-id");
        if (action === "assign") await assignInstructorCourse(selectedInstructor.id, courseId);
        if (action === "unassign") await unassignInstructorCourse(selectedInstructor.id, courseId);
        await renderInstructorDetail();
      });
    });
  }

  async function updateInstructorRole(userId, role) {
    const { error } = await window.MKV_SUPABASE.client
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    if (error) {
      window.alert(error.message);
      return;
    }
    selectedInstructor.role = role;
    await createNotification(
      userId,
      role === "instructor" ? "Instructor access granted" : "Instructor access updated",
      role === "instructor"
        ? "An MKV Academy admin has enabled your instructor dashboard."
        : "Your MKV Academy instructor access has been updated.",
      role === "instructor" ? "instructor.html" : "students.html"
    );
    await loadInstructorUsers();
    await renderInstructorDetail();
  }

  async function assignInstructorCourse(userId, courseId) {
    const { error } = await window.MKV_SUPABASE.client.from("course_instructors").upsert({
      course_id: courseId,
      instructor_id: userId,
    });
    if (error) {
      window.alert(error.message);
      return;
    }
    await createNotification(userId, "Course assigned", "A course has been added to your instructor dashboard.", "instructor.html");
  }

  async function unassignInstructorCourse(userId, courseId) {
    const { error } = await window.MKV_SUPABASE.client
      .from("course_instructors")
      .delete()
      .eq("course_id", courseId)
      .eq("instructor_id", userId);
    if (error) window.alert(error.message);
  }

  async function loadSubmissions() {
    const list = document.getElementById("admin-submissions-list");
    if (!list || !window.MKV_SUPABASE || !window.MKV_SUPABASE.client) return;

    const { data, error } = await window.MKV_SUPABASE.client
      .from("assignment_submissions")
      .select("id, user_id, course_id, lesson_id, file_bucket, file_path, note, status, grade, feedback, created_at, lessons(title)")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      list.innerHTML = `<p class="py-4 text-sm text-red-600">${error.message}</p>`;
      return;
    }

    list.innerHTML = (data || []).length
      ? data.map(submissionMarkup).join("")
      : `<p class="py-4 text-sm text-slate-400">No submissions yet.</p>`;

    list.querySelectorAll("[data-download-submission]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const { data: signed, error: signError } = await window.MKV_SUPABASE.signedDownloadUrl(
          btn.getAttribute("data-bucket"),
          btn.getAttribute("data-path"),
          3600
        );
        if (signError) {
          window.alert(signError.message);
          return;
        }
        window.open(signed.signedUrl, "_blank", "noopener");
      });
    });

    list.querySelectorAll("[data-review-form]").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const id = form.getAttribute("data-review-form");
        const userId = form.getAttribute("data-user-id");
        const { error: reviewError } = await window.MKV_SUPABASE.client
          .from("assignment_submissions")
          .update({
            status: formData.get("status"),
            grade: formData.get("grade"),
            feedback: formData.get("feedback"),
            reviewed_by: window.MKV_CURRENT_USER && window.MKV_CURRENT_USER.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (reviewError) {
          window.alert(reviewError.message);
          return;
        }
        await createNotification(userId, "Assignment reviewed", "Your assignment has been reviewed. Open your dashboard to see feedback.", "students.html");
        await loadSubmissions();
      });
    });
  }

  function submissionMarkup(submission) {
    const lesson = Array.isArray(submission.lessons) ? submission.lessons[0] : submission.lessons;
    return `
      <article class="py-5">
        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p class="font-semibold text-slate-900">${lesson?.title || submission.lesson_id}</p>
            <p class="mt-1 text-xs text-slate-400">${submission.user_id} - ${submission.course_id}</p>
            ${submission.note ? `<p class="mt-2 text-sm text-slate-600">${submission.note}</p>` : ""}
          </div>
          <button type="button" data-download-submission data-bucket="${submission.file_bucket}" data-path="${submission.file_path}" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg px-4 py-2">Download</button>
        </div>
        <form data-review-form="${submission.id}" data-user-id="${submission.user_id}" class="mt-4 grid md:grid-cols-4 gap-3">
          <select name="status" class="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            ${["submitted", "reviewed", "needs_revision", "approved"].map((status) => `<option value="${status}" ${submission.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <input name="grade" value="${submission.grade || ""}" placeholder="Grade" class="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input name="feedback" value="${submission.feedback || ""}" placeholder="Feedback" class="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-1" />
          <button type="submit" class="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Save Review</button>
        </form>
      </article>
    `;
  }

  async function initAdmin() {
    if (!document.getElementById("admin-workspace")) return;

    const user = window.MKV_CURRENT_USER;
    if (!user) {
      setStatus("");
      showWorkspace(false);
      return;
    }

    if (!window.MKV_SUPABASE || !window.MKV_SUPABASE.isConfigured) {
      setStatus("Supabase is not configured.");
      showWorkspace(false);
      return;
    }

    if (!isAdmin(user)) {
      setStatus(`Signed in as ${user.email || "student"}`);
      showWorkspace(false);
      return;
    }

    setStatus(`Signed in as ${user.email}`);
    showWorkspace(true);
    await loadCourses();
    await loadAnalytics();
    await loadLessons();
    await loadLandingVideos();
    await loadCoupons();
    await loadStudents();
    await loadInstructorUsers();
    await loadSubmissions();
  }

  document.addEventListener("mkv:auth-updated", initAdmin);
  document.addEventListener("DOMContentLoaded", () => {
    bindCourseForm();
    bindLessonForm();
    bindLandingVideoForm();
    bindCouponForm();
    const refresh = document.getElementById("admin-refresh");
    refresh && refresh.addEventListener("click", loadLessons);
    const refreshLandingVideos = document.getElementById("admin-refresh-landing-videos");
    refreshLandingVideos && refreshLandingVideos.addEventListener("click", loadLandingVideos);
    const refreshAnalytics = document.getElementById("admin-refresh-analytics");
    refreshAnalytics && refreshAnalytics.addEventListener("click", loadAnalytics);
    const refreshSubmissions = document.getElementById("admin-refresh-submissions");
    refreshSubmissions && refreshSubmissions.addEventListener("click", loadSubmissions);
    const studentSearch = document.getElementById("admin-student-search");
    studentSearch && studentSearch.addEventListener("input", () => loadStudents());
    const instructorSearch = document.getElementById("admin-instructor-search");
    instructorSearch && instructorSearch.addEventListener("input", () => loadInstructorUsers());
    setTimeout(initAdmin, 0);
  });
})();
