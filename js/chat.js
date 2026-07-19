/* ==========================================================================
   MKV Academy - In-App Chat Page
   Dedicated account-based messaging page backed by Supabase.
   ========================================================================== */

(function () {
  let activeThreadId = null;
  let threadsCache = [];
  let refreshTimer = null;
  let realtimeChannel = null;

  function isAdmin(user) {
    const role = user && user.profile && user.profile.role;
    return role === "admin" || role === "owner";
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
    if (isAdmin(window.MKV_CURRENT_USER)) {
      return `${thread.subject} - ${thread.student_id.slice(0, 8)}`;
    }
    return thread.subject;
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

    const { data, error } = isAdmin(user) ? await query : await query.eq("student_id", user.id);

    if (error) {
      renderEmptyThreads(error.message);
      return;
    }

    threadsCache = data || [];
    if (!activeThreadId && threadsCache.length) activeThreadId = threadsCache[0].id;
    renderThreads();
    if (activeThreadId) await loadMessages(activeThreadId);
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
        return `
          <div class="max-w-[82%] ${mine ? "ml-auto text-right" : ""}">
            <div class="inline-block rounded-xl px-4 py-3 ${bubbleClass}">
              <p class="text-sm leading-relaxed whitespace-pre-wrap">${escapeHtml(message.body)}</p>
              <p class="mt-2 text-[11px] ${metaClass}">${formatDate(message.created_at)}</p>
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
      if (meta) meta.textContent = `${thread.status} - ${formatDate(thread.updated_at || thread.created_at)}`;
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

    renderMessages(data || []);
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

    const subject = window.prompt("Conversation subject", "Course question");
    if (!subject) return;

    const studentId = isAdmin(user)
      ? window.prompt("Student user ID for this conversation")
      : user.id;
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

  function initChat() {
    if (!document.getElementById("chat-thread-list")) return;
    const user = window.MKV_CURRENT_USER;
    const role = document.getElementById("chat-role-label");
    if (role && user) role.textContent = isAdmin(user) ? "Admin inbox" : "Student inbox";

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
    const newBtn = document.getElementById("new-chat-thread");
    newBtn && newBtn.addEventListener("click", createThread);
    setTimeout(initChat, 0);
  });
})();
