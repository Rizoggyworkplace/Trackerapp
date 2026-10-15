// Trackers Workspace — AI parse perintah PKBON via multi-provider (failover).
// Deploy as a Supabase Edge Function named "ai-parse".
// Flow: aplikasi kirim {text, context} -> function verifikasi JWT -> coba provider
// berurutan (Groq -> DeepSeek -> OpenRouter, semua OpenAI-compatible + JSON mode)
// -> kembalikan JSON draft. API key disimpan sebagai secret Supabase,
// tidak pernah ke browser.
//
// Anti-halusinasi:
//  1. LLM hanya boleh memilih site/bank dari daftar yang dikirim (exact match).
//  2. Nominal harus angka > 0 yang benar-benar disebut di teks.
//  3. Kalau ragu -> kembalikan "butuh" (field yang kurang), bukan ngarang.
//  4. Klien memvalidasi ulang hasil terhadap data asli sebelum jadi draft.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

const SYSTEM_PROMPT = `Kamu adalah parser perintah PKBON (permohonan kasbon operasional) untuk aplikasi Trackers Workspace.
Tugasmu: ubah perintah bahasa Indonesia (sering informal, disingkat) menjadi JSON terstruktur.

ATURAN KERAS (anti-halusinasi):
1. "site" HARUS sama persis dengan salah satu nama di daftar site yang diberikan. Jangan mengarang, jangan memperbaiki ejaan sendiri — kalau tidak ada yang cocok, isi null.
2. "bank.nama", "bank.rekening", "bank.bank" HARUS dari daftar bank yang diberikan (cocokkan by nama atau nomor rekening).
   Kalau nomor rekening TIDAK ada di daftar = bank BARU: isi "isBaru": true dan tulis apa adanya
   TANPA mengarang nomor rekening. JANGAN PERNAH memaksa cocokkan ke bank yang mirip/namanya hampir sama.
3. "nominal" HARUS angka (Rupiah, tanpa titik/koma) yang benar-benar disebut di teks. "700rb"=700000, "1,5jt"=1500000, "tiga juta"=3000000. Kalau tidak disebut, isi null — JANGAN menebak.
4. "uraian" = ringkasan pembayaran dari teks perintah. PERTAHANKAN kata kunci asli
   pengguna (mis. "multiguna", "jasa PLN", "pelunasan") — jangan parafrase jadi
   kalimat generik. Contoh: "bayarkan multiguna site Sendangreto" -> "Pembayaran multiguna".
5. "pekerjaan" = jenis/nama pekerjaan yang jelas dari teks (mis. "Jasa Admin Freelance",
   "Multiguna", "Jasa PLN"). WAJIB diisi bila teks menyebut nama pekerjaan/jasa —
   jangan biarkan null kalau ada katanya. Hanya isi null bila benar-benar tidak ada info.
6. Kalau perintah bukan tentang membuat PKBON, intent = "bukan_pkbon".
7. Kalau info kurang untuk membuat draft (mis. nominal/site tidak jelas), intent = "buat_pkbon" tapi isi "butuh" dengan field yang kurang: "nominal", "site", atau "bank". Jangan mengarang nilainya.
8. Gunakan "percakapan" (pesan sebelumnya) untuk memahami rujukan seperti "yang tadi", "ganti nominalnya", "site yang sama".

KELUARAN: hanya JSON valid, tanpa markdown, tanpa penjelasan. Skema:
{
  "intent": "buat_pkbon" | "bukan_pkbon",
  "draft": {
    "site": "nama persis dari daftar atau null",
    "projectId": "projectId site tersebut atau null",
    "pekerjaan": "string atau null",
    "uraian": "string",
    "nominal": 1234567 atau null,
    "tanggal": "YYYY-MM-DD atau null (default hari ini bila disebut 'hari ini')",
    "bank": {"nama": "...", "rekening": "...", "bank": "...", "isBaru": false}
  } | null,
  "butuh": ["nominal", "site", "bank"],
  "tanya": "kalimat tanya santai dalam Bahasa Indonesia bila ada yang kurang, atau null"
}`;

function buildUserMessage(text: string, ctx: any): string {
  const sites = (ctx.sites || []).map((s: any) => `- ${s.name} (projectId: ${s.projectId || "-"})`).join("\n") || "(kosong)";
  const banks = (ctx.banks || []).map((b: any) => `- ${b.nama} | ${b.rekening} | ${b.bank}`).join("\n") || "(kosong)";
  const hist = (ctx.history || []).slice(0, 5).map((h: any) =>
    `- ${h.pkbonNo || "?"}: ${h.uraian || "-"} @ ${h.site || "-"} Rp${h.nominal || 0} -> ${h.bankNama || "-"}`
  ).join("\n") || "(kosong)";
  const conv = (ctx.conversation || []).slice(-6).map((m: any) =>
    `${m.role === "user" ? "Pengguna" : "Asisten"}: ${m.text}`
  ).join("\n") || "(baru mulai)";
  const form = ctx.formState ? JSON.stringify(ctx.formState) : "(form kosong)";
  // "Hari ini" dalam WIB (UTC+7), bukan UTC — supaya tidak selisih sehari jam 00:00–07:00.
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  return `Tanggal hari ini: ${today}

Daftar site (PILIH SALAH SATU, sama persis):
${sites}

Daftar bank tersimpan:
${banks}

Riwayat PKBON terakhir (untuk konteks kebiasaan):
${hist}

Isi form yang sedang berjalan:
${form}

Percakapan terakhir:
${conv}

Perintah pengguna:
"${text}"

Keluarkan JSON sesuai skema.`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    // Daftar provider AI berurutan: utama -> cadangan 1 -> cadangan 2.
    // Semua OpenAI-compatible (chat completions + JSON mode). Provider tanpa key dilewati otomatis.
    const PROVIDERS = [
      { name: "groq",
        url: "https://api.groq.com/openai/v1/chat/completions",
        key: Deno.env.get("GROQ_API_KEY") || "",
        model: Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-20b" },
      { name: "deepseek",
        url: "https://api.deepseek.com/chat/completions",
        key: Deno.env.get("DEEPSEEK_API_KEY") || "",
        model: Deno.env.get("DEEPSEEK_MODEL") || "deepseek-chat" },
      { name: "openrouter",
        url: "https://openrouter.ai/api/v1/chat/completions",
        key: Deno.env.get("OPENROUTER_API_KEY") || "",
        model: Deno.env.get("OPENROUTER_MODEL") || "openai/gpt-oss-120b:free" },
    ].filter(p => p.key);
    if(!PROVIDERS.length)
      return json({ ok: false, error: "API key AI belum diset di secrets Supabase." }, 500);

    // Verifikasi JWT pemanggil (pola sama seperti invite-user).
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ ok: false, error: "Unauthorized." }, 401);
    const apiKey = req.headers.get("apikey") || anonKey;
    const userRes = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${jwt}` },
    });
    if (!userRes.ok) return json({ ok: false, error: "Sesi tidak valid. Login ulang." }, 401);
    const callerUser = await userRes.json();
    if (!callerUser?.id) return json({ ok: false, error: "Sesi tidak valid. Login ulang." }, 401);

    const body = await req.json().catch(() => ({}));
    const text = String(body.text || "").trim();
    if (!text) return json({ ok: false, error: "Teks kosong." }, 400);
    if (text.length > 2000) return json({ ok: false, error: "Teks terlalu panjang." }, 400);
    const context = body.context || {};

    // Failover: coba provider berurutan. 429/5xx/gangguan jaringan langsung
    // lanjut ke cadangan TANPA retry buta ke provider yang sama (retry 2,5 dtk
    // ke provider yang sama terbukti gagal lagi saat kepentok TPM per-menit).
    const chatBody = (model: string) => JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(text, context) },
      ],
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });
    let servedBy = "", raw = "";
    const failures: string[] = [];
    for(const p of PROVIDERS){
      try{
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + p.key,
        };
        if(p.name === "openrouter"){
          headers["HTTP-Referer"] = "https://rizoggyworkplace.github.io/Trackerapp/";
          headers["X-Title"] = "Trackers Workspace PKBON AI";
        }
        const r = await fetch(p.url, { method: "POST", headers, body: chatBody(p.model) });
        if(r.ok){
          const g = await r.json();
          raw = g?.choices?.[0]?.message?.content || "";
          servedBy = p.name;
          break;
        }
        const t = await r.text().catch(() => "");
        failures.push(p.name + ": HTTP " + r.status);
        console.error("ai-parse failover:", p.name, "HTTP", r.status, t.slice(0, 200));
      }catch(e){
        failures.push(p.name + ": network error");
        console.error("ai-parse failover:", p.name, "network error", String(e).slice(0, 200));
      }
    }
    if(!servedBy){
      console.error("ai-parse: semua provider gagal:", failures.join(" | "));
      const kenaLimit = failures.some(f => f.includes("429"));
      return json({ ok: false, error: kenaLimit
        ? "AI kena rate limit di semua provider, coba lagi 1 menit."
        : "AI sedang tidak bisa dihubungi (" + failures.join(", ") + "). Coba lagi sebentar." }, 502);
    }
    let parsed: any = null;
    try{
      parsed = JSON.parse(raw);
    }catch{
      return json({ ok: false, error: "AI mengembalikan format tak dikenal." }, 502);
    }
    return json({ ok: true, result: parsed, provider: servedBy });
  } catch (e) {
    console.error("ai-parse error:", e);
    return json({ ok: false, error: "Terjadi kesalahan di server AI." }, 500);
  }
});
