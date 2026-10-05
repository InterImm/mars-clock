// The light-year page: story clock, messages to stars and voyage clocks. Physics in ../lib/lightyear.js.
import * as mt from '../lib/marstime.js';
import * as ly from '../lib/lightyear.js';

const lang = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
const T = {
  en: {
    ly: (x) => `${fmtNum(x)} ly`,
    years: (x) => `${fmtNum(x)} yr`,
    yearsDays: (y) => { const whole = Math.floor(y); const d = Math.floor((y - whole) * 365.25); return `${whole} yr ${d} d`; },
    c: (b) => `${b < 0.999 ? b.toFixed(3) : b.toFixed(6)} c`,
    custom: 'Custom ship',
    inTransit: 'In transit', arrived: 'Arrived', remove: 'Remove', share: 'Copy link', copied: 'Copied',
    sentLine: (s, a, r) => `Sent ${s} · arrives ${a} · earliest reply ${r}`,
    travelled: (x, d) => `${x} of ${d} light years`,
    km: (k) => `${k} km out`,
    outboxEmpty: 'Nothing sent yet from this browser.',
    shared: 'A message someone sent you a link to',
    empty: 'Write something first.',
    zh: false,
  },
  zh: {
    ly: (x) => `${fmtNum(x)} 光年`,
    years: (x) => `${fmtNum(x)} 年`,
    yearsDays: (y) => { const whole = Math.floor(y); const d = Math.floor((y - whole) * 365.25); return `${whole} 年 ${d} 天`; },
    c: (b) => `${b < 0.999 ? b.toFixed(3) : b.toFixed(6)} 倍光速`,
    custom: '自定义飞船',
    inTransit: '在路上', arrived: '已抵达', remove: '删除', share: '复制链接', copied: '已复制',
    sentLine: (s, a, r) => `发出 ${s} · 抵达 ${a} · 最早回信 ${r}`,
    travelled: (x, d) => `已走 ${x} / ${d} 光年`,
    km: (k) => `已飞出 ${k} 千米`,
    outboxEmpty: '这个浏览器还没有发出过信。',
    shared: '有人发给你的一封信',
    empty: '先写点什么。',
    zh: true,
  },
}[lang];

const $ = (id) => document.getElementById(id);
const set = (id, text) => { const el = $(id); if (el && el.textContent !== text) el.textContent = text; };
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
function fmtNum(x) {
  const n = x >= 100 ? 0 : x >= 10 ? 1 : 2;
  return x.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en', { maximumFractionDigits: n, minimumFractionDigits: 0 });
}

// ---------------------------------------------------------------- calendar: story (2219) or real

const calSelect = $('calendar');
calSelect.value = store.get('lightyear.calendar', 'story');
const story = () => calSelect.value === 'story';
const shift = (ms) => (story() ? ms + ly.STORY_OFFSET_DAYS * 86400e3 : ms);
const unshift = (ms) => (story() ? ms - ly.STORY_OFFSET_DAYS * 86400e3 : ms);
const day = (ms) => new Date(shift(ms)).toISOString().slice(0, 10);
const marsDate = (ms) => mt.interimmTime(shift(ms)).iso; // the InterImm calendar, read on the chosen calendar

// ---------------------------------------------------------------- star picker

const starSelect = $('star');
for (const s of ly.STARS) starSelect.add(new Option(`${s.name[lang]} · ${T.ly(s.distance)}`, s.id));
starSelect.value = store.get('lightyear.star', 'epsilon-eridani');
if (!starSelect.value) starSelect.value = 'epsilon-eridani';
const currentStar = () => ly.star(starSelect.value);

// ---------------------------------------------------------------- hero

function hero() {
  const now = Date.now();
  const s = currentStar();
  const iso = new Date(shift(now)).toISOString();
  set('hero-clock', iso.slice(11, 19));
  set('hero-date', `${iso.slice(0, 10)} UTC · ${lang === 'zh' ? '星际移民历' : 'InterImm'} ${marsDate(now)}`);
  set('hero-distance', T.ly(s.distance));
  set('hero-arrives', day(ly.message(now, s.distance).arrives.getTime()));
  set('hero-light', day(ly.emitted(now, s.distance).getTime()));
}

// ---------------------------------------------------------------- messages

const OUTBOX_KEY = 'lightyear.outbox';
const readOutbox = () => { try { return JSON.parse(store.get(OUTBOX_KEY, '[]')) || []; } catch { return []; } };
const writeOutbox = (list) => store.set(OUTBOX_KEY, JSON.stringify(list.slice(0, 50)));

const b64 = {
  enc: (text) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))),
};
const shareUrl = (m) => {
  const u = new URL(location.href.split(/[?#]/)[0]);
  u.searchParams.set('to', m.to);
  u.searchParams.set('at', String(m.at));
  if (m.reply) u.searchParams.set('r', String(m.reply));
  u.searchParams.set('m', b64.enc(m.text));
  return u.toString() + '#write';
};

function letterCard(m, { removable }) {
  const s = ly.star(m.to);
  const card = document.createElement('article');
  card.className = 'card letter';
  const head = document.createElement('p');
  head.className = 'tile-kicker';
  head.textContent = `→ ${s.name[lang]}`;
  const body = document.createElement('p');
  body.className = 'letter-text';
  body.textContent = m.text;
  const times = ly.message(m.at, s.distance, { replyAfter: m.reply || 0 });
  const line = document.createElement('p');
  line.className = 'note mono';
  line.textContent = T.sentLine(day(m.at), day(times.arrives.getTime()), day(times.earliestReply.getTime()));
  const bar = document.createElement('div');
  bar.className = 'progress';
  bar.innerHTML = '<span></span>';
  const status = document.createElement('p');
  status.className = 'note mono';
  const actions = document.createElement('div');
  actions.className = 'letter-actions';
  const copy = document.createElement('button');
  copy.type = 'button'; copy.className = 'btn btn-ghost'; copy.textContent = T.share;
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shareUrl(m)); copy.textContent = T.copied; setTimeout(() => (copy.textContent = T.share), 1500); }
    catch { prompt('', shareUrl(m)); }
  });
  actions.append(copy);
  if (removable) {
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'btn btn-ghost'; del.textContent = T.remove;
    del.addEventListener('click', () => { writeOutbox(readOutbox().filter((x) => !(x.at === m.at && x.text === m.text))); renderOutbox(); });
    actions.append(del);
  }
  card.append(head, body, line, bar, status, actions);
  card.update = (now) => {
    const p = ly.messageProgress(m.at, s.distance, now);
    bar.firstChild.style.width = `${(p.fraction * 100).toFixed(4)}%`;
    const km = Math.floor(p.travelled * ly.LY_M / 1000).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en');
    status.textContent = p.arrived ? `${T.arrived} · ${T.travelled(fmtNum(s.distance), fmtNum(s.distance))}`
      : `${T.inTransit} · ${T.km(km)} · ${T.travelled(p.travelled.toFixed(8), fmtNum(s.distance))}`;
  };
  return card;
}

let liveCards = [];
function renderOutbox() {
  const box = $('outbox');
  box.replaceChildren();
  liveCards = liveCards.filter((c) => c.shared);
  const list = readOutbox();
  if (!list.length) { const p = document.createElement('p'); p.className = 'note'; p.textContent = T.outboxEmpty; box.append(p); }
  for (const m of list) { const c = letterCard(m, { removable: true }); box.append(c); liveCards.push(c); }
  tickLetters();
}

function tickLetters() { const now = Date.now(); for (const c of liveCards) c.update(now); }

$('write-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('letter').value.trim();
  if (!text) { set('write-note', T.empty); return; }
  set('write-note', '');
  const m = { to: starSelect.value, at: Date.now(), text, reply: Number($('reply-after').value) || 0 };
  writeOutbox([m, ...readOutbox()]);
  $('letter').value = '';
  renderOutbox();
});

// A shared link: ?to=star&at=ms&m=base64url(text)&r=years
(function sharedLetter() {
  const q = new URLSearchParams(location.search);
  if (!q.get('m') || !q.get('to') || !q.get('at')) return;
  try {
    const m = { to: q.get('to'), at: Number(q.get('at')), text: b64.dec(q.get('m')).slice(0, 2000), reply: Number(q.get('r')) || 0 };
    ly.star(m.to);
    if (!Number.isFinite(m.at)) return;
    const c = letterCard(m, { removable: false });
    c.shared = true;
    c.classList.add('is-shared');
    const label = document.createElement('p');
    label.className = 'kicker'; label.textContent = T.shared;
    $('shared').append(label, c);
    $('shared').hidden = false;
    liveCards.push(c);
  } catch { /* a broken link shows nothing */ }
})();

// ---------------------------------------------------------------- voyage clock

const profileSelect = $('profile');
for (const [k, p] of Object.entries(ly.PROFILES)) profileSelect.add(new Option(p.name[lang], k));
profileSelect.add(new Option(T.custom, 'custom'));
const accelIn = $('accel'), cruiseIn = $('cruise'), decelIn = $('decel'), departIn = $('depart'), scrub = $('scrub');

function fillProfile() {
  const p = ly.PROFILES[profileSelect.value];
  if (!p) return;
  accelIn.value = p.accel; cruiseIn.value = p.cruise ?? ''; decelIn.checked = p.decelerate;
  set('profile-note', p.note[lang]);
}
profileSelect.value = store.get('lightyear.profile', 'torch');
if (!profileSelect.value) profileSelect.value = 'torch';
fillProfile();
for (const el of [accelIn, cruiseIn, decelIn]) el.addEventListener('input', () => { profileSelect.value = 'custom'; set('profile-note', ''); voyageView(); });
profileSelect.addEventListener('change', () => { store.set('lightyear.profile', profileSelect.value); fillProfile(); voyageView(); renderTable(); });

const setDepartDefault = () => { departIn.value = day(Date.now()); };
setDepartDefault();

let current = null;
function voyageView() {
  const s = currentStar();
  const cruise = cruiseIn.value === '' ? null : Number(cruiseIn.value);
  let v;
  try {
    v = ly.voyage({ distance: s.distance, accel: Number(accelIn.value) || 0, cruise, decelerate: decelIn.checked });
    set('voyage-error', '');
  } catch (e) { set('voyage-error', e.message); return; }
  const depart = unshift(Date.parse(`${departIn.value}T00:00:00Z`));
  if (!Number.isFinite(depart)) return;
  const dates = ly.voyageDates(v, depart);
  current = { v, depart };
  set('v-earth', T.yearsDays(v.earthYears));
  set('v-ship', T.yearsDays(v.shipYears));
  set('v-saved', T.yearsDays(v.timeSavedYears));
  set('v-peak', T.c(v.peakBeta));
  set('v-gamma', `γ = ${v.peakGamma < 100 ? v.peakGamma.toFixed(3) : fmtNum(v.peakGamma)}`);
  set('v-arrive', `${day(dates.arrives.getTime())} · ${marsDate(dates.arrives.getTime())}`);
  set('v-news', day(dates.newsHome.getTime()));
  set('v-mass', v.photonRocketMassRatio < 1e6 ? fmtNum(v.photonRocketMassRatio) : v.photonRocketMassRatio.toExponential(2));
  set('v-mars-years', T.years(v.marsYears));
  drawChart(v);
  scrubView();
}

function scrubView() {
  if (!current) return;
  const { v, depart } = current;
  const t = (Number(scrub.value) / 1000) * v.earthYears;
  const st = ly.voyageAt(v, t);
  const when = depart + t * ly.YEAR_MS;
  set('s-date', `${day(when)} · ${marsDate(when)}`);
  set('s-earth', T.yearsDays(t));
  set('s-ship', T.yearsDays(st.shipYears));
  set('s-distance', T.ly(st.distance));
  set('s-speed', T.c(st.beta));
  const dot = $('chart-dot');
  if (dot) { dot.setAttribute('cx', X(t, v)); dot.setAttribute('cy', Y(st.shipYears, v)); }
  const line = $('chart-now');
  if (line) { line.setAttribute('x1', X(t, v)); line.setAttribute('x2', X(t, v)); }
}

// Chart: Mars-frame years across, ship-clock years up, with the Mars clock as the diagonal.
const W = 640, H = 300, PAD = { l: 48, r: 16, t: 16, b: 36 };
const X = (t, v) => (PAD.l + (t / v.earthYears) * (W - PAD.l - PAD.r)).toFixed(1);
const Y = (y, v) => (H - PAD.b - (y / v.earthYears) * (H - PAD.t - PAD.b)).toFixed(1);
function drawChart(v) {
  const pts = [];
  for (let i = 0; i <= 240; i++) { const t = (v.earthYears * i) / 240; pts.push(`${X(t, v)},${Y(ly.voyageAt(v, t).shipYears, v)}`); }
  const ticks = niceTicks(v.earthYears);
  const lab = lang === 'zh' ? { x: '火星上过去的年数', ship: '船上的钟', mars: '火星的钟' } : { x: 'years passed on Mars', ship: 'ship clock', mars: 'Mars clock' };
  $('chart').innerHTML = `
    <g class="axis">${ticks.map((k) => `<line x1="${X(k, v)}" x2="${X(k, v)}" y1="${PAD.t}" y2="${H - PAD.b}"/><text x="${X(k, v)}" y="${H - PAD.b + 18}" text-anchor="middle">${k}</text>`).join('')}
      ${ticks.map((k) => `<text x="${PAD.l - 8}" y="${Number(Y(k, v)) + 4}" text-anchor="end">${k}</text>`).join('')}
      <text x="${W - PAD.r}" y="${H - 4}" text-anchor="end">${lab.x}</text></g>
    <line class="mars-line" x1="${X(0, v)}" y1="${Y(0, v)}" x2="${X(v.earthYears, v)}" y2="${Y(v.earthYears, v)}"/>
    <text class="mars-label" x="${Number(X(v.earthYears, v)) - 6}" y="${Number(Y(v.earthYears, v)) + 16}" text-anchor="end">${lab.mars}</text>
    <polyline class="ship-line" points="${pts.join(' ')}"/>
    <text class="ship-label" x="${Number(X(v.earthYears, v)) - 6}" y="${Number(Y(v.shipYears, v)) - 8}" text-anchor="end">${lab.ship} ${fmtNum(v.shipYears)}</text>
    <line id="chart-now" class="now-line" y1="${PAD.t}" y2="${H - PAD.b}" x1="${PAD.l}" x2="${PAD.l}"/>
    <circle id="chart-dot" class="ship-dot" r="5" cx="${PAD.l}" cy="${H - PAD.b}"/>`;
}
function niceTicks(max) {
  const raw = max / 5, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let k = 0; k <= max + 1e-9; k += step) out.push(Number(k.toPrecision(6)));
  return out;
}

// ---------------------------------------------------------------- star table

function renderTable() {
  const prof = ly.PROFILES[profileSelect.value] ? profileSelect.value : 'torch';
  const tbody = $('stars').querySelector('tbody');
  tbody.replaceChildren();
  set('table-profile', ly.PROFILES[prof].name[lang]);
  for (const s of ly.STARS) {
    const v = ly.profileVoyage(prof, s.distance);
    const tr = document.createElement('tr');
    if (s.id === starSelect.value) tr.className = 'is-current';
    const name = document.createElement('th');
    name.scope = 'row';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'link-button'; b.textContent = s.name[lang];
    b.addEventListener('click', () => { starSelect.value = s.id; starChanged(); $('voyage').scrollIntoView({ behavior: 'smooth' }); });
    name.append(b);
    tr.append(name, ...[s.type, T.ly(s.distance), T.years(2 * s.distance), T.years(v.earthYears), T.years(v.shipYears)].map((x, i) => {
      const td = document.createElement('td'); td.textContent = x; if (i) td.className = 'mono'; return td;
    }));
    tbody.append(tr);
  }
}

// ---------------------------------------------------------------- wiring

function starChanged() { store.set('lightyear.star', starSelect.value); hero(); voyageView(); renderTable(); }
starSelect.addEventListener('change', starChanged);
calSelect.addEventListener('change', () => { store.set('lightyear.calendar', calSelect.value); setDepartDefault(); hero(); voyageView(); renderOutbox(); });
departIn.addEventListener('change', voyageView);
scrub.addEventListener('input', scrubView);
$('depart-now').addEventListener('click', () => { setDepartDefault(); voyageView(); });

hero();
voyageView();
renderTable();
renderOutbox();
setInterval(() => { hero(); tickLetters(); }, 1000);
