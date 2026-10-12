// Backend portfolio: Express + SQLite lokal / Neon di Vercel. Jalanin: npm start
const express = require('express'), multer = require('multer'), crypto = require('crypto'), path = require('path'), fs = require('fs');

// --- baca .env (tanpa library tambahan) ---
try { fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach(l => { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }); } catch {}
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) { console.error('ERROR: isi ADMIN_PASSWORD di file .env (lihat .env.example)'); process.exit(1); }
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const db = process.env.VERCEL && process.env.DATABASE_URL ? require('./neon-db') : require('./db');
const dbReady = typeof db.init === 'function' ? db.init() : Promise.resolve();
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' }); next(); });
app.use(async (req, res, next) => {
  try { await dbReady; next(); }
  catch (error) { console.error('Database initialization failed:', error.message); res.status(500).json({ error: 'Database belum siap.' }); }
});

// --- rate limit sederhana (per IP, di memori) ---
const hits = new Map();
const limit = (max, ms) => (req, res, next) => {
  const k = req.path + req.ip, now = Date.now(), h = (hits.get(k) || []).filter(t => now - t < ms);
  if (h.length >= max) return res.status(429).json({ error: 'Terlalu banyak percobaan, coba lagi nanti.' });
  h.push(now); hits.set(k, h); next();
};

// --- auth admin: cookie bertanda tangan HMAC ---
const sign = v => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
const safeEq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const getCookie = (req, n) => (req.headers.cookie || '').split(';').map(c => c.trim().split('=')).find(c => c[0] === n)?.[1];
const isAuthed = req => { const t = getCookie(req, 'session'); if (!t) return false; const [exp, sig] = t.split('.'); return !!sig && Date.now() < +exp && safeEq(sig, sign(exp)); };
const auth = (req, res, next) => isAuthed(req) ? next() : res.status(401).json({ error: 'Belum login' });

app.post('/api/admin/login', limit(8, 15 * 60 * 1000), (req, res) => {
  if (!safeEq(String(req.body?.password || ''), ADMIN_PASSWORD)) return res.status(401).json({ error: 'Password salah' });
  const exp = String(Date.now() + 7 * 864e5);
  res.cookie('session', `${exp}.${sign(exp)}`, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 864e5 });
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie('session'); res.json({ ok: true }); });
app.get('/api/admin/me', (req, res) => res.json({ authed: isAuthed(req) }));

// --- API publik ---
const all = (t) => db.prepare(`SELECT * FROM ${t} ORDER BY sort, id`).all();
app.get('/api/content', async (req, res) => {
  const [settingRows, experiences, projects, gallery, skills, facts, links] = await Promise.all([
    db.prepare('SELECT key,value FROM settings').all(), all('experiences'), all('projects'), all('gallery'), all('skill_groups'), all('facts'), all('links')
  ]);
  const settings = Object.fromEntries(settingRows.map(r => [r.key, r.value]));
  res.json({ settings, experiences, projects, gallery, skills, facts, links });
});
const visitorHash = v => crypto.createHash('sha256').update(String(v)).digest('hex');
app.get('/api/stats', async (req, res) => {
  const [visits, likes] = await Promise.all([db.prepare('SELECT COUNT(*) n FROM site_visits').get(), db.prepare('SELECT COUNT(*) n FROM site_likes').get()]);
  res.json({ views: visits.n, likes: likes.n });
});
app.post('/api/visit', async (req, res) => {
  const id = String(req.body?.visitor_id || '');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id)) return res.status(400).json({ error: 'ID kunjungan tidak valid.' });
  await db.prepare('INSERT OR IGNORE INTO site_visits(visitor) VALUES(?)').run(visitorHash(id));
  res.json({ views: (await db.prepare('SELECT COUNT(*) n FROM site_visits').get()).n });
});
app.post('/api/like/state', async (req, res) => {
  const id = String(req.body?.visitor_id || '');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id)) return res.status(400).json({ error: 'ID like tidak valid.' });
  const [liked, count] = await Promise.all([db.prepare('SELECT 1 FROM site_likes WHERE visitor=?').get(visitorHash(id)), db.prepare('SELECT COUNT(*) n FROM site_likes').get()]);
  res.json({ liked: !!liked, likes: count.n });
});
app.post('/api/like/toggle', limit(30, 60 * 60 * 1000), async (req, res) => {
  const id = String(req.body?.visitor_id || '');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id)) return res.status(400).json({ error: 'ID like tidak valid.' });
  const hash = visitorHash(id), exists = await db.prepare('SELECT 1 FROM site_likes WHERE visitor=?').get(hash);
  if (exists) await db.prepare('DELETE FROM site_likes WHERE visitor=?').run(hash);
  else await db.prepare('INSERT INTO site_likes(visitor) VALUES(?)').run(hash);
  res.json({ liked: !exists, likes: (await db.prepare('SELECT COUNT(*) n FROM site_likes').get()).n });
});
app.post('/api/contact', limit(5, 60 * 60 * 1000), async (req, res) => {
  const { name, email, message, website } = req.body || {};
  if (website) return res.json({ ok: true }); // honeypot anti-bot
  const n = String(name || '').trim(), e = String(email || '').trim(), m = String(message || '').trim();
  if (!n || n.length > 120) return res.status(400).json({ error: 'Nama wajib diisi (maks 120 karakter).' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 200) return res.status(400).json({ error: 'Format email tidak valid.' });
  if (m.length < 10 || m.length > 3000) return res.status(400).json({ error: 'Pesan 10-3000 karakter.' });
  await db.prepare('INSERT INTO messages(name,email,message) VALUES(?,?,?)').run(n, e, m);
  res.json({ ok: true });
});

// --- upload gambar/PDF (tanpa SVG demi keamanan) ---
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf' };
const upload = multer({
  storage: multer.diskStorage({ destination: path.join(__dirname, 'uploads'), filename: (q, f, cb) => cb(null, crypto.randomBytes(12).toString('hex') + EXT[f.mimetype]) }),
  limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (q, f, cb) => cb(null, !!EXT[f.mimetype])
});
app.post('/api/admin/upload', auth, upload.single('file'), (req, res) => req.file ? res.json({ url: '/uploads/' + req.file.filename }) : res.status(400).json({ error: 'File harus JPG/PNG/WebP/GIF/PDF, maks 8MB.' }));

// --- CRUD admin (tabel + kolom yang boleh diubah) ---
const R = {
  experiences: 'title,org,period,description,color',
  projects: 'title,label,code,description,image,highlight_type,highlight,stack,links,color,size',
  gallery: 'category,title,image,crop_x,crop_y',
  skills: 'title,items,color',
  facts: 'value,label,visible,source',
  links: 'label,url,display'
};
const tbl = r => r === 'skills' ? 'skill_groups' : r;
const pick = (r, body) => R[r].split(',').map(c => String(body[c] ?? '').slice(0, 5000));
app.get('/api/admin/messages', auth, async (req, res) => res.json(await db.prepare('SELECT * FROM messages ORDER BY id DESC').all()));
app.patch('/api/admin/messages/:id', auth, async (req, res) => { await db.prepare('UPDATE messages SET is_read=? WHERE id=?').run(req.body.is_read ? 1 : 0, req.params.id); res.json({ ok: true }); });
app.delete('/api/admin/messages/:id', auth, async (req, res) => { await db.prepare('DELETE FROM messages WHERE id=?').run(req.params.id); res.json({ ok: true }); });
app.get('/api/admin/settings', auth, async (req, res) => res.json(Object.fromEntries((await db.prepare('SELECT key,value FROM settings').all()).map(r => [r.key, r.value]))));
app.put('/api/admin/settings', auth, async (req, res) => {
  const s = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  for (const [k, v] of Object.entries(req.body || {})) if (/^[a-z_]{1,30}$/.test(k)) await s.run(k, String(v).slice(0, 2000));
  res.json({ ok: true });
});
app.get('/api/admin/:r', auth, async (req, res) => R[req.params.r] ? res.json(await all(tbl(req.params.r))) : res.sendStatus(404));
app.post('/api/admin/:r/reorder', auth, async (req, res) => {
  const r = req.params.r; if (!R[r]) return res.sendStatus(404);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const up = db.prepare(`UPDATE ${tbl(r)} SET sort=? WHERE id=?`);
  for (const [i, id] of ids.entries()) await up.run(i + 1, Number(id));
  res.json({ ok: true });
});
app.post('/api/admin/:r', auth, async (req, res) => {
  const r = req.params.r; if (!R[r]) return res.sendStatus(404);
  const cols = R[r], t = tbl(r);
  const info = await db.prepare(`INSERT INTO ${t}(${cols},sort) VALUES(${cols.split(',').map(() => '?')},(SELECT COALESCE(MAX(sort),0)+1 FROM ${t})) RETURNING id`).get(...pick(r, req.body));
  res.json({ id: info.id });
});
app.put('/api/admin/:r/:id', auth, async (req, res) => {
  const r = req.params.r; if (!R[r]) return res.sendStatus(404);
  await db.prepare(`UPDATE ${tbl(r)} SET ${R[r].split(',').map(c => c + '=?').join(',')} WHERE id=?`).run(...pick(r, req.body), req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/:r/:id', auth, async (req, res) => { if (!R[req.params.r]) return res.sendStatus(404); await db.prepare(`DELETE FROM ${tbl(req.params.r)} WHERE id=?`).run(req.params.id); res.json({ ok: true }); });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { console.error(err.message); res.status(500).json({ error: 'Terjadi kesalahan server.' }); });
if (!process.env.VERCEL) app.listen(PORT, () => console.log(`Portfolio jalan di http://localhost:${PORT}  |  Admin: http://localhost:${PORT}/admin/`));
module.exports = app;
