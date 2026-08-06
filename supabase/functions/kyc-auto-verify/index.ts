import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function downloadDoc(supabase: any, path: string): Promise<{ bytes: Uint8Array; b64: string; mime: string } | null> {
  const { data, error } = await supabase.storage.from("kyc-documents").download(path);
  if (error || !data) return null;
  const buf = new Uint8Array(await data.arrayBuffer());
  const mime = (data as Blob).type || "image/jpeg";
  // base64
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  const b64 = btoa(bin);
  return { bytes: buf, b64, mime };
}

async function aiVision(prompt: string, images: { b64: string; mime: string }[]): Promise<any> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const content: any[] = [{ type: "text", text: prompt }];
  for (const img of images) {
    content.push({ type: "image_url", image_url: { url: `data:${img.mime};base64,${img.b64}` } });
  }

  const res = await fetch(LOVABLE_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("AI gateway error", res.status, txt);
    return null;
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function nameSimilarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  const A = norm(a || "");
  const B = norm(b || "");
  if (!A || !B) return 0;
  const setA = new Set(A.split(/\s+/));
  const setB = new Set(B.split(/\s+/));
  let matches = 0;
  for (const t of setA) if (setB.has(t)) matches++;
  return matches / Math.max(setA.size, setB.size);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let failedSubmissionId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { submission_id } = await req.json();
    failedSubmissionId = submission_id ?? null;
    if (!submission_id) {
      return new Response(JSON.stringify({ error: "submission_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sub, error: subErr } = await supabase
      .from("kyc_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (sub.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download documents
    const [front, back, selfie] = await Promise.all([
      sub.id_front_url ? downloadDoc(supabase, sub.id_front_url) : Promise.resolve(null),
      sub.id_back_url ? downloadDoc(supabase, sub.id_back_url) : Promise.resolve(null),
      sub.selfie_url ? downloadDoc(supabase, sub.selfie_url) : Promise.resolve(null),
    ]);

    if (!front || !selfie) {
      await supabase.from("kyc_submissions").update({
        status: "auto_rejected",
        bot_reason: "missing_documents",
        bot_score: 0,
      }).eq("id", submission_id);
      return new Response(JSON.stringify({ ok: false, status: "auto_rejected", reason: "missing_documents" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hash documents
    const frontHash = await sha256Hex(front.bytes);
    const backHash = back ? await sha256Hex(back.bytes) : null;
    const selfieHash = await sha256Hex(selfie.bytes);

    await supabase.from("kyc_submissions").update({
      id_front_hash: frontHash,
      id_back_hash: backHash,
      selfie_hash: selfieHash,
    }).eq("id", submission_id);

    // Claim fingerprints
    const fps: any[] = [
      { fingerprint: frontHash, kind: "image_hash" },
      { fingerprint: selfieHash, kind: "image_hash" },
    ];
    if (backHash) fps.push({ fingerprint: backHash, kind: "image_hash" });
    if (sub.id_number) fps.push({ fingerprint: `${sub.country_code || ""}:${sub.id_number}`.toUpperCase(), kind: "id_number" });

    const { data: claim } = await supabase.rpc("claim_kyc_fingerprints", {
      p_submission_id: submission_id,
      p_user_id: user.id,
      p_fingerprints: fps,
    });

    if (claim && (claim as any).ok === false) {
      await supabase.rpc("finalize_kyc_decision", {
        p_submission_id: submission_id,
        p_decision: "auto_rejected",
        p_reviewer: null,
        p_notes: "Document already used by another account",
      });
      await supabase.from("kyc_submissions").update({
        bot_reason: "document_reused",
        bot_checks: { reuse_conflicts: (claim as any).conflicts },
      }).eq("id", submission_id);
      return new Response(JSON.stringify({ ok: false, status: "auto_rejected", reason: "document_reused" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bot checks
    const checks: Record<string, any> = {};
    let score = 0;

    // Field validity
    const validId = !!sub.id_number && sub.id_number.length >= 5;
    const validDob = sub.date_of_birth && (new Date().getFullYear() - new Date(sub.date_of_birth).getFullYear()) >= 18;
    checks.field_validity = { valid_id: validId, valid_dob: validDob };
    if (validId) score += 10;
    if (validDob) score += 10;

    // ID image quality
    const idQuality = await aiVision(
      `Analyze this government ID document image. Return JSON: {"valid": boolean, "confidence": number 0-1, "issues": string[], "country": string, "id_type": string, "name_on_document": string}`,
      [front]
    );
    checks.id_quality = idQuality;
    if (idQuality?.valid) score += 25;

    // Selfie quality
    const selfieQuality = await aiVision(
      `Analyze this selfie. Return JSON: {"valid": boolean, "is_real_person": boolean, "holding_id": boolean, "confidence": number 0-1, "issues": string[]}`,
      [selfie]
    );
    checks.selfie_quality = selfieQuality;
    if (selfieQuality?.valid && selfieQuality?.is_real_person) score += 20;

    // Face match
    const faceMatch = await aiVision(
      `Compare these two images. Image 1 is a government ID, Image 2 is a selfie. Determine if they show the same person. Return JSON: {"match": boolean, "confidence": number 0-1, "reasoning": string}`,
      [front, selfie]
    );
    checks.face_match = faceMatch;
    if (faceMatch?.match && (faceMatch?.confidence ?? 0) >= 0.7) score += 25;

    // Name match
    const nameSim = idQuality?.name_on_document && sub.full_name
      ? nameSimilarity(idQuality.name_on_document, sub.full_name)
      : 0;
    checks.name_match = { similarity: nameSim, doc_name: idQuality?.name_on_document, profile_name: sub.full_name };
    if (nameSim >= 0.5) score += 10;

    // Critical failures
    const critical: string[] = [];
    if (idQuality && idQuality.valid === false) critical.push("id_invalid");
    if (selfieQuality && selfieQuality.is_real_person === false) critical.push("selfie_invalid");
    if (faceMatch && faceMatch.match === false && (faceMatch.confidence ?? 0) >= 0.7) critical.push("face_mismatch");

    const aiUnavailable = !idQuality && !selfieQuality && !faceMatch;

    let decision = "needs_review";
    let reason = "manual_review";
    if (aiUnavailable) {
      decision = "needs_review";
      reason = "ai_unavailable";
      console.error("kyc-auto-verify: AI vision unavailable, escalating to manual review");
    } else if (critical.length > 0) {
      decision = "auto_rejected";
      reason = critical.join(",");
    } else if (score >= 85) {
      decision = "auto_approved";
      reason = "high_confidence";
    } else if (score <= 40) {
      decision = "auto_rejected";
      reason = "low_score";
    }

    await supabase.from("kyc_submissions").update({
      bot_score: score,
      bot_checks: checks,
      bot_reason: reason,
    }).eq("id", submission_id);

    await supabase.rpc("finalize_kyc_decision", {
      p_submission_id: submission_id,
      p_decision: decision,
      p_reviewer: null,
      p_notes: reason,
    });

    return new Response(JSON.stringify({ ok: true, status: decision, score, reason, checks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("kyc-auto-verify error:", message);

    // Never leave the submission stuck in `pending`: escalate to manual review
    // and record the failure in the admin audit log.
    try {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      if (failedSubmissionId) {
        await admin.rpc("kyc_job_failed", {
          p_submission_id: failedSubmissionId,
          p_error: message,
        });
      }
    } catch (logErr) {
      console.error("kyc-auto-verify: failed to record job failure", logErr);
    }

    return new Response(
      JSON.stringify({ ok: false, status: "needs_review", reason: "bot_failed", error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
