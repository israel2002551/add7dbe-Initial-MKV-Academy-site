/* ==========================================================================
   MKV Academy - Admin Studio
   Course creation and lesson video/assignment uploads for Supabase.
   ========================================================================== */

(function () {
  let adminCourses = [];
  let selectedStudent = null;
  let selectedInstructor = null;
  let referralEmailsCache = [];

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
    const referrals = document.getElementById("admin-referrals-panel");
    const students = document.getElementById("admin-students-panel");
    const instructors = document.getElementById("admin-instructors-panel");
    const submissions = document.getElementById("admin-submissions-panel");
    denied && denied.classList.toggle("hidden", allowed);
    workspace && workspace.classList.toggle("hidden", !allowed);
    lessons && lessons.classList.toggle("hidden", !allowed);
    landingVideos && landingVideos.classList.toggle("hidden", !allowed);
    coupons && coupons.classList.toggle("hidden", !allowed);
    referrals && referrals.classList.toggle("hidden", !allowed);
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
      .eq("is_active", true)
      .order("title", { ascending: true });

    if (error) {
      select.innerHTML = `<option value="">${error.message}</option>`;
      return;
    }

    adminCourses = data || [];
    select.innerHTML = adminCourses
      .map((course) => `<option value="${course.id}">${course.title}</option>`)
      .join("");
    renderCourseManager();
  }

  function renderCourseManager() {
    const list = document.getElementById("admin-courses-list");
    if (!list) return;
    list.innerHTML = adminCourses.length
      ? adminCourses.map((course) => `
        <div class="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p class="font-semibold text-slate-900">${escapeHtml(course.title)}</p>
            <p class="mt-1 text-xs text-slate-400">${escapeHtml(course.id)}</p>
          </div>
          <button type="button" data-delete-course="${course.id}" class="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg px-3 py-2">Delete Course</button>
        </div>
      `).join("")
      : `<p class="py-4 text-sm text-slate-400">No active courses yet.</p>`;
    list.querySelectorAll("[data-delete-course]").forEach((btn) => {
      btn.addEventListener("click", () => deleteCourse(btn.getAttribute("data-delete-course")));
    });
  }

  async function deleteCourse(courseId) {
    const course = adminCourses.find((item) => item.id === courseId);
    if (!courseId || !window.confirm(`Delete "${course?.title || courseId}" from courses, dropdowns, and student access?`)) return;
    try {
      const lessonIds = await lessonIdsForCourse(courseId);
      if (lessonIds.length) await window.MKV_SUPABASE.client.from("lesson_progress").delete().in("lesson_id", lessonIds);
      await window.MKV_SUPABASE.client.from("assignment_submissions").delete().eq("course_id", courseId);
      await window.MKV_SUPABASE.client.from("course_instructors").delete().eq("course_id", courseId);
      await window.MKV_SUPABASE.client.from("enrollments").delete().eq("course_id", courseId);
      await window.MKV_SUPABASE.client.from("lessons").delete().eq("course_id", courseId);
      const { error } = await window.MKV_SUPABASE.client.from("courses").delete().eq("id", courseId);
      if (error) {
        const { error: archiveError } = await window.MKV_SUPABASE.client.from("courses").update({ is_active: false }).eq("id", courseId);
        if (archiveError) throw archiveError;
        setMessage("Course had protected records, so it was removed from active dropdowns/catalog instead.", "success");
      } else {
        setMessage("Course deleted.", "success");
      }
      await loadCourses();
      await loadLessons();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  async function lessonIdsForCourse(courseId) {
    const { data } = await window.MKV_SUPABASE.client.from("lessons").select("id").eq("course_id", courseId);
    return (data || []).map((lesson) => lesson.id);
  }

  async function loadLessons() {
    const list = document.getElementById("admin-lessons-list");
    if (!list || !window.MKV_SUPABASE || !window.MKV_SUPABASE.client) return;

    const { data, error } = await window.MKV_SUPABASE.client
      .from("lessons")
      .select("id, title, course_id, chapter_title, chapter_order, description, video_provider, video_path, stream_embed_url, assignment_path, resource_path, sort_order, created_at")
      .order("course_id", { ascending: true })
      .order("chapter_order", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      list.innerHTML = `<p class="py-4 text-sm text-red-600">${error.message}</p>`;
      return;
    }

    list.innerHTML = (data || []).length
      ? groupedLessonMarkup(data || [])
      : `<p class="py-4 text-sm text-slate-400">No lessons uploaded yet.</p>`;

    list.querySelectorAll("[data-edit-lesson]").forEach((btn) => {
      btn.addEventListener("click", () => startLessonEdit((data || []).find((lesson) => lesson.id === btn.getAttribute("data-edit-lesson"))));
    });
    list.querySelectorAll("[data-delete-lesson]").forEach((btn) => {
      btn.addEventListener("click", async () => deleteLesson(btn.getAttribute("data-delete-lesson")));
    });
  }

  async function refreshLessonUpload() {
    await loadCourses();
    await loadLessons();
  }

  function groupedLessonMarkup(lessons) {
    const courses = new Map();
    lessons.forEach((lesson) => {
      const course = adminCourses.find((item) => item.id === lesson.course_id);
      const courseTitle = course ? course.title : lesson.course_id;
      const chapter = lesson.chapter_title || "General";
      const chapterOrder = Number(lesson.chapter_order || 1);
      if (!courses.has(courseTitle)) courses.set(courseTitle, new Map());
      const chapters = courses.get(courseTitle);
      if (!chapters.has(chapter)) chapters.set(chapter, { order: chapterOrder, rows: [] });
      chapters.get(chapter).rows.push(lesson);
    });

    return [...courses.entries()].map(([courseTitle, chapters]) => `
      <div class="py-5">
        <h3 class="font-bold text-slate-900">${escapeHtml(courseTitle)}</h3>
        <div class="mt-3 space-y-3">
          ${[...chapters.entries()].sort((a, b) => a[1].order - b[1].order).map(([chapter, group]) => `
            <div class="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p class="text-xs font-technical uppercase text-slate-400">Chapter ${group.order}: ${escapeHtml(chapter)}</p>
              <div class="mt-2 divide-y divide-slate-200">
                ${group.rows.map((lesson) => `
                  <div class="py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p class="font-semibold text-slate-900">${escapeHtml(lesson.title)}</p>
                      <p class="text-xs text-slate-400">Lesson ${lesson.sort_order || 0}</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 text-xs">
                      ${lesson.video_path ? `<span class="bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full">video saved</span>` : ""}
                      ${lesson.stream_embed_url ? `<span class="bg-cyan-50 text-cyan-700 px-2.5 py-1 rounded-full">${escapeHtml(lesson.video_provider)} stream</span>` : ""}
                      ${lesson.assignment_path ? `<span class="bg-white text-slate-600 px-2.5 py-1 rounded-full">assignment saved</span>` : ""}
                      ${lesson.resource_path ? `<span class="bg-white text-slate-600 px-2.5 py-1 rounded-full">resource saved</span>` : ""}
                      <button type="button" data-edit-lesson="${lesson.id}" class="bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg px-3 py-2">Edit</button>
                      <button type="button" data-delete-lesson="${lesson.id}" class="bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-lg px-3 py-2">Delete</button>
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");
  }

  function startLessonEdit(lesson) {
    const form = document.getElementById("admin-lesson-form");
    if (!form || !lesson) return;
    form.elements.lesson_id.value = lesson.id;
    form.elements.course_id.value = lesson.course_id;
    form.elements.title.value = lesson.title || "";
    form.elements.chapter_title.value = lesson.chapter_title || "";
    form.elements.chapter_order.value = lesson.chapter_order || 1;
    form.elements.description.value = lesson.description || "";
    form.elements.video_provider.value = lesson.video_provider || "storage";
    form.elements.stream_embed_url.value = lesson.stream_embed_url || "";
    form.elements.sort_order.value = lesson.sort_order || 0;
    document.getElementById("admin-lesson-cancel-edit")?.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteLesson(lessonId) {
    if (!lessonId || !window.confirm("Delete this lesson from the course overview?")) return;
    const { error } = await window.MKV_SUPABASE.client.from("lessons").delete().eq("id", lessonId);
    if (error) {
      setMessage(error.message, "error");
      return;
    }
    setMessage("Lesson deleted.", "success");
    await loadLessons();
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
      ? data.map((c) => `<div class="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><p class="font-semibold text-slate-900">${escapeHtml(c.code)}</p><p class="text-xs text-slate-400">${c.discount_value} ${c.discount_type} - ${c.redeemed_count}/${c.max_redemptions || "unlimited"}</p></div><div class="flex flex-wrap items-center gap-2"><span class="text-xs font-technical ${c.is_active ? "text-emerald-600" : "text-slate-400"}">${c.is_active ? "active" : "inactive"}</span><button type="button" data-edit-coupon="${c.id}" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-3 py-2">Edit</button><button type="button" data-toggle-coupon="${c.id}" data-active="${c.is_active}" class="bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg px-3 py-2">${c.is_active ? "Deactivate" : "Activate"}</button><button type="button" data-delete-coupon="${c.id}" class="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg px-3 py-2">Delete</button></div></div>`).join("")
      : `<p class="py-4 text-sm text-slate-400">No coupons yet.</p>`;
    list.querySelectorAll("[data-edit-coupon]").forEach((btn) => {
      btn.addEventListener("click", () => startCouponEdit((data || []).find((coupon) => coupon.id === btn.getAttribute("data-edit-coupon"))));
    });
    list.querySelectorAll("[data-toggle-coupon]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await window.MKV_SUPABASE.client.from("coupons").update({ is_active: btn.getAttribute("data-active") !== "true" }).eq("id", btn.getAttribute("data-toggle-coupon"));
        await loadCoupons();
      });
    });
    list.querySelectorAll("[data-delete-coupon]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!window.confirm("Delete this coupon?")) return;
        await window.MKV_SUPABASE.client.from("coupons").delete().eq("id", btn.getAttribute("data-delete-coupon"));
        await loadCoupons();
      });
    });
  }

  function startCouponEdit(coupon) {
    const form = document.getElementById("admin-coupon-form");
    if (!form || !coupon) return;
    form.elements.code.value = coupon.code || "";
    form.elements.discount_type.value = coupon.discount_type || "percent";
    form.elements.discount_value.value = coupon.discount_value || 0;
    form.elements.max_redemptions.value = coupon.max_redemptions || "";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
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

  async function loadReferralAnalytics() {
    const summary = document.getElementById("admin-referrals-summary");
    const list = document.getElementById("admin-referrals-list");
    if (!summary || !list || !window.MKV_SUPABASE?.client) return;

    const { data, error } = await window.MKV_SUPABASE.client
      .from("referrals")
      .select("id, referrer_id, referred_email, referred_user_id, status, reward_status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      list.innerHTML = `<p class="py-4 text-sm text-red-600">${escapeHtml(error.message)}</p>`;
      return;
    }

    const rows = data || [];
    const referrerIds = [...new Set(rows.map((row) => row.referrer_id).filter(Boolean))];
    let profileMap = new Map();
    if (referrerIds.length) {
      const { data: profiles } = await window.MKV_SUPABASE.client
        .from("profiles")
        .select("id, full_name, email")
        .in("id", referrerIds);
      profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    }
    referralEmailsCache = [...new Set(rows.map((row) => row.referred_email).filter(Boolean))];
    const referrers = new Map();
    rows.forEach((row) => {
      const key = row.referrer_id || "unknown";
      const profile = profileMap.get(row.referrer_id);
      if (!referrers.has(key)) {
        referrers.set(key, {
          id: key,
          name: profile?.full_name || "Unknown referrer",
          email: profile?.email || "",
          referrals: [],
        });
      }
      referrers.get(key).referrals.push(row);
    });

    summary.innerHTML = [
      ["Total Referrals", rows.length],
      ["Referrers", referrers.size],
      ["Unique Emails", referralEmailsCache.length],
    ].map(([label, value]) => `<div class="rounded-lg border border-slate-100 bg-slate-50 p-4"><p class="text-xs font-technical uppercase text-slate-400">${label}</p><p class="mt-2 text-2xl font-extrabold text-slate-900">${value}</p></div>`).join("");

    list.innerHTML = referrers.size
      ? [...referrers.values()].map((referrer) => `
        <article class="py-5">
          <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <p class="font-semibold text-slate-900">${escapeHtml(referrer.name)}</p>
              <p class="mt-1 text-xs text-slate-400">${escapeHtml(referrer.email || referrer.id)}</p>
            </div>
            <span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">${referrer.referrals.length} referral${referrer.referrals.length === 1 ? "" : "s"}</span>
          </div>
          <div class="mt-4 overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-xs uppercase text-slate-400"><tr><th class="py-2 pr-4">Referee Email</th><th class="py-2 pr-4">Status</th><th class="py-2 pr-4">Reward</th><th class="py-2">Actions</th></tr></thead>
              <tbody class="divide-y divide-slate-100">
                ${referrer.referrals.map((row) => `
                  <tr>
                    <td class="py-2 pr-4 text-slate-700">${escapeHtml(row.referred_email || "No email")}</td>
                    <td class="py-2 pr-4 text-slate-500">${escapeHtml(row.status || "pending")}</td>
                    <td class="py-2 pr-4 text-slate-500">${escapeHtml(row.reward_coupon_code || row.reward_status || "none")}</td>
                    <td class="py-2">
                      <div class="flex flex-wrap gap-2">
                        <button type="button" data-approve-referral="${row.id}" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg px-3 py-2">Approve</button>
                        <button type="button" data-reward-referral="${row.id}" data-referrer-id="${row.referrer_id}" class="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg px-3 py-2">Issue Coupon</button>
                        <button type="button" data-clear-referral="${row.id}" class="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg px-3 py-2">Clear</button>
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </article>
      `).join("")
      : `<p class="py-4 text-sm text-slate-400">No referrals yet.</p>`;

    list.querySelectorAll("[data-approve-referral]").forEach((btn) => {
      btn.addEventListener("click", () => approveReferral(btn.getAttribute("data-approve-referral")));
    });
    list.querySelectorAll("[data-reward-referral]").forEach((btn) => {
      btn.addEventListener("click", () => issueReferralReward(btn.getAttribute("data-reward-referral"), btn.getAttribute("data-referrer-id")));
    });
    list.querySelectorAll("[data-clear-referral]").forEach((btn) => {
      btn.addEventListener("click", () => clearReferral(btn.getAttribute("data-clear-referral")));
    });
  }

  async function approveReferral(referralId) {
    const { error } = await window.MKV_SUPABASE.client
      .from("referrals")
      .update({ status: "paid", reward_status: "approved" })
      .eq("id", referralId);
    if (error) {
      setMessage(error.message, "error");
      return;
    }
    setMessage("Referral approved.", "success");
    await loadReferralAnalytics();
  }

  async function issueReferralReward(referralId, referrerId) {
    if (!referrerId) return;
    const code = `REF${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { error: couponError } = await window.MKV_SUPABASE.client.from("coupons").insert({
      code,
      discount_type: "percent",
      discount_value: 20,
      max_redemptions: 1,
      is_active: true,
      created_by: window.MKV_CURRENT_USER && window.MKV_CURRENT_USER.id,
    });
    if (couponError) {
      setMessage(couponError.message, "error");
      return;
    }

    const { error } = await window.MKV_SUPABASE.client
      .from("referrals")
      .update({ reward_status: "paid", reward_coupon_code: code })
      .eq("id", referralId);
    if (error) {
      setMessage(error.message, "error");
      return;
    }

    await createNotification(
      referrerId,
      "Referral reward issued",
      `Your referral reward coupon is ${code}. Use it for a 20% discount on your next course.`,
      "courses.html"
    );
    setMessage(`Reward coupon ${code} issued and sent to student.`, "success");
    await loadCoupons();
    await loadReferralAnalytics();
  }

  async function clearReferral(referralId) {
    if (!referralId || !window.confirm("Clear this referral from admin and the student's referral page?")) return;
    const { error } = await window.MKV_SUPABASE.client.from("referrals").delete().eq("id", referralId);
    if (error) {
      setMessage(error.message, "error");
      return;
    }
    setMessage("Referral cleared.", "success");
    await loadReferralAnalytics();
  }

  async function copyReferralEmails() {
    const text = referralEmailsCache.join(", ");
    if (!text) {
      setMessage("No referral emails to copy yet.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Referral emails copied.", "success");
    } catch (error) {
      window.prompt("Copy referral emails", text);
    }
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
        const thumbnail = formData.get("thumbnail");
        const thumbnailPath = thumbnail && thumbnail.size ? await uploadFile("course-thumbnails", id, thumbnail) : "";
        const payload = {
          id,
          title,
          description: formData.get("description"),
          price: Number(formData.get("price") || 0),
          currency: formData.get("currency") || "NGN",
          is_active: true,
        };
        if (thumbnailPath) {
          payload.thumbnail_path = thumbnailPath;
        }

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
        const resource = formData.get("resource");

        setMessage("Uploading files. Please keep this tab open.", "success");

        const videoPath = video && video.size ? await uploadFile("course-videos", courseId, video) : "";
        const assignmentPath =
          assignment && assignment.size ? await uploadFile("course-assignments", courseId, assignment) : "";
        const resourcePath =
          resource && resource.size ? await uploadFile("course-materials", courseId, resource) : "";

        const lessonId = formData.get("lesson_id");
        const payload = {
          course_id: courseId,
          title: formData.get("title"),
          chapter_title: formData.get("chapter_title") || "General",
          chapter_order: Number(formData.get("chapter_order") || 1),
          description: formData.get("description"),
          video_provider: videoProvider,
          video_bucket: "course-videos",
          video_path: videoPath,
          video_url: formData.get("stream_embed_url") || "",
          stream_embed_url: formData.get("stream_embed_url") || "",
          assignment_bucket: "course-assignments",
          assignment_path: assignmentPath,
          resource_bucket: "course-materials",
          resource_path: resourcePath,
          sort_order: Number(formData.get("sort_order") || 0),
          created_by: user && user.id,
        };
        if (lessonId) {
          if (!videoPath) delete payload.video_path;
          if (!assignmentPath) delete payload.assignment_path;
          if (!resourcePath) delete payload.resource_path;
        }
        const { error } = lessonId
          ? await window.MKV_SUPABASE.client.from("lessons").update(payload).eq("id", lessonId)
          : await window.MKV_SUPABASE.client.from("lessons").insert(payload);
        if (error) throw error;

        setMessage(lessonId ? "Lesson updated." : "Lesson uploaded and saved.", "success");
        form.reset();
        document.getElementById("admin-lesson-cancel-edit")?.classList.add("hidden");
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
          <span class="block mt-1 text-[11px] font-technical text-slate-400">Student ID: ${student.id}</span>
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
      .select("id, course_id, created_at, expires_at")
      .eq("user_id", selectedStudent.id);

    if (error) {
      detail.innerHTML = `<p class="text-red-600">${error.message}</p>`;
      return;
    }

    const enrollmentMap = new Map((enrollments || []).map((item) => [item.course_id, item]));
    detail.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h3 class="text-lg font-bold text-slate-900">${selectedStudent.full_name || "Unnamed student"}</h3>
          <p class="mt-1 text-sm text-slate-500">${selectedStudent.email || selectedStudent.id}</p>
          <p class="mt-1 text-xs font-technical text-slate-400">Student ID: ${selectedStudent.id}</p>
        </div>
        <span class="text-xs font-technical text-slate-400">${selectedStudent.role}</span>
      </div>

      <div class="mt-6">
        <p class="text-sm font-semibold text-slate-900">Course Access</p>
        <div class="mt-3 space-y-2">
          ${adminCourses
            .map((course) => {
              const enrollment = enrollmentMap.get(course.id);
              const hasAccess = !!enrollment;
              const expires = enrollment?.expires_at ? new Date(enrollment.expires_at).toLocaleDateString() : "No expiry";
              return `
                <div class="rounded-lg border border-slate-100 px-4 py-3">
                  <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                      <span class="text-sm font-semibold text-slate-700">${course.title}</span>
                      <span class="block mt-1 text-xs text-slate-400">Access: ${hasAccess ? expires : "not granted"}</span>
                    </div>
                    <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                      ${
                        hasAccess
                          ? ""
                          : `<select data-access-duration="${course.id}" class="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                              <option value="2m">2 months</option>
                              <option value="6m">6 months</option>
                              <option value="1y">1 year</option>
                              <option value="none">No expiry</option>
                              <option value="custom">Custom date</option>
                            </select>
                            <input data-access-custom-date="${course.id}" type="date" class="hidden rounded-lg border border-slate-200 px-3 py-2 text-xs" />`
                      }
                      <button type="button" data-access-action="${hasAccess ? "revoke" : "grant"}" data-course-id="${course.id}"
                              class="${hasAccess ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-brand-600 text-white hover:bg-brand-700"} text-xs font-semibold rounded-lg px-3 py-2">
                        ${hasAccess ? "Revoke" : "Grant"}
                      </button>
                    </div>
                  </div>
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
          await grantAccess(selectedStudent.id, courseId, accessExpiryFor(courseId, detail));
        } else {
          await revokeAccess(selectedStudent.id, courseId);
        }
        await renderStudentDetail();
      });
    });
    detail.querySelectorAll("[data-access-duration]").forEach((select) => {
      select.addEventListener("change", () => {
        const courseId = select.getAttribute("data-access-duration");
        const custom = detail.querySelector(`[data-access-custom-date="${courseId}"]`);
        custom && custom.classList.toggle("hidden", select.value !== "custom");
      });
    });
  }

  async function refreshStudentManager() {
    await loadStudents();
    if (selectedStudent) await renderStudentDetail();
  }

  function accessExpiryFor(courseId, root) {
    const select = root.querySelector(`[data-access-duration="${courseId}"]`);
    const value = select ? select.value : "2m";
    if (value === "none") return null;
    if (value === "custom") {
      const date = root.querySelector(`[data-access-custom-date="${courseId}"]`)?.value;
      return date ? new Date(`${date}T23:59:59`).toISOString() : null;
    }
    const expires = new Date();
    if (value === "2m") expires.setMonth(expires.getMonth() + 2);
    if (value === "6m") expires.setMonth(expires.getMonth() + 6);
    if (value === "1y") expires.setFullYear(expires.getFullYear() + 1);
    return expires.toISOString();
  }

  async function grantAccess(userId, courseId, expiresAt) {
    const { error } = await window.MKV_SUPABASE.client.from("enrollments").upsert({
      user_id: userId,
      course_id: courseId,
      expires_at: expiresAt,
    });
    if (error) {
      window.alert(error.message);
      return;
    }
    await createNotification(
      userId,
      "Course access granted",
      expiresAt
        ? `An MKV Academy admin has added a course to your dashboard until ${new Date(expiresAt).toLocaleDateString()}.`
        : "An MKV Academy admin has added a course to your dashboard.",
      "students.html"
    );
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

  async function refreshInstructorManager() {
    await loadInstructorUsers();
    if (!selectedInstructor) return;
    const { data } = await window.MKV_SUPABASE.client
      .from("profiles")
      .select("id, full_name, email, role, created_at")
      .eq("id", selectedInstructor.id)
      .maybeSingle();
    if (data) selectedInstructor = data;
    await renderInstructorDetail();
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

      <div class="mt-5 grid sm:grid-cols-3 gap-3">
        <div class="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
          <p class="text-[11px] uppercase font-technical text-slate-400">Assigned Courses</p>
          <p class="mt-1 text-xl font-extrabold text-slate-900">${assignedIds.size}</p>
        </div>
        <div class="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
          <p class="text-[11px] uppercase font-technical text-slate-400">Instructor Status</p>
          <p class="mt-1 text-sm font-bold ${canTeach ? "text-emerald-700" : "text-slate-500"}">${canTeach ? "Enabled" : "Not enabled"}</p>
        </div>
        <button type="button" data-copy-instructor-email class="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 text-sm font-semibold">Copy Email</button>
      </div>

      <div class="mt-5 flex flex-col sm:flex-row gap-3">
        ${
          canTeach
            ? `<button type="button" data-instructor-role-action="remove" ${protectedRole ? "disabled" : ""} class="${protectedRole ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-red-50 text-red-700 hover:bg-red-100"} rounded-lg px-4 py-2 text-sm font-semibold">Remove Instructor Access</button>`
            : `<button type="button" data-instructor-role-action="promote" class="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2 text-sm font-semibold">Make Instructor</button>`
        }
        <button type="button" data-refresh-instructor-detail class="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-4 py-2 text-sm font-semibold">Refresh Detail</button>
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

    detail.querySelector("[data-copy-instructor-email]")?.addEventListener("click", async () => {
      const email = selectedInstructor.email || selectedInstructor.id;
      try {
        await navigator.clipboard.writeText(email);
        setMessage("Instructor email copied.", "success");
      } catch (error) {
        window.prompt("Copy instructor email", email);
      }
    });

    detail.querySelector("[data-refresh-instructor-detail]")?.addEventListener("click", refreshInstructorManager);

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
    await loadInstructorUsers();
  }

  async function unassignInstructorCourse(userId, courseId) {
    const { error } = await window.MKV_SUPABASE.client
      .from("course_instructors")
      .delete()
      .eq("course_id", courseId)
      .eq("instructor_id", userId);
    if (error) window.alert(error.message);
    await loadInstructorUsers();
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
    await appendProjectReviews(list);

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

  async function appendProjectReviews(list) {
    const { data, error } = await window.MKV_SUPABASE.client
      .from("project_review_submissions")
      .select("id, user_id, subject, note, image_bucket, image_path, cad_bucket, cad_path, status, feedback, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return;
    if (!data || !data.length) return;
    list.insertAdjacentHTML("beforeend", `
      <div class="pt-6">
        <h3 class="font-bold text-slate-900">Project Reviews</h3>
        <div class="mt-3 divide-y divide-slate-100">
          ${data.map((item) => `
            <article class="py-5">
              <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <p class="font-semibold text-slate-900">${escapeHtml(item.subject)}</p>
                  <p class="mt-1 text-xs text-slate-400">${item.user_id} - ${item.status}</p>
                  ${item.note ? `<p class="mt-2 text-sm text-slate-600">${escapeHtml(item.note)}</p>` : ""}
                </div>
                <div class="flex flex-wrap gap-2">
                  <button type="button" data-download-submission data-bucket="${item.image_bucket}" data-path="${item.image_path}" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg px-4 py-2">Image</button>
                  <button type="button" data-download-submission data-bucket="${item.cad_bucket}" data-path="${item.cad_path}" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg px-4 py-2">CAD</button>
                </div>
              </div>
              <form data-project-review-form="${item.id}" data-user-id="${item.user_id}" class="mt-4 grid md:grid-cols-3 gap-3">
                <select name="status" class="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  ${["submitted", "reviewed", "needs_revision", "approved"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
                </select>
                <input name="feedback" value="${escapeHtml(item.feedback || "")}" placeholder="Feedback" class="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <button type="submit" class="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Save Review</button>
              </form>
            </article>
          `).join("")}
        </div>
      </div>
    `);
    list.querySelectorAll("[data-project-review-form]").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const userId = form.getAttribute("data-user-id");
        const { error: reviewError } = await window.MKV_SUPABASE.client
          .from("project_review_submissions")
          .update({
            status: formData.get("status"),
            feedback: formData.get("feedback"),
            reviewed_by: window.MKV_CURRENT_USER && window.MKV_CURRENT_USER.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", form.getAttribute("data-project-review-form"));
        if (reviewError) {
          window.alert(reviewError.message);
          return;
        }
        await createNotification(userId, "Project review updated", "Your project review has feedback from MKV Academy.", "students.html#project-review");
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
    try {
      await window.MKV_SUPABASE.client.rpc("revoke_expired_enrollments");
    } catch (error) {
      console.warn("Could not revoke expired enrollments", error);
    }
    await loadCourses();
    await loadAnalytics();
    await loadLessons();
    await loadLandingVideos();
    await loadCoupons();
    await loadReferralAnalytics();
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
    const refreshLessonUploadBtn = document.getElementById("admin-refresh-lesson-upload");
    refreshLessonUploadBtn && refreshLessonUploadBtn.addEventListener("click", refreshLessonUpload);
    const refresh = document.getElementById("admin-refresh");
    refresh && refresh.addEventListener("click", loadLessons);
    const refreshCourses = document.getElementById("admin-refresh-courses");
    refreshCourses && refreshCourses.addEventListener("click", loadCourses);
    const refreshLandingVideos = document.getElementById("admin-refresh-landing-videos");
    refreshLandingVideos && refreshLandingVideos.addEventListener("click", loadLandingVideos);
    const refreshAnalytics = document.getElementById("admin-refresh-analytics");
    refreshAnalytics && refreshAnalytics.addEventListener("click", loadAnalytics);
    const refreshReferrals = document.getElementById("admin-refresh-referrals");
    refreshReferrals && refreshReferrals.addEventListener("click", loadReferralAnalytics);
    const refreshCoupons = document.getElementById("admin-refresh-coupons");
    refreshCoupons && refreshCoupons.addEventListener("click", loadCoupons);
    const copyReferralEmailsBtn = document.getElementById("admin-copy-referral-emails");
    copyReferralEmailsBtn && copyReferralEmailsBtn.addEventListener("click", copyReferralEmails);
    const refreshSubmissions = document.getElementById("admin-refresh-submissions");
    refreshSubmissions && refreshSubmissions.addEventListener("click", loadSubmissions);
    const refreshStudents = document.getElementById("admin-refresh-students");
    refreshStudents && refreshStudents.addEventListener("click", refreshStudentManager);
    const refreshInstructors = document.getElementById("admin-refresh-instructors");
    refreshInstructors && refreshInstructors.addEventListener("click", refreshInstructorManager);
    const studentSearch = document.getElementById("admin-student-search");
    studentSearch && studentSearch.addEventListener("input", () => loadStudents());
    const instructorSearch = document.getElementById("admin-instructor-search");
    instructorSearch && instructorSearch.addEventListener("input", () => loadInstructorUsers());
    const cancelLessonEdit = document.getElementById("admin-lesson-cancel-edit");
    cancelLessonEdit && cancelLessonEdit.addEventListener("click", () => {
      document.getElementById("admin-lesson-form")?.reset();
      cancelLessonEdit.classList.add("hidden");
    });
    setTimeout(initAdmin, 0);
  });
})();
