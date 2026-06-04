// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:team@peerly.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

interface Payload {
  user_id: string;
  notification_id?: string;
  title: string;
  body: string;
  url?: string;
  type?: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return new Response(JSON.stringify({ publicKey: VAPID_PUBLIC }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as Payload;
    if (!body?.user_id || !body?.title || !body?.body) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .eq("user_id", body.user_id)
      .eq("enabled", true);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: body.title,
      body: body.body,
      url: body.url ?? "/",
      type: body.type,
      data: body.data ?? {},
      notification_id: body.notification_id,
    });

    let sent = 0;
    let failed = 0;

    await Promise.all(
      subs.map(async (s: any) => {
        const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } };
        const deliveryInsert = await supabase
          .from("push_deliveries")
          .insert({
            notification_id: body.notification_id ?? null,
            subscription_id: s.id,
            user_id: body.user_id,
            payload: JSON.parse(payload),
          })
          .select("id")
          .single();
        const deliveryId = deliveryInsert.data?.id;

        try {
          await webpush.sendNotification(sub as any, payload, { TTL: 60 * 60 * 24 });
          sent++;
          await supabase
            .from("push_deliveries")
            .update({ sent_at: new Date().toISOString(), delivered_at: new Date().toISOString() })
            .eq("id", deliveryId);
          await supabase
            .from("push_subscriptions")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", s.id);
        } catch (err: any) {
          failed++;
          const statusCode = err?.statusCode;
          await supabase
            .from("push_deliveries")
            .update({
              failed_at: new Date().toISOString(),
              error: String(err?.body || err?.message || err).slice(0, 500),
            })
            .eq("id", deliveryId);
          // Gone / not registered — disable subscription
          if (statusCode === 404 || statusCode === 410) {
            await supabase
              .from("push_subscriptions")
              .update({ enabled: false })
              .eq("id", s.id);
          }
        }
      }),
    );

    return new Response(JSON.stringify({ sent, failed, total: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-push error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
