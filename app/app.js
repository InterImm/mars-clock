// The Mars clock page. All the astronomy is in ../lib/marstime.js; this file only fills in the page.
import * as mt from '../lib/marstime.js';

const lang = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
const T = {
  en: {
    seasons: { spring: 'spring', summer: 'summer', autumn: 'autumn', winter: 'winter' },
    season: (s) => `Northern ${s.north}, southern ${s.south}`,
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    weekShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    date: (i) => `${i.iso} · ${i.monthName.en}`,
    zone: (z) => `Zone ${z}`,
    sol: (n) => `Sol ${n.toLocaleString('en')}`,
    my: (n) => `Mars Year ${n}`,
    leap: (b) => (b ? 'leap year, 669 sols' : 'common year, 668 sols'),
    monthName: (m) => m.en,
    seasonsTable: ['Spring', 'Summer', 'Autumn', 'Winter'],
    invalid: 'Enter a valid date',
    rovers: ['Curiosity', 'Perseverance'],
  },
  zh: {
    seasons: { spring: '春', summer: '夏', autumn: '秋', winter: '冬' },
    season: (s) => `北半球${s.north}季，南半球${s.south}季`,
    weekdays: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    weekShort: ['日', '一', '二', '三', '四', '五', '六'],
    date: (i) => `${i.iso} · ${i.monthName.zh}`,
    zone: (z) => `${z} 区`,
    sol: (n) => `火星日 ${n}`,
    my: (n) => `火星年 MY ${n}`,
    leap: (b) => (b ? '闰年，669 个火星日' : '平年，668 个火星日'),
    monthName: (m) => m.zh,
    seasonsTable: ['春', '夏', '秋', '冬'],
    invalid: '请输入有效的日期',
    rovers: ['好奇号', '毅力号'],
  },
}[lang];

// Places for the local-time picker. Longitudes are degrees east. InterImm cities have a timezone but no fixed
// longitude yet, so they use the centre of their zone.
const PLACES = [
  ['curiosity', 137.4417, { en: 'Curiosity, Gale crater', zh: '好奇号，盖尔撞击坑' }],
  ['perseverance', 77.4509, { en: 'Perseverance, Jezero crater', zh: '毅力号，耶泽罗撞击坑' }],
  ['zhurong', 109.925, { en: 'Zhurong, Utopia Planitia', zh: '祝融号，乌托邦平原' }],
  ['insight', 135.6234, { en: 'InSight, Elysium Planitia', zh: '洞察号，埃律西昂平原' }],
  ['olympus', 226.2, { en: 'Olympus Mons', zh: '奥林匹斯山' }],
  ['elysium', 146.9, { en: 'Elysium Mons', zh: '埃律西昂山' }],
  ['viking1', 312.05, { en: 'Viking 1', zh: '维京1号' }],
  ['viking2', 134.29, { en: 'Viking 2', zh: '维京2号' }],
  ['pathfinder', 326.75, { en: 'Pathfinder', zh: '火星探路者号' }],
  ['spirit', 175.4729, { en: 'Spirit', zh: '勇气号' }],
  ['opportunity', 354.4734, { en: 'Opportunity', zh: '机遇号' }],
  ['airy0', 0, { en: 'Airy-0 (prime meridian)', zh: '艾里-0（本初子午线）' }],
  ...[['isidis', 5, '伊希地城市圈（南河城、参宿城、天狼城）', 'Isidis metropolitan area (Procyon, Betelgeuse, Sirius)'],
    ['kroran', 12, '楼兰城', 'Kroran'], ['pompeii', 13, '庞贝城', 'Pompeii'], ['singularity', 24, '奇点城', 'Singularity'],
    ['atlantis', 13, '亚特兰蒂斯城', 'Atlantis'], ['horizon', 0, '视界城', 'Horizon'], ['bolide', 21, '星坠城', 'Bolide'],
    ['terminus', 5, '端点城', 'Terminus'], ['trantor', 4, '川陀城', 'Trantor']]
    .map(([id, zone, zh, en]) => [id, (zone + 0.5) * mt.INTERIMM_ZONE_WIDTH, { en, zh }, zone]),
];

let lastSol = null;
const $ = (id) => document.getElementById(id);
const set = (id, text) => { const el = $(id); if (el && el.textContent !== text) el.textContent = text; };
const deg = (x, n = 2) => `${x.toFixed(n)}°`;
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const earthFmt = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-GB', {
  dateStyle: 'full', timeStyle: 'medium',
});
const utcFmt = (d) => d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

// ---------------------------------------------------------------- zone and place pickers

const zoneSelect = $('zone');
for (let z = 0; z <= 24; z++) zoneSelect.add(new Option(T.zone(z), z));
zoneSelect.value = store.get('marsclock.zone', '0');
zoneSelect.addEventListener('change', () => { store.set('marsclock.zone', zoneSelect.value); tick(true); });

const placeSelect = $('place');
for (const [id, lon, names, zone] of PLACES) {
  const label = zone === undefined ? `${names[lang]} · ${lon.toFixed(2)}°E` : `${names[lang]} · ${T.zone(zone)}`;
  placeSelect.add(new Option(label, id));
}
const lonInput = $('longitude');
const pickPlace = () => {
  const p = PLACES.find(([id]) => id === placeSelect.value);
  if (p) lonInput.value = p[1].toFixed(2);
  store.set('marsclock.place', placeSelect.value);
  tick(true);
};
placeSelect.value = store.get('marsclock.place', 'curiosity');
placeSelect.addEventListener('change', pickPlace);
lonInput.addEventListener('input', () => { placeSelect.value = ''; tick(true); });
pickPlace();

// ---------------------------------------------------------------- live readouts

function tick(force = false) {
  const now = Date.now();
  const zone = Number(zoneSelect.value);
  const m = mt.marsTime(now);
  const i = mt.interimmTime(now, { zone });

  set('hero-clock', i.clock);
  set('hero-date', `${T.date(i)} · ${T.weekdays[(i.day - 1) % 7]}`);
  set('hero-mtc', mt.formatHms(m.mtc));
  set('hero-ls', deg(m.ls, 1));
  set('hero-my', String(m.marsYear));

  set('mtc', mt.formatHms(m.mtc));
  set('msd', m.msd.toFixed(5));
  set('ls', deg(m.ls, 3));
  set('season', T.season({ north: T.seasons[mt.season(m.ls).north], south: T.seasons[mt.season(m.ls).south] }));
  set('mars-year', T.my(m.marsYear));
  set('utc', utcFmt(new Date(now)));
  set('tai', `TAI − UTC = ${mt.taiMinusUtc(now)} s`);
  set('subsolar', `${deg(m.subsolarLongitude, 1)}E`);
  set('declination', deg(m.solarDeclination, 2));
  set('distance', `${m.heliocentricDistance.toFixed(4)} AU`);
  for (const key of ['curiosity', 'perseverance']) {
    const s = mt.missionTime(now, key);
    set(`${key}-sol`, T.sol(s.sol));
    set(`${key}-lmst`, `LMST ${mt.formatHms(s.lmst)} · LTST ${mt.formatHms(s.ltst)}`);
  }

  const lon = Number(lonInput.value);
  if (Number.isFinite(lon)) {
    const here = mt.marsTime(now, { longitude: lon });
    const z = mt.interimmZone(lon);
    set('place-lmst', mt.formatHms(here.lmst));
    set('place-ltst', mt.formatHms(here.ltst));
    set('place-zone', T.zone(z));
    set('place-interimm', mt.interimmTime(now, { zone: z }).clock);
  }

  for (let z = 0; z <= 24; z++) set(`tz-${z}`, mt.interimmTime(now, { zone: z }).clock);
  set('zone-label', T.zone(zone));

  if (force || lastSol !== `${i.year}-${i.month}-${i.day}-${zone}`) {
    lastSol = `${i.year}-${i.month}-${i.day}-${zone}`;
    renderMonth(i);
  }
}

// ---------------------------------------------------------------- calendar

function renderMonth(today) {
  const { year, month } = today;
  set('cal-title', `${today.iso.slice(0, -3)} · ${lang === 'zh' ? today.monthName.zh : today.monthName.en}`);
  set('cal-leap', T.leap(today.leapYear));
  const days = mt.interimmMonthLength(year, month);
  const grid = $('cal-grid');
  const cells = T.weekShort.map((d) => `<div class="cal-head" aria-hidden="true">${d}</div>`);
  for (let d = 1; d <= days; d++) {
    const cls = d === today.day ? 'cal-day is-today' : 'cal-day';
    const label = d === today.day ? ` aria-current="date"` : '';
    cells.push(`<div class="${cls}"${label}><span>${d}</span></div>`);
  }
  grid.innerHTML = cells.join('');
  document.querySelectorAll('#months [data-month]').forEach((el) => {
    el.classList.toggle('is-current', Number(el.dataset.month) === month);
  });
}

function renderMonthsTable() {
  // Columns are seasons; month 22-24 open spring (立春, 雨水, 惊蛰) in the original table, then 1-3.
  const order = [[22, 23, 24, 1, 2, 3], [4, 5, 6, 7, 8, 9], [10, 11, 12, 13, 14, 15], [16, 17, 18, 19, 20, 21]];
  const head = `<tr>${T.seasonsTable.map((s) => `<th scope="col">${s}</th>`).join('')}</tr>`;
  const rows = [0, 1, 2, 3, 4, 5].map((r) => `<tr>${order.map((col) => {
    const m = mt.INTERIMM_MONTHS[col[r] - 1];
    return `<td data-month="${m.month}"><span class="mono">${m.month}</span> ${lang === 'zh' ? m.zh : `${m.en} <span class="muted">${m.zh}</span>`}</td>`;
  }).join('')}</tr>`).join('');
  $('months').innerHTML = `<thead>${head}</thead><tbody>${rows}</tbody>`;
}

function renderZonesTable() {
  const w = mt.INTERIMM_ZONE_WIDTH;
  const places = (z) => PLACES.filter(([, lon, , zone]) => (zone ?? mt.interimmZone(lon)) === z).map(([, , n]) => n[lang]);
  $('zones').querySelector('tbody').innerHTML = Array.from({ length: 25 }, (_, z) => {
    const to = z === 24 ? 360 : (z + 1) * w;
    const off = z === 24 ? (lang === 'zh' ? '+24 h（即 −39:35）' : '+24 h (= −39:35)') : `+${z} h`;
    return `<tr><th scope="row">${z}</th><td class="mono">${(z * w).toFixed(2)}° – ${to.toFixed(2)}°</td><td class="mono">${off}</td>`
      + `<td class="mono" id="tz-${z}"></td><td>${places(z).join(lang === 'zh' ? '、' : ', ')}</td></tr>`;
  }).join('');
}

// ---------------------------------------------------------------- converters

const earthIn = $('earth-in');
const earthTz = $('earth-tz');
function convertEarth() {
  const v = earthIn.value;
  const out = $('earth-out');
  if (!v) { out.hidden = true; return; }
  const ms = earthTz.value === 'utc' ? Date.parse(v + 'Z') : new Date(v).getTime();
  if (!Number.isFinite(ms)) { out.hidden = false; set('c-utc', T.invalid); return; }
  out.hidden = false;
  const m = mt.marsTime(ms);
  const i = mt.interimmTime(ms, { zone: Number(zoneSelect.value) });
  set('c-utc', utcFmt(new Date(ms)));
  set('c-msd', m.msd.toFixed(5));
  set('c-mtc', mt.formatHms(m.mtc));
  set('c-ls', `${deg(m.ls, 2)} · ${T.my(m.marsYear)}`);
  set('c-interimm', `${T.date(i)} ${i.clock} (${T.zone(i.zone)})`);
  const cur = mt.missionTime(ms, 'curiosity').sol, per = mt.missionTime(ms, 'perseverance').sol;
  set('c-missions', `${T.rovers[0]} ${cur >= 0 ? cur : '–'} · ${T.rovers[1]} ${per >= 0 ? per : '–'}`);
}
earthIn.addEventListener('input', convertEarth);
earthTz.addEventListener('change', convertEarth);
$('earth-now').addEventListener('click', () => {
  const d = new Date();
  const local = new Date(d.getTime() - (earthTz.value === 'utc' ? 0 : d.getTimezoneOffset() * 60e3));
  earthIn.value = local.toISOString().slice(0, 19);
  convertEarth();
});

const marsForm = $('mars-form');
function convertMars() {
  const f = Object.fromEntries(new FormData(marsForm));
  const out = $('mars-out');
  const [hh = 0, mm = 0, ss = 0] = String(f.time || '0:0:0').split(':').map(Number);
  try {
    const d = mt.dateFromInterimm({
      year: Number(f.year), month: Number(f.month), day: Number(f.day), zone: Number(f.zone),
      hours: hh + mm / 60 + ss / 3600 + (f.extra === 'on' ? 24 : 0),
    });
    set('m-utc', utcFmt(d));
    set('m-local', earthFmt.format(d));
    set('m-ls', `${deg(mt.marsTime(d).ls, 2)} · ${T.my(mt.marsTime(d).marsYear)}`);
    out.classList.remove('is-error');
  } catch {
    set('m-utc', T.invalid); set('m-local', ''); set('m-ls', '');
    out.classList.add('is-error');
  }
}
marsForm.addEventListener('input', convertMars);
const mz = marsForm.elements.zone;
for (let z = 0; z <= 24; z++) mz.add(new Option(T.zone(z), z));
const mMonth = marsForm.elements.month;
for (const m of mt.INTERIMM_MONTHS) mMonth.add(new Option(`${m.month} · ${T.monthName(m)}`, m.month));
{
  const i = mt.interimmTime(Date.now());
  marsForm.elements.year.value = i.year;
  mMonth.value = i.month;
  marsForm.elements.day.value = i.day;
}
convertMars();

// ---------------------------------------------------------------- go

renderMonthsTable();
renderZonesTable();
tick(true);
setInterval(tick, 250);
document.documentElement.classList.add('clock-ready');
