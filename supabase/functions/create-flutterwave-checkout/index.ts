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

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return json({ error: "Login required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const flutterwaveSecret = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
  const siteUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://www.mkvacademy.com";

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !flutterwaveSecret) {
    return json({ error: "Missing required environment variables" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

  const { course_id, coupon_code } = await req.json();
  if (!course_id) return json({ error: "Missing course_id" }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: course, error: courseError } = await admin
    .from("courses")
    .select("id, title, price, currency")
    .eq("id", course_id)
    .eq("is_active", true)
    .single();

  if (courseError || !course) return json({ error: "Course not found" }, 404);

  let discountAmount = 0;
  let couponCode = String(coupon_code || "").trim().toUpperCase();
  if (couponCode) {
    const { data: coupon } = await admin
      .from("coupons")
      .select("*")
      .eq("code", couponCode)
      .eq("is_active", true)
      .maybeSingle();
    if (coupon) {
      const expired = coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now();
      const maxed = coupon.max_redemptions && coupon.redeemed_count >= coupon.max_redemptions;
      if (!expired && !maxed) {
        discountAmount =
          coupon.discount_type === "percent"
            ? (Number(course.price || 0) * Number(coupon.discount_value || 0)) / 100
            : Number(coupon.discount_value || 0);
        discountAmount = Math.min(discountAmount, Number(course.price || 0));
      } else {
        couponCode = "";
      }
    } else {
      couponCode = "";
    }
  }

  const finalAmount = Math.max(0, Number(course.price || 0) - discountAmount);
  const txRef = `mkv__${course.id}__${userData.user.id}__${Date.now()}`;
  await admin.from("orders").insert({
    user_id: userData.user.id,
    course_id: course.id,
    amount: finalAmount,
    currency: course.currency || "NGN",
    status: "pending",
    flutterwave_tx_ref: txRef,
    coupon_code: couponCode || null,
    discount_amount: discountAmount,
  });

  if (finalAmount <= 0) {
    const { error: grantError } = await admin.rpc("grant_paid_course_access", {
      p_tx_ref: txRef,
      p_transaction_id: `coupon-${Date.now()}`,
      p_amount: 0,
      p_currency: course.currency || "NGN",
      p_status: "successful",
    });

    if (grantError) return json({ error: grantError.message }, 500);

    return json({
      payment_link: `${siteUrl}/students.html`,
      tx_ref: txRef,
      amount: finalAmount,
      discount_amount: discountAmount,
      checkout_completed: true,
    });
  }

  const initRes = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${flutterwaveSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: txRef,
      amount: finalAmount,
      currency: course.currency || "NGN",
      redirect_url: `${siteUrl}/students.html`,
      customer: {
        email: userData.user.email,
        name: userData.user.user_metadata?.full_name || userData.user.email,
      },
      customizations: {
        title: "MKV Academy",
        description: course.title,
      },
      meta: {
        user_id: userData.user.id,
        course_id: course.id,
        coupon_code: couponCode,
      },
    }),
  });

  const initData = await initRes.json();
  if (!initRes.ok || initData.status !== "success") {
    return json({ error: initData.message || "Could not create checkout" }, 500);
  }

  return json({ payment_link: initData.data.link, tx_ref: txRef, amount: finalAmount, discount_amount: discountAmount });
});
