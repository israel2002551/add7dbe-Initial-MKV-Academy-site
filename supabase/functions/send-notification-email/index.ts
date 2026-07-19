import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { notification_id } = await req.json();
  if (!notification_id) return json({ error: "Missing notification_id" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("MKV_FROM_EMAIL") || "MKV Academy <no-reply@mkvacademy.com>";

  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase service credentials" }, 500);
  if (!resendApiKey) return json({ error: "Missing RESEND_API_KEY" }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: notification, error } = await supabase
    .from("notifications")
    .select("id, user_id, title, body, action_url")
    .eq("id", notification_id)
    .single();

  if (error) return json({ error: error.message }, 500);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", notification.user_id)
    .single();

  if (profileError) return json({ error: profileError.message }, 500);

  if (!profile?.email) {
    await supabase.from("notifications").update({ email_status: "skipped" }).eq("id", notification_id);
    return json({ ok: true, skipped: true });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: profile.email,
      subject: notification.title,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>${notification.title}</h2>
          <p>${notification.body || ""}</p>
          ${
            notification.action_url
              ? `<p><a href="${notification.action_url}" style="color:#1d4ed8;font-weight:600">Open MKV Academy</a></p>`
              : ""
          }
        </div>
      `,
    }),
  });

  await supabase
    .from("notifications")
    .update({ email_status: res.ok ? "sent" : "failed" })
    .eq("id", notification_id);

  return json({ ok: res.ok });
});
