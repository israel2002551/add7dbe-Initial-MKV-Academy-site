/* ==========================================================================
   MKV Academy - In-App Chat Page
   Dedicated account-based messaging page backed by Supabase.
   ========================================================================== */

(function () {
  let activeThreadId = null;
  let threadsCache = [];
  let refreshTimer = null;
  let realtimeChannel = null;
  let studentPickerResolve = null;
  let studentPickerStudents = [];

  function isAdmin(user) {
    const role = user && user.profile && user.profile.role;
    return role === "admin" || role === "owner";
  }

  function isStaff(user) {
    const role = user && user.profile && user.profile.role;
    return role === "admin" || role === "owner" || role === "instructor";
  }

  function canUseSupabase() {
    return window.MKV_SUPABASE && window.MKV_SUPABASE.isConfigured && window.MKV_SUPABASE.client;
  }

  function formatDate(value) {
    if (!value) return "";
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setStatus(message) {
    const el = document.getElementById("chat-message-status");
    if (el) el.textContent = message || "";
  }

  function renderEmptyThreads(message) {
    const list = document.getElementById("chat-thread-list");
    if (!list) return;
    list.innerHTML = `<p class="text-sm text-slate-400 py-4">${message}</p>`;
  }

  function threadTitle(thread) {
    if (isStaff(window.MKV_CURRENT_USER)) {
      const name = thread.student_name || thread.student_username || "Unknown student";
      const shortId = thread.student_id ? thread.student_id.slice(0, 8) : "";
      return `${thread.subject} - ${name}${shortId ? ` (${shortId})` : ""}`;
    }
    return thread.subject;
  }

  function studentMeta(thread) {
    const parts = [thread.student_name, thread.student_email, thread.student_username, thread.student_id].filter(Boolean);
    return parts.join(" - ");
  }

  function renderThreads() {
    const list = document.getElementById("chat-thread-list");
    if (!list) return;

    if (!threadsCache.length) {
      renderEmptyThreads("No conversations yet.");
      return;
    }

    list.innerHTML = threadsCache
      .map((thread) => {
        const active = thread.id === activeThreadId;
        return `
          <button type="button" data-thread-id="${thread.id}"
                  class="w-full text-left rounded-lg px-4 py-3 transition-colors ${
                    active ? "bg-brand-50 text-brand-700" : "hover:bg-slate-50 text-slate-700"
                  }">
            <span class="block text-sm font-semibold">${escapeHtml(threadTitle(thread))}</span>
            ${isStaff(window.MKV_CURRENT_USER) ? `<span class="mt-1 block text-[11px] text-slate-400">${escapeHtml(studentMeta(thread))}</span>` : ""}
            <span class="mt-1 block text-xs text-slate-400">${formatDate(thread.updated_at || thread.created_at)}</span>
          </button>
        `;
      })
      .join("");

    list.querySelectorAll("[data-thread-id]").forEach((btn) => {
      btn.addEventListener("click", () => selectThread(btn.getAttribute("data-thread-id")));
    });
  }

  async function loadThreads() {
    if (!document.getElementById("chat-thread-list")) return;
    const user = window.MKV_CURRENT_USER;
    if (!user) return;

    if (!canUseSupabase()) {
      renderEmptyThreads("Configure Supabase to use real chat.");
      return;
    }

    const query = window.MKV_SUPABASE.client
      .from("chat_threads")
      .select("id, student_id, subject, status, created_at, updated_at")
      .order("updated_at", { ascending: false });

    const { data, error } = isStaff(user) ? await query.neq("status", "closed") : await query.eq("student_id", user.id).neq("status", "closed");

    if (error) {
      renderEmptyThreads(error.message);
      return;
    }

    threadsCache = await hydrateThreadStudents(data || []);
    if (!activeThreadId && threadsCache.length) activeThreadId = threadsCache[0].id;
    renderThreads();
    if (activeThreadId) await loadMessages(activeThreadId);
  }

  async function hydrateThreadStudents(threads) {
    const ids = [...new Set(threads.map((thread) => thread.student_id).filter(Boolean))];
    if (!ids.length) return threads;
    const { data } = await window.MKV_SUPABASE.client.from("profiles").select("id, username, full_name, email").in("id", ids);
    const profileMap = new Map((data || []).map((profile) => [profile.id, profile]));
    return threads.map((thread) => {
      const profile = profileMap.get(thread.student_id);
      return {
        ...thread,
        student_username: profile?.username || "",
        student_name: profile?.full_name || "",
        student_email: profile?.email || "",
      };
    });
  }

  async function hydrateMessageSenders(messages) {
    const ids = [...new Set(messages.map((message) => message.sender_id).filter(Boolean))];
    if (!ids.length) return messages;
    const { data } = await window.MKV_SUPABASE.client.from("profiles").select("id, username, full_name, role").in("id", ids);
    const profileMap = new Map((data || []).map((profile) => [profile.id, profile]));
    return messages.map((message) => ({ ...message, sender_profile: profileMap.get(message.sender_id) }));
  }

  function renderMessages(messages) {
    const wrap = document.getElementById("chat-messages");
    if (!wrap) return;

    const user = window.MKV_CURRENT_USER;
    if (!messages.length) {
      wrap.innerHTML = `<div class="text-center text-sm text-slate-400 py-20">No messages yet. Send the first one.</div>`;
      return;
    }

    wrap.innerHTML = messages
      .map((message) => {
        const mine = message.sender_id === user.id;
        const bubbleClass = mine ? "bg-brand-600 text-white ml-auto" : "bg-white text-slate-700 border border-slate-100";
        const metaClass = mine ? "text-brand-100" : "text-slate-400";
        const senderName = message.sender_profile?.username || message.sender_profile?.full_name || (mine ? "You" : "MKV Support");
        return `
          <div class="max-w-[82%] ${mine ? "ml-auto text-right" : ""}">
            <div class="inline-block rounded-xl px-4 py-3 ${bubbleClass}">
              <p class="text-sm leading-relaxed whitespace-pre-wrap">${escapeHtml(message.body)}</p>
              <p class="mt-2 text-[11px] ${metaClass}">${escapeHtml(senderName)} - ${formatDate(message.created_at)}</p>
            </div>
          </div>
        `;
      })
      .join("");
    wrap.scrollTop = wrap.scrollHeight;
  }

  async function loadMessages(threadId) {
    if (!threadId || !canUseSupabase()) return;

    const thread = threadsCache.find((item) => item.id === threadId);
    const subject = document.getElementById("chat-active-subject");
    const meta = document.getElementById("chat-active-meta");
    const form = document.getElementById("chat-form");

    if (thread) {
      if (subject) subject.textContent = threadTitle(thread);
      if (meta) {
        const student = isStaff(window.MKV_CURRENT_USER) ? `${studentMeta(thread)} - ` : "";
        meta.textContent = `${student}${thread.status} - ${formatDate(thread.updated_at || thread.created_at)}`;
      }
    }
    if (form) form.classList.remove("hidden");

    const { data, error } = await window.MKV_SUPABASE.client
      .from("chat_messages")
      .select("id, sender_id, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) {
      const wrap = document.getElementById("chat-messages");
      if (wrap) wrap.innerHTML = `<div class="text-center text-sm text-red-600 py-20">${error.message}</div>`;
      return;
    }

    renderMessages(await hydrateMessageSenders(data || []));
  }

  async function selectThread(threadId) {
    activeThreadId = threadId;
    renderThreads();
    await loadMessages(threadId);
    subscribeToThread(threadId);
  }

  function subscribeToThread(threadId) {
    if (!canUseSupabase() || !threadId) return;
    if (realtimeChannel) {
      window.MKV_SUPABASE.client.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    realtimeChannel = window.MKV_SUPABASE.client
      .channel(`mkv-chat-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` },
        () => loadMessages(threadId)
      )
      .subscribe();
  }

  async function createThread() {
    const user = window.MKV_CURRENT_USER;
    if (!user || !canUseSupabase()) {
      window.alert("Configure Supabase and log in to start a conversation.");
      return;
    }

    const subject = window.prompt("Subject (required)", "Course question");
    if (!subject) return;

    const studentId = isStaff(user) ? await pickStudent() : user.id;
    if (!studentId) return;

    const { data, error } = await window.MKV_SUPABASE.client
      .from("chat_threads")
      .insert({ student_id: studentId, subject })
      .select("id")
      .single();

    if (error) {
      window.alert(error.message);
      return;
    }

    activeThreadId = data.id;
    await loadThreads();
  }

  function studentLabel(student) {
    const name = student.full_name || student.username || student.email || "Unnamed student";
    const secondary = [student.email, student.username, student.id].filter(Boolean).join(" - ");
    return { name, secondary };
  }

  function renderStudentPicker(students) {
    const list = document.getElementById("student-picker-list");
    if (!list) return;
    if (!students.length) {
      list.innerHTML = `<p class="p-4 text-sm text-slate-400">No students found.</p>`;
      return;
    }
    list.innerHTML = students.map((student) => {
      const label = studentLabel(student);
      return `
        <button type="button" data-student-id="${student.id}" class="block w-full rounded-xl px-4 py-3 text-left hover:bg-slate-50">
          <span class="block text-sm font-semibold text-slate-900">${escapeHtml(label.name)}</span>
          <span class="mt-1 block text-xs text-slate-400">${escapeHtml(label.secondary)}</span>
        </button>
      `;
    }).join("");
    list.querySelectorAll("[data-student-id]").forEach((btn) => {
      btn.addEventListener("click", () => closeStudentPicker(btn.getAttribute("data-student-id")));
    });
  }

  function filterStudentPicker() {
    const input = document.getElementById("student-picker-search");
    const term = input ? input.value.trim().toLowerCase() : "";
    const filtered = !term
      ? studentPickerStudents
      : studentPickerStudents.filter((student) => {
        return [student.full_name, student.username, student.email, student.id]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
    renderStudentPicker(filtered);
  }

  function closeStudentPicker(value) {
    const modal = document.getElementById("student-picker-modal");
    if (modal) modal.classList.add("hidden");
    if (studentPickerResolve) {
      studentPickerResolve(value || "");
      studentPickerResolve = null;
    }
  }

  async function loadStudentPickerStudents() {
    const list = document.getElementById("student-picker-list");
    if (list) list.innerHTML = `<p class="p-4 text-sm text-slate-400">Loading students...</p>`;
    const { data, error } = await window.MKV_SUPABASE.client
      .from("profiles")
      .select("id, username, full_name, email, role")
      .eq("role", "student")
      .order("full_name", { ascending: true });
    if (error) {
      if (list) list.innerHTML = `<p class="p-4 text-sm text-red-600">${escapeHtml(error.message)}</p>`;
      return;
    }
    studentPickerStudents = data || [];
    filterStudentPicker();
  }

  function pickStudent() {
    const modal = document.getElementById("student-picker-modal");
    if (!modal) return Promise.resolve(window.prompt("Student user ID for this conversation"));
    modal.classList.remove("hidden");
    const input = document.getElementById("student-picker-search");
    if (input) {
      input.value = "";
      setTimeout(() => input.focus(), 0);
    }
    loadStudentPickerStudents();
    return new Promise((resolve) => {
      studentPickerResolve = resolve;
    });
  }

  function bindChatForm() {
    const form = document.getElementById("chat-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = window.MKV_CURRENT_USER;
      if (!user || !activeThreadId || !canUseSupabase()) return;

      const body = new FormData(form).get("body");
      if (!body || !String(body).trim()) return;

      setStatus("Sending...");
      const { error } = await window.MKV_SUPABASE.client.from("chat_messages").insert({
        thread_id: activeThreadId,
        sender_id: user.id,
        body: String(body).trim(),
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      await window.MKV_SUPABASE.client
        .from("chat_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeThreadId);

      form.reset();
      setStatus("");
      await loadThreads();
      await loadMessages(activeThreadId);
    });
  }

  function bindArchiveButton() {
    const btn = document.getElementById("archive-chat-thread");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const user = window.MKV_CURRENT_USER;
      if (!activeThreadId || !isStaff(user) || !canUseSupabase()) return;
      const { error } = await window.MKV_SUPABASE.client
        .from("chat_threads")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", activeThreadId);
      if (error) {
        window.alert(error.message);
        return;
      }
      activeThreadId = null;
      await loadThreads();
      const wrap = document.getElementById("chat-messages");
      if (wrap) wrap.innerHTML = `<div class="text-center text-sm text-slate-400 py-20">Conversation deleted.</div>`;
    });
  }

  function bindStudentPicker() {
    const modal = document.getElementById("student-picker-modal");
    if (!modal) return;
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeStudentPicker("");
    });
    document.querySelectorAll("[data-student-picker-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => closeStudentPicker(""));
    });
    const input = document.getElementById("student-picker-search");
    input && input.addEventListener("input", filterStudentPicker);
  }

  function initChat() {
    if (!document.getElementById("chat-thread-list")) return;
    const user = window.MKV_CURRENT_USER;
    const role = document.getElementById("chat-role-label");
    if (role && user) role.textContent = isStaff(user) ? "Support inbox" : "Student inbox";
    const archive = document.getElementById("archive-chat-thread");
    archive && archive.classList.toggle("hidden", !isStaff(user));

    if (refreshTimer) clearInterval(refreshTimer);
    if (!user) return;

    loadThreads();
    if (activeThreadId) subscribeToThread(activeThreadId);
    refreshTimer = setInterval(() => {
      if (activeThreadId) loadMessages(activeThreadId);
    }, 15000);
  }

  document.addEventListener("mkv:auth-updated", initChat);
  document.addEventListener("DOMContentLoaded", () => {
    bindChatForm();
    bindArchiveButton();
    bindStudentPicker();
    const newBtn = document.getElementById("new-chat-thread");
    newBtn && newBtn.addEventListener("click", createThread);
    setTimeout(initChat, 0);
  });
})();
