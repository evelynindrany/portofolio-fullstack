// Panel admin. Mau tambah/ubah field? Edit objek SCHEMA di bawah (dan kolom di server.js + db.js).
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['pink', 'cyan', 'violet'], SIZES = ['c4', 'c5', 'c7', 'c8'];
const SCHEMA = {
  experiences: { label: 'Pengalaman', title: 'title', sub: 'period', fields: [['title', 'Judul'], ['org', 'Organisasi'], ['period', 'Periode'], ['description', 'Deskripsi', 'textarea'], ['color', 'Warna', COLORS], ['sort', 'Urutan', 'number']] },
  projects: { label: 'Project', title: 'title', sub: 'code', fields: [['title', 'Judul'], ['label', 'Label (mis. LIVE DEPLOYMENT)'], ['code', 'Kode (mis. APP-SYS // 01)'], ['description', 'Deskripsi', 'textarea'], ['snippet', 'Snippet kode/metrik (opsional)', 'textarea'], ['stats', 'Statistik: 60+|Components;100%|WCAG (opsional)'], ['stack', 'Tech stack (pisah koma)'], ['link_text', 'Teks link'], ['link_url', 'URL link'], ['color', 'Warna', COLORS], ['size', 'Lebar card', SIZES], ['sort', 'Urutan', 'number']] },
  gallery: { label: 'Gallery', title: 'title', sub: 'category', fields: [['category', 'Kategori'], ['title', 'Judul'], ['image', 'Foto', 'file'], ['crop_x', 'Fokus horizontal', 'crop'], ['crop_y', 'Fokus vertikal', 'crop'], ['sort', 'Urutan', 'number']] },
  skills: { label: 'Skills', title: 'title', sub: 'items', fields: [['title', 'Nama grup'], ['items', 'Skill (pisah koma)', 'textarea'], ['color', 'Warna', COLORS], ['sort', 'Urutan', 'number']] },
  facts: { label: 'Statistik profil', title: 'value', sub: 'label', fields: [['value', 'Nilai manual (dipakai jika sumber otomatis = manual)'], ['label', 'Label'], ['source', 'Sumber angka otomatis', [['', 'Manual'], ['experiences', 'Jumlah Experiences'], ['projects', 'Jumlah Projects'], ['gallery', 'Jumlah foto kegiatan'], ['skills', 'Jumlah grup Skills']]], ['visible', 'Tampilkan di website', [['1', 'Tampilkan'], ['0', 'Sembunyikan']]], ['sort', 'Urutan', 'number']] }
};
const SETTINGS = [['about_text', 'Teks About Me', 'textarea'], ['gallery_text', 'Activity Gallery', 'textarea'], ['projects_text', 'Featured Architecture & Interfaces', 'textarea'], ['skills_text', 'Technical Matrix', 'textarea'], ['education_program', 'Program studi'], ['education_school', 'Universitas / sekolah'], ['education_period', 'Periode pendidikan'], ['hero_photo', 'Foto hero (PNG transparan)', 'file'], ['cv_url', 'File CV (PDF)', 'file'], ['github', 'GitHub URL'], ['linkedin', 'LinkedIn URL'], ['dribbble', 'Dribbble URL'], ['figma', 'Figma URL'], ['instagram', 'Instagram URL']];
const COPY_DEFAULTS = {
  gallery_text: 'Moments beyond the IDE: campus keynotes, nationwide hackathon sprints, community leadership, and department championships.',
  projects_text: 'Asymmetrical showcase bridging technical computer science systems with refined ergonomic product aesthetics.',
  skills_text: 'Dual proficiency spanning low-level procedural system architecture and high-fidelity user-centric product engineering.',
  education_program: 'Informatics Engineering',
  education_school: 'Universitas Airlangga',
  education_period: '2021 — 2025'
};
const inferredFactSource = f => f.source || (String(f.label || '').toLowerCase().includes('project') ? 'projects' : /experience|pengalaman/i.test(f.label || '') ? 'experiences' : /activity|kegiatan|gallery/i.test(f.label || '') ? 'gallery' : /skill/i.test(f.label || '') ? 'skills' : '');

const api = async (m, u, b) => { const r = await fetch('/api/admin' + u, { method: m, headers: b ? { 'Content-Type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined }); if (r.status === 401) return location.reload(); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Error'); return j; };
const toast = t => { const e = $('#toast'); e.textContent = t; e.style.display = 'block'; setTimeout(() => e.style.display = 'none', 2500); };

async function upload(file) { const fd = new FormData(); fd.append('file', file); const r = await fetch('/api/admin/upload', { method: 'POST', body: fd }); const j = await r.json(); if (!r.ok) throw new Error(j.error); return j.url; }

function fieldHTML([k, label, type], v) {
  v = v ?? '';
  const inp = Array.isArray(type) ? `<select name="${k}">${type.map(o => { const value = Array.isArray(o) ? o[0] : o, text = Array.isArray(o) ? o[1] : o; return `<option value="${esc(value)}" ${String(value) === String(v) ? 'selected' : ''}>${esc(text)}</option>`; }).join('')}</select>`
    : type === 'textarea' ? `<textarea name="${k}">${esc(v)}</textarea>`
    : type === 'file' ? `<input name="${k}" value="${esc(v)}" placeholder="URL atau upload"><input type="file" data-up="${k}" accept="image/*,application/pdf" style="margin-top:6px">${k === 'image' ? `<div class="crop-preview"><img data-crop-preview src="${esc(v)}" alt="Preview crop"><span>Area ini yang akan tampil (rasio 16:9)</span></div>` : ''}`
    : type === 'crop' ? `<div class="crop-control"><input name="${k}" type="range" min="0" max="100" value="${esc(v === '' ? 50 : v)}" data-crop-range><output>${esc(v === '' ? 50 : v)}%</output></div>`
    : `<input name="${k}" type="${type || 'text'}" value="${esc(v)}">`;
  return `<div class="f"><label>${esc(label)}</label>${inp}</div>`;
}
function bindUploads(form) {
  form.querySelectorAll('[data-up]').forEach(i => i.onchange = async () => { try { const input = form.elements[i.dataset.up]; input.value = await upload(i.files[0]); input.dispatchEvent(new Event('input')); toast('Terupload. Atur fokus crop lalu klik Simpan.'); } catch (e) { toast(e.message); } });
  const preview = form.querySelector('[data-crop-preview]');
  if (preview) {
    const update = () => { preview.src = form.elements.image.value; preview.style.objectPosition = `${form.elements.crop_x.value}% ${form.elements.crop_y.value}%`; };
    form.elements.image.addEventListener('input', update);
    form.querySelectorAll('[data-crop-range]').forEach(range => range.addEventListener('input', () => { range.nextElementSibling.value = `${range.value}%`; update(); }));
    update();
  }
}

async function tab(name) {
  document.querySelectorAll('#tabs .btn').forEach(b => b.classList.toggle('on', b.dataset.t === name));
  const v = $('#view');
  if (name === 'messages') {
    const ms = await api('GET', '/messages');
    v.innerHTML = ms.length ? ms.map(m => `<div class="row ${m.is_read ? '' : 'unread'}" style="align-items:flex-start"><div><b>${esc(m.name)}</b> &lt;${esc(m.email)}&gt;<small>${esc(m.created_at)} UTC</small><div class="msg">${esc(m.message)}</div></div><div class="act"><button class="btn sm" data-r="${m.id}" data-v="${m.is_read ? 0 : 1}">${m.is_read ? 'Tandai belum dibaca' : 'Tandai dibaca'}</button><button class="btn sm" data-d="${m.id}">Hapus</button></div></div>`).join('') : '<p>Belum ada pesan.</p>';
    v.onclick = async e => { const t = e.target; if (t.dataset.r) { await api('PATCH', '/messages/' + t.dataset.r, { is_read: +t.dataset.v }); tab('messages'); } if (t.dataset.d && confirm('Hapus pesan ini?')) { await api('DELETE', '/messages/' + t.dataset.d); tab('messages'); } };
    return;
  }
  if (name === 'settings') {
    const s = await api('GET', '/settings');
    const copyKeys = new Set(['gallery_text', 'projects_text', 'skills_text']), educationKeys = new Set(['education_program', 'education_school', 'education_period']);
    const copy = SETTINGS.filter(f => copyKeys.has(f[0])), education = SETTINGS.filter(f => educationKeys.has(f[0])), other = SETTINGS.filter(f => !copyKeys.has(f[0]) && !educationKeys.has(f[0]));
    v.innerHTML = `<form class="card" id="sf"><h3>Deskripsi halaman</h3><p class="hint">Edit paragraf yang tampil di Activity Gallery, Featured Architecture, dan Technical Matrix.</p>${copy.map(f => fieldHTML(f, s[f[0]] ?? COPY_DEFAULTS[f[0]])).join('')}<h3>Pendidikan</h3><p class="hint">Informasi ini tampil di kartu Education pada bagian About.</p>${education.map(f => fieldHTML(f, s[f[0]] ?? COPY_DEFAULTS[f[0]])).join('')}<h3>Profil, foto, dan tautan</h3>${other.map(f => fieldHTML(f, s[f[0]])).join('')}<button class="btn p">Simpan</button></form>`;
    const f = $('#sf'); bindUploads(f);
    f.onsubmit = async e => { e.preventDefault(); await api('PUT', '/settings', Object.fromEntries(new FormData(f))); toast('Tersimpan'); };
    return;
  }
  const S = SCHEMA[name], rows = await api('GET', '/' + name);
  const content = name === 'facts' ? await fetch('/api/content').then(r => r.json()).catch(() => null) : null;
  v.innerHTML = `<button class="btn p" id="add" style="margin-bottom:16px">+ Tambah ${S.label}</button><div id="list">${rows.map(r => { const source = name === 'facts' ? inferredFactSource(r) : ''; const computed = source && content ? content[source]?.length : null; const title = computed === null || computed === undefined ? r[S.title] : String(computed); const detail = `${r[S.sub] || ''}${source ? ` · Otomatis dari ${source}` : ''}`; return `<div class="row"><div><b>${esc(title)}</b><small>${esc(String(detail).slice(0, 100))}</small></div><div class="act"><button class="btn sm" data-e="${r.id}">Edit</button><button class="btn sm" data-d="${r.id}">Hapus</button></div></div>`; }).join('')}</div>`;
  const form = (r = {}) => { v.innerHTML = `<form class="card" id="ef">${S.fields.map(f => fieldHTML(f, r[f[0]])).join('')}<div style="display:flex;gap:8px"><button class="btn p">Simpan</button><button type="button" class="btn" id="cancel">Batal</button></div></form>`;
    const f = $('#ef'); bindUploads(f); $('#cancel').onclick = () => tab(name);
    f.onsubmit = async e => { e.preventDefault(); const b = Object.fromEntries(new FormData(f)); r.id ? await api('PUT', `/${name}/${r.id}`, b) : await api('POST', '/' + name, b); toast('Tersimpan'); tab(name); }; };
  $('#add').onclick = () => form();
  $('#list').onclick = async e => { const t = e.target; if (t.dataset.e) form(rows.find(r => r.id == t.dataset.e)); if (t.dataset.d && confirm('Hapus item ini?')) { await api('DELETE', `/${name}/${t.dataset.d}`); tab(name); } };
}

function start() {
  $('#login').hidden = true; $('#app').hidden = false;
  $('#tabs').innerHTML = [...Object.entries(SCHEMA).map(([k, s]) => [k, s.label]), ['messages', 'Pesan masuk'], ['settings', 'Pengaturan']].map(([k, l]) => `<button class="btn" data-t="${k}">${l}</button>`).join('') + '<a class="btn" href="/" target="_blank">Lihat website ↗</a><button class="btn" id="out">Logout</button>';
  $('#tabs').onclick = e => { if (e.target.dataset.t) tab(e.target.dataset.t); };
  $('#out').onclick = async () => { await api('POST', '/logout', {}); location.reload(); };
  tab('experiences');
}
const login = async () => { try { await api('POST', '/login', { password: $('#pw').value }); start(); } catch (e) { $('#lerr').textContent = e.message; } };
$('#login').addEventListener('submit', e => { e.preventDefault(); login(); });
$('#toggle-pw').onclick = e => { const visible = $('#pw').type === 'password'; $('#pw').type = visible ? 'text' : 'password'; e.currentTarget.textContent = visible ? 'Sembunyikan' : 'Lihat'; e.currentTarget.setAttribute('aria-pressed', String(visible)); $('#pw').focus(); };
if (!$('#login').hidden) $('#pw').focus();
fetch('/api/admin/me').then(r => r.json()).then(j => j.authed && start());
