// One-time import: copy the local portfolio.db into the connected Neon database.
const fs = require('fs');
const path = require('path');

for (const envFile of ['.env', '.env.local']) {
  try {
    fs.readFileSync(path.join(__dirname, '..', envFile), 'utf8').split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    });
  } catch {}
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL belum ada. Simpan connection string Neon ke .env lokal (jangan commit file ini).');
  process.exit(1);
}

const readline = require('readline/promises');
const { stdin, stdout } = require('process');
const Database = require('better-sqlite3');
const { neon } = require('@neondatabase/serverless');
const neonDb = require('../neon-db');
const sql = neon(process.env.DATABASE_URL);

const tables = {
  experiences: ['id', 'title', 'org', 'period', 'description', 'color', 'sort'],
  projects: ['id', 'title', 'label', 'code', 'description', 'image', 'highlight_type', 'highlight', 'stack', 'links', 'color', 'size', 'sort'],
  gallery: ['id', 'category', 'title', 'image', 'crop_x', 'crop_y', 'sort'],
  skill_groups: ['id', 'title', 'items', 'color', 'sort'],
  facts: ['id', 'value', 'label', 'visible', 'source', 'sort'],
  links: ['id', 'label', 'url', 'display', 'sort'],
  messages: ['id', 'name', 'email', 'message', 'created_at', 'is_read'],
  settings: ['key', 'value'],
  site_visits: ['visitor', 'created_at'],
  site_likes: ['visitor', 'created_at']
};

async function main() {
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  const answer = await prompt.question('Ini akan mengganti seluruh isi Neon dengan data lokal. Ketik IMPORT untuk lanjut: ');
  prompt.close();
  if (answer.trim() !== 'IMPORT') {
    console.log('Dibatalkan. Database Neon tidak diubah.');
    return;
  }

  const local = new Database(path.join(__dirname, '..', 'data', 'portfolio.db'), { readonly: true });
  await neonDb.init();

  for (const table of Object.keys(tables)) await sql.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
  for (const [table, columns] of Object.entries(tables)) {
    const sourceColumns = new Set(local.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name));
    const selected = columns.filter(column => sourceColumns.has(column));
    if (!selected.length) continue;
    const rows = local.prepare(`SELECT ${selected.join(',')} FROM ${table}`).all();
    for (const row of rows) {
      const placeholders = selected.map((_, index) => `$${index + 1}`).join(',');
      await sql.query(`INSERT INTO ${table}(${selected.join(',')}) VALUES(${placeholders})`, selected.map(column => row[column]));
    }
    console.log(`Diimpor ${rows.length} baris: ${table}`);
  }

  for (const table of ['experiences', 'projects', 'gallery', 'skill_groups', 'facts', 'links', 'messages']) {
    await sql.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1), COUNT(*) > 0) FROM ${table}`);
  }
  local.close();
  console.log('Impor selesai. Data lokal sekarang tersalin ke Neon.');
}

main().catch(error => {
  console.error('Impor gagal:', error.message);
  process.exitCode = 1;
});
