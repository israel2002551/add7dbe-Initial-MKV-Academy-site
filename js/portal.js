/* ==========================================================================
   MKV Academy - Student Portal
   Shows paid courses from Supabase enrollments and generates temporary signed
   URLs for private lesson videos and assignments.
   ========================================================================== */

(function () {
  const PROGRESS_STORAGE_KEY = "mkv-course-progress";
  let remoteProgress = {};
  let submissionStatus = {};

  const LOCAL_PREVIEW_COURSES = [
    {
      id: "solidworks-beginner-cswa",
      title: "SolidWorks: Beginner to CSWA",
      description: "Preview course. Real lessons will come from Supabase after setup.",
      lessons: [
        {
          id: "preview-lesson-1",
          title: "Lecture 1 - Introduction to SolidWorks",
          description: "A sample lesson showing how paid course content appears.",
          video_path: "",
          assignment_path: "",
        },
      ],
    },
  ];

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveProgress(data) {
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      /* localStorage unavailable */
    }
  }

  function isComplete(lessonId) {
    return !!remoteProgress[lessonId] || !!loadProgress()[lessonId];
  }

  async function setComplete(lessonId, value) {
    const data = loadProgress();
    data[lessonId] = value;
    saveProgress(data);
    remoteProgress[lessonId] = value;

    const user = window.MKV_CURRENT_USER;
    if (!user || !window.MKV_SUPABASE || !window.MKV_SUPABASE.isConfigured || lessonId.startsWith("preview-")) return;

    await window.MKV_SUPABASE.client.from("lesson_progress").upsert({
      user_id: user.id,
      lesson_id: lessonId,
      completed: value,
      updated_at: new Date().toISOString(),
    });
  }

  function courseProgress(course) {
    const total = course.lessons.length;
    if (!total) return 0;
    const done = course.lessons.filter((lesson) => isComplete(lesson.id)).length;
    return Math.round((done / total) * 100);
  }

  function emptyState(message, detail) {
    return `
      <div class="mkv-card p-8 text-center">
        <p class="text-slate-600">${message}</p>
        ${detail ? `<p class="mt-2 text-sm text-slate-500">${detail}</p>` : ""}
      </div>
    `;
  }

  async function getPaidCourses(userId) {
    const supa = window.MKV_SUPABASE;
    if (!supa || !supa.isConfigured || userId === "local-preview-user") {
      return LOCAL_PREVIEW_COURSES;
    }

    try {
      await supa.client.rpc("revoke_expired_enrollments");
    } catch (error) {
      console.warn("Could not revoke expired enrollments", error);
    }

    const { data: enrollments, error: enrollmentError } = await supa.client
      .from("enrollments")
      .select("course_id, created_at, expires_at, courses(id, title, description, drip_enabled, certificate_enabled)")
      .eq("user_id", userId);

    if (enrollmentError) throw enrollmentError;
    if (!enrollments || !enrollments.length) return [];

    const activeEnrollments = (enrollments || []).filter((item) => !item.expires_at || new Date(item.expires_at).getTime() > Date.now());
    if (!activeEnrollments.length) return [];

    const courseIds = activeEnrollments.map((item) => item.course_id);
    const { data: lessons, error: lessonsError } = await supa.client
      .from("lessons")
      .select("*")
      .in("course_id", courseIds)
      .order("chapter_order", { ascending: true })
      .order("sort_order", { ascending: true });

    if (lessonsError) throw lessonsError;

    await loadRemoteProgress(userId);
    await loadSubmissionStatus(userId);

    return activeEnrollments.map((item) => {
      const course = item.courses || { id: item.course_id, title: item.course_id, description: "" };
      return {
        id: course.id,
        title: course.title,
        description: course.description,
        drip_enabled: course.drip_enabled,
        certificate_enabled: course.certificate_enabled,
        enrolled_at: item.created_at,
        expires_at: item.expires_at,
        lessons: (lessons || []).filter((lesson) => lesson.course_id === course.id),
      };
    });
  }

  async function loadRemoteProgress(userId) {
    remoteProgress = {};
    if (!window.MKV_SUPABASE || !window.MKV_SUPABASE.isConfigured || userId === "local-preview-user") return;

    const { data } = await window.MKV_SUPABASE.client
      .from("lesson_progress")
      .select("lesson_id, completed")
      .eq("user_id", userId);

    (data || []).forEach((row) => {
      remoteProgress[row.lesson_id] = row.completed;
    });
  }

  async function loadSubmissionStatus(userId) {
    submissionStatus = {};
    if (!window.MKV_SUPABASE || !window.MKV_SUPABASE.isConfigured || userId === "local-preview-user") return;

    const { data } = await window.MKV_SUPABASE.client
      .from("assignment_submissions")
      .select("lesson_id, status, grade, feedback, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    (data || []).forEach((row) => {
      if (!submissionStatus[row.lesson_id]) submissionStatus[row.lesson_id] = row;
    });
  }

  function isUnlocked(course, lesson) {
    if (!course.drip_enabled) return true;
    const enrolledAt = new Date(course.enrolled_at || Date.now()).getTime();
    const unlockAt = enrolledAt + Number(lesson.unlock_after_days || 0) * 24 * 60 * 60 * 1000;
    return Date.now() >= unlockAt;
  }

  function lessonRow(lesson, course) {
    const done = isComplete(lesson.id);
    const unlocked = isUnlocked(course, lesson);
    const submitted = submissionStatus[lesson.id];
    const canSubmit = lesson.assignment_path && !String(lesson.id).startsWith("preview-");
    const hasExternalVideo = lesson.video_provider && lesson.video_provider !== "storage" && (lesson.stream_embed_url || lesson.video_url);
    return `
      <div class="py-4 border-t border-slate-100" data-lesson-row="${lesson.id}">
        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <button data-progress-toggle data-lesson-id="${lesson.id}" data-course-id="${course.id}"
                      class="h-6 w-6 rounded-full border flex items-center justify-center text-xs transition-colors ${
                        done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-brand-600"
                      }">
                ${done ? `<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>` : ""}
              </button>
              <h4 class="font-semibold text-slate-900">${lesson.title}</h4>
            </div>
            ${lesson.description ? `<p class="mt-1 ml-8 text-sm text-slate-500">${lesson.description}</p>` : ""}
          </div>
          <div class="flex flex-wrap gap-2 ml-8 lg:ml-0">
            ${
              !unlocked
                ? `<span class="text-sm text-slate-400 px-4 py-2">Locked</span>`
                : hasExternalVideo
                ? `<button data-open-external-video data-url="${lesson.stream_embed_url || lesson.video_url}" class="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Watch</button>`
                : lesson.video_path
                ? `<button data-open-video data-bucket="${lesson.video_bucket || "course-videos"}" data-path="${lesson.video_path}" class="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Watch</button>`
                : `<span class="text-sm text-slate-300 px-4 py-2">Video coming soon</span>`
            }
            ${
              unlocked && lesson.assignment_path
                ? `<button data-download-file data-bucket="${lesson.assignment_bucket || "course-assignments"}" data-path="${lesson.assignment_path}" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg px-4 py-2">Assignment</button>`
                : ""
            }
            ${
              unlocked && lesson.resource_path
                ? `<button data-download-file data-bucket="${lesson.resource_bucket || "course-materials"}" data-path="${lesson.resource_path}" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg px-4 py-2">Resource</button>`
                : ""
            }
          </div>
        </div>
        ${
          unlocked && canSubmit
            ? `<form data-assignment-submit data-lesson-id="${lesson.id}" data-course-id="${lesson.course_id}" class="mt-4 ml-8 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div class="flex flex-col lg:flex-row lg:items-end gap-3">
                  <div class="flex-1">
                    <label class="block text-xs font-semibold text-slate-500 mb-1.5">Submit completed assignment</label>
                    <input name="submission" type="file" required class="w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-slate-700 file:font-semibold" />
                  </div>
                  <div class="flex-1">
                    <label class="block text-xs font-semibold text-slate-500 mb-1.5">Note</label>
                    <input name="note" type="text" placeholder="Optional note" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600" />
                  </div>
                  <button type="submit" class="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg px-4 py-2">Submit</button>
                </div>
                ${
                  submitted
                    ? `<p class="mt-3 text-xs text-slate-500">Latest submission: <span class="font-semibold text-brand-700">${submitted.status}</span>${submitted.grade ? ` - Grade: ${submitted.grade}` : ""}${submitted.feedback ? ` - ${submitted.feedback}` : ""}</p>`
                    : ""
                }
              </form>`
            : ""
        }
      </div>
    `;
  }

  function groupLessonsByChapter(lessons) {
    const chapters = new Map();
    (lessons || []).forEach((lesson) => {
      const title = lesson.chapter_title || "General";
      const order = Number(lesson.chapter_order || 1);
      if (!chapters.has(title)) chapters.set(title, { title, order, lessons: [] });
      chapters.get(title).lessons.push(lesson);
    });
    return [...chapters.values()]
      .sort((a, b) => a.order - b.order)
      .map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
      }));
  }

  function chapterMarkup(chapter, course, index) {
    return `
      <details class="border-t border-slate-100" ${index === 0 ? "open" : ""}>
        <summary class="flex cursor-pointer list-none items-center justify-between gap-4 py-4">
          <div>
            <p class="font-semibold text-slate-900">Chapter ${chapter.order}: ${chapter.title}</p>
            <p class="mt-1 text-xs text-slate-400">${chapter.lessons.length} video lesson${chapter.lessons.length === 1 ? "" : "s"}</p>
          </div>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Open</span>
        </summary>
        <div class="pb-2">
          ${chapter.lessons.map((lesson) => lessonRow(lesson, course)).join("")}
        </div>
      </details>
    `;
  }

  function embedUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtu.be")) {
        const id = parsed.pathname.replace("/", "");
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : url;
      }
      if (parsed.hostname.includes("youtube.com")) {
        const id = parsed.searchParams.get("v") || parsed.pathname.split("/").pop();
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : url;
      }
      if (parsed.hostname.includes("drive.google.com") && parsed.pathname.includes("/file/d/")) {
        const id = parsed.pathname.split("/file/d/")[1]?.split("/")[0];
        return id ? `https://drive.google.com/file/d/${id}/preview` : url;
      }
    } catch (e) {
      return url;
    }
    return url;
  }

  function courseCard(course, index) {
    const pct = courseProgress(course);
    const chapterCount = groupLessonsByChapter(course.lessons).length;
    const lessonCount = course.lessons.length;
    return `
      <article class="mkv-card">
        <details ${index === 0 ? "open" : ""}>
          <summary class="flex cursor-pointer list-none flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="font-technical text-xs uppercase tracking-widest text-brand-700">Enrolled Course</p>
              <h3 class="mt-2 text-xl font-bold text-slate-900">${course.title}</h3>
              ${course.description ? `<p class="mt-2 text-sm text-slate-600">${course.description}</p>` : ""}
              ${course.expires_at ? `<p class="mt-2 text-xs font-semibold text-amber-700">Access expires ${new Date(course.expires_at).toLocaleDateString()}</p>` : ""}
              <p class="mt-3 text-xs font-semibold text-slate-500">${chapterCount} chapter${chapterCount === 1 ? "" : "s"} - ${lessonCount} lesson${lessonCount === 1 ? "" : "s"}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2 md:justify-end">
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">${pct}% complete</span>
              <span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">Open / Close</span>
            </div>
          </summary>
          <div class="px-6 pb-6">
            <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div class="h-full bg-brand-600 rounded-full transition-all" style="width: ${pct}%"></div>
            </div>
            <div class="mt-5">
              ${
                course.lessons.length
                  ? groupLessonsByChapter(course.lessons).map((chapter, chapterIndex) => chapterMarkup(chapter, course, chapterIndex)).join("")
                  : `<p class="py-4 text-sm text-slate-400 border-t border-slate-100">Lessons have not been uploaded for this course yet.</p>`
              }
            </div>
            <div class="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-5">
              <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p class="font-semibold text-slate-900">Overall Course Assessment</p>
                  <p class="mt-1 text-sm text-slate-600">Submit your final CAD files, reports, or ZIP package for instructor grading when you complete the course.</p>
                </div>
                <a href="#project-review" class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Submit Final Project</a>
              </div>
            </div>
          </div>
        </details>
      </article>
    `;
  }

  function bindPortalActions(courses) {
    document.querySelectorAll("[data-progress-toggle]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const lessonId = btn.getAttribute("data-lesson-id");
        const courseId = btn.getAttribute("data-course-id");
        await setComplete(lessonId, !isComplete(lessonId));
        if (courseId && window.MKV_CURRENT_USER && window.MKV_SUPABASE?.isConfigured) {
          await window.MKV_SUPABASE.client.rpc("issue_certificate_if_complete", {
            p_user_id: window.MKV_CURRENT_USER.id,
            p_course_id: courseId,
          });
          loadCertificates();
        }
        renderCourses(courses);
      });
    });

    document.querySelectorAll("[data-open-external-video]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openVideoPlayer(embedUrl(btn.getAttribute("data-url")), btn.closest("[data-lesson-row]")?.querySelector("h4")?.textContent || "Lesson video", true);
      });
    });

    document.querySelectorAll("[data-open-video]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!window.MKV_SUPABASE || !window.MKV_SUPABASE.isConfigured) {
          window.alert("Video playback will work after Supabase is configured.");
          return;
        }
        const { data, error } = await window.MKV_SUPABASE.signedViewUrl(
          btn.getAttribute("data-bucket"),
          btn.getAttribute("data-path"),
          3600
        );
        if (error) {
          window.alert(error.message);
          return;
        }
        openVideoPlayer(data.signedUrl, btn.closest("[data-lesson-row]")?.querySelector("h4")?.textContent || "Lesson video", false);
      });
    });

    document.querySelectorAll("[data-download-file]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!window.MKV_SUPABASE || !window.MKV_SUPABASE.isConfigured) {
          window.alert("Downloads will work after Supabase is configured.");
          return;
        }
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

    document.querySelectorAll("[data-assignment-submit]").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await submitAssignment(form, courses);
      });
    });
  }

  function openVideoPlayer(url, title, embed) {
    const viewer = document.getElementById("student-video-viewer");
    const frame = document.getElementById("student-video-frame");
    const titleEl = document.getElementById("student-video-title");
    if (!viewer || !frame) {
      window.open(url, "_blank", "noopener");
      return;
    }
    titleEl.textContent = title || "Lesson video";
    frame.innerHTML = embed
      ? `<iframe src="${url}" title="${titleEl.textContent}" class="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`
      : `<video src="${url}" controls playsinline class="h-full w-full bg-slate-950"></video>`;
    viewer.classList.remove("hidden");
    viewer.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeVideoPlayer() {
    const viewer = document.getElementById("student-video-viewer");
    const frame = document.getElementById("student-video-frame");
    if (frame) frame.innerHTML = "";
    if (viewer) viewer.classList.add("hidden");
  }

  async function submitAssignment(form, courses) {
    const user = window.MKV_CURRENT_USER;
    if (!user || !window.MKV_SUPABASE || !window.MKV_SUPABASE.isConfigured) {
      window.alert("Assignment submission works after Supabase is configured.");
      return;
    }

    const formData = new FormData(form);
    const file = formData.get("submission");
    if (!file || !file.size) return;

    const lessonId = form.getAttribute("data-lesson-id");
    const courseId = form.getAttribute("data-course-id");
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const cleanName = window.MKV_SUPABASE.slugify(file.name.replace(/\.[^.]+$/, ""));
    const path = `${user.id}/${courseId}/${lessonId}/${Date.now()}-${cleanName}.${extension}`;

    const { error: uploadError } = await window.MKV_SUPABASE.client.storage
      .from("assignment-submissions")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) {
      window.alert(uploadError.message);
      return;
    }

    const { error } = await window.MKV_SUPABASE.client.from("assignment_submissions").insert({
      lesson_id: lessonId,
      course_id: courseId,
      user_id: user.id,
      file_bucket: "assignment-submissions",
      file_path: path,
      note: formData.get("note") || "",
    });
    if (error) {
      window.alert(error.message);
      return;
    }

    await loadSubmissionStatus(user.id);
    renderCourses(courses);
  }

  async function submitProjectReview(form) {
    const status = document.getElementById("project-review-status");
    const user = window.MKV_CURRENT_USER;
    if (!user || !window.MKV_SUPABASE || !window.MKV_SUPABASE.isConfigured) {
      if (status) status.textContent = "Project review upload works after Supabase is configured.";
      return;
    }

    const formData = new FormData(form);
    const image = formData.get("image");
    const cad = formData.get("cad");
    if (!image?.size || !cad?.size) return;

    if (status) status.textContent = "Uploading review files...";
    const basePath = `${user.id}/project-reviews/${Date.now()}`;
    const imagePath = await uploadReviewFile(basePath, image);
    const cadPath = await uploadReviewFile(basePath, cad);

    const { error } = await window.MKV_SUPABASE.client.from("project_review_submissions").insert({
      user_id: user.id,
      subject: formData.get("subject"),
      note: formData.get("note") || "",
      image_bucket: "project-review-submissions",
      image_path: imagePath,
      cad_bucket: "project-review-submissions",
      cad_path: cadPath,
    });
    if (error) {
      if (status) status.textContent = error.message;
      return;
    }
    form.reset();
    if (status) status.textContent = "Project submitted. A mentor will review it from the admin dashboard.";
  }

  async function uploadReviewFile(basePath, file) {
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const cleanName = window.MKV_SUPABASE.slugify(file.name.replace(/\.[^.]+$/, ""));
    const path = `${basePath}/${cleanName}.${extension}`;
    const { error } = await window.MKV_SUPABASE.client.storage
      .from("project-review-submissions")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    return path;
  }

  async function loadNotifications() {
    const wrap = document.getElementById("student-notifications");
    const user = window.MKV_CURRENT_USER;
    if (!wrap || !user || !window.MKV_SUPABASE || !window.MKV_SUPABASE.isConfigured) {
      if (wrap) wrap.innerHTML = "";
      return;
    }

    const { data, error } = await window.MKV_SUPABASE.client
      .from("notifications")
      .select("id, title, body, action_url, read_at, created_at")
      .eq("user_id", user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(3);

    if (error || !data || !data.length) {
      wrap.innerHTML = "";
      return;
    }

    wrap.innerHTML = data
      .map(
        (n) => `
        <div class="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-brand-900">${n.title}</p>
            ${n.body ? `<p class="mt-1 text-xs text-brand-700">${n.body}</p>` : ""}
          </div>
          <button data-notification-read data-id="${n.id}" class="text-xs font-semibold text-brand-700 hover:text-brand-900">Mark read</button>
        </div>`
      )
      .join("");

    wrap.querySelectorAll("[data-notification-read]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await window.MKV_SUPABASE.client
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", btn.getAttribute("data-id"));
        loadNotifications();
      });
    });
  }

  function renderCourses(courses) {
    const list = document.getElementById("my-courses-list");
    if (!list) return;

    if (!courses.length) {
      list.innerHTML = emptyState(
        "You do not have any paid courses linked to this account yet.",
        `After payment is verified, the course will appear here automatically. <a href="courses.html" class="text-brand-700 font-medium hover:text-brand-900">Browse courses</a>.`
      );
      return;
    }

    list.innerHTML = courses.map((course, index) => courseCard(course, index)).join("");
    bindPortalActions(courses);
  }

  async function verifyPaymentReturn() {
    if (!window.MKV_SUPABASE?.isConfigured || !window.MKV_CURRENT_USER) return null;

    const params = new URLSearchParams(window.location.search);
    const txRef = params.get("tx_ref") || params.get("txref") || "";
    const transactionId = params.get("transaction_id") || params.get("id") || "";
    const status = (params.get("status") || "").toLowerCase();
    if (!txRef && !transactionId) return null;
    if (status && status !== "successful" && status !== "completed") return false;

    const list = document.getElementById("my-courses-list");
    if (list) list.innerHTML = `<p class="text-sm text-slate-400 py-4">Confirming your payment and unlocking your course...</p>`;

    const { data, error } = await window.MKV_SUPABASE.client.functions.invoke("verify-flutterwave-payment", {
      body: { tx_ref: txRef, transaction_id: transactionId },
    });

    if (error || !data?.ok) {
      if (list) list.innerHTML = emptyState("We could not confirm this payment automatically.", error?.message || data?.error || "Please contact support with your payment reference.");
      return false;
    }

    const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, document.title, cleanUrl);
    return true;
  }

  async function initMyCourses() {
    const list = document.getElementById("my-courses-list");
    const refreshBtn = document.getElementById("student-refresh-courses");
    if (!list) return;

    const user = window.MKV_CURRENT_USER;
    if (!user) {
      list.innerHTML = "";
      return;
    }

    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "Refreshing...";
      refreshBtn.classList.add("opacity-70", "cursor-wait");
    }
    list.innerHTML = `<p class="text-sm text-slate-400 py-4">Loading your paid courses...</p>`;
    try {
      const verifiedPayment = await verifyPaymentReturn();
      if (verifiedPayment === false) return;
      const courses = await getPaidCourses(user.id);
      renderCourses(courses);
      loadNotifications();
      loadCertificates();
      loadReferrals();
      loadQuizzes();
    } catch (error) {
      list.innerHTML = emptyState("We could not load your dashboard right now.", error.message);
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = "Refresh";
        refreshBtn.classList.remove("opacity-70", "cursor-wait");
      }
    }
  }

  async function loadCertificates() {
    const wrap = document.getElementById("student-certificates");
    const user = window.MKV_CURRENT_USER;
    if (!wrap || !user || !window.MKV_SUPABASE?.isConfigured) return;
    const { data } = await window.MKV_SUPABASE.client
      .from("certificates")
      .select("course_id, certificate_code, issued_at")
      .eq("user_id", user.id)
      .order("issued_at", { ascending: false });
    wrap.innerHTML = data && data.length
      ? data.map((c) => `<div class="py-2"><p><span class="font-semibold">${c.course_id}</span><br><span class="font-technical text-xs">${c.certificate_code}</span></p><button type="button" data-certificate-code="${c.certificate_code}" data-certificate-course="${c.course_id}" data-certificate-date="${c.issued_at}" class="mt-2 text-xs font-semibold text-brand-700 hover:text-brand-900">View certificate</button></div>`).join("")
      : "Complete all lessons in a certificate-enabled course to unlock a certificate.";
    wrap.querySelectorAll("[data-certificate-code]").forEach((btn) => {
      btn.addEventListener("click", () => openCertificate(btn));
    });
  }

  function openCertificate(btn) {
    const user = window.MKV_CURRENT_USER || {};
    const name = user.profile?.full_name || user.user_metadata?.full_name || user.email || "MKV Academy Student";
    const course = btn.getAttribute("data-certificate-course");
    const code = btn.getAttribute("data-certificate-code");
    const issued = new Date(btn.getAttribute("data-certificate-date")).toLocaleDateString();
    const win = window.open("", "_blank", "noopener");
    if (!win) return;
    win.document.write(`
      <html><head><title>MKV Certificate ${code}</title><style>
      body{font-family:Inter,Arial,sans-serif;margin:0;background:#f8fafc;color:#0f172a}
      .cert{max-width:900px;margin:40px auto;background:white;border:12px solid #1d4ed8;padding:56px;text-align:center;box-shadow:0 20px 50px rgba(15,23,42,.12)}
      .mark{font-weight:800;letter-spacing:.12em;color:#1d4ed8}.name{font-size:42px;font-weight:800;margin:28px 0 10px}.course{font-size:24px;font-weight:700}.meta{margin-top:36px;color:#475569;font-size:14px}
      @media print{body{background:white}.cert{box-shadow:none;margin:0;max-width:none;min-height:80vh}}
      </style></head><body><main class="cert"><p class="mark">MKV ACADEMY</p><h1>Certificate of Completion</h1><p>This certifies that</p><p class="name">${name}</p><p>has completed</p><p class="course">${course}</p><p class="meta">Issued ${issued} - Certificate Code: ${code}</p></main></body></html>
    `);
    win.document.close();
  }

  async function loadReferrals() {
    const wrap = document.getElementById("student-referrals");
    const user = window.MKV_CURRENT_USER;
    if (!wrap || !user || !window.MKV_SUPABASE?.isConfigured) return;
    const { data } = await window.MKV_SUPABASE.client
      .from("referrals")
      .select("referred_email, status, reward_status, reward_coupon_code")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    wrap.innerHTML = data && data.length
      ? data.map((r) => `<p>${r.referred_email || "Invite"} - ${r.status} / ${r.reward_coupon_code || r.reward_status}</p>`).join("")
      : "No referrals yet.";
  }

  async function loadQuizzes() {
    const wrap = document.getElementById("student-quizzes");
    const user = window.MKV_CURRENT_USER;
    if (!wrap || !user || !window.MKV_SUPABASE?.isConfigured) return;
    const { data } = await window.MKV_SUPABASE.client
      .from("quizzes")
      .select("id, title, course_id, pass_mark")
      .eq("is_active", true)
      .limit(8);
    wrap.innerHTML = data && data.length
      ? data.map((q) => `<button data-quiz-id="${q.id}" class="block w-full text-left py-2 text-brand-700 font-semibold">${q.title}<span class="block text-xs text-slate-400">${q.course_id} - pass ${q.pass_mark}%</span></button>`).join("")
      : "No quizzes available yet.";
    wrap.querySelectorAll("[data-quiz-id]").forEach((btn) => {
      btn.addEventListener("click", () => openQuiz(btn.getAttribute("data-quiz-id")));
    });
  }

  async function openQuiz(quizId) {
    const wrap = document.getElementById("student-quizzes");
    if (!wrap || !quizId || !window.MKV_SUPABASE?.isConfigured) return;
    const { data, error } = await window.MKV_SUPABASE.client.rpc("get_quiz_payload", { p_quiz_id: quizId });
    if (error || !data) {
      wrap.innerHTML = `<p class="text-red-600">${error ? error.message : "Quiz unavailable"}</p>`;
      return;
    }
    if (!data.questions || !data.questions.length) {
      wrap.innerHTML = `<p class="text-sm text-slate-500">No quiz questions have been added for this course yet.</p>`;
      return;
    }
    wrap.innerHTML = `
      <form id="student-quiz-attempt" data-quiz-id="${data.id}" class="space-y-4">
        <p class="font-semibold text-slate-900">${data.title}</p>
        ${(data.questions || []).map((q, index) => `
          <fieldset class="rounded-lg border border-slate-100 p-3">
            <legend class="text-sm font-semibold text-slate-700">${index + 1}. ${q.question}</legend>
            <div class="mt-2 space-y-1">
              ${(q.options || []).map((o) => `
                <label class="flex gap-2 text-sm text-slate-600">
                  <input type="radio" name="${q.id}" value="${o.id}" required />
                  <span>${o.option_text}</span>
                </label>
              `).join("")}
            </div>
          </fieldset>
        `).join("")}
        <button class="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Submit Quiz</button>
      </form>
    `;
    document.getElementById("student-quiz-attempt").addEventListener("submit", submitQuiz);
  }

  async function submitQuiz(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const answers = {};
    new FormData(form).forEach((value, key) => {
      answers[key] = value;
    });
    const { data, error } = await window.MKV_SUPABASE.client.rpc("submit_quiz_attempt", {
      p_quiz_id: form.getAttribute("data-quiz-id"),
      p_answers: answers,
    });
    const wrap = document.getElementById("student-quizzes");
    if (error) {
      wrap.innerHTML = `<p class="text-red-600">${error.message}</p>`;
      return;
    }
    wrap.innerHTML = `<p class="font-semibold ${data.passed ? "text-emerald-700" : "text-red-700"}">Score: ${data.score}% - ${data.passed ? "Passed" : "Try again"}</p>`;
  }

  function bindReferralForm() {
    const form = document.getElementById("student-referral-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = window.MKV_CURRENT_USER;
      if (!user || !window.MKV_SUPABASE?.isConfigured) return;
      const email = new FormData(form).get("email");
      await window.MKV_SUPABASE.client.from("referrals").insert({ referrer_id: user.id, referred_email: email });
      form.reset();
      loadReferrals();
    });
  }

  function bindProjectReviewForm() {
    const form = document.getElementById("project-review-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await submitProjectReview(form);
      } catch (error) {
        const status = document.getElementById("project-review-status");
        if (status) status.textContent = error.message;
      }
    });
  }

  /* ------------------------- STUDY TIMER ------------------------- */

  function initStudyTimer() {
    const display = document.getElementById("timer-display");
    if (!display) return;

    const startBtn = document.getElementById("timer-start");
    const pauseBtn = document.getElementById("timer-pause");
    const resetBtn = document.getElementById("timer-reset");
    const notifyBtn = document.getElementById("timer-notify");
    const statusEl = document.getElementById("timer-status");
    const presetButtons = document.querySelectorAll("[data-timer-preset]");

    let totalSeconds = 25 * 60;
    let remaining = totalSeconds;
    let intervalId = null;
    let notificationsEnabled = false;

    function format(seconds) {
      const m = Math.floor(seconds / 60).toString().padStart(2, "0");
      const s = Math.floor(seconds % 60).toString().padStart(2, "0");
      return `${m}:${s}`;
    }

    function render() {
      display.textContent = format(remaining);
    }

    function playChime() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch (e) {
        /* Web Audio unavailable */
      }
    }

    function finish() {
      clearInterval(intervalId);
      intervalId = null;
      startBtn.classList.remove("hidden");
      pauseBtn.classList.add("hidden");
      playChime();
      if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
        new Notification("MKV Academy Study Timer", { body: "Time is up. Nice work." });
      }
      statusEl.textContent = "Time is up!";
    }

    function tick() {
      remaining -= 1;
      render();
      if (remaining <= 0) finish();
    }

    function start() {
      if (intervalId) return;
      intervalId = setInterval(tick, 1000);
      startBtn.classList.add("hidden");
      pauseBtn.classList.remove("hidden");
      statusEl.textContent = "";
    }

    function pause() {
      clearInterval(intervalId);
      intervalId = null;
      startBtn.classList.remove("hidden");
      pauseBtn.classList.add("hidden");
    }

    function reset() {
      pause();
      remaining = totalSeconds;
      render();
      statusEl.textContent = "";
    }

    presetButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const minutes = Number(btn.getAttribute("data-timer-preset"));
        totalSeconds = minutes * 60;
        presetButtons.forEach((b) => b.classList.remove("bg-brand-50", "text-brand-700"));
        presetButtons.forEach((b) => b.classList.add("bg-slate-100", "text-slate-600"));
        btn.classList.remove("bg-slate-100", "text-slate-600");
        btn.classList.add("bg-brand-50", "text-brand-700");
        reset();
      });
    });

    startBtn.addEventListener("click", start);
    pauseBtn.addEventListener("click", pause);
    resetBtn.addEventListener("click", reset);

    notifyBtn.addEventListener("click", () => {
      if (!("Notification" in window)) {
        statusEl.textContent = "Notifications are not supported in this browser. Sound will still play.";
        notificationsEnabled = true;
        return;
      }
      Notification.requestPermission().then((permission) => {
        notificationsEnabled = permission === "granted";
        statusEl.textContent = notificationsEnabled
          ? "You will get a sound and notification when time is up."
          : "Notifications blocked. You will still hear a sound.";
      });
    });

    render();
  }

  document.addEventListener("mkv:auth-updated", initMyCourses);
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      bindReferralForm();
      bindProjectReviewForm();
      document.getElementById("student-refresh-courses")?.addEventListener("click", initMyCourses);
      document.getElementById("student-video-back")?.addEventListener("click", closeVideoPlayer);
      initMyCourses();
      initStudyTimer();
    }, 0);
  });
})();
