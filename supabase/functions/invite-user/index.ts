// Trackers Workspace — invite team member by email (owner/admin only).
// Deploy as a Supabase Edge Function named "invite-user".
// Flow: owner enters email+role in the app -> member gets an invite email
// with a login link -> clicks it, lands in the app, sets their own password.
// The service_role key is auto-provided by the Edge Functions runtime,
// so it never ships in client code.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const APP_URL = "https://rizoggyworkplace.github.io/Trackerapp/";
const ALLOWED_ROLES = ["admin", "project_manager", "regional_pic", "viewer"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ ok: false, error: "Unauthorized." }, 401);

    // Verify the caller through their own JWT with a direct auth API call
    // (mirrors a plain curl to /auth/v1/user; avoids gotrue client quirks).
    const apiKey = req.headers.get("apikey") || anonKey;
    const userRes = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${jwt}` },
    });
    if (!userRes.ok) return json({ ok: false, error: "Sesi tidak valid. Login ulang." }, 401);
    const callerUser = await userRes.json();
    if (!callerUser?.id) return json({ ok: false, error: "Sesi tidak valid. Login ulang." }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Caller profile via service_role (JWT already verified above).
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("user_id, role, access_enabled, workspace_owner_id")
      .eq("user_id", callerUser.id)
      .maybeSingle();
    if (!callerProfile || callerProfile.access_enabled !== true || !["owner", "admin"].includes(callerProfile.role)) {
      return json({ ok: false, error: "Hanya owner/admin yang dapat mengundang anggota." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "Email tidak valid." }, 400);
    if (!ALLOWED_ROLES.includes(role)) return json({ ok: false, error: "Role tidak valid." }, 400);

    const ownerId: string = callerProfile.workspace_owner_id || callerProfile.user_id;

    // Account already exists? (service_role bypasses RLS)
    const { data: existing } = await admin
      .from("profiles")
      .select("user_id, role")
      .eq("email", email)
      .maybeSingle();

    if (existing?.user_id) {
      if (existing.user_id === callerUser.id) return json({ ok: false, error: "Itu akunmu sendiri." }, 400);
      if (existing.role === "owner") return json({ ok: false, error: "Akun tersebut adalah owner." }, 400);
      const { error: upErr } = await admin.from("profiles").update({
        workspace_owner_id: ownerId, role, access_enabled: true, updated_at: new Date().toISOString(),
      }).eq("user_id", existing.user_id);
      if (upErr) throw upErr;
      await logAudit(admin, ownerId, callerUser, email, "Tambah anggota", role);
      return json({ ok: true, invited: false, email });
    }

    // New account: send the invite email with a login link.
    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: APP_URL,
      data: { full_name: email.split("@")[0] },
    });
    if (invErr) throw invErr;

    // The auth trigger auto-creates a profiles row; attach it to this workspace.
    let attached = false;
    for (let i = 0; i < 10 && !attached; i++) {
      const { data: p } = await admin.from("profiles").select("user_id").eq("user_id", invited.user.id).maybeSingle();
      if (p) {
        const { error: upErr } = await admin.from("profiles").update({
          workspace_owner_id: ownerId, role, access_enabled: true,
          full_name: email.split("@")[0], updated_at: new Date().toISOString(),
        }).eq("user_id", invited.user.id);
        if (upErr) throw upErr;
        attached = true;
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    if (!attached) return json({ ok: false, error: "Akun terbuat tapi profil belum siap. Coba lagi." }, 500);

    await logAudit(admin, ownerId, callerUser, email, "Undang anggota", role);
    return json({ ok: true, invited: true, email });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : "Gagal mengundang." }, 400);
  }
});

async function logAudit(admin: any, ownerId: string, callerUser: any, email: string, action: string, role: string): Promise<void> {
  try {
    const { data: cp } = await admin.from("profiles").select("email").eq("user_id", callerUser.id).maybeSingle();
    await admin.from("trackers_audit").insert({
      workspace_owner_id: ownerId,
      actor_id: callerUser.id,
      actor_email: cp?.email || callerUser.email || "",
      changes: [{ entity: "member", name: email, action, fields: [{ field: "role", before: null, after: role }] }],
    });
  } catch { /* audit is best-effort */ }
}
