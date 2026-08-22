/* ============================================================
   EduMantra – API Client
   ============================================================ */
const API_BASE = '/api/v1';

const Api = (() => {
  function getToken() {
    return localStorage.getItem('em_access_token');
  }

  async function request(method, path, body = null, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { method, headers, ...opts };
    if (body) config.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, config);

    if (res.status === 401) {
      // Try token refresh
      const refreshed = await tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${getToken()}`;
        const retry = await fetch(`${API_BASE}${path}`, { ...config, headers });
        if (!retry.ok) {
          const err = await retry.json().catch(() => ({}));
          throw new Error(err.error || 'Request failed');
        }
        return retry.json();
      }
      Auth.logout();
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  async function tryRefresh() {
    const refreshToken = localStorage.getItem('em_refresh_token');
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('em_access_token', data.access_token);
      localStorage.setItem('em_refresh_token', data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  async function upload(path, formData) {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  }

  return {
    get:    (path)         => request('GET', path),
    post:   (path, body)   => request('POST', path, body),
    put:    (path, body)   => request('PUT', path, body),
    del:    (path)         => request('DELETE', path),
    upload: (path, form)   => upload(path, form),
  };
})();

/* ============================================================
   Auth helpers
   ============================================================ */
const Auth = {
  save(data) {
    localStorage.setItem('em_access_token',  data.access_token);
    localStorage.setItem('em_refresh_token', data.refresh_token);
    localStorage.setItem('em_user',          JSON.stringify(data.user));
  },
  getUser() {
    try { return JSON.parse(localStorage.getItem('em_user') || 'null'); }
    catch { return null; }
  },
  isLoggedIn() { return !!localStorage.getItem('em_access_token'); },
  logout() {
    localStorage.removeItem('em_access_token');
    localStorage.removeItem('em_refresh_token');
    localStorage.removeItem('em_user');
    window.location.href = '/index.html';
  },
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/index.html';
      return null;
    }
    return this.getUser();
  },
  redirectByRole(user) {
    const routes = {
      student:            '/dashboards/student.html',
      instructor:         '/dashboards/instructor.html',
      parent:             '/dashboards/parent.html',
      organization_admin: '/dashboards/organization.html',
      developer:          '/dashboards/developer.html',
    };
    window.location.href = routes[user.role] || '/dashboards/student.html';
  },
};

/* ============================================================
   Toast notifications
   ============================================================ */
const Toast = {
  container: null,
  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  show(message, type = 'info', duration = 4000) {
    this.init();
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    this.container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  },
  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'error'),
  info:    (msg) => Toast.show(msg, 'info'),
};

/* ============================================================
   UI Utilities
   ============================================================ */
const UI = {
  // Build initials avatar text
  initials(name = '') {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';
  },

  // Format date
  date(iso) {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  },

  // Format hours
  hours(h) {
    if (!h) return '—';
    const n = parseFloat(h);
    if (n < 1) return `${Math.round(n * 60)}m`;
    return `${n % 1 === 0 ? n : n.toFixed(1)}h`;
  },

  // Severity badge
  severityBadge(severity) {
    const map = { critical: 'red', high: 'orange', medium: 'blue', low: 'green' };
    return `<span class="badge badge-${map[severity] || 'gray'}">${severity}</span>`;
  },

  // Status badge
  statusBadge(status) {
    const map = {
      completed:   ['green',  '✓ Completed'],
      in_progress: ['blue',   '⏳ In Progress'],
      not_started: ['gray',   '○ Not Started'],
      dropped:     ['red',    '✕ Dropped'],
    };
    const [color, label] = map[status] || ['gray', status];
    return `<span class="badge badge-${color}">${label}</span>`;
  },

  // Role badge
  roleBadge(role) {
    const map = {
      student:            ['blue',   'Student'],
      instructor:         ['purple', 'Instructor'],
      parent:             ['orange', 'Parent'],
      organization_admin: ['cyan',   'Org Admin'],
      developer:          ['red',    'Developer'],
    };
    const [color, label] = map[role] || ['gray', role];
    return `<span class="badge badge-${color}">${label}</span>`;
  },

  // Progress bar HTML
  progress(pct, color = 'blue') {
    const v = Math.min(100, Math.max(0, parseFloat(pct) || 0));
    return `
      <div class="progress-wrap">
        <div class="progress-bar ${color}" style="width:${v}%"></div>
      </div>
      <span class="text-xs text-muted" style="margin-top:.2rem;display:block">${Math.round(v)}%</span>`;
  },

  // Skeleton placeholder
  skeleton(h = '18px', w = '100%') {
    return `<div class="skeleton" style="height:${h};width:${w}"></div>`;
  },

  // Setup tabs
  setupTabs(container) {
    const tabs = container.querySelectorAll('.tab-btn');
    const panels = container.querySelectorAll('.tab-panel');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const target = container.querySelector(`.tab-panel[data-tab="${tab.dataset.tab}"]`);
        if (target) target.classList.add('active');
      });
    });
  },

  // Modal open/close
  openModal(id) {
    document.getElementById(id)?.classList.add('open');
  },
  closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
  },
};

/* ============================================================
   Sidebar & hamburger setup
   ============================================================ */
function setupSidebar(role, userName, avatarUrl) {
  const user = Auth.getUser();

  // Set brand role label
  const brandRole = document.querySelector('.brand-role');
  if (brandRole) brandRole.textContent = role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

  // User info in footer
  const nameEl = document.querySelector('.sidebar-user .name');
  const roleEl = document.querySelector('.sidebar-user .role');
  if (nameEl) nameEl.textContent = userName || 'User';
  if (roleEl) roleEl.textContent = role;

  // Avatar
  const avatarEl = document.querySelector('.sidebar-user .avatar');
  if (avatarEl) {
    if (avatarUrl) avatarEl.innerHTML = `<img src="${avatarUrl}" alt="avatar">`;
    else avatarEl.textContent = UI.initials(userName);
  }

  // Hamburger toggle
  const hamburger = document.querySelector('.hamburger');
  const sidebar = document.querySelector('.sidebar');
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  // Logout
  const logoutBtn = document.querySelector('.sidebar-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', () => Auth.logout());

  // Active nav item
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const page = item.dataset.page;
      showPage(page);
    });
  });
}

// Page visibility controller
function showPage(pageId) {
  document.querySelectorAll('.dash-page').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById(`page-${pageId}`);
  if (target) {
    target.classList.remove('hidden');
    const topbarTitle = document.querySelector('.topbar-title');
    if (topbarTitle) {
      const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
      if (navItem) topbarTitle.textContent = navItem.querySelector('.nav-label')?.textContent || pageId;
    }
  }
}
