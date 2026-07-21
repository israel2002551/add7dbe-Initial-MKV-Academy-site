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

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return json({ error: "Login required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const flutterwaveSecret = Deno.env.get("FLUTTERWAVE_SECRET_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !flutterwaveSecret) {
    return json({ error: "Missing required environment variables" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

  const { transaction_id, tx_ref } = await req.json();
  const transactionId = String(transaction_id || "").trim();
  const txRef = String(tx_ref || "").trim();

  if (!transactionId && !txRef) return json({ error: "Missing transaction reference" }, 400);

  const verifyUrl = transactionId
    ? `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`
    : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`;

  const verifyRes = await fetch(verifyUrl, {
    headers: { Authorization: `Bearer ${flutterwaveSecret}` },
  });
  const verified = await verifyRes.json();
  const verifiedData = verified.data || {};

  if (!verifyRes.ok || verified.status !== "success" || verifiedData.status !== "successful") {
    return json({ ok: false, error: verified.message || "Payment not successful" }, 400);
  }

  const verifiedTxRef = String(verifiedData.tx_ref || txRef || "");
  const meta = verifiedData.meta || {};
  const parsed = parseTxRef(verifiedTxRef);
  const userId = meta.user_id || parsed.user_id;
  const courseId = meta.course_id || parsed.course_id;

  if (!userId || !courseId) {
    return json({ error: "Payment does not include course metadata" }, 400);
  }

  if (userId !== userData.user.id) {
    return json({ error: "This payment belongs to a different student account" }, 403);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: orderId, error } = await admin.rpc("grant_paid_course_access", {
    p_user_id: userId,
    p_course_id: courseId,
    p_amount: Number(verifiedData.amount || 0),
    p_currency: String(verifiedData.currency || "NGN"),
    p_tx_ref: verifiedTxRef,
    p_transaction_id: String(verifiedData.id || transactionId || verifiedTxRef),
  });

  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, order_id: orderId, course_id: courseId });
});
