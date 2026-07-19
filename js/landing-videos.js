/* ==========================================================================
   MKV Academy - Landing Welcome Videos
   Loads up to four public welcome videos from Supabase Storage.
   ========================================================================== */

(function () {
  const FALLBACK_VIDEOS = [
    {
      title: "Welcome to MKV Academy",
      description: "A quick introduction to the academy experience.",
      label: "Welcome",
    },
    {
      title: "How Practical Learning Works",
      description: "See how lessons connect to real engineering tasks.",
      label: "Learning",
    },
    {
      title: "Inside the Student Dashboard",
      description: "Preview paid lessons, assignments, and progress tracking.",
      label: "Dashboard",
    },
    {
      title: "Why Engineers Choose MKV",
      description: "The mindset behind practical CAD and design training.",
      label: "Outcomes",
    },
  ];

  function publicUrl(bucket, path) {
    if (!window.MKV_SUPABASE || !window.MKV_SUPABASE.client || !bucket || !path) return "";
    const { data } = window.MKV_SUPABASE.client.storage.from(bucket).getPublicUrl(path);
    return data && data.publicUrl ? data.publicUrl : "";
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

  function videoMarkup(video, index) {
    const src = video.video_url || publicUrl(video.video_bucket || "welcome-videos", video.video_path);
    const poster = publicUrl(video.poster_bucket || "welcome-videos", video.poster_path);

    if (!src) {
      return `
        <article class="mkv-card overflow-hidden">
          <div class="aspect-video bg-gradient-to-br from-slate-900 via-brand-900 to-slate-800 flex items-center justify-center">
            <div class="h-14 w-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <svg class="w-7 h-7 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 3.6A1 1 0 005 4.5v11a1 1 0 001.5.86l9-5.5a1 1 0 000-1.72l-9-5.5a1 1 0 00-.2-.04z"/></svg>
            </div>
          </div>
          <div class="p-5">
            <p class="font-technical text-xs uppercase tracking-widest text-brand-700">${escapeHtml(video.label || `Video ${index + 1}`)}</p>
            <h3 class="mt-2 font-bold text-slate-900">${escapeHtml(video.title)}</h3>
            <p class="mt-2 text-sm text-slate-500">${escapeHtml(video.description || "")}</p>
          </div>
        </article>
      `;
    }

    return `
      <article class="mkv-card overflow-hidden">
        <video class="w-full aspect-video bg-slate-900 object-cover" controls preload="metadata" ${poster ? `poster="${poster}"` : ""}>
          <source src="${src}" />
        </video>
        <div class="p-5">
          <p class="font-technical text-xs uppercase tracking-widest text-brand-700">Welcome Video ${index + 1}</p>
          <h3 class="mt-2 font-bold text-slate-900">${escapeHtml(video.title)}</h3>
          <p class="mt-2 text-sm text-slate-500">${escapeHtml(video.description || "")}</p>
        </div>
      </article>
    `;
  }

  function render(videos) {
    const grid = document.getElementById("landing-videos-grid");
    if (!grid) return;
    const usable = (videos && videos.length ? videos : FALLBACK_VIDEOS).slice(0, 4);
    grid.innerHTML = usable.map(videoMarkup).join("");
  }

  async function loadVideos() {
    const grid = document.getElementById("landing-videos-grid");
    if (!grid) return;

    if (!window.MKV_SUPABASE || !window.MKV_SUPABASE.isConfigured) {
      render(FALLBACK_VIDEOS);
      return;
    }

    try {
      const { data, error } = await window.MKV_SUPABASE.client
        .from("landing_videos")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(4);

      if (error || !data || !data.length) {
        render(FALLBACK_VIDEOS);
        return;
      }

      render(data);
    } catch (error) {
      render(FALLBACK_VIDEOS);
    }
  }

  document.addEventListener("DOMContentLoaded", loadVideos);
})();
