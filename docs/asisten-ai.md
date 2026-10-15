# Asisten AI PKBON

Perintah bahasa Indonesia → draft PKBON otomatis. Tombol 🤖 di kanan bawah,
tersedia di semua halaman aplikasi.

## Cara pakai

1. Klik tombol 🤖, ketik perintah biasa, mis:
   - `buatkan PKBON untuk pelunasan jasa PLN 700rb transfer ke Baidhowi`
   - `bayarkan multiguna site Sendangreto Rp 3.309.543 ke pak Joko`
2. Asisten mengisi form sebagai **DRAFT**, menampilkan kartu ringkasan.
3. Cek → **✅ Simpan** (atau ketik `ya`) / **Batal** (form tetap terisi, bisa edit manual).

Asisten tidak pernah menyimpan otomatis — selalu ada konfirmasi dulu.

## Cara kerja (full Groq, tanpa parser aturan)

1. User ketik perintah → dikirim ke edge function `ai-parse` (Supabase) bersama konteks:
   daftar site, daftar bank, 5 riwayat PKBON terakhir, state form aktif,
   dan 6 pesan percakapan terakhir.
2. Groq mengembalikan JSON draft terstruktur (`intent`, `draft`, `butuh`, `tanya`).
3. `validasiHasilLLM` mencocokkan hasil ke data ASLI sebelum jadi draft:
   site harus sama persis dengan daftar, bank dari daftar (atau bank baru yang
   eksplisit), nominal angka > 0 yang benar-benar disebut. Kalau ngarang → ditolak.
4. Kalau AI ragu / info kurang → ia bertanya balik (`tanya`), bukan mengarang.
   Jawaban user diproses sebagai perintah lanjutan dengan memori percakapan,
   jadi "ganti nominalnya jadi 500rb" atau "site yang sama" tetap nyambung.
5. Draft valid → kartu konfirmasi → **Simpan** / Batal.

Kalau AI tidak bisa dihubungi (server/koneksi) → pesan error, user coba lagi.
API key Groq dipegang edge function, tidak pernah ke-expose di browser.

## Nomor PKBON dari Google Sheet

Sumber: sheet operasional, tab `Sheet2`, kolom `B` (NO) dan `C` (PKBON).

Aturan: **nomor urut = (nomor terbesar di kolom PKBON) + 1**,
diformat `00935-3/X/2026`
(5 digit + `-3/` + bulan romawi + tahun — sama dengan `buildPkbonNo`).

- Sheet dibaca via Sheets API v4 (butuh login Google, scope `spreadsheets`).
  Jangan pakai gviz: gviz berhenti di sel kosong pertama sehingga baris tulis
  bisa jatuh di tengah data / menimpa baris terisi (bug 2026-10-15).
- Hasil di-cache per sesi; kalau fetch gagal (offline) → fallback ke
  `nextSequence()` lokal (history perangkat).
- **Tulis-balik otomatis**: setiap PKBON yang disimpan via asisten langsung
  mengisi baris baru: kolom C=nomor PKBON, E=site, F=tanggal (D/M/YYYY),
  G=perihal, H=nominal (`Rp 3.309.543`), I=PIC (nama profil Google).
  Baris tulis = tepat setelah baris terakhir yang terisi (selalu di ujung
  paling bawah — tidak pernah mengisi celah kosong di tengah, tidak pernah
  menimpa baris yang sudah terisi).
- **PERATURAN baris tulis** (minta Oggy, 2026-10-15):
  1. "Terisi" dinilai dari seluruh kolom data C..I, bukan cuma kolom C —
     baris yang diisi manual tanpa nomor PKBON tetap dihitung.
  2. Pengaman: tidak pernah menulis di/atas baris 981 (baris terakhir data
     saat aturan dibuat). Kalau hitungan jatuh di bawahnya, pakai baris 982.
  3. Sebelum PUT, baris target dicek ulang: kalau ada sel C..I yang terisi,
     geser ke bawah sampai ketemu baris yang C..I-nya kosong semua.
  Nomor yang sudah ada di sheet tidak ditulis ulang (anti duplikat).
- Tulis-balik memakai OAuth Google yang sudah ada (scope `spreadsheets`
  ditambahkan ke login Drive). Koneksi lama perlu **hubungkan ulang sekali**
  di Pengaturan untuk menyetujui izin baru. Gagal tulis tidak menggagalkan
  simpan — tersedia tombol "🔁 Coba isi sheet lagi".

## Arsitektur

```
chat UI (ai-assistant.js) ──route('pkbon')──▶ ensurePkbonModule()
        │                                            │
        ▼                                            ▼
parsePerintahPKBON() ──draft──▶ window.TrackersPkbonAPI.fillDraft()
  (aturan v1 / LLM fase 2)          (di dalam closure pkbon.js)
        │                                            │
        ▼                                            ▼
konfirmasi user ──▶ API.saveCurrent() ──▶ history
```

- `assets/js/ai-assistant.js` — parser + chat UI + orkestrasi. Classic script,
  tidak menyentuh DOM di top-level sehingga bisa di-require Node untuk test.
- `assets/js/pkbon.js` — mengekspos `window.TrackersPkbonAPI`
  (`newDoc`, `fillDraft`, `saveCurrent`, `getSites`, `getBanks`,
  `getSelectedBank`, `nextSequence`, …). Satu-satunya perubahan di file ini.
- Nomor sheet: `TrackersAI.getNextSeqFromSheet()` / `formatPkbonNo()`.

## Edge function `ai-parse`

`supabase/functions/ai-parse/index.ts` — verifikasi JWT via direct fetch
`/auth/v1/user` (pola `invite-user`), secret `GROQ_API_KEY`, model default
`openai/gpt-oss-20b` (override via `GROQ_MODEL`).

Grounding di system prompt: site cocok persis daftar, bank dari daftar kecuali
`isBaru`, nominal harus tertulis eksplisit di teks (700rb=700000, 1,5jt=1500000),
uraian PERTAHANKAN kata kunci asli pengguna (jangan parafrase generik),
data kurang → `butuh` + `tanya`.

## Test

`npm test` — termasuk `tests/ai-assistant.test.cjs` (14 test: `validasiHasilLLM`
anti-halusinasi, penomoran & tulis-balik sheet).
