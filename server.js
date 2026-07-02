'use strict';
// SILAGA - Sistem Laporan Gangguan Listrik PLN (full-stack, zero dependencies)
// Alur sesuai formulir kertas:
//   1) LAPORAN GANGGUAN        -> diisi PETUGAS
//   2) BERITA ACARA PERBAIKAN  -> diisi/ditandatangani PELANGGAN (mengacu ke laporan)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
// Serve static files from ./public if it exists, otherwise from the project root.
const PUBLIC = fs.existsSync(path.join(ROOT, 'public', 'index.html')) ? path.join(ROOT, 'public') : ROOT;
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data.db');
const PORT = process.env.PORT || 3000;

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS laporan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    no_laporan TEXT,
    dilaporkan_oleh TEXT,
    pada_jam TEXT,
    tanggal_laporan TEXT,
    isi_laporan TEXT,
    nama_pelanggan TEXT,
    cara_lapor TEXT,
    no_telepon TEXT,
    alamat TEXT,
    no_kontrak TEXT,
    jurusan TEXT,
    mulai_padam TEXT,
    gardu_padam TEXT,
    menyala_kembali TEXT,
    gardu_nyala TEXT,
    penyebab_padam TEXT,
    perbaikan_dilakukan TEXT,
    kondisi_tegangan TEXT,
    kode_pemadam TEXT,
    jumlah_pelanggan INTEGER,
    unit TEXT,
    petugas_pembuat TEXT,
    petugas_pelaksana TEXT,
    pejabat_piket TEXT,
    tgl_ttd TEXT,
    status TEXT DEFAULT 'Dilaporkan',
    created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS berita_acara (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    no_ba TEXT,
    laporan_id INTEGER,
    nama_pelanggan TEXT,
    tanggal TEXT,
    segel_kode TEXT,
    alamat TEXT,
    pembatas_ampere TEXT,
    pembatas_tanggal TEXT,
    jenis_perbaikan TEXT,
    jam TEXT,
    petugas_pembuat TEXT,
    ttd_pelanggan TEXT,
    status TEXT DEFAULT 'Selesai',
    created_at TEXT
  );
`);

function pad(n, len) { return String(n).padStart(len, '0'); }
function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}`;
}
function genNo(prefix, id) { return `${prefix}-${stamp()}-${pad(id, 4)}`; }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { if (!data) return resolve({}); try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(PUBLIC, path.normalize(rel));
  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<h1>404 - Halaman tidak ditemukan</h1>'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const p = req.url.split('?')[0];
  try {
    // ---- LAPORAN GANGGUAN (Petugas) ----
    if (p === '/api/laporan' && req.method === 'GET') {
      return sendJson(res, 200, db.prepare('SELECT * FROM laporan ORDER BY id DESC').all());
    }
    if (p === '/api/laporan' && req.method === 'POST') {
      const b = await readBody(req);
      const cols = ['no_laporan','dilaporkan_oleh','pada_jam','tanggal_laporan','isi_laporan','nama_pelanggan','cara_lapor','no_telepon','alamat','no_kontrak','jurusan','mulai_padam','gardu_padam','menyala_kembali','gardu_nyala','penyebab_padam','perbaikan_dilakukan','kondisi_tegangan','kode_pemadam','jumlah_pelanggan','unit','petugas_pembuat','petugas_pelaksana','pejabat_piket','tgl_ttd','status','created_at'];
      const vals = cols.map((c) => {
        if (c === 'status') return 'Dilaporkan';
        if (c === 'created_at') return new Date().toISOString();
        if (c === 'jumlah_pelanggan') return b.jumlah_pelanggan ? Number(b.jumlah_pelanggan) : null;
        return b[c] != null ? b[c] : '';
      });
      const info = db.prepare(`INSERT INTO laporan (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...vals);
      const id = Number(info.lastInsertRowid);
      let no = b.no_laporan;
      if (!no) { no = genNo('LG', id); db.prepare('UPDATE laporan SET no_laporan=? WHERE id=?').run(no, id); }
      return sendJson(res, 201, { id, no_laporan: no });
    }
    const mL = p.match(/^\/api\/laporan\/(\d+)$/);
    if (mL && req.method === 'GET') {
      const row = db.prepare('SELECT * FROM laporan WHERE id=?').get(Number(mL[1]));
      return row ? sendJson(res, 200, row) : sendJson(res, 404, { error: 'not found' });
    }

    // ---- BERITA ACARA PERBAIKAN (Pelanggan) ----
    if (p === '/api/berita-acara' && req.method === 'GET') {
      return sendJson(res, 200, db.prepare(`SELECT ba.*, lg.no_laporan AS laporan_no FROM berita_acara ba
        LEFT JOIN laporan lg ON lg.id = ba.laporan_id ORDER BY ba.id DESC`).all());
    }
    const mB = p.match(/^\/api\/berita-acara\/(\d+)$/);
    if (mB && req.method === 'GET') {
      const row = db.prepare(`SELECT ba.*, lg.no_laporan AS laporan_no, lg.unit AS laporan_unit,
        lg.no_kontrak AS laporan_kontrak, lg.jurusan AS laporan_jurusan,
        lg.perbaikan_dilakukan AS laporan_perbaikan, lg.isi_laporan AS laporan_keluhan
        FROM berita_acara ba LEFT JOIN laporan lg ON lg.id = ba.laporan_id WHERE ba.id=?`).get(Number(mB[1]));
      return row ? sendJson(res, 200, row) : sendJson(res, 404, { error: 'not found' });
    }
    if (p === '/api/berita-acara' && req.method === 'POST') {
      const b = await readBody(req);
      const cols = ['no_ba','laporan_id','nama_pelanggan','tanggal','segel_kode','alamat','pembatas_ampere','pembatas_tanggal','jenis_perbaikan','jam','petugas_pembuat','ttd_pelanggan','status','created_at'];
      const vals = cols.map((c) => {
        if (c === 'status') return b.status || 'Selesai';
        if (c === 'created_at') return new Date().toISOString();
        if (c === 'laporan_id') return b.laporan_id ? Number(b.laporan_id) : null;
        return b[c] != null ? b[c] : '';
      });
      const info = db.prepare(`INSERT INTO berita_acara (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...vals);
      const id = Number(info.lastInsertRowid);
      let no = b.no_ba;
      if (!no) { no = genNo('BA', id); db.prepare('UPDATE berita_acara SET no_ba=? WHERE id=?').run(no, id); }
      if (b.laporan_id) db.prepare('UPDATE laporan SET status=? WHERE id=?').run('Selesai', Number(b.laporan_id));
      return sendJson(res, 201, { id, no_ba: no });
    }

    // ---- STATS ----
    if (p === '/api/stats' && req.method === 'GET') {
      const laporan = db.prepare('SELECT COUNT(*) c FROM laporan').get().c;
      const selesai = db.prepare("SELECT COUNT(*) c FROM laporan WHERE status='Selesai'").get().c;
      const ba = db.prepare('SELECT COUNT(*) c FROM berita_acara').get().c;
      return sendJson(res, 200, { laporan, selesai, berita_acara: ba, terbuka: laporan - selesai });
    }

    if (p.startsWith('/api/')) return sendJson(res, 404, { error: 'unknown endpoint' });
    return serveStatic(req, res, p);
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
});

server.listen(PORT, () => console.log(`SILAGA berjalan di http://localhost:${PORT}`));
