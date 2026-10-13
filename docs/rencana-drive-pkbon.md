# Skema: Lampiran PKBON di Google Drive

Status: **DIIMPLEMENTASI 2026-10-13** (belum aktif sampai Client ID diisi).
Keputusan Oggy (2026-10-13):
1. Folder ID diurus Bro — folder "PKBON Lampiran" sudah dibuat di Drive
   Oggy dan ID-nya di-hardcode di config aplikasi (tidak perlu ditempel
   manual di Pengaturan).
2. Lampiran dihapus di aplikasi → file di Drive **dibiarkan** (arsip).
3. Tanda tangan pejabat tetap base64 — setuju.

Yang masih manual (satu kali, oleh Oggy):
- Buat OAuth Client ID (tipe Web) di Google Cloud Console, daftarkan
  origin https://rizoggyworkplace.github.io, lalu tempel Client ID ke
  `googleClientId` di assets/js/config.js. Tanpa ini tombol hubungkan
  Drive tampil "Belum dikonfigurasi".

## 1. Masalah sekarang

Foto lampiran PKBON disimpan sebagai base64 langsung di dalam data aplikasi
(di-resize max 1800px dulu). Akibatnya:

- Data aplikasi membengkak (base64 ~33% lebih besar dari file asli).
- Makan jatah localStorage HP (~5 MB) dan payload sync Supabase.
- Tidak scalable kalau foto makin banyak.

## 2. Ide dasar

Foto dipindah ke **Google Drive** (15 GB gratis). Di data aplikasi cuma
disimpan **referensi** (ID file), bukan isi fotonya. Alasannya Drive:

- Oggy sudah pakai Drive untuk foto survei site (alur kerja familiar).
- Koneksi Drive ke Muse sudah ada; tinggal koneksi dari aplikasinya.
- Privat secara default (tidak seperti ImgBB/Imgur yang publik).

Yang dipindah: 3 lampiran per bon
(`lampiranPengajuan`, `lampiranTransfer`, `lampiranBuktiBayar`).
Tanda tangan pejabat **tetap** base64 (ukurannya kecil, tidak masalah).

## 3. Keputusan desain

### 3.1 Login Google (auth)

- Pakai **Google Identity Services (GIS)** langsung di aplikasi (PWA).
- Tiap anggota tim login Google **sekali** di aplikasi (tombol
  "Hubungkan Google Drive" di Pengaturan).
- Token disimpan di browser; refresh otomatis oleh GIS.

### 3.2 Folder & akses

- Folder **sudah dibuatkan**: `PKBON Lampiran` di Drive Oggy
  (keputusan 2026-10-13: Bro yang urus, ID di-hardcode di config).
- Folder di-**share (writer)** ke akun Google tiap anggota tim
  (rizogworks@gmail.com sudah).
- Anggota baru: Oggy tinggal share folder ke akun Google-nya
  (atau minta Bro).
- File milik Oggy (pemilik folder); anggota upload ke folder itu.

### 3.3 Struktur file di Drive

- Flat, satu folder. Nama file:
  `{docId}_{jenis}_{yyyymmdd-hhmm}.jpg`
  contoh: `pkbon9f2_buktiBayar_20261013-1042.jpg`
- Tidak pakai subfolder per bon (lebih sedikit API call).

### 3.4 Format referensi (pengganti base64)

```js
// DULU: string base64
state.lampiranBuktiBayar = "data:image/jpeg;base64,..."

// BARU: objek referensi
state.lampiranBuktiBayar = {
  v: 1,
  driveId: "1a2B3cDeFgH...",
  name: "pkbon9f2_buktiBayar_20261013-1042.jpg",
  mime: "image/jpeg",
  thumb: "data:image/jpeg;base64,...", // thumbnail mungil ~160px, untuk preview offline
  uploadedAt: "2026-10-13T10:42:00+07:00"
}
```

- Kode render cek tipe: `string` = format lama (tetap tampil),
  `object` = format baru. **Foto-foto lama tidak rusak.**

### 3.5 Menampilkan foto

1. Preview cepat: pakai `thumb` mungil yang tertanam (selalu ada,
   bisa offline).
2. Tampilan penuh: URL thumbnail Drive
   `https://drive.google.com/thumbnail?id={driveId}&sz=w1000`
   (jalan selama browser login akun Google yang punya akses).
3. Fallback: kalau gagal dimuat, ambil via Drive API pakai token GIS,
   jadikan blob URL.

### 3.6 Alur upload

1. User pilih file → resize via canvas seperti sekarang
   (max 1800px, JPEG).
2. Kalau **online + sudah login Google** → upload ke folder Drive →
   state diganti objek referensi → simpan.
3. Kalau **offline / belum login Google** → simpan base64 sementara +
   tandai pending → coba lagi otomatis saat online (antrean di
   localStorage: `pkbonDrivePending`).
4. Batas tetap: JPG/PNG/WebP, maks 15 MB per file.

### 3.7 Hapus lampiran

- User hapus lampiran di aplikasi → file di Drive **dibiarkan**
  (keputusan 2026-10-13: jadi arsip, tidak ikut dihapus).
- Referensi di data aplikasi dibersihkan seperti biasa.

### 3.8 Cetak / print preview

- Saat cetak, referensi di-resolve ke URL gambar (thumbnail/full).
  Browser mengurus auth via cookie Google seperti biasa.

### 3.9 Privasi

- Folder **tidak** di-share "anyone with the link". Hanya akun tim
  yang di-share Oggy yang bisa akses.

### 3.10 Migrasi data lama

- Foto base64 yang sudah ada **tetap jalan** (backward compatible).
- Migrasi massal ke Drive dijadikan fase 2 (opsional), tidak wajib.

## 4. Yang perlu dibangun

| # | Pekerjaan | File |
|---|-----------|------|
| 1 | OAuth Client ID Google (dibuat Oggy sekali di Google Cloud Console, ditempel di config) | manual |
| 2 | Modul baru `drive.js`: init GIS, login/logout, simpan token, upload, ambil file, URL thumbnail (tidak perlu hapus file — arsip dibiarkan) | `assets/js/drive.js` (baru) |
| 3 | UI Pengaturan: tombol hubungkan Drive + status koneksi (ID folder sudah di-hardcode, tidak perlu input) | `index.html` + `app.js` |
| 4 | `readAttachment` → alur upload Drive + antrean offline | `assets/js/pkbon.js` |
| 5 | Render preview & print → resolve referensi Drive | `assets/js/pkbon.js` |
| 6 | Hapus lampiran → hapus file Drive | `assets/js/pkbon.js` |
| 7 | Tes: upload/hapus offline/online, format lama tetap tampil | `tests/` |

## 5. Pertanyaan untuk Oggy (jawab sebelum dibangun)

1. Folder ID ditempel manual di Pengaturan — setuju? (alternatif: aplikasi
   bikin folder otomatis, tapi perlu scope Drive lebih luas)
2. Saat lampiran dihapus di aplikasi, file di Drive ikut dihapus? (atau
   dibiarkan sebagai arsip)
3. Tanda tangan pejabat tetap base64 — setuju? (ukurannya kecil)

## 6. Estimasi risiko

- Terbesar: tiap anggota tim **wajib punya akun Google** dan di-share
  folder oleh Oggy. Kalau ada anggota tanpa Google, dia tidak bisa
  upload (tetap bisa pakai mode base64 sementara).
- Ketergantungan internet saat upload (sudah ditangani antrean offline).
- Tidak ada biaya tambahan. Kuota: 15 GB Drive Oggy.
