/**
 * EduMantra Shell — shared runtime for all dashboards
 * Follows ui-ux-pro-max-skill rules:
 *  - SVG icons (Phosphor), no emoji as icons
 *  - cursor-pointer on all interactive elements (applied via CSS)
 *  - Focus states visible (design-system.css)
 *  - prefers-reduced-motion respected
 *  - Text reflows correctly at all widths
 */

/* ── Icons (Phosphor subset — inline SVG) ─────────────────── */
const Icon = {
  _s: (d, size=18) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${d}</svg>`,
  house:        () => Icon._s('<path d="M224 115.55V208a16 16 0 0 1-16 16H168a16 16 0 0 1-16-16V168H104v40a16 16 0 0 1-16 16H48a16 16 0 0 1-16-16V115.55a16 16 0 0 1 5.17-11.78l80-75.48a16 16 0 0 1 21.66 0l80 75.48A16 16 0 0 1 224 115.55Z"/>'),
  chart:        () => Icon._s('<path d="M232 208a8 8 0 0 1-8 8H32a8 8 0 0 1-8-8V48a8 8 0 0 1 16 0v132l50-53.06a8 8 0 0 1 11.16-.73l43.15 37.23L184 115a8 8 0 0 1 12.69.38L224 152V48a8 8 0 0 1 16 0v160Z"/>'),
  users:        () => Icon._s('<path d="M117.25 157.92a60 60 0 1 0-66.5 0 95.83 95.83 0 0 0-47.22 37.71 8 8 0 1 0 13.4 8.74 80 80 0 0 1 134.14 0 8 8 0 0 0 13.4-8.74 95.83 95.83 0 0 0-47.22-37.71ZM40 108a44 44 0 1 1 44 44A44.05 44.05 0 0 1 40 108Zm210.14 98.7a95.83 95.83 0 0 0-47.22-37.71 60 60 0 1 0-66.5 0 95.83 95.83 0 0 0-47.22 37.71 8 8 0 0 0 13.4 8.74 80 80 0 0 1 134.14 0 8 8 0 0 0 13.4-8.74Z"/>'),
  user:         () => Icon._s('<path d="M230.92 212c-15.23-26.33-38.7-45.21-66.09-54.16a72 72 0 1 0-73.66 0C63.78 166.79 40.31 185.67 25.08 212a8 8 0 1 0 13.85 8c18.84-32.56 52.14-52 89.07-52s70.23 19.44 89.07 52a8 8 0 1 0 13.85-8ZM72 96a56 56 0 1 1 56 56A56.06 56.06 0 0 1 72 96Z"/>'),
  book:         () => Icon._s('<path d="M208 24H72a32 32 0 0 0-32 32v144a32 32 0 0 0 32 32h136a8 8 0 0 0 8-8V32a8 8 0 0 0-8-8Zm-8 192H72a16 16 0 0 1 0-32h128ZM56 152.57A31.81 31.81 0 0 1 72 148h128V40H72a16 16 0 0 0-16 16Z"/>'),
  path:         () => Icon._s('<path d="M237.66 58.34a8 8 0 0 0-11.32 0L192 92.69l-13.17-13.17a8 8 0 0 0-11.32 11.32L181.69 104l-76.1 76.1a40 40 0 0 1-55.16 0 8 8 0 0 0-11.32 11.32 56.11 56.11 0 0 0 77.8 0L193.03 115.3l13.63 13.63a8 8 0 0 0 11.32-11.32L204.69 104l33.35-33.35a8 8 0 0 0 0-11.31ZM18.34 197.66a8 8 0 1 1 11.32-11.32l20 20a8 8 0 0 1-11.32 11.32Z"/>'),
  brain:        () => Icon._s('<path d="M248 120a48.05 48.05 0 0 0-40.09-47.38 40.07 40.07 0 0 0-48.5-48.5 40 40 0 0 0-62.82 0 40.07 40.07 0 0 0-48.5 48.5 48 48 0 0 0 0 94.76 40.07 40.07 0 0 0 48.5 48.5 40 40 0 0 0 62.82 0 40.07 40.07 0 0 0 48.5-48.5A48.05 48.05 0 0 0 248 120Z"/>'),
  lightning:    () => Icon._s('<path d="M213.85 125.46l-112 120a8 8 0 0 1-13.69-7l14.66-73.33-57.63-21.64a8 8 0 0 1-2.87-13L154.15 10.54a8 8 0 0 1 13.69 7l-14.66 73.33 57.63 21.64a8 8 0 0 1 2.87 13Z"/>'),
  clipboard:    () => Icon._s('<path d="M160 40h-12V32a20 20 0 0 0-40 0v8H96a16 16 0 0 0-16 16v152a16 16 0 0 0 16 16h64a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16ZM108 32a4 4 0 0 1 8 0v16H108Zm68 176H80V56h16v8a8 8 0 0 0 8 8h48a8 8 0 0 0 8-8v-8h16Z"/>'),
  flask:        () => Icon._s('<path d="M221.56 160l-53.34-89.09A8 8 0 0 0 176 64V40h8a8 8 0 0 0 0-16H72a8 8 0 0 0 0 16h8v24a8 8 0 0 0 7.78 8.88L34.44 160a16 16 0 0 0 13.56 24.53h160A16 16 0 0 0 221.56 160ZM96 40h64v19.42l-8.2 13.67a4 4 0 0 1-6.9-.35L128 40h-16l-9.9 32.74a4 4 0 0 1-6.1 2L96 40Z"/>'),
  shield:       () => Icon._s('<path d="M208 40H48a16 16 0 0 0-16 16v58.77c0 89.61 75.82 119.34 91 124.39a15.53 15.53 0 0 0 10 0c15.2-5.05 91-34.78 91-124.39V56A16 16 0 0 0 208 40Z"/>'),
  gear:         () => Icon._s('<path d="M128 80a48 48 0 1 0 48 48 48.05 48.05 0 0 0-48-48Zm0 80a32 32 0 1 1 32-32 32 32 0 0 1-32 32Zm108.61-55.43-9.52-16.5a20 20 0 0 0-26.07-7.35l-6.22 3.08a78.55 78.55 0 0 0-9.26-5.33L184 72a20 20 0 0 0-19.76-16h-19a20 20 0 0 0-19.76 16l-1.55 7.53a78.55 78.55 0 0 0-9.26 5.33L108.46 81.7a20 20 0 0 0-26.07 7.35L72.87 105.6a20 20 0 0 0 4.52 26.1l6.07 4.79a80.43 80.43 0 0 0 0 10.54l-6.07 4.79a20 20 0 0 0-4.52 26.1l9.52 16.5a20 20 0 0 0 26.07 7.35l6.22-3.08a78.55 78.55 0 0 0 9.26 5.33L125.3 211a20 20 0 0 0 19.76 16h19a20 20 0 0 0 19.76-16l1.55-7.53a78.55 78.55 0 0 0 9.26-5.33l6.22 3.08a20 20 0 0 0 26.07-7.35l9.52-16.5a20 20 0 0 0-4.52-26.1l-6.07-4.79a80.43 80.43 0 0 0 0-10.54l6.07-4.79a20 20 0 0 0 4.52-26.1Z"/>'),
  bell:         () => Icon._s('<path d="M221.8 175.94C216.25 166.38 208 139.33 208 104a80 80 0 1 0-160 0c0 35.34-8.26 62.38-13.81 71.94A16 16 0 0 0 48 200h40.81a40 40 0 0 0 78.38 0H208a16 16 0 0 0 13.8-24.06ZM128 216a24 24 0 0 1-22.62-16h45.24A24 24 0 0 1 128 216Z"/>'),
  search:       () => Icon._s('<path d="M229.66 218.34l-50.07-50.07a88.11 88.11 0 1 0-11.31 11.31l50.06 50.07a8 8 0 0 0 11.32-11.31ZM40 112a72 72 0 1 1 72 72A72.08 72.08 0 0 1 40 112Z"/>'),
  logout:       () => Icon._s('<path d="M120 216a8 8 0 0 1-8 8H48a16 16 0 0 1-16-16V48a16 16 0 0 1 16-16h64a8 8 0 0 1 0 16H48v160h64a8 8 0 0 1 8 8Zm109.66-93.66-40-40a8 8 0 0 0-11.32 11.32L204.69 120H112a8 8 0 0 0 0 16h92.69l-26.35 26.34a8 8 0 0 0 11.32 11.32l40-40a8 8 0 0 0 0-11.32Z"/>'),
  plus:         () => Icon._s('<path d="M224 128a8 8 0 0 1-8 8H136v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8Z"/>'),
  pencil:       () => Icon._s('<path d="M227.31 73.37 182.63 28.68a16 16 0 0 0-22.63 0L36.69 152A15.86 15.86 0 0 0 32 163.31V208a16 16 0 0 0 16 16h44.69A15.86 15.86 0 0 0 104 219.31L227.31 96a16 16 0 0 0 0-22.63ZM92.69 208H48v-44.69l88-88L180.69 120Zm96-96L144.69 68l24-24L212.69 88Z"/>'),
  trash:        () => Icon._s('<path d="M216 48h-40v-8a24 24 0 0 0-24-24h-48a24 24 0 0 0-24 24v8H40a8 8 0 0 0 0 16h8v144a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16V64h8a8 8 0 0 0 0-16ZM96 40a8 8 0 0 1 8-8h48a8 8 0 0 1 8 8v8H96Zm96 168H64V64h128Z"/>'),
  download:     () => Icon._s('<path d="M224 152v56a16 16 0 0 1-16 16H48a16 16 0 0 1-16-16v-56a8 8 0 0 1 16 0v56h160v-56a8 8 0 0 1 16 0Zm-101.66 5.66a8 8 0 0 0 11.32 0l40-40a8 8 0 0 0-11.32-11.32L136 132.69V40a8 8 0 0 0-16 0v92.69L93.66 106.34a8 8 0 0 0-11.32 11.32Z"/>'),
  upload:       () => Icon._s('<path d="M240 136v64a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16v-64a8 8 0 0 1 16 0v64h192v-64a8 8 0 0 1 16 0ZM93.66 85.66a8 8 0 0 0 11.32 0L120 70.63V168a8 8 0 0 0 16 0V70.63l15.02 15.03a8 8 0 0 0 11.32-11.32l-24-24a8 8 0 0 0-.36-.34 8 8 0 0 0-10.6.34l-24 24a8 8 0 0 0-.04 11.32Z"/>'),
  eye:          () => Icon._s('<path d="M247.31 124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57 61.26 162.88 48 128 48S61.43 61.26 36.34 86.35C17.51 105.18 9 124 8.69 124.76a8 8 0 0 0 0 6.48c.35.79 8.82 19.58 27.65 38.41C61.43 194.74 93.12 208 128 208s66.57-13.26 91.66-38.35c18.83-18.83 27.3-37.62 27.65-38.41a8 8 0 0 0 0-6.48ZM128 192c-30.78 0-57.67-11.19-79.93-33.25A133.47 133.47 0 0 1 25 128a133.33 133.33 0 0 1 23.07-30.75C70.33 75.19 97.22 64 128 64s57.67 11.19 79.93 33.25A133.46 133.46 0 0 1 231.05 128c-7.21 13.46-38.62 64-103.05 64Zm0-112a48 48 0 1 0 48 48 48.05 48.05 0 0 0-48-48Zm0 80a32 32 0 1 1 32-32 32 32 0 0 1-32 32Z"/>'),
  warning:      () => Icon._s('<path d="M236.8 188.09 149.35 36.22a24.76 24.76 0 0 0-42.7 0L19.2 188.09a23.51 23.51 0 0 0 0 23.72A24.35 24.35 0 0 0 40.55 224h174.9a24.35 24.35 0 0 0 21.33-12.19 23.51 23.51 0 0 0 .02-23.72ZM120 104a8 8 0 0 1 16 0v40a8 8 0 0 1-16 0Zm8 88a12 12 0 1 1 12-12 12 12 0 0 1-12 12Z"/>'),
  check:        () => Icon._s('<path d="M173.66 98.34a8 8 0 0 1 0 11.32l-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 0ZM232 128A104 104 0 1 1 128 24a104.11 104.11 0 0 1 104 104Zm-16 0a88 88 0 1 0-88 88 88.1 88.1 0 0 0 88-88Z"/>'),
  x:            () => Icon._s('<path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/>'),
  menu:         () => Icon._s('<path d="M224 128a8 8 0 0 1-8 8H40a8 8 0 0 1 0-16h176a8 8 0 0 1 8 8ZM40 72h176a8 8 0 0 0 0-16H40a8 8 0 0 0 0 16Zm176 112H40a8 8 0 0 0 0 16h176a8 8 0 0 0 0-16Z"/>'),
  arrowRight:   () => Icon._s('<path d="M221.66 133.66l-72 72a8 8 0 0 1-11.32-11.32L196.69 136H40a8 8 0 0 1 0-16h156.69l-58.35-58.34a8 8 0 0 1 11.32-11.32l72 72a8 8 0 0 1 0 11.32Z"/>'),
  calendar:     () => Icon._s('<path d="M208 32h-24v-8a8 8 0 0 0-16 0v8H88v-8a8 8 0 0 0-16 0v8H48A16 16 0 0 0 32 48v160a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16ZM72 48v8a8 8 0 0 0 16 0v-8h80v8a8 8 0 0 0 16 0v-8h24v32H48V48ZM208 208H48V96h160Z"/>'),
  file:         () => Icon._s('<path d="M213.66 82.34l-56-56A8 8 0 0 0 152 24H56A16 16 0 0 0 40 40v176a16 16 0 0 0 16 16h144a16 16 0 0 0 16-16V88a8 8 0 0 0-2.34-5.66ZM160 51.31 188.69 80H160ZM200 216H56V40h88v48a8 8 0 0 0 8 8h48V216Z"/>'),
  robot:        () => Icon._s('<path d="M200 48h-72V16a8 8 0 0 0-16 0v32H40A16 16 0 0 0 24 64v80a16 16 0 0 0 16 16h4v16a16 16 0 0 0 16 16h136a16 16 0 0 0 16-16v-16h4a16 16 0 0 0 16-16V64a16 16 0 0 0-16-16ZM96 120a16 16 0 1 1 16-16 16 16 0 0 1-16 16Zm64 0a16 16 0 1 1 16-16 16 16 0 0 1-16 16Zm56 0h-4V96h4Zm-176 0V96H40v24Z"/>'),
  database:     () => Icon._s('<path d="M128 24C74.17 24 32 48.6 32 80v96c0 31.4 42.17 56 96 56s96-24.6 96-56V80c0-31.4-42.17-56-96-56Zm80 128c0 9.6-30.75 40-80 40s-80-30.4-80-40v-16.61C67.28 145.45 96.5 152 128 152s60.72-6.55 80-16.61Zm0-48c0 9.6-30.75 40-80 40s-80-30.4-80-40V87.39C67.28 97.45 96.5 104 128 104s60.72-6.55 80-16.61Zm-80 16c-49.25 0-80-30.4-80-40s30.75-40 80-40 80 30.4 80 40-30.75 40-80 40Z"/>'),
  globe:        () => Icon._s('<path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm88 104a87.47 87.47 0 0 1-4.2 26.8L194 140.5A20.14 20.14 0 0 0 176 124h-4V112a8 8 0 0 0-8-8h-20v-8a8 8 0 0 0-8-8H108V76h12a8 8 0 0 0 8-8V44.32A88.29 88.29 0 0 1 216 128ZM40 128a87.47 87.47 0 0 1 2.91-22.5L72 128v8a16 16 0 0 0 16 16v8a16 16 0 0 0 16 16h8v22.32A88.1 88.1 0 0 1 40 128Z"/>'),
  sparkle:      () => Icon._s('<path d="M197.58 129.06 160 112l-17.07-37.6a20 20 0 0 0-36.5 0L89.92 112l-37.54 17a20 20 0 0 0 0 36.5L90 182.42l17.06 37.52a20 20 0 0 0 36.5 0L160 182.42l37.58-17a20 20 0 0 0 0-36.36Z"/>'),
  medal:        () => Icon._s('<path d="M221.9 53.9A8 8 0 0 0 215.12 48H40.88a8 8 0 0 0-6.78 12.22L96 163.45V216a8 8 0 0 0 11.58 7.16L128 213.8l20.42 9.36A8 8 0 0 0 160 216v-52.55l61.89-103.23A8 8 0 0 0 221.9 53.9Z"/>'),
  star:         () => Icon._s('<path d="m234.29 84.53-64.62 9.39L143 33.89a16 16 0 0 0-30 0L86.33 93.92 21.71 84.53a16 16 0 0 0-8.87 27.3l46.8 45.6-11 64.34a16 16 0 0 0 23.17 16.88L128 209.94l56.22 28.71A16 16 0 0 0 207.36 222l-11-64.34 46.8-45.6a16 16 0 0 0-8.87-27.53Z"/>'),
  trend:        () => Icon._s('<path d="M240 56a8 8 0 0 1-8 8h-44.69l-40 40a8 8 0 0 1-11.32 0L104 72.69 29.66 147a8 8 0 0 1-11.32-11.32l80-80a8 8 0 0 1 11.32 0L152 87.31l34.35-34.35H148a8 8 0 0 1 0-16h84a8 8 0 0 1 8 8ZM205.66 197.66 176 168l-32 32a8 8 0 0 1-13.54-5.66V136a8 8 0 0 1 8-8h58.34a8 8 0 0 1 5.66 13.54L178.21 159.8l29.79 29.8a8 8 0 0 1-2.34 8.06Z"/>'),
  lock:         () => Icon._s('<path d="M208 80h-32V52a48 48 0 0 0-96 0v28H48a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V96a16 16 0 0 0-16-16ZM96 52a32 32 0 0 1 64 0v28H96Zm112 156H48V96h160Zm-72-84v32a8 8 0 0 1-16 0v-32a8 8 0 0 1 16 0Z"/>'),
  terminal:     () => Icon._s('<path d="M128 136a8 8 0 0 1-8 8H72a8 8 0 0 1 0-16h48a8 8 0 0 1 8 8Zm56 8h-8a8 8 0 0 0 0 16h8a8 8 0 0 0 0-16Zm40-112H32A16 16 0 0 0 16 48v160a16 16 0 0 0 16 16h192a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16ZM32 64h192v24H32Zm192 144H32V104h192Zm-162.34-50.34a8 8 0 0 0 0 11.32l24 24a8 8 0 0 0 11.32-11.32L110.63 168l26.37-26.34a8 8 0 0 0-11.32-11.32Z"/>'),
  send:         () => Icon._s('<path d="m231.87 114-168-95.89A16 16 0 0 0 40.92 37l19.57 51.27A8 8 0 0 0 68 93.11l79.0 10.64a4 4 0 0 1 0 7.9l-79 10.64a8 8 0 0 0-7.51 5.83L40.92 219a16 16 0 0 0 22.95 18.91l168-95.89a16 16 0 0 0 0-27.02Z"/>'),
};

/* ── Toast system ─────────────────────────────────────────── */
const Toast = {
  _wrap: null,
  _get() {
    if (!this._wrap) {
      this._wrap = document.createElement('div');
      this._wrap.className = 'toast-stack';
      document.body.appendChild(this._wrap);
    }
    return this._wrap;
  },
  show(msg, type = 'info', duration = 4000) {
    const icons = { success: Icon.check(), error: Icon.x(), info: Icon.sparkle(), warning: Icon.warning() };
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg">${msg}</span>`;
    this._get().appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .2s'; setTimeout(() => t.remove(), 200); }, duration);
  },
  success: m => Toast.show(m, 'success'),
  error:   m => Toast.show(m, 'error'),
  info:    m => Toast.show(m, 'info'),
  warn:    m => Toast.show(m, 'warning'),
};

/* ── Auth / API (reuse api.js) ───────────────────────────── */
// api.js must be loaded first

/* ── Sidebar shell builder ───────────────────────────────── */
function buildSidebar({ role, name, avatarUrl, navItems }) {
  const user = Auth.user();

  // Brand role label
  const brandRoleEl = document.querySelector('.brand-role');
  if (brandRoleEl) brandRoleEl.textContent = (role || '').replace(/_/g, ' ');

  // User chip
  const nameEl = document.querySelector('.user-name');
  const roleEl = document.querySelector('.user-role');
  const avEl   = document.querySelector('.user-avatar');
  if (nameEl) nameEl.textContent = name || 'User';
  if (roleEl) roleEl.textContent = (role || '').replace(/_/g, ' ');
  if (avEl) {
    if (avatarUrl) avEl.innerHTML = `<img src="${avatarUrl}" alt="${name}">`;
    else avEl.textContent = (name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '??';
  }

  // Hamburger
  const toggle = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:199;display:none;background:rgba(15,23,42,.4)';
  document.body.appendChild(overlay);

  if (toggle && sidebar) {
    toggle.innerHTML = Icon.menu();
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.style.display = 'none';
    });
  }

  // Logout button
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.innerHTML = Icon.logout();
    logoutBtn.title = 'Sign out';
    logoutBtn.addEventListener('click', () => {
      Api.post('/auth/logout', {}).catch(() => {});
      Auth.logout();
    });
  }
}

/* ── Navigation ──────────────────────────────────────────── */
function initNav(defaultPage, handlers = {}) {
  const items = document.querySelectorAll('.nav-item[data-page]');
  items.forEach(item => {
    item.addEventListener('click', () => {
      switchPage(item.dataset.page, handlers);
    });
  });
  switchPage(defaultPage, handlers, true);
}

function switchPage(pageId, handlers = {}, silent = false) {
  // Hide all pages
  document.querySelectorAll('.dash-page').forEach(p => {
    p.classList.remove('active');
  });
  // Activate target
  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.add('active');

  // Update nav
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${pageId}"]`)?.classList.add('active');

  // Update topbar title
  const titleEl = document.querySelector('.topbar-title');
  const navLabel = document.querySelector(`.nav-item[data-page="${pageId}"] .nav-label`);
  if (titleEl && navLabel) titleEl.textContent = navLabel.textContent;

  // Close sidebar on mobile
  document.querySelector('.sidebar')?.classList.remove('open');
  document.querySelectorAll('[style*="position:fixed"]').forEach(el => { if (el !== document.querySelector('.sidebar')) el.style.display = 'none'; });

  // Call handler
  if (!silent && handlers[pageId]) handlers[pageId]();
}

/* ── Modal helpers ───────────────────────────────────────── */
const Modal = {
  open(id)  { document.getElementById(id)?.classList.add('open'); },
  close(id) { document.getElementById(id)?.classList.remove('open'); },
  init(id)  {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll('[data-modal-close]').forEach(btn => btn.addEventListener('click', () => Modal.close(id)));
    el.addEventListener('click', e => { if (e.target === el) Modal.close(id); });
  },
};

/* ── Tabs ────────────────────────────────────────────────── */
function initTabs(containerEl) {
  if (!containerEl) return;
  containerEl.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const root = btn.closest('[data-tabs]') || containerEl;
      root.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      root.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = root.querySelector(`.tab-panel[data-tab="${btn.dataset.tab}"]`);
      if (panel) panel.classList.add('active');
      if (btn.dataset.onactivate) window[btn.dataset.onactivate]?.();
    });
  });
}

/* ── Progress bar helper ─────────────────────────────────── */
function progressBar(pct, colorClass = '') {
  const v = Math.min(100, Math.max(0, Math.round(parseFloat(pct) || 0)));
  return `<div class="progress progress-md"><div class="progress-bar ${colorClass}" style="width:${v}%"></div></div>`;
}

/* ── Competency pips ─────────────────────────────────────── */
const LEVEL_ORDER = ['none','beginner','intermediate','advanced','expert'];
function compPips(level, maxPips = 4) {
  const idx = LEVEL_ORDER.indexOf(level);
  const filled = Math.max(0, idx); // 'none'=0, 'beginner'=1, etc.
  const pips = Array.from({ length: maxPips }, (_, i) =>
    `<div class="comp-pip${i < filled ? ' on' : ''}"></div>`
  ).join('');
  return `<div class="comp-pips" title="${level || 'none'}">${pips}</div>`;
}

/* ── Inline chart (CSS bars) ─────────────────────────────── */
function inlineBarChart(items, maxOverride) {
  // items: [{label, value, color}]
  const max = maxOverride || Math.max(...items.map(i => i.value), 1);
  return `<div class="chart-bars">
    ${items.map(item => {
      const h = Math.round((item.value / max) * 80) + 4;
      const color = item.color || 'var(--c-primary-500)';
      return `<div class="chart-bar-col">
        <span style="font-size:10px;color:var(--text-muted)">${item.value}</span>
        <div class="chart-bar-fill" style="height:${h}px;background:${color}"></div>
        <span class="chart-bar-label">${item.label}</span>
      </div>`;
    }).join('')}
  </div>`;
}

/* ── Date helpers ────────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', { day:'numeric', month:'short', year:'numeric' }).format(new Date(iso));
}
function fmtHours(h) {
  if (!h) return '—';
  const n = parseFloat(h);
  return n < 1 ? `${Math.round(n * 60)}m` : `${n % 1 === 0 ? n : n.toFixed(1)}h`;
}
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return fmtDate(iso);
}

/* ── Badge helpers ───────────────────────────────────────── */
function statusBadge(s) {
  const m = { completed:'badge-completed', in_progress:'badge-progress', not_started:'badge-slate', dropped:'badge-red', active:'badge-active', inactive:'badge-inactive' };
  const l = { completed:'Completed', in_progress:'In Progress', not_started:'Not Started', dropped:'Dropped', active:'Active', inactive:'Inactive' };
  return `<span class="badge ${m[s]||'badge-slate'}">${l[s]||s}</span>`;
}
function severityBadge(s) {
  return `<span class="badge badge-${s||'low'}">${(s||'').charAt(0).toUpperCase()+(s||'').slice(1)}</span>`;
}
function roleBadge(r) {
  const m = { student:'badge-indigo', instructor:'badge-violet', parent:'badge-amber', organization_admin:'badge-sky', developer:'badge-rose' };
  const l = { student:'Student', instructor:'Educator', parent:'Supervisor', organization_admin:'Org Admin', developer:'Developer' };
  return `<span class="badge ${m[r]||'badge-slate'}">${l[r]||r}</span>`;
}

/* ── Empty state helper ──────────────────────────────────── */
function emptyState(title, desc, actionHtml = '') {
  return `<div class="empty-state">
    <div class="empty-icon">${Icon.file(36)}</div>
    <div class="empty-title">${title}</div>
    <p class="empty-desc">${desc}</p>
    ${actionHtml}
  </div>`;
}
