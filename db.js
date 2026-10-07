// Database SQLite + data awal (seed) + migrasi otomatis. File DB: data/portfolio.db
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'data', 'portfolio.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS experiences(id INTEGER PRIMARY KEY, title TEXT, org TEXT, period TEXT, description TEXT, color TEXT DEFAULT 'pink', sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS projects(id INTEGER PRIMARY KEY, title TEXT, label TEXT, code TEXT, description TEXT, snippet TEXT, stats TEXT, stack TEXT, link_text TEXT, link_url TEXT, color TEXT DEFAULT 'pink', size TEXT DEFAULT 'c4', sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS gallery(id INTEGER PRIMARY KEY, category TEXT, title TEXT, image TEXT, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS skill_groups(id INTEGER PRIMARY KEY, title TEXT, items TEXT, color TEXT DEFAULT 'pink', sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS facts(id INTEGER PRIMARY KEY, value TEXT, label TEXT, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS links(id INTEGER PRIMARY KEY, label TEXT, url TEXT, display TEXT, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, name TEXT, email TEXT, message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, is_read INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS site_visits(visitor TEXT PRIMARY KEY, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS site_likes(visitor TEXT PRIMARY KEY, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

// --- migrasi: kolom baru di tabel projects (aman buat database lama) ---
const addCol = (t, c, def) => { if (!db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };
addCol('projects', 'image', "TEXT DEFAULT ''");
addCol('projects', 'highlight_type', "TEXT DEFAULT ''");
addCol('projects', 'highlight', "TEXT DEFAULT ''");
addCol('projects', 'links', "TEXT DEFAULT ''");
addCol('facts', 'visible', 'INTEGER DEFAULT 1');
addCol('facts', 'source', "TEXT DEFAULT ''");
// Sambungkan statistik lama ke data terkait berdasarkan labelnya.
db.exec(`UPDATE facts SET source='projects' WHERE COALESCE(source,'')='' AND lower(label) LIKE '%project%';
UPDATE facts SET source='experiences' WHERE COALESCE(source,'')='' AND (lower(label) LIKE '%experience%' OR lower(label) LIKE '%pengalaman%');
UPDATE facts SET source='gallery' WHERE COALESCE(source,'')='' AND (lower(label) LIKE '%activity%' OR lower(label) LIKE '%kegiatan%' OR lower(label) LIKE '%gallery%');
UPDATE facts SET source='skills' WHERE COALESCE(source,'')='' AND lower(label) LIKE '%skill%';`);
addCol('gallery', 'crop_x', 'INTEGER DEFAULT 50');
addCol('gallery', 'crop_y', 'INTEGER DEFAULT 50');
// pindahin data project lama (snippet/stats/link) ke format baru, sekali saja
db.prepare("SELECT id,snippet,stats,link_text,link_url FROM projects WHERE highlight_type IS NULL OR highlight_type=''").all().forEach(p => {
  let type = 'none', hl = '';
  if (p.stats) { type = 'stats'; hl = p.stats.split(';').filter(Boolean).join('\n'); }
  else if (p.snippet) { type = 'text'; hl = p.snippet; }
  const links = p.link_text ? `${p.link_text}|${p.link_url || '#'}` : '';
  db.prepare('UPDATE projects SET highlight_type=?, highlight=?, links=? WHERE id=?').run(type, hl, links, p.id);
});

const ins = (t, cols, rows) => { const s = db.prepare(`INSERT INTO ${t}(${cols}) VALUES(${cols.split(',').map(() => '?')})`); rows.forEach(r => s.run(...r)); };
const empty = t => !db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;

if (empty('experiences')) ins('experiences', 'title,org,period,description,color,sort', [
  ['Student Ambassador & Tech Evangelist', 'Google Developer Student Clubs / Campus Chapter', '2024 — PRESENT', 'Championed developer tech talks, structured code labs, and directly mentored 120+ undergraduate students across modern UI/UX design systems, accessibility standards, and web client frameworks.', 'pink', 1],
  ['Lead Project Director — Hackfest 2024', 'National Informatics Olympiad & Hackathon', '2023 — 2024', 'Managed a 35-person interdisciplinary committee, directed sponsor pipelines securing tech partnerships, and smoothly coordinated 500+ participants nationwide throughout a 48-hour continuous hackathon event.', 'cyan', 2],
  ['Head of Finance & Hackathon Treasurer', 'Informatics Student Association (HMIF)', '2023', 'Orchestrated budgeting, allocation modeling, and procurement oversight for 4 flagship university tech summits, maintaining 100% financial accuracy across multiple vendor contracts.', 'violet', 3],
  ['Frontend Engineer & UI/UX Intern', 'Nexus Studio Labs', '2022 — 2023', 'Architected modular design systems, delivered 14 responsive interactive templates, and boosted client-facing web portal performance scores by 38% through optimized Laravel Blade components and Tailwind CSS bundling.', 'pink', 4]]);

if (empty('projects')) ins('projects', 'title,label,code,description,image,highlight_type,highlight,stack,links,color,size,sort', [
  ['Nexus ERP Core', 'LIVE DEPLOYMENT', 'APP-SYS // 01', 'Enterprise Resource Planning platform featuring reactive analytics, granular RBAC permissions, and high-concurrency queue processing with sub-100ms response benchmarks.', '', 'text', 'Latency: 42ms\nSELECT user_id, cluster_id, COUNT(*) FROM telemetry_events GROUP BY 1,2;', 'PHP 8.2,Laravel,Vue.js,Redis', 'INSPECT SPEC ↗|#', 'pink', 'c7', 1],
  ['FinPulse Mobile App', 'UI/UX RESEARCH', 'DES-APP // 02', 'Neo-banking experience tailored for Gen-Z wealth builders with micro-investment ladders and dark glass aesthetics.', '', 'text', 'Usability score: 94% SUS', 'Figma Tokens,Prototyping', 'CASE STUDY ↗|#', 'violet', 'c5', 2],
  ['Clustered DB Engine', 'DATA INFRASTRUCTURE', 'INFRA // 03', 'High-performance multi-tenant PostgreSQL schema handling B-Tree indices and partitioned storage.', '', 'text', 'TPS Capacity: 4,800/sec', 'PostgreSQL,Docker', 'SCHEMA ↗|#', 'cyan', 'c4', 3],
  ['Aura Glassmorphism Component Kit', 'COMPONENT SYSTEM', 'SYS-UI // 04', '60+ accessible, production-tested UI tokens crafted specifically for high-contrast dark interfaces. Built with Tailwind CSS, React, and fine-tuned CSS specular refraction.', '', 'stats', '60+|Components\n100%|WCAG AAA\nZero|Runtime overhead', 'Next.js,Tailwind,TypeScript', 'EXPLORE DOCUMENTATION ↗|#', 'pink', 'c8', 4]]);

if (empty('gallery')) ins('gallery', 'category,title,image,sort', [
  ['Student cultural & campus organization', 'PKM UK Mapanza', '', 1], ['Campus community & keynotes', 'Google Student Ambassador 2026', '', 2], ['National hackathon', 'Hackfest 2024 Opening', '', 3]]);

if (empty('skill_groups')) ins('skill_groups', 'title,items,color,sort', [
  ['Informatics & code execution', 'PHP 8+,Laravel Framework,JavaScript (ESNext),TypeScript,Python,Tailwind CSS,REST APIs & GraphQL,Git & CI/CD Pipelines', 'pink', 1],
  ['UI/UX & product architecture', 'Figma Architecture,Design Tokens (W3C),Wireframing,User Journey Maps,Usability Testing,High-Fi Prototyping', 'violet', 2],
  ['Data & infrastructure engineering', 'PostgreSQL,MySQL,Redis In-Memory,Docker Containers,System Modeling & UML', 'cyan', 3]]);

if (empty('facts')) ins('facts', 'value,label,sort', [['3.92', 'CGPA / 4.00', 1], ['15+', 'Shipped projects', 2], ['Top 3', 'National hackathon', 3], ['120+', 'Students mentored', 4]]);

if (empty('links')) ins('links', 'label,url,display,sort', [
  ['Email', 'hello@example.com', 'hello@example.com', 1], ['LinkedIn', '#', 'linkedin.com/in/username', 2], ['GitHub', '#', 'github.com/username', 3], ['Instagram', '#', '@username', 4]]);

// pengaturan: nilai awal hanya diisi kalau belum ada (punya lo yang sudah ada nggak ditimpa)
const setDefault = db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)');
[['hero_photo', '/assets/foto-evelyn.svg'], ['hero_tags', 'Undergraduate Informatics Engineering / Web Dev & UI/UX\nCGPA 3.92 / 4.00\n15+ Shipped Projects\nTop 3 National Hackathon Winner'],
 ['about_title', 'Building interfaces\nthat think.'], ['about_text', ''], ['gallery_text', 'Moments beyond the IDE: campus keynotes, nationwide hackathon sprints, community leadership, and department championships.'], ['projects_text', 'Asymmetrical showcase bridging technical computer science systems with refined ergonomic product aesthetics.'], ['skills_text', 'Dual proficiency spanning low-level procedural system architecture and high-fidelity user-centric product engineering.'], ['education_program', 'Informatics Engineering'], ['education_school', 'Universitas Airlangga'], ['education_period', '2021 — 2025'], ['cv_url', ''], ['availability', 'Open for internships & collaborations']].forEach(([k, v]) => setDefault.run(k, v));

module.exports = db;
