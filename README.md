# SILAGA — Sistem Laporan Gangguan Listrik

Aplikasi web full-stack untuk digitalisasi **Laporan Gangguan** (diisi pelanggan) dan **Berita Acara Perbaikan** (diisi petugas) PT PLN (Persero) UP3 Purwakarta.

Menggantikan formulir kertas: pelanggan melapor lewat web, petugas mengisi berita acara, semua data tersimpan permanen di database.

## Fitur

- **Halaman Pelanggan** (`/lapor.html`) — form laporan gangguan, nomor laporan dibuat otomatis (contoh `LG-20260702-0001`).
- **Halaman Petugas** (`/petugas.html`) — form berita acara perbaikan, tertaut ke laporan pelanggan, autofill data pelanggan, nomor BA otomatis.
- **Dashboard** (`/dashboard.html`) — rekap statistik + tabel laporan & berita acara.
- **Cetak PDF** (`/ba.html?id=...`) — dokumen resmi Berita Acara berkop PLN + blok tanda tangan; klik “Unduh / Cetak PDF” untuk menyimpan sebagai PDF (arsip & tanda tangan). Buka dari kolom “Dokumen” di dashboard.
- **Backend + database** — Node.js (tanpa dependensi eksternal) + SQLite. Data tersimpan permanen di `data.db`.
- Saat berita acara dibuat, status laporan terkait otomatis menjadi **Selesai**.

## Teknologi

- Node.js (modul bawaan `http` + `node:sqlite`) — **tanpa `npm install`**. Butuh Node.js >= 22.5.
- HTML + CSS + JavaScript murni (tanpa framework).

## Menjalankan secara lokal

```bash
node server.js
# buka http://localhost:3000
```

Ubah port bila perlu: `PORT=8080 node server.js`

## Struktur proyek

```
server.js        # backend: HTTP server, API, database SQLite
package.json     # metadata + start script (untuk hosting)
public/
  index.html     # landing (pilih peran)
  lapor.html     # form pelanggan
  petugas.html   # form petugas (berita acara)
  dashboard.html # rekap data
  ba.html        # dokumen Berita Acara siap cetak/PDF
  styles.css     # gaya bersama
data.db          # database (dibuat otomatis saat pertama jalan)
```

## API

| Method | Endpoint | Fungsi |
| ------ | -------- | ------ |
| GET  | `/api/laporan` | Daftar laporan |
| POST | `/api/laporan` | Buat laporan baru |
| GET  | `/api/laporan/:id` | Detail laporan |
| GET  | `/api/berita-acara` | Daftar berita acara |
| GET  | `/api/berita-acara/:id` | Detail berita acara (untuk dokumen cetak) |
| POST | `/api/berita-acara` | Buat berita acara |
| GET  | `/api/stats` | Statistik ringkas |

## Deploy (agar data permanen di server)

Butuh host Node.js + penyimpanan file (untuk `data.db`).

- **Railway / Render / Fly.io** — start command `node server.js` (atau `npm start`). Tambahkan **Volume/Disk** dengan mount path `/data` dan set variabel `DB_PATH=/data/data.db` agar database awet saat re-deploy.
- **VPS** — jalankan `node server.js` di belakang Nginx + PM2.
- GitHub Pages **tidak** bisa (hanya file statis, tanpa backend/database).

`server.js` sudah membaca `PORT` dan `DB_PATH` dari environment.
