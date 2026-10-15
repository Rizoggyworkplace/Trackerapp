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

## Yang dipahami (v1, tanpa API key)

| Hal | Contoh | Hasil |
|---|---|---|
| Nominal | `700rb`, `1,5jt`, `2 juta`, `Rp 3.309.543`, `tujuh ratus ribu` | 700000, 1500000, 2000000, 3309543, 700000 |
| Site | `site sendang Reto` | fuzzy-match ke master site → `Sendangreto` |
| Penerima | `transfer ke pak joko` | fuzzy-match ke master bank (gelar diabaikan) |
| `rekening ini` | `dikirim ke rekening ini` | pakai bank yang sedang dipilih di form |
| Nomor PKBON | otomatis | dari Google Sheet operasional (lihat bawah) |
| Mention/basa-basi | `@Om Emir`, `tolong dibantu` | diabaikan |

Kalau site/bank tidak ketemu, asisten bertanya (tampil sebagai pilihan/ketikan).
Kalau nominal tidak disebut, asisten menanyakannya.

## Nomor PKBON dari Google Sheet

Sumber: sheet operasional, tab `Sheet2`, kolom `B` (NO) dan `C` (PKBON).

Aturan: **nomor urut = (nomor terbesar di kolom PKBON) + 1**,
diformat `00935-3/X/2026`
(5 digit + `-3/` + bulan romawi + tahun — sama dengan `buildPkbonNo`).

- Sheet dibaca publik via gviz (`fetch`, tanpa login).
- Hasil di-cache per sesi; kalau fetch gagal (offline) → fallback ke
  `nextSequence()` lokal (history perangkat).
- **Tulis-balik otomatis**: setiap PKBON yang disimpan via asisten langsung
  mengisi baris baru: kolom C=nomor PKBON, E=site, F=tanggal (D/M/YYYY),
  G=perihal, H=nominal (`Rp 3.309.543`), I=PIC (nama profil Google).
  Baris tulis = tepat setelah baris terakhir yang terisi (bukan baris kosong
  pertama). Nomor yang sudah ada di sheet tidak ditulis ulang (anti duplikat).
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

## Upgrade ke LLM (fase 2)

Parser aturan menangani pola umum. Untuk perintah kompleks, colokkan LLM:

```js
// di console / modul inisialisasi:
TrackersAI.llm.endpoint = async (text, ctx) => {
  const r = await supabase.functions.invoke('ai-parse', {body: {text, ctx}});
  return r.data; // {draft: {...}} atau null
};
```

Pola yang disarankan: Supabase Edge Function `ai-parse` (seperti `invite-user`)
memegang API key, menerima teks + konteks (sites, banks), mengembalikan JSON
draft terstruktur. Kunci tidak pernah ke-expose di browser.

## Test

`npm test` — termasuk `tests/ai-assistant.test.cjs` (10 test: parser nominal,
2 contoh perintah asli, fuzzy site/bank, format nomor, baca sheet).
