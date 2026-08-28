// ══════════════════════════════════════════════════════════════════
// EduMantra Theme Manager — Dark / Light (Black & White) Switcher
// ══════════════════════════════════════════════════════════════════

(function() {
  const THEME_KEY = 'em_theme';

  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark'; // default
  }

  function getSunIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  }

  function getMoonIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'light') {
      root.classList.add('theme-light');
      root.classList.remove('theme-dark');
    } else {
      root.classList.add('theme-dark');
      root.classList.remove('theme-light');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch(e) {}

    // Update all theme toggle buttons across the UI
    document.querySelectorAll('.theme-toggle-btn, [data-action="toggle-theme"], #themeToggleBtn, #themeToggle').forEach(btn => {
      const isLight = theme === 'light';
      btn.setAttribute('aria-label', isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme');
      btn.setAttribute('title', isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme');
      btn.innerHTML = isLight ? getMoonIcon() : getSunIcon();
    });

    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }

  // Set immediately
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  window.Theme = {
    get: () => document.documentElement.getAttribute('data-theme') || 'dark',
    set: applyTheme,
    toggle: () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    }
  };

  window.toggleTheme = window.Theme.toggle;

  // Re-run once DOM loads to bind newly rendered buttons
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyTheme(getPreferredTheme()));
  } else {
    applyTheme(getPreferredTheme());
  }
})();
