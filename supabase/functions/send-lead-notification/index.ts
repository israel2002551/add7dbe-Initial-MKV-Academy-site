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

  const { lead_id } = await req.json();
  if (!lead_id) return json({ error: "Missing lead_id" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("MKV_FROM_EMAIL") || "MKV Academy <no-reply@mkvacademy.com>";
  const defaultTo = Deno.env.get("MKV_LEADS_EMAIL") || "mkvconsultingofficial@gmail.com";

  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase service credentials" }, 500);
  if (!resendApiKey) return json({ error: "Missing RESEND_API_KEY" }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: lead, error } = await supabase
    .from("lead_submissions")
    .select("source, name, email, reason, message, notify_email, created_at")
    .eq("id", lead_id)
    .single();

  if (error) return json({ error: error.message }, 500);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: lead.notify_email || defaultTo,
      subject: `New MKV ${lead.source || "lead"} submission`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>New MKV Academy lead</h2>
          <p><strong>Name:</strong> ${lead.name || "Not provided"}</p>
          <p><strong>Email:</strong> ${lead.email}</p>
          <p><strong>Source:</strong> ${lead.source || "contact"}</p>
          <p><strong>Reason:</strong> ${lead.reason || "Not provided"}</p>
          <p><strong>Message:</strong><br>${lead.message || "Not provided"}</p>
        </div>
      `,
    }),
  });

  return json({ ok: res.ok });
});
