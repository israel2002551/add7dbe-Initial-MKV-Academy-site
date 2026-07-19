/* ==========================================================================
   MKV Academy - Supabase Client
   Shared helpers for auth, database reads, private Storage signed URLs, and
   admin uploads. Requires config.js and the Supabase browser CDN script.
   ========================================================================== */

(function () {
  const missingConfigMessage =
    "Supabase is not configured yet. Copy config.example.js to config.js and add your project URL and anon key.";

  function getConfig() {
    const cfg = window.MKV_SUPABASE_CONFIG || {};
    const hasValues =
      cfg.SUPABASE_URL &&
      cfg.SUPABASE_ANON_KEY &&
      !String(cfg.SUPABASE_URL).includes("YOUR_PROJECT_REF") &&
      !String(cfg.SUPABASE_ANON_KEY).includes("YOUR_SUPABASE");

    return hasValues ? cfg : null;
  }

  function createClient() {
    const cfg = getConfig();
    if (!cfg || !window.supabase || !window.supabase.createClient) return null;
    return window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  const client = createClient();

  async function getSession() {
    if (!client) return { data: { session: null }, error: new Error(missingConfigMessage) };
    return client.auth.getSession();
  }

  async function getCurrentUser() {
    const { data, error } = await getSession();
    return { user: data && data.session ? data.session.user : null, error };
  }

  async function getProfile(userId) {
    if (!client || !userId) return { data: null, error: null };
    return client.from("profiles").select("*").eq("id", userId).maybeSingle();
  }

  function requireClient() {
    if (!client) throw new Error(missingConfigMessage);
    return client;
  }

  async function signedDownloadUrl(bucket, path, expiresInSeconds) {
    if (!bucket || !path) return { data: null, error: new Error("Missing file path") };
    return requireClient().storage.from(bucket).createSignedUrl(path, expiresInSeconds || 3600, {
      download: true,
    });
  }

  async function signedViewUrl(bucket, path, expiresInSeconds) {
    if (!bucket || !path) return { data: null, error: new Error("Missing file path") };
    return requireClient().storage.from(bucket).createSignedUrl(path, expiresInSeconds || 3600);
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  window.MKV_SUPABASE = {
    client,
    isConfigured: !!client,
    missingConfigMessage,
    getCurrentUser,
    getProfile,
    signedDownloadUrl,
    signedViewUrl,
    slugify,
  };
})();
