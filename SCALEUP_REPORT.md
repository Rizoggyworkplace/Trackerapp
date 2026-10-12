# Scale-Up Report — Trackers Workspace v7.7.0

Refactor untuk scalability **tanpa menambah fitur dan tanpa mengubah perilaku
aplikasi**. Semua perubahan diuji dengan suite yang ada + tes baru.

## Ringkasan hasil

| Area | Sebelum | Sesudah |
|---|---|---|
| JS diunduh saat buka aplikasi | 235 KB (11 file, blocking) | 184 KB (10 file, `defer`) — 22% lebih ringan; `pkbon.js` (51 KB) dimuat malas saat rute PKBON dibuka |
| Build production (`npm run build` → `dist/`) | tidak ada | JS 239 KB → 201 KB (minify terser, 16%); CSS 52,6 KB → 51,4 KB |
| State di localStorage | JSON mentah | Envelope terkompresi LZ (`{_v:1,_c}`); contoh state 231 KB → 25 KB (~89% lebih kecil) |
| Payload sync Supabase | snapshot JSON penuh | snapshot v61 terkompresi (kolom & RLS tidak berubah) |
| Service worker | precache semua termasuk pkbon.js | pkbon.js keluar dari precache; aset `assets/` di-cache on-demand (PKBON tetap offline setelah dibuka sekali) |

## Phase A — defer + lazy-load PKBON

- `index.html`: semua `<script src>` diberi `defer` (urutan eksekusi tetap
  terjaga); tag `pkbon.js` dihapus dari HTML.
- `assets/js/app.js`: `ensurePkbonModule()` kini menyuntikkan
  `<script src="assets/js/pkbon.js?v=20260923.77">` tepat sekali saat pertama
  dibutuhkan (rute PKBON atau perintah PKBON). Handshake `PKBON_READY` +
  antrian `pendingPkbonCommands` yang sudah ada dipakai ulang tanpa perubahan.
- Aman karena: `#pkbonIntegrated` sudah statis di HTML; `pkbonHistoryAll()`
  membaca localStorage langsung (tidak butuh modul); perintah yang datang
  sebelum modul siap tetap diantre.

## Phase B — minified build

- `npm install -D terser clean-css` berhasil (network tersedia).
- `npm run build` → `scripts/build.cjs`: salin proyek ke `dist/` (tanpa
  `node_modules`, `tests`, `scripts`), minify semua `assets/js/*.js` + `sw.js`
  (terser, 2 pass) dan `assets/css/*.css` (clean-css). Nama file tidak berubah
  sehingga `index.html`, query `?v=`, dan service worker tetap valid.
- Root repo tidak diubah → alur zero-build (server.cjs / serve.py /
  START_TRACKERS.bat / GitHub Pages root) tetap utuh.
- `BUILD.md` menjelaskan cara build & deploy `dist/`.
- Verifikasi: semua file dist lolos `node --check`; smoke test via dom-harness
  di dist — startup OK, injeksi lazy PKBON tepat sekali, handshake
  `PKBON_READY` selesai.

## Phase C — kompresi state (localStorage)

- `assets/js/core.js`: `compress`/`decompress` (LZW murni, kode 12-bit,
  kamus dibekukan di 4096 entri; kode 4095 sebagai escape untuk unit UTF-16
  ≥256 seperti emoji/CJK), plus `encodeStored`/`decodeStored` (envelope
  `{_v:1,_c}` yang juga menerima JSON lama), `encodeEnvelope`/
  `decodeEnvelope`, dan `normalizeSnapshot` (terima snapshot v60 polos & v61
  terkompresi).
- `app.js` (`save`/`load`/reset), `operations.js` (audit & before/after write),
  `pkbon.js` (`saveJSON`/`loadJSON`) memakai envelope. Data korup tetap lewat
  jalur `TRACKERS_CORRUPT_KEYS` yang sudah ada — tidak pernah crash saat start.
- Backup export memakai snapshot terkompresi; restore (`validateSnapshot` +
  `normalizeSnapshot`) menerima **kedua format**, jadi backup lama tetap bisa
  dipulihkan.
- Tes baru `tests/compression.test.cjs` (6 tes): round-trip string kosong,
  kecil, JSON besar repetitif, teks Indonesia/unicode/emoji, penolakan input
  rusak, envelope + kedua format snapshot.

## Phase D — payload sync

- `assets/js/cloud.js`: `cloudSnapshot()` kini versi 61 —
  `{trackly_c, pkbon_c}` berisi envelope terkompresi di dalam nilai jsonb yang
  sama (tanpa ubah tipe kolom / RLS / RPC `trackers_save_state`).
  `cloudApplySnapshot`, `cloudComparable`, dan logika rekonsiliasi
  menormalisasi kedua format dulu, jadi device lama (v60) dan baru (v61) bisa
  bertukar snapshot tanpa konflik palsu.
- **Delta-sync (hanya entitas berubah) tidak diimplementasikan** — butuh
  versioning per-entitas dan perubahan protokol RPC/migrasi Supabase
  (migrasi 003/004 memakai satu `updated_at` per snapshot). Kompresi saja
  sudah memangkas ~89% payload dengan nol perubahan protokol.

## Phase E — konsistensi service worker

- Versi tetap 7.7 di semua tempat (tidak di-bump).
- `pkbon.js` dikeluarkan dari daftar precache; fetch handler diperluas agar
  request `assets/*` yang tidak ada di precache di-cache saat pertama dipakai.
  Tes SW yang ada tetap hijau.

## Hasil tes

- Baseline (sebelum refactor): 62/64 lolos; 2 gagal adalah ekspektasi basi di
  `tests/regression.test.cjs` (menyebut `v7.2` / `?v=20260922.72`, kode sudah
  `v7.7` / `?v=20260923.77`) — diperbaiki.
- Final: **70/70 lolos** (`npm test`: 64 tes app + 6 tes kompresi baru).
- Tes yang membaca mentah localStorage diperbarui memakai
  `C.decodeStored` (format penyimpanan memang sengaja berubah).

## Yang tidak diubah / dilewati

- Tidak ada fitur baru, tidak ada perubahan teks UI, tidak ada perubahan
  perilaku.
- Hand-rolled minifier tidak dibuat — dipakai terser/clean-css resmi.
- Delta-sync tidak diimplementasikan (alasan di Phase D).
- `dist/` adalah artefak build; jangan edit manual — selalu `npm run build`
  ulang dari source.
