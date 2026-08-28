/* ============================================================
   EduMantra – API Client & Shared Utilities  v2
   ============================================================ */
const API = '/api/v1';

/* ── HTTP client ─────────────────────────────────────────── */
const Api = (() => {
  const tok = () => localStorage.getItem('em_token');

  async function req(method, path, body, isForm) {
    const h = {};
    if (tok()) h['Authorization'] = `Bearer ${tok()}`;
    if (!isForm) h['Content-Type'] = 'application/json';
    const cfg = { method, headers: h };
    if (body) cfg.body = isForm ? body : JSON.stringify(body);
    const r = await fetch(`${API}${path}`, cfg);
    if (r.status === 401) { Auth.logout(); return; }
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
    if (r.status === 204) return null;
    return r.json();
  }

  return {
    get:    (p)      => req('GET', p),
    post:   (p, b)   => req('POST', p, b),
    put:    (p, b)   => req('PUT', p, b),
    del:    (p)      => req('DELETE', p),
    upload: (p, f)   => req('POST', p, f, true),
  };
})();

/* ── Auth ────────────────────────────────────────────────── */
const Auth = {
  save(d) {
    if (!d) return;
    if (d.access_token) localStorage.setItem('em_token', d.access_token);
    if (d.refresh_token) localStorage.setItem('em_refresh', d.refresh_token);
    if (d.user) localStorage.setItem('em_user', JSON.stringify(d.user));
  },
  user() { try { return JSON.parse(localStorage.getItem('em_user')||'null'); } catch { return null; } },
  loggedIn() { return !!localStorage.getItem('em_token'); },
  logout() {
    ['em_token','em_refresh','em_user'].forEach(k => localStorage.removeItem(k));
    window.location.href = '/login.html';
  },
  guard() {
    if (!this.loggedIn()) { window.location.href = '/login.html'; return null; }
    return this.user();
  },
  redirect(u) {
    const map = {
      student:            '/dashboards/student.html',
      instructor:         '/dashboards/educator.html',
      parent:             '/dashboards/supervisor.html',
      organization_admin: '/dashboards/organization.html',
      developer:          '/dashboards/developer.html',
    };
    window.location.href = map[u?.role] || '/dashboards/student.html';
  },
};

/* ── Toast ───────────────────────────────────────────────── */
window.Toast = window.Toast || {
  _el: null,
  _init() {
    if (!this._el) {
      this._el = document.createElement('div');
      this._el.className = 'toast-wrap';
      document.body.appendChild(this._el);
    }
  },
  show(msg, type = 'info', ms = 4000) {
    this._init();
    const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
    this._el.appendChild(t);
    setTimeout(() => t.remove(), ms);
  },
  success: m => window.Toast.show(m,'success'),
  error:   m => window.Toast.show(m,'error'),
  info:    m => window.Toast.show(m,'info'),
  warn:    m => window.Toast.show(m,'warning'),
};

/* ── UI helpers ──────────────────────────────────────────── */
const UI = {
  initials: n => (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'??',

  date(iso) {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric'}).format(new Date(iso));
  },

  hours(h) {
    if (!h) return '—';
    const n = parseFloat(h);
    return n < 1 ? `${Math.round(n*60)}m` : `${n%1===0?n:n.toFixed(1)}h`;
  },

  pct(v) { return `${Math.min(100,Math.max(0,Math.round(parseFloat(v)||0)))}%`; },

  prog(pct, cls='pb-blue') {
    const v = Math.min(100,Math.max(0,Math.round(parseFloat(pct)||0)));
    return `<div class="prog-wrap"><div class="prog-bar ${cls}" style="width:${v}%"></div></div>`;
  },

  badge(text, cls='b-gray') { return `<span class="badge ${cls}">${text}</span>`; },

  roleBadge(r) {
    const m = {student:'b-blue',instructor:'b-purple',parent:'b-orange',organization_admin:'b-cyan',developer:'b-red'};
    const l = {student:'Student',instructor:'Instructor',parent:'Supervisor',organization_admin:'Org Admin',developer:'Developer'};
    return `<span class="badge ${m[r]||'b-gray'}">${l[r]||r}</span>`;
  },

  statusBadge(s) {
    const m = {completed:'b-green',in_progress:'b-blue',not_started:'b-gray',dropped:'b-red'};
    const l = {completed:'✓ Done',in_progress:'In Progress',not_started:'Not Started',dropped:'Dropped'};
    return `<span class="badge ${m[s]||'b-gray'}">${l[s]||s}</span>`;
  },

  severityBadge(s) {
    const m={critical:'b-red',high:'b-orange',medium:'b-blue',low:'b-green'};
    return `<span class="badge ${m[s]||'b-gray'}">${s}</span>`;
  },

  levelPips(level) {
    const order = ['none','beginner','intermediate','advanced','expert'];
    const idx = order.indexOf(level);
    return order.slice(1).map((_,i) =>
      `<div class="comp-pip${i<idx?' filled':''}"></div>`).join('');
  },

  openModal:  id => document.getElementById(id)?.classList.add('open'),
  closeModal: id => document.getElementById(id)?.classList.remove('open'),

  setupTabs(root) {
    root.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
        root.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
        btn.classList.add('active');
        root.querySelector(`.tab-panel[data-tab="${btn.dataset.tab}"]`)?.classList.add('active');
      });
    });
  },

  /* Mini bar chart – data: [{label,value,color}] */
  barChart(data, maxVal) {
    const max = maxVal || Math.max(...data.map(d=>d.value), 1);
    return `<div class="bar-chart">
      ${data.map(d=>`
        <div class="bar-col">
          <span class="text-xs text-muted">${d.value}</span>
          <div class="bar-fill" style="height:${Math.round((d.value/max)*80)+4}px;background:${d.color||'var(--primary)'}"></div>
          <span class="bar-label">${d.label}</span>
        </div>`).join('')}
    </div>`;
  },

  /* SVG donut – segments: [{value,color,label}] */
  donut(segments, size=90) {
    const total = segments.reduce((s,x)=>s+x.value,0)||1;
    let offset = 0;
    const r=30, cx=50, cy=50, circ=2*Math.PI*r;
    const arcs = segments.map(s=>{
      const dash = (s.value/total)*circ;
      const arc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="14"
        stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += dash;
      return arc;
    }).join('');
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="donut">${arcs}</svg>`;
  },
};

/* ── Sidebar & navigation ────────────────────────────────── */
function initSidebar(role, name, avatarUrl) {
  const nameEl  = document.querySelector('#sidebarName');
  const roleEl  = document.querySelector('#sidebarRole');
  const avEl    = document.querySelector('#sidebarAvatar');
  const brandR  = document.querySelector('.brand-role');
  if (nameEl) nameEl.textContent = name || 'User';
  if (roleEl) roleEl.textContent = role?.replace('_',' ') || '';
  if (brandR) brandR.textContent = role?.replace('_',' ') || '';
  if (avEl) { avEl.textContent = ''; if (avatarUrl) avEl.innerHTML=`<img src="${avatarUrl}">`; else avEl.textContent=UI.initials(name); }

  // Hamburger
  const ham = document.querySelector('.hamburger');
  const sb  = document.querySelector('.sidebar');
  if (ham && sb) {
    ham.addEventListener('click', () => sb.classList.toggle('open'));
    document.addEventListener('click', e => { if (!sb.contains(e.target)&&!ham.contains(e.target)) sb.classList.remove('open'); });
  }

  // Logout
  document.querySelector('.sidebar-logout')?.addEventListener('click', () => Auth.logout());
}

function activateNav(page) {
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
}

function showPage(pageId) {
  document.querySelectorAll('.dash-page').forEach(p=>p.classList.add('hidden'));
  document.getElementById(`page-${pageId}`)?.classList.remove('hidden');
  const lbl = document.querySelector(`.nav-item[data-page="${pageId}"] .nav-label`)?.textContent;
  const tt = document.querySelector('.topbar-title');
  if (tt && lbl) tt.textContent = lbl;
  activateNav(pageId);
}

function setupNav(handlers = {}) {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      showPage(item.dataset.page);
      handlers[item.dataset.page]?.();
    });
  });
}
