# Portfolio Evelyn Indriany (Full-stack)

Node.js + Express + SQLite. Konten (pengalaman, project, gallery, skill) disimpan di database
dan diedit lewat **Admin Panel**, jadi nggak perlu ngoding tiap update.

## Jalanin lokal
1. Install Node.js 18+ (nodejs.org)
2. Di folder ini: `npm install`
3. Salin `.env.example` jadi `.env`, isi `ADMIN_PASSWORD` dan `SESSION_SECRET` (string acak panjang)
4. `npm start` (atau `npm run dev` biar auto-restart pas edit)
5. Buka http://localhost:3000  |  Admin: http://localhost:3000/admin/

## Struktur
- server.js       : API + auth admin + upload + keamanan
- db.js           : skema database + data awal (seed)
- public/index.html, style.css, script.js : website publik
- public/admin/   : panel admin
- data/           : file database (otomatis dibuat, JANGAN di-commit)
- uploads/        : foto/CV hasil upload

## Update konten
Buka /admin/ -> login -> tab Pengalaman / Project / Gallery / Skills / Pengaturan.
- Foto hero: tab Pengaturan -> upload PNG transparan (cutout) biar efek "nimpa teks" jalan
- CV: tab Pengaturan -> upload PDF (tombol Download CV otomatis aktif)
- Pesan dari form kontak masuk ke tab "Pesan masuk"

## Ubah desain
Warna ada di `:root` paling atas `public/style.css`.

## Deploy (butuh hosting Node + disk persisten, BUKAN Vercel/Netlify statis)
Cocok: Railway, Render (pakai persistent disk), Fly.io, atau VPS.
- Set env: ADMIN_PASSWORD, SESSION_SECRET, NODE_ENV=production
- Pastikan folder `data/` dan `uploads/` ada di disk persisten, kalau nggak data hilang tiap deploy
- Pakai HTTPS (cookie login jadi `secure` di production)
- Backup rutin file data/portfolio.db

## Keamanan yang sudah ada
Login admin + cookie HttpOnly bertanda tangan, rate limit (login & form kontak), honeypot anti-bot,
validasi input, output di-escape (anti XSS), upload dibatasi tipe/ukuran (SVG diblokir), query terparameter (anti SQL injection).
