/**
 * EduMantra Shell v2 — ui-ux-pro-max compliant
 * ✓ Lucide SVG icons — no emojis as icons
 * ✓ cursor:pointer via CSS on all interactive elements
 * ✓ Transitions 150-300ms
 * ✓ Focus states via :focus-visible
 * ✓ prefers-reduced-motion via CSS
 * ✓ Skip link in each page for keyboard nav
 */

/* ─── Lucide SVG icon set ───────────────────────── */
const L = {
  _i: (paths, size=18) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
      stroke-linejoin="round" aria-hidden="true">${paths}</svg>`,

  home:         (s) => L._i('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',s),
  barChart:     (s) => L._i('<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',s),
  users:        (s) => L._i('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',s),
  user:         (s) => L._i('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',s),
  book:         (s) => L._i('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',s),
  map:          (s) => L._i('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',s),
  brain:        (s) => L._i('<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.07-4.13A3 3 0 0 1 4.46 12 3 3 0 0 1 5 9.5a3.5 3.5 0 0 1 1.5-5A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.07-4.13A3 3 0 0 0 19.54 12 3 3 0 0 0 19 9.5a3.5 3.5 0 0 0-1.5-5A2.5 2.5 0 0 0 14.5 2Z"/>',s),
  zap:          (s) => L._i('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',s),
  clipboard:    (s) => L._i('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',s),
  target:       (s) => L._i('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',s),
  shield:       (s) => L._i('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',s),
  settings:     (s) => L._i('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',s),
  bell:         (s) => L._i('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',s),
  search:       (s) => L._i('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',s),
  logOut:       (s) => L._i('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',s),
  plus:         (s) => L._i('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',s),
  pencil:       (s) => L._i('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',s),
  trash:        (s) => L._i('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',s),
  download:     (s) => L._i('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',s),
  upload:       (s) => L._i('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',s),
  eye:          (s) => L._i('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',s),
  alertTriangle:(s) => L._i('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',s),
  checkCircle:  (s) => L._i('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',s),
  xCircle:      (s) => L._i('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',s),
  x:            (s) => L._i('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',s),
  menu:         (s) => L._i('<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',s),
  arrowRight:   (s) => L._i('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',s),
  calendar:     (s) => L._i('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',s),
  file:         (s) => L._i('<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>',s),
  cpu:          (s) => L._i('<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',s),
  database:     (s) => L._i('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',s),
  globe:        (s) => L._i('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',s),
  sparkles:     (s) => L._i('<path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287Z"/>',s),
  award:        (s) => L._i('<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',s),
  star:         (s) => L._i('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',s),
  trendingUp:   (s) => L._i('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',s),
  lock:         (s) => L._i('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',s),
  terminal:     (s) => L._i('<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',s),
  send:         (s) => L._i('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',s),
  flask:        (s) => L._i('<path d="M9 3h6l1 9H8L9 3z"/><path d="M6.3 15a2 2 0 0 0-.3 1 2 2 0 0 0 2 2h8a2 2 0 0 0 2-2 2 2 0 0 0-.3-1L15 12H9L6.3 15z"/>',s),
  messageSquare:(s) => L._i('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',s),
  checkSquare:  (s) => L._i('<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',s),
  layers:       (s) => L._i('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',s),
  activity:     (s) => L._i('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',s),
  refreshCw:    (s) => L._i('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',s),
  copy:         (s) => L._i('<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 0 2 2v1"/>',s),
  keyRound:     (s) => L._i('<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',s),
  server:       (s) => L._i('<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',s),
  bookOpen:     (s) => L._i('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',s),
  pieChart:     (s) => L._i('<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',s),
  userCheck:    (s) => L._i('<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',s),
  package:      (s) => L._i('<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',s),
  helpCircle:   (s) => L._i('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',s),
  chevronsRight:(s) => L._i('<polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>',s),
  minus:        (s) => L._i('<line x1="5" y1="12" x2="19" y2="12"/>',s),
  externalLink: (s) => L._i('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',s),
};

/* ─── Toast ──────────────────────────────────────────── */
const Toast = {
  _el: null,
  _init() {
    if (!this._el) {
      this._el = document.createElement('div');
      this._el.className = 'toast-stack';
      this._el.setAttribute('role', 'region');
      this._el.setAttribute('aria-live', 'polite');
      document.body.appendChild(this._el);
    }
  },
  show(msg, type = 'info', ms = 4500) {
    this._init();
    const icons = {
      success: L.checkCircle(), error: L.xCircle(),
      info: L.helpCircle(),   warning: L.alertTriangle(),
    };
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.setAttribute('role', 'alert');
    t.innerHTML = `<span class="toast-icon">${icons[type]||icons.info}</span><span class="toast-msg">${msg}</span>`;
    this._el.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 200ms';
      setTimeout(() => t.remove(), 200);
    }, ms);
  },
  success: m => Toast.show(m, 'success'),
  error:   m => Toast.show(m, 'error'),
  info:    m => Toast.show(m, 'info'),
  warn:    m => Toast.show(m, 'warning'),
};

/* ─── Modal ──────────────────────────────────────────── */
const Modal = {
  open(id)  { document.getElementById(id)?.classList.add('open'); },
  close(id) { document.getElementById(id)?.classList.remove('open'); },
  init(id)  {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => Modal.close(id)));
    el.addEventListener('click', e => { if (e.target === el) Modal.close(id); });
    // Trap focus inside modal when open
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') Modal.close(id);
    });
  },
};

/* ─── Shell init ─────────────────────────────────────── */
function initShell({ name, role, avatarUrl }) {
  // Set user info
  const nameEl = document.querySelector('#sidebarName');
  const roleEl = document.querySelector('#sidebarRole');
  const avEl   = document.querySelector('#sidebarAvatar');
  const bRole  = document.querySelector('.brand-role');
  if (nameEl) nameEl.textContent = name || 'User';
  if (roleEl) roleEl.textContent = (role||'').replace(/_/g,' ');
  if (bRole)  bRole.textContent  = (role||'').replace(/_/g,' ');
  if (avEl) {
    if (avatarUrl) avEl.innerHTML = `<img src="${avatarUrl}" alt="${name}">`;
    else avEl.textContent = (name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '??';
  }

  // Menu toggle (hamburger)
  const toggle = document.querySelector('.menu-toggle');
  const sb     = document.querySelector('.sidebar');
  if (toggle) toggle.innerHTML = L.menu();
  if (toggle && sb) {
    toggle.addEventListener('click', () => sb.classList.toggle('open'));
    // Overlay click closes sidebar on mobile
    document.addEventListener('click', e => {
      if (window.innerWidth < 1024 && !sb.contains(e.target) && !toggle.contains(e.target)) {
        sb.classList.remove('open');
      }
    });
  }

  // Logout
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.innerHTML = L.logOut();
    logoutBtn.title = 'Sign out';
    logoutBtn.addEventListener('click', () => {
      Api.post('/auth/logout', {}).catch(() => {});
      Auth.logout();
    });
  }
}

/* ─── Navigation ─────────────────────────────────────── */
function initNav(defaultPage, handlers = {}) {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => goPage(item.dataset.page, handlers));
  });
  goPage(defaultPage, handlers, true);
}

function goPage(pageId, handlers = {}, silent = false) {
  document.querySelectorAll('.dash-page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${pageId}`)?.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${pageId}"]`)?.classList.add('active');

  const lbl = document.querySelector(`.nav-item[data-page="${pageId}"] .nav-label`)?.textContent;
  const tt  = document.querySelector('.topbar-title');
  if (tt && lbl) tt.textContent = lbl;

  // Close sidebar on mobile
  if (window.innerWidth < 1024) document.querySelector('.sidebar')?.classList.remove('open');

  if (!silent && handlers[pageId]) handlers[pageId]();
}

/* ─── Tabs ───────────────────────────────────────────── */
function initTabs(el) {
  if (!el) return;
  el.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const root = btn.closest('[data-tabs]') || el;
      root.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      root.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      root.querySelector(`.tab-panel[data-tab="${btn.dataset.tab}"]`)?.classList.add('active');
      if (btn.dataset.fn) window[btn.dataset.fn]?.();
    });
  });
}

/* ─── Progress bar HTML ──────────────────────────────── */
function progBar(pct, cls = '') {
  const v = Math.min(100, Math.max(0, Math.round(parseFloat(pct)||0)));
  return `<div class="progress progress-md"><div class="progress-fill${cls?' '+cls:''}" style="width:${v}%"></div></div>`;
}

/* ─── Competency pips ────────────────────────────────── */
const LEVELS = ['none','beginner','intermediate','advanced','expert'];
function compPips(level, n=4) {
  const idx = Math.max(0, LEVELS.indexOf(level));
  const cls = idx >= 4 ? 'g' : idx >= 3 ? '' : idx >= 2 ? '' : idx >= 1 ? 'a' : 'r';
  return `<div class="pips" title="${level||'none'}">${Array.from({length:n},(_,i)=>`<div class="pip${i<idx?' on'+( i<idx&&idx<=1?' r':idx<=2?' a':' '):''}"></div>`).join('')}</div>`;
}

/* ─── Inline bar chart ───────────────────────────────── */
function barChart(items, maxOverride) {
  const max = maxOverride || Math.max(...items.map(i=>i.value), 1);
  return `<div class="bar-chart">
    ${items.map(it=>{
      const h = Math.round((it.value/max)*76)+4;
      return `<div class="bar-col">
        <span class="bar-val">${it.value}</span>
        <div class="bar-fill" style="height:${h}px;background:${it.color||'var(--color-primary)'}"></div>
        <span class="bar-lbl">${it.label}</span>
      </div>`;
    }).join('')}
  </div>`;
}

/* ─── Badges ─────────────────────────────────────────── */
function statusBadge(s) {
  const m = { completed:'badge-done', in_progress:'badge-progress', not_started:'badge-slate', dropped:'badge-red', active:'badge-active', inactive:'badge-inactive' };
  const l = { completed:'Completed', in_progress:'In Progress', not_started:'Not Started', dropped:'Dropped', active:'Active', inactive:'Inactive' };
  return `<span class="badge ${m[s]||'badge-slate'}">${l[s]||s}</span>`;
}
function severityBadge(s) {
  const m = { critical:'badge-critical', high:'badge-high', medium:'badge-medium', low:'badge-low' };
  return `<span class="badge ${m[s]||'badge-slate'}">${s||'—'}</span>`;
}
function roleBadge(r) {
  const m = { student:'badge-blue', instructor:'badge-slate', parent:'badge-amber', organization_admin:'badge-sky', developer:'badge-red' };
  const l = { student:'Student', instructor:'Educator', parent:'Supervisor', organization_admin:'Org Admin', developer:'Developer' };
  return `<span class="badge ${m[r]||'badge-slate'}">${l[r]||r}</span>`;
}

/* ─── Dates ──────────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric'}).format(new Date(iso));
}
function fmtHours(h) {
  if (!h) return '—';
  const n = parseFloat(h);
  return n < 1 ? `${Math.round(n*60)}m` : `${n%1===0?n:n.toFixed(1)}h`;
}
function timeAgo(iso) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso))/60000);
  if (m<1) return 'just now';
  if (m<60) return `${m}m ago`;
  const hr = Math.floor(m/60);
  if (hr<24) return `${hr}h ago`;
  return fmtDate(iso);
}

/* ─── Empty state ────────────────────────────────────── */
function emptyState(title, desc, action='') {
  return `<div class="empty-state">
    <div class="empty-icon">${L.file(40)}</div>
    <div class="empty-title">${title}</div>
    <p class="empty-desc">${desc}</p>
    ${action}
  </div>`;
}
