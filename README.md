# SILAGA — Sistem Laporan Gangguan Listrik

Aplikasi web full-stack untuk digitalisasi formulir gangguan PT PLN (Persero) UP3 Purwakarta.

Alur mengikuti formulir kertas asli:

1. **Laporan Gangguan** — diisi **Petugas** (data pelanggan, waktu padam, gardu, penyebab, tindakan perbaikan, petugas pelaksana).
2. **Berita Acara Perbaikan** — diisi & **ditandatangani Pelanggan/Penghuni** sebagai bukti gangguan telah ditangani (mengacu ke Laporan Gangguan terkait).

## Fitur

- **Halaman Petugas** (`/lapor.html`) — form Laporan Gangguan lengkap; nomor laporan otomatis (contoh `LG-20260702-0001`).
- **Halaman Pelanggan** (`/petugas.html`) — form Berita Acara Perbaikan; pilih laporan gangguan (autofill data pelanggan), nomor BA otomatis.
- **Dashboard** (`/dashboard.html`) — statistik + tabel Laporan Gangguan & Berita Acara.
- **Cetak PDF** (`/ba.html?id=...`) — dokumen resmi Berita Acara berkop PLN + blok tanda tangan (Petugas Pembuat Laporan & Pelanggan/Penghuni) + catatan resmi. Buka via kolom “Dokumen” di dashboard, klik “Unduh / Cetak PDF”.
- Saat Berita Acara dibuat, status Laporan Gangguan terkait otomatis menjadi **Selesai**.
- **Backend + database** Node.js (tanpa dependensi eksternal) + SQLite; data permanen di `data.db`.

> Catatan nama file: `lapor.html` = halaman Petugas (Laporan Gangguan), `petugas.html` = halaman Pelanggan (Berita Acara). Nama file dipertahankan agar update di hosting berupa penimpaan bersih.

## Teknologi

- Node.js modul bawaan `http` + `node:sqlite` — **tanpa `npm install`**. Butuh Node.js >= 22.5.
- HTML + CSS + JavaScript murni.

## Menjalankan lokal

```bash
node --experimental-sqlite server.js
# buka http://localhost:3000
```

## API

| Method | Endpoint | Fungsi |
| ------ | -------- | ------ |
| GET  | `/api/laporan` | Daftar laporan gangguan |
| POST | `/api/laporan` | Buat laporan gangguan (petugas) |
| GET  | `/api/laporan/:id` | Detail laporan |
| GET  | `/api/berita-acara` | Daftar berita acara |
| GET  | `/api/berita-acara/:id` | Detail berita acara (untuk cetak) |
| POST | `/api/berita-acara` | Buat berita acara (pelanggan) |
| GET  | `/api/stats` | Statistik ringkas |

## Deploy (Railway / Render / Fly.io)

- Start command: `npm start` (sudah memakai flag `--experimental-sqlite`).
- Butuh Node.js >= 22.5 (di-pin lewat `engines` di `package.json`).
- Tambahkan **Volume/Disk** mount path `/data` dan variabel `DB_PATH=/data/data.db` agar database awet saat re-deploy.
- GitHub Pages tidak bisa (hanya statis).
