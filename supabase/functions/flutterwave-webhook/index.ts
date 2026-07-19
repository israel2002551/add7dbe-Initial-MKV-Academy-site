import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, verif-hash",
};

type FlutterwavePayload = {
  event?: string;
  data?: {
    id?: number | string;
    tx_ref?: string;
    status?: string;
    amount?: number;
    currency?: string;
    meta?: {
      user_id?: string;
      course_id?: string;
    };
  };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseTxRef(txRef = "") {
  const parts = txRef.split("__");
  if (parts.length >= 4 && parts[0] === "mkv") {
    return { course_id: parts[1], user_id: parts[2] };
  }
  return { course_id: "", user_id: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const flutterwaveSecret = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase service credentials" }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  let eventId = "";

  async function audit(status: string, fields: Record<string, unknown> = {}) {
    if (!eventId) {
      const { data } = await supabase.from("payment_events").insert({ status, ...fields }).select("id").single();
      eventId = data?.id || "";
      return;
    }
    await supabase.from("payment_events").update({ status, ...fields }).eq("id", eventId);
  }

  const payload = (await req.json()) as FlutterwavePayload;
  const data = payload.data || {};
  const transactionId = String(data.id || "");
  const txRef = String(data.tx_ref || "");

  await audit("received", {
    provider: "flutterwave",
    event_type: payload.event || "webhook",
    tx_ref: txRef,
    transaction_id: transactionId,
    payload,
  });

  const expectedHash = Deno.env.get("FLUTTERWAVE_WEBHOOK_HASH");
  const receivedHash = req.headers.get("verif-hash");
  if (expectedHash && receivedHash !== expectedHash) {
    await audit("rejected", { error_message: "Invalid webhook hash" });
    return json({ error: "Invalid webhook hash" }, 401);
  }

  if (!transactionId || !txRef) {
    await audit("invalid", { error_message: "Missing transaction data" });
    return json({ error: "Missing transaction data" }, 400);
  }

  if (!flutterwaveSecret) {
    await audit("failed", { error_message: "Missing FLUTTERWAVE_SECRET_KEY" });
    return json({ error: "Missing FLUTTERWAVE_SECRET_KEY" }, 500);
  }

  const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${flutterwaveSecret}` },
  });
  const verified = await verifyRes.json();
  const verifiedData = verified.data || {};

  if (!verifyRes.ok || verified.status !== "success" || verifiedData.status !== "successful") {
    await audit("not_successful", {
      verified_payload: verified,
      error_message: verified.message || "Payment not successful",
    });
    return json({ ok: false, message: "Payment not successful" }, 200);
  }

  const meta = verifiedData.meta || data.meta || {};
  const parsed = parseTxRef(txRef);
  const userId = meta.user_id || parsed.user_id;
  const courseId = meta.course_id || parsed.course_id;

  if (!userId || !courseId) {
    await audit("missing_metadata", {
      verified_payload: verified,
      error_message: "Missing user_id or course_id in metadata or tx_ref",
    });
    return json({ error: "Missing user_id or course_id in Flutterwave metadata/tx_ref" }, 400);
  }

  const { data: orderId, error } = await supabase.rpc("grant_paid_course_access", {
    p_user_id: userId,
    p_course_id: courseId,
    p_amount: Number(verifiedData.amount || data.amount || 0),
    p_currency: String(verifiedData.currency || data.currency || "NGN"),
    p_tx_ref: txRef,
    p_transaction_id: transactionId,
  });

  if (error) {
    await audit("grant_failed", { verified_payload: verified, error_message: error.message });
    return json({ error: error.message }, 500);
  }

  await audit("confirmed", { verified_payload: verified });
  return json({ ok: true, order_id: orderId });
});
