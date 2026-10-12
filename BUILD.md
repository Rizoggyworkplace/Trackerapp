# Build & Deploy

Sumber utama (source of truth) tetap folder repo ini — aplikasi jalan langsung
tanpa build (`server.cjs`, `serve.py`, `START_TRACKERS.bat`, atau GitHub Pages
yang menyajikan root repo).

## Membuat versi production (`dist/`)

```bash
npm install   # sekali saja: memasang terser + clean-css
npm run build
```

Build menyalin seluruh proyek ke `dist/` lalu mem minify `assets/js/*.js`
(terser) dan `assets/css/*.css` (clean-css). Nama file tidak berubah, jadi
`index.html`, service worker, dan query `?v=` tetap valid — tidak ada yang
perlu diubah manual.

Hasil terakhir: JS 239 KB → 201 KB (~16% lebih kecil).

## Deploy `dist/`

- **GitHub Pages:** push isi `dist/` ke branch `gh-pages` (atau folder
  `docs/`), contoh: `npx gh-pages -d dist`.
- **Server lokal:** `server.cjs` dan `serve.py` ikut tersalin ke `dist/`,
  jadi cukup `cd dist && node server.cjs` (atau `python serve.py`).

## Catatan

- `dist/` tidak di-commit; selalu hasilkan ulang dari source dengan
  `npm run build` sebelum deploy.
- Service worker: `dist/sw.js` ikut di-minify; version `7.7` tidak berubah,
  jadi update ke user tetap lewat alur `UPDATE_TRACKERS.html` seperti biasa.
