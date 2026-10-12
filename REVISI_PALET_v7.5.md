# Update palet v7.5

Tema tetap: Trackers Green, Midnight Lime, Warm Sand.
Tema baru sesuai urutan gambar: Stone Gray, Forest Sage, Cloud Blue, Mono Lime.
Ocean Blue, Soft Lavender, Navy Sky, Graphite Rose dihapus; pilihan tersimpan dialihkan ke Warm Sand.
Perubahan hanya warna, tanpa perubahan layout atau SQL.

## Pemasangan
1. Ekstrak ZIP.
2. Upload seluruh isinya ke root repository Trackerapp, timpa file dengan nama yang sama. Pertahankan struktur folder assets.
3. File assets/js/config.js tidak disertakan; pertahankan konfigurasi Supabase yang sudah berjalan.
4. Tunggu GitHub Pages selesai deploy, buka UPDATE_TRACKERS.html pada situs dan jalankan pembaruan.
5. Buka Settings > Tampilan untuk memilih warna.

Paket mencakup pembaruan sinkronisasi v7.3 dan tema sebelumnya. Ditujukan untuk instalasi v7.2–v7.4 yang sudah memiliki aset ikon Material.
Validasi: sintaks JavaScript, pemilihan tujuh tema dan penyimpanan setelah muat ulang, migrasi empat tema yang dihapus menggunakan simulasi DOM. Tampilan belum diverifikasi di browser nyata.
