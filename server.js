'use strict';
// PLN Gangguan - full-stack web app (zero external dependencies)
// Backend: Node.js built-in http + node:sqlite (persistent database)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const PUBLIC = fs.existsSync(path.join(ROOT, 'public', 'index.html')) ? path.join(ROOT, 'public') : ROOT;
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data.db');
const PORT = process.env.PORT || 3000;

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS laporan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    no_laporan TEXT,
    nama_pelanggan TEXT,
    no_kontrak TEXT,
    alamat TEXT,
    no_gardu TEXT,
    unit TEXT,
    tanggal_gangguan TEXT,
    keluhan TEXT,
    dilaporkan_oleh TEXT,
    status TEXT DEFAULT 'Dilaporkan',
    created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS berita_acara (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    no_ba TEXT,
    laporan_id INTEGER,
    nama_pelanggan TEXT,
    alamat TEXT,
    tanggal_perbaikan TEXT,
    mulai_padam TEXT,
    menyala_kembali TEXT,
    jenis_perbaikan TEXT,
    perbaikan TEXT,
    kondisi_tegangan TEXT,
    kode_pemadam TEXT,
    jumlah_pelanggan INTEGER,
    jurusan TEXT,
    segel TEXT,
    pembatas TEXT,
    petugas_pelaksana TEXT,
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
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
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
    if (p === '/api/laporan' && req.method === 'GET') {
      return sendJson(res, 200, db.prepare('SELECT * FROM laporan ORDER BY id DESC').all());
    }
    if (p === '/api/laporan' && req.method === 'POST') {
      const b = await readBody(req);
      const info = db.prepare(`INSERT INTO laporan
        (no_laporan,nama_pelanggan,no_kontrak,alamat,no_gardu,unit,tanggal_gangguan,keluhan,dilaporkan_oleh,status,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        b.no_laporan || '', b.nama_pelanggan || '', b.no_kontrak || '', b.alamat || '',
        b.no_gardu || '', b.unit || '', b.tanggal_gangguan || '', b.keluhan || '',
        b.dilaporkan_oleh || '', 'Dilaporkan', new Date().toISOString());
      const id = Number(info.lastInsertRowid);
      let no = b.no_laporan;
      if (!no) { no = genNo('LG', id); db.prepare('UPDATE laporan SET no_laporan=? WHERE id=?').run(no, id); }
      return sendJson(res, 201, { id, no_laporan: no });
    }
    const m = p.match(/^\/api\/laporan\/(\d+)$/);
    if (m && req.method === 'GET') {
      const row = db.prepare('SELECT * FROM laporan WHERE id=?').get(Number(m[1]));
      return row ? sendJson(res, 200, row) : sendJson(res, 404, { error: 'not found' });
    }
    if (p === '/api/berita-acara' && req.method === 'GET') {
      return sendJson(res, 200, db.prepare(`SELECT ba.*, lg.no_laporan AS laporan_no FROM berita_acara ba
        LEFT JOIN laporan lg ON lg.id = ba.laporan_id ORDER BY ba.id DESC`).all());
    }
    const mba = p.match(/^\/api\/berita-acara\/(\d+)$/);
    if (mba && req.method === 'GET') {
      const row = db.prepare(`SELECT ba.*, lg.no_laporan AS laporan_no,
        lg.tanggal_gangguan AS laporan_tanggal, lg.keluhan AS laporan_keluhan,
        lg.no_kontrak AS laporan_kontrak, lg.no_gardu AS laporan_gardu, lg.unit AS laporan_unit
        FROM berita_acara ba LEFT JOIN laporan lg ON lg.id = ba.laporan_id WHERE ba.id=?`).get(Number(mba[1]));
      return row ? sendJson(res, 200, row) : sendJson(res, 404, { error: 'not found' });
    }
    if (p === '/api/berita-acara' && req.method === 'POST') {
      const b = await readBody(req);
      const info = db.prepare(`INSERT INTO berita_acara
        (no_ba,laporan_id,nama_pelanggan,alamat,tanggal_perbaikan,mulai_padam,menyala_kembali,jenis_perbaikan,perbaikan,kondisi_tegangan,kode_pemadam,jumlah_pelanggan,jurusan,segel,pembatas,petugas_pelaksana,petugas_pembuat,ttd_pelanggan,status,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        b.no_ba || '', b.laporan_id ? Number(b.laporan_id) : null, b.nama_pelanggan || '', b.alamat || '',
        b.tanggal_perbaikan || '', b.mulai_padam || '', b.menyala_kembali || '', b.jenis_perbaikan || '',
        b.perbaikan || '', b.kondisi_tegangan || '', b.kode_pemadam || '',
        b.jumlah_pelanggan ? Number(b.jumlah_pelanggan) : null, b.jurusan || '', b.segel || '',
        b.pembatas || '', b.petugas_pelaksana || '', b.petugas_pembuat || '', b.ttd_pelanggan || '',
        b.status || 'Selesai', new Date().toISOString());
      const id = Number(info.lastInsertRowid);
      let no = b.no_ba;
      if (!no) { no = genNo('BA', id); db.prepare('UPDATE berita_acara SET no_ba=? WHERE id=?').run(no, id); }
      if (b.laporan_id) db.prepare('UPDATE laporan SET status=? WHERE id=?').run('Selesai', Number(b.laporan_id));
      return sendJson(res, 201, { id, no_ba: no });
    }
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

server.listen(PORT, () => console.log(`PLN Gangguan web berjalan di http://localhost:${PORT}`));
