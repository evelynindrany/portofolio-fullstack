// Neon Postgres adapter used by Vercel. Local development keeps using db.js (SQLite).
const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum diatur. Hubungkan Neon ke project Vercel.');

const sql = neon(process.env.DATABASE_URL);
const toPostgres = (statement) => {
  let index = 0;
  let query = statement.replace(/\?/g, () => `$${++index}`);
  if (/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(query)) {
    query = query.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i, 'INSERT INTO').replace(/;?\s*$/, ' ON CONFLICT DO NOTHING');
  }
  return query;
};

const query = async (statement, params = []) => sql.query(toPostgres(statement), params, { fullResults: true });
const db = {
  prepare(statement) {
    return {
      all: async (...params) => (await query(statement, params)).rows,
      get: async (...params) => (await query(statement, params)).rows[0],
      run: async (...params) => {
        const result = await query(statement, params);
        return { changes: result.rowCount };
      }
    };
  },
  async init() {
    const schema = [
      `CREATE TABLE IF NOT EXISTS experiences(id SERIAL PRIMARY KEY, title TEXT, org TEXT, period TEXT, description TEXT, color TEXT DEFAULT 'pink', sort INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS projects(id SERIAL PRIMARY KEY, title TEXT, label TEXT, code TEXT, description TEXT, image TEXT DEFAULT '', highlight_type TEXT DEFAULT '', highlight TEXT DEFAULT '', stack TEXT, links TEXT DEFAULT '', color TEXT DEFAULT 'pink', size TEXT DEFAULT 'c4', sort INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS gallery(id SERIAL PRIMARY KEY, category TEXT, title TEXT, image TEXT, crop_x INTEGER DEFAULT 50, crop_y INTEGER DEFAULT 50, sort INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS skill_groups(id SERIAL PRIMARY KEY, title TEXT, items TEXT, color TEXT DEFAULT 'pink', sort INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS facts(id SERIAL PRIMARY KEY, value TEXT, label TEXT, visible INTEGER DEFAULT 1, source TEXT DEFAULT '', sort INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS links(id SERIAL PRIMARY KEY, label TEXT, url TEXT, display TEXT, sort INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS messages(id SERIAL PRIMARY KEY, name TEXT, email TEXT, message TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, is_read INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT)`,
      `CREATE TABLE IF NOT EXISTS site_visits(visitor TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS site_likes(visitor TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`
    ];
    for (const statement of schema) await sql.query(statement);

    const addDefaults = async (table, columns, rows) => {
      const count = await sql.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
      if (count[0].n) return;
      for (const row of rows) {
        const marks = row.map((_, i) => `$${i + 1}`).join(',');
        await sql.query(`INSERT INTO ${table}(${columns}) VALUES(${marks})`, row);
      }
    };

    await addDefaults('experiences', 'title,org,period,description,color,sort', [
      ['Student Ambassador & Tech Evangelist', 'Google Developer Student Clubs / Campus Chapter', '2024 — PRESENT', 'Championed developer tech talks, structured code labs, and directly mentored 120+ undergraduate students across modern UI/UX design systems, accessibility standards, and web client frameworks.', 'pink', 1],
      ['Lead Project Director — Hackfest 2024', 'National Informatics Olympiad & Hackathon', '2023 — 2024', 'Managed a 35-person interdisciplinary committee, directed sponsor pipelines securing tech partnerships, and smoothly coordinated 500+ participants nationwide throughout a 48-hour continuous hackathon event.', 'pink', 2],
      ['Head of Finance & Hackathon Treasurer', 'Informatics Student Association (HMIF)', '2023', 'Orchestrated budgeting, allocation modeling, and procurement oversight for 4 flagship university tech summits, maintaining 100% financial accuracy across multiple vendor contracts.', 'pink', 3],
      ['Frontend Engineer & UI/UX Intern', 'Nexus Studio Labs', '2022 — 2023', 'Architected modular design systems, delivered 14 responsive interactive templates, and boosted client-facing web portal performance scores by 38% through optimized Laravel Blade components and Tailwind CSS bundling.', 'pink', 4]
    ]);
    await addDefaults('projects', 'title,label,code,description,image,highlight_type,highlight,stack,links,color,size,sort', [
      ['Nexus ERP Core', 'LIVE DEPLOYMENT', 'APP-SYS // 01', 'Enterprise Resource Planning platform featuring reactive analytics, granular RBAC permissions, and high-concurrency queue processing with sub-100ms response benchmarks.', '', 'text', 'Latency: 42ms', 'PHP 8.2,Laravel,Vue.js,Redis', 'INSPECT SPEC ↗|#', 'pink', 'c7', 1],
      ['FinPulse Mobile App', 'UI/UX RESEARCH', 'DES-APP // 02', 'Neo-banking experience tailored for Gen-Z wealth builders with micro-investment ladders and dark glass aesthetics.', '', 'text', 'Usability score: 94% SUS', 'Figma Tokens,Prototyping', 'CASE STUDY ↗|#', 'violet', 'c5', 2],
      ['Clustered DB Engine', 'DATA INFRASTRUCTURE', 'INFRA // 03', 'High-performance multi-tenant PostgreSQL schema handling B-Tree indices and partitioned storage.', '', 'text', 'TPS Capacity: 4,800/sec', 'PostgreSQL,Docker', 'SCHEMA ↗|#', 'cyan', 'c4', 3],
      ['Aura Glassmorphism Component Kit', 'COMPONENT SYSTEM', 'SYS-UI // 04', '60+ accessible, production-tested UI tokens crafted specifically for high-contrast dark interfaces. Built with Tailwind CSS, React, and fine-tuned CSS specular refraction.', '', 'stats', '60+|Components\n100%|WCAG AAA\nZero|Runtime overhead', 'Next.js,Tailwind,TypeScript', 'EXPLORE DOCUMENTATION ↗|#', 'pink', 'c8', 4]
    ]);
    await addDefaults('gallery', 'category,title,image,sort', [
      ['Student cultural & campus organization', 'PKM UK Mapanza', '', 1], ['Campus community & keynotes', 'Google Student Ambassador 2026', '', 2], ['National hackathon', 'Hackfest 2024 Opening', '', 3]
    ]);
    await addDefaults('skill_groups', 'title,items,color,sort', [
      ['Informatics & code execution', 'PHP 8+,Laravel Framework,JavaScript (ESNext),TypeScript,Python,Tailwind CSS,REST APIs & GraphQL,Git & CI/CD Pipelines', 'pink', 1],
      ['UI/UX & product architecture', 'Figma Architecture,Design Tokens (W3C),Wireframing,User Journey Maps,Usability Testing,High-Fi Prototyping', 'violet', 2],
      ['Data & infrastructure engineering', 'PostgreSQL,MySQL,Redis In-Memory,Docker Containers,System Modeling & UML', 'cyan', 3]
    ]);
    await addDefaults('facts', 'value,label,sort', [['3.92', 'CGPA / 4.00', 1], ['15+', 'Shipped projects', 2], ['Top 3', 'National hackathon', 3], ['120+', 'Students mentored', 4]]);
    await addDefaults('links', 'label,url,display,sort', [
      ['Email', 'hello@example.com', 'hello@example.com', 1], ['LinkedIn', '#', 'linkedin.com/in/username', 2], ['GitHub', '#', 'github.com/username', 3], ['Instagram', '#', '@username', 4]
    ]);
    const settings = [
      ['hero_photo', '/assets/foto-evelyn.svg'], ['hero_tags', 'Undergraduate Informatics Engineering / Web Dev & UI/UX\nCGPA 3.92 / 4.00\n15+ Shipped Projects\nTop 3 National Hackathon Winner'],
      ['about_title', 'Building interfaces\nthat think.'], ['about_text', ''],
      ['gallery_text', 'Moments beyond the IDE: campus keynotes, nationwide hackathon sprints, community leadership, and department championships.'],
      ['projects_text', 'Asymmetrical showcase bridging technical computer science systems with refined ergonomic product aesthetics.'],
      ['skills_text', 'Dual proficiency spanning low-level procedural system architecture and high-fidelity user-centric product engineering.'],
      ['education_program', 'Informatics Engineering'], ['education_school', 'Universitas Airlangga'], ['education_period', '2021 — 2025'],
      ['cv_url', ''], ['availability', 'Open for internships & collaborations']
    ];
    for (const [key, value] of settings) await sql.query('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING', [key, value]);
  }
};

module.exports = db;
