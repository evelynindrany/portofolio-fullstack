// Frontend: ambil data dari /api/content lalu render. Semua teks di-escape (anti XSS).
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const col = c => ['pink', 'cyan', 'violet'].includes(c) ? c : 'pink';
const size = s => ['c4', 'c5', 'c7', 'c8'].includes(s) ? s : 'c4';
const url = u => /^(https?:\/\/|\/|#|mailto:)/.test(u || '') ? u : '#';
const chips = csv => String(csv || '').split(',').map(x => x.trim()).filter(Boolean).map(x => `<span class="chip">${esc(x)}</span>`).join('');
const skillIcon = name => {
  const n = String(name || '').toLowerCase();
  const icons = [
    [/php/, 'php'], [/laravel/, 'laravel'], [/javascript|\bjs\b/, 'javascript'], [/typescript|\bts\b/, 'typescript'],
    [/python/, 'python'], [/tailwind/, 'tailwindcss'], [/figma/, 'figma'], [/postgres/, 'postgresql'],
    [/mysql/, 'mysql'], [/redis/, 'redis'], [/docker/, 'docker'], [/\bgit\b/, 'git'], [/graphql/, 'graphql']
  ];
  return icons.find(([pattern]) => pattern.test(n))?.[1] || '';
};
const skillChips = csv => String(csv || '').split(',').map(x => x.trim()).filter(Boolean).map(x => {
  const icon = skillIcon(x), file = icon === 'graphql' ? 'graphql-plain.svg' : `${icon}-original.svg`, src = icon ? `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${icon}/${file}` : '';
  return `<span class="chip skill-chip">${src ? `<img src="${src}" alt="" aria-hidden="true" loading="lazy">` : ''}<span>${esc(x)}</span></span>`;
}).join('');

function renderStats(s) {
  const items = String(s || '').split(';').filter(Boolean).map(p => p.split('|'));
  return items.length ? `<div class="stats">${items.map(([v, l], i) => `<div><b${i === items.length - 1 && !/\d/.test(v) ? ' style="color:var(--fg)"' : ''}>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>` : '';
}

function initCarousel() {
  const t = $('#track'), s = [...t.children], dots = $('#dots');
  if (!s.length) return;
  dots.innerHTML = s.map(() => '<i></i>').join('');
  const d = [...dots.children]; let i = Math.min(1, s.length - 1);
  const go = n => { i = (n + s.length) % s.length; const c = s[i];
    t.style.transform = `translateX(${-(c.offsetLeft - (t.parentNode.clientWidth - c.clientWidth) / 2)}px)`;
    s.forEach((x, k) => x.classList.toggle('on', k === i)); d.forEach((x, k) => x.classList.toggle('on', k === i)); };
  $('#prev').onclick = () => go(i - 1); $('#next').onclick = () => go(i + 1);
  addEventListener('resize', () => go(i)); addEventListener('load', () => go(i)); go(i);
}

function initEngagement() {
  const makeId = () => `v-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const formatCount = value => { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.floor(n).toLocaleString() : '0'; };
  let visitorId = localStorage.getItem('portfolio_like_id');
  if (!visitorId) { visitorId = makeId(); localStorage.setItem('portfolio_like_id', visitorId); }
  let visitId = sessionStorage.getItem('portfolio_visit_id');
  if (!visitId) { visitId = makeId(); sessionStorage.setItem('portfolio_visit_id', visitId); }
  const paint = async () => {
    const r = await fetch('/api/stats'); if (!r.ok) return;
    const stats = await r.json(); $('#views-count').textContent = formatCount(stats.views); $('#likes-count').textContent = formatCount(stats.likes);
  };
  fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitor_id: visitId }) }).then(paint).catch(() => {});
  setInterval(paint, 30000);
  fetch('/api/like/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitor_id: visitorId }) }).then(r => { if (!r.ok) throw new Error('Stats unavailable'); return r.json(); }).then(s => { $('#like-btn').setAttribute('aria-pressed', String(!!s.liked)); $('#like-btn').classList.toggle('liked', !!s.liked); $('#likes-count').textContent = formatCount(s.likes); }).catch(() => { $('#likes-count').textContent = '0'; });
  $('#like-btn').onclick = async () => {
    const b = $('#like-btn'); b.disabled = true;
    try { const r = await fetch('/api/like/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitor_id: visitorId }) }); const s = await r.json(); if (!r.ok) throw new Error(s.error); b.setAttribute('aria-pressed', String(!!s.liked)); b.classList.toggle('liked', !!s.liked); $('#likes-count').textContent = formatCount(s.likes); }
    catch { /* Tally remains at its last known value if offline. */ }
    b.disabled = false;
  };
}

function initThemeToggle() {
  const button = $('#theme-toggle'), root = document.documentElement;
  const sync = () => {
    const light = root.dataset.theme === 'light';
    button.textContent = light ? '☾' : '☼';
    button.setAttribute('aria-pressed', String(light));
    button.setAttribute('aria-label', light ? 'Aktifkan dark mode' : 'Aktifkan light mode');
    button.title = light ? 'Ganti ke dark mode' : 'Ganti ke light mode';
  };
  button.onclick = () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('portfolio_theme', root.dataset.theme); } catch {}
    sync();
  };
  sync();
}

function initTextReveal() {
  if (!('IntersectionObserver' in window)) return;
  const targets = document.querySelectorAll('section .eyebrow,section h2,section p,section h3,section h4,section time,section small,section .fact b,section .fact span,footer .wrap > div');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('text-revealed');
      observer.unobserve(entry.target);
    }
  }), { threshold:0.08, rootMargin:'0px 0px -6% 0px' });
  targets.forEach((el, i) => {
    if (el.dataset.revealReady) return;
    el.dataset.revealReady = '1';
    el.style.setProperty('--reveal-delay', `${(i % 4) * 65}ms`);
    el.classList.add('text-reveal');
    observer.observe(el);
  });
}

async function load() {
  try {
    const r = await fetch('/api/content'); if (!r.ok) throw 0;
    const d = await r.json(), st = d.settings;
    // Foto hero: pakai upload dari Admin kalau ada, kalau nggak pakai assets/foto-evelyn.png
    $('#hero-photo').src = (st.hero_photo && !st.hero_photo.endsWith('.svg')) ? url(st.hero_photo) : '/assets/foto-evelyn.png';
    if (st.about_text) $('#about-text').textContent = st.about_text;
    if (st.gallery_text) $('#gallery-intro').textContent = st.gallery_text;
    if (st.projects_text) $('#projects-intro').textContent = st.projects_text;
    if (st.skills_text) $('#skills-intro').textContent = st.skills_text;
    if (st.education_program) $('#education-program').textContent = st.education_program;
    if (st.education_school) $('#education-school').textContent = st.education_school;
    if (st.education_period) $('#education-period').textContent = st.education_period;
    const factValue = f => {
      const label = String(f.label || '').toLowerCase();
      const sourceKey = f.source || (label.includes('project') ? 'projects' : /experience|pengalaman/.test(label) ? 'experiences' : /activity|kegiatan|gallery/.test(label) ? 'gallery' : label.includes('skill') ? 'skills' : '');
      const source = { experiences: d.experiences, projects: d.projects, gallery: d.gallery, skills: d.skills }[sourceKey];
      return Array.isArray(source) ? String(source.length) : f.value;
    };
    const visibleFacts = (d.facts || []).filter(f => Number(f.visible) !== 0).map(f => ({ ...f, displayValue: factValue(f) }));
    $('#profile-facts').innerHTML = visibleFacts.map(f => `<div class="fact"><b>${esc(f.displayValue)}</b><span>${esc(f.label)}</span></div>`).join('');
    $('#hero-facts').innerHTML = visibleFacts.map(f => `<span class="chip">${esc(f.displayValue)} ${esc(f.label)}</span>`).join('');
    if (st.cv_url) $('#cv-btn').href = url(st.cv_url); else $('#cv-btn').removeAttribute('download');
    document.querySelectorAll('[data-social]').forEach(a => a.href = url(st[a.dataset.social]));
    $('#tl').innerHTML = d.experiences.map(e => `<article class="item" style="--c:var(--${col(e.color)})"><time>${esc(e.period)}</time><h3>${esc(e.title)}</h3><div class="org">${esc(e.org)}</div><p>${esc(e.description)}</p></article>`).join('');
    $('#track').innerHTML = d.gallery.map((g, n) => { const x = Math.max(0, Math.min(100, Number(g.crop_x ?? 50))), y = Math.max(0, Math.min(100, Number(g.crop_y ?? 50))); return `<div class="slide"><div class="ph" role="img" aria-label="${esc(g.title)}" style="background-position:${x}% ${y}%;background-image:${g.image ? `url('${esc(url(g.image))}'),` : ''}linear-gradient(135deg,${['#3b1d4a', '#14324a', '#4a1d33'][n % 3]},#1a1020)"></div><small>${esc(g.category)}</small><h4>${esc(g.title)}</h4></div>`; }).join('');
    $('#grid').innerHTML = d.projects.map(p => `<article class="card ${size(p.size)}"><div class="top"><span style="color:var(--${col(p.color)})">${esc(p.label)}</span><span>${esc(p.code)}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p>${p.snippet ? `<div class="code">${esc(p.snippet)}</div>` : ''}${renderStats(p.stats)}<div class="foot"><div class="stack">${chips(p.stack)}</div><a href="${esc(url(p.link_url))}" target="_blank" rel="noopener">${esc(p.link_text)}</a></div></article>`).join('');
    $('#skills-list').innerHTML = d.skills.map(s => `<div class="skill" style="--c:var(--${col(s.color)})"><span class="eyebrow">${esc(s.title)}</span><div class="stack">${skillChips(s.items)}</div></div>`).join('');
    initCarousel();
    initTextReveal();
  } catch { $('#tl').innerHTML = '<p style="color:var(--mut)">Gagal memuat konten. Pastikan server backend berjalan (npm start).</p>'; }
}
load();
initEngagement();
initThemeToggle();
initTextReveal();

// Form kontak -> POST /api/contact
$('#contact').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, st = $('#status'), btn = f.querySelector('button');
  st.className = ''; st.textContent = 'Mengirim...'; btn.disabled = true;
  try {
    const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(f))) });
    const j = await r.json();
    if (r.ok) { st.textContent = 'Pesan terkirim. Terima kasih!'; f.reset(); } else { st.className = 'err'; st.textContent = j.error || 'Gagal kirim.'; }
  } catch { st.className = 'err'; st.textContent = 'Gagal kirim. Cek koneksi lo.'; }
  btn.disabled = false;
});

// Highlight menu sesuai section yang lagi dilihat
const navLinks = [...document.querySelectorAll('.links a')];
const menuToggle = $('#menu-toggle'), navMenu = $('.links');
menuToggle.onclick = () => { const open = navMenu.classList.toggle('open'); menuToggle.setAttribute('aria-expanded', String(open)); menuToggle.setAttribute('aria-label', open ? 'Tutup navigasi' : 'Buka navigasi'); menuToggle.textContent = open ? '×' : '☰'; };
navLinks.forEach(a => a.addEventListener('click', () => { navMenu.classList.remove('open'); menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.setAttribute('aria-label', 'Buka navigasi'); menuToggle.textContent = '☰'; }));
const spy = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) navLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
navLinks.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) spy.observe(s); });
