// <mars-clock-card>: a ready-styled Mars clock any website can embed with one script tag.
//
//   <script type="module" src="https://cdn.jsdelivr.net/gh/InterImm/mars-clock@gh-pages/lib/mars-clock-card.js"></script>
//   <mars-clock-card></mars-clock-card>
//
// Attributes (all optional):
//   lang       "en" (default) or "zh"
//   zone       InterImm timezone 0-24 (default 0)
//   longitude  degrees east; when set, the big clock shows local mean solar time there instead of InterImm time
//   place      a label for that longitude, e.g. "Jezero crater"
//   theme      "auto" (default, follows the visitor's light/dark setting), "dark" or "light"
//   rovers     present = also show Curiosity and Perseverance sols
//   compact    present = clock and date only
//
// Styles live in a shadow root, so the host page's CSS can't break the card and the card can't leak into the page.
// Size it with the host element's width (it adapts from ~220px to any width). Colours can be overridden with
// --mcc-accent, --mcc-bg, --mcc-text and --mcc-muted on the element.
import { marsTime, interimmTime, missionTime, season, formatHms } from './marstime.js';

const TEXT = {
  en: {
    zone: (z) => `InterImm zone ${z}`,
    local: (p) => `Local mean solar time${p ? ` · ${p}` : ''}`,
    date: (i) => `${i.iso} · ${i.monthName.en} · ${i.weekday}`,
    mtc: 'Mars time (MTC)', ls: 'Season', my: 'Mars Year', sol: 'Sol',
    season: (s) => `${s.north} (N)`,
    seasons: { spring: 'spring', summer: 'summer', autumn: 'autumn', winter: 'winter' },
    rovers: ['Curiosity', 'Perseverance'],
    credit: 'Mars Clock by InterImm',
    href: 'https://interimm.org/mars-clock/en/',
  },
  zh: {
    zone: (z) => `星际移民中心时间 · ${z} 区`,
    local: (p) => `地方平太阳时${p ? ` · ${p}` : ''}`,
    date: (i) => `${i.iso} · ${i.monthName.zh} · ${['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][(i.day - 1) % 7]}`,
    mtc: '协调火星时', ls: '季节', my: '火星年', sol: '火星日',
    season: (s) => `北半球${s.north}季`,
    seasons: { spring: '春', summer: '夏', autumn: '秋', winter: '冬' },
    rovers: ['好奇号', '毅力号'],
    credit: '星际移民中心 · 火星时钟',
    href: 'https://interimm.org/mars-clock/',
  },
};

const STYLE = `
:host {
  --_accent: var(--mcc-accent, #ff6b3d);
  --_bg: var(--mcc-bg, #ffffff);
  --_text: var(--mcc-text, #15171d);
  --_muted: var(--mcc-muted, #5a6070);
  --_border: rgb(127 127 127 / 0.22);
  display: block; container-type: inline-size; color-scheme: light dark;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
}
:host([hidden]) { display: none; }
@media (prefers-color-scheme: dark) {
  :host(:not([theme="light"])) { --_bg: var(--mcc-bg, #0f141f); --_text: var(--mcc-text, #e8ebf2); --_muted: var(--mcc-muted, #98a1b4); }
}
:host([theme="dark"]) { --_bg: var(--mcc-bg, #0f141f); --_text: var(--mcc-text, #e8ebf2); --_muted: var(--mcc-muted, #98a1b4); }
.card {
  position: relative; overflow: hidden; box-sizing: border-box; padding: 1rem 1.15rem 0.85rem;
  border: 1px solid var(--_border); border-radius: 1rem; background: var(--_bg); color: var(--_text);
}
.card::after {
  content: ""; position: absolute; right: -3.5rem; top: -3.5rem; width: 8rem; height: 8rem; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ff9a6b, #d4532a 40%, #7a2410 75%); opacity: 0.85; pointer-events: none;
}
.kicker { position: relative; z-index: 1; margin: 0 0 0.2rem; padding-right: 3.5rem; color: var(--_muted);
  font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.kicker:lang(zh) { text-transform: none; letter-spacing: 0.02em; }
.dot { display: inline-block; width: 0.5em; height: 0.5em; margin-right: 0.45em; border-radius: 50%; background: var(--_accent);
  vertical-align: 0.05em; animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
.clock { position: relative; z-index: 1; display: block; margin: 0; font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
  font-variant-numeric: tabular-nums; font-weight: 500; letter-spacing: -0.03em; line-height: 1.05; font-size: clamp(2rem, 14cqi, 4.5rem); }
.date { margin: 0.25rem 0 0; font-size: 0.95rem; }
.stats { display: flex; flex-wrap: wrap; gap: 0.35rem 1.25rem; margin: 0.7rem 0 0; padding: 0.65rem 0 0; border-top: 1px solid var(--_border); }
.stats div { display: flex; flex-direction: column; min-width: 0; }
dt { color: var(--_muted); font-size: 0.7rem; letter-spacing: 0.04em; text-transform: uppercase; }
dt:lang(zh) { text-transform: none; }
dd { margin: 0; font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; font-size: 0.95rem; }
.credit { display: inline-block; margin-top: 0.6rem; color: var(--_muted); font-size: 0.72rem; text-decoration: none; }
.credit:hover { color: var(--_accent); }
:host([compact]) .stats { display: none; }
@container (max-width: 260px) { .date { font-size: 0.85rem; } .card::after { width: 6rem; height: 6rem; } }
`;

class MarsClockCard extends HTMLElement {
  static observedAttributes = ['lang', 'zone', 'longitude', 'place', 'theme', 'rovers', 'compact'];

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.build();
    this.timer = setInterval(() => this.tick(), 500);
  }

  disconnectedCallback() { clearInterval(this.timer); }

  attributeChangedCallback() { if (this.isConnected && this.els) this.build(); }

  build() {
    const lang = (this.getAttribute('lang') || 'en').startsWith('zh') ? 'zh' : 'en';
    const t = TEXT[lang];
    const rovers = this.hasAttribute('rovers')
      ? t.rovers.map((r, k) => `<div><dt>${r}</dt><dd data-k="rover${k}"></dd></div>`).join('') : '';
    this.root.innerHTML = `<style>${STYLE}</style>
      <div class="card" lang="${lang === 'zh' ? 'zh-CN' : 'en'}" part="card">
        <p class="kicker"><span class="dot"></span><span data-k="kicker"></span></p>
        <time class="clock" data-k="clock" part="clock"></time>
        <p class="date" data-k="date"></p>
        <dl class="stats">
          <div><dt>${t.mtc}</dt><dd data-k="mtc"></dd></div>
          <div><dt>${t.ls}</dt><dd data-k="ls"></dd></div>
          <div><dt>${t.my}</dt><dd data-k="my"></dd></div>
          ${rovers}
        </dl>
        <a class="credit" href="${t.href}" target="_blank" rel="noopener">${t.credit} ↗</a>
      </div>`;
    this.els = Object.fromEntries([...this.root.querySelectorAll('[data-k]')].map((el) => [el.dataset.k, el]));
    this.t = t;
    this.tick();
  }

  tick() {
    if (!this.els) return;
    const now = Date.now();
    const t = this.t;
    const zone = Math.min(24, Math.max(0, Math.trunc(Number(this.getAttribute('zone')) || 0)));
    const lonAttr = this.getAttribute('longitude');
    const lon = lonAttr === null || lonAttr === '' ? null : Number(lonAttr);
    const m = marsTime(now, { longitude: Number.isFinite(lon) ? lon : 0 });
    const i = interimmTime(now, { zone });
    const set = (k, v) => { const el = this.els[k]; if (el && el.textContent !== v) el.textContent = v; };
    if (Number.isFinite(lon)) {
      set('kicker', t.local(this.getAttribute('place')));
      set('clock', formatHms(m.lmst));
    } else {
      set('kicker', t.zone(zone));
      set('clock', i.clock);
    }
    set('date', t.date(i));
    set('mtc', formatHms(m.mtc));
    const s = season(m.ls);
    set('ls', `${m.ls.toFixed(1)}° ${t.season({ north: t.seasons[s.north] })}`);
    set('my', String(m.marsYear));
    if (this.els.rover0) {
      set('rover0', `${t.sol} ${missionTime(now, 'curiosity').sol}`);
      set('rover1', `${t.sol} ${missionTime(now, 'perseverance').sol}`);
    }
  }
}

if (!customElements.get('mars-clock-card')) customElements.define('mars-clock-card', MarsClockCard);
