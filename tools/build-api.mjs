// Writes the static JSON API in api/v1/ from lib/marstime.js. Run with: node tools/build-api.mjs
// Output is deterministic (no timestamps), so CI can check the committed files are up to date.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import * as mt from '../lib/marstime.js';

const OUT = new URL('../api/v1/', import.meta.url);
const FIRST_YEAR = 2000, LAST_YEAR = 2050;
const r = (x, n) => Number(x.toFixed(n));
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const write = (name, data) => writeFileSync(new URL(name, OUT), JSON.stringify(data) + '\n');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(new URL('daily/', OUT), { recursive: true });

// Moments when Ls crosses a multiple of 90 degrees, found by bisection.
function lsCrossing(fromMs, target) {
  const off = (ms) => ((mt.marsTime(ms).ls - target + 540) % 360) - 180; // -180..180, rises through 0 at the crossing
  let a = fromMs, step = 86400e3;
  while (!(off(a) < 0 && off(a + step) >= 0)) a += step;
  let b = a + step;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (off(m) < 0) a = m; else b = m; }
  return Math.round(b / 1000) * 1000;
}

const marsYears = [];
let t = Date.UTC(1955, 3, 1);
for (let my = 1; my <= 80; my++) {
  const start = lsCrossing(t, 0);
  const row = { marsYear: my, start: new Date(start).toISOString() };
  let s = start;
  for (const [key, ls] of [['ls90', 90], ['ls180', 180], ['ls270', 270]]) { s = lsCrossing(s, ls); row[key] = new Date(s).toISOString(); }
  marsYears.push(row);
  t = start + 600 * 86400e3;
}
write('mars-years.json', {
  about: 'Clancy Mars Years: the UTC instant each starts (Ls 0, northern spring equinox) and reaches Ls 90, 180 and 270.',
  years: marsYears,
});

const interimmYears = [];
for (let y = 1; y <= 80; y++) {
  interimmYears.push({ year: y, start: mt.dateFromInterimm({ year: y }).toISOString(), sols: mt.interimmYearLength(y) });
}
write('interimm-years.json', {
  about: 'InterImm calendar years: the UTC instant each starts (month 1, day 1, 00:00:00 in zone 0) and its length in sols.',
  months: mt.INTERIMM_MONTHS,
  years: interimmYears,
});

write('missions.json', { about: 'Landers and rovers with their own sol counts. Longitude is degrees east; sol 0 is the landing sol.', missions: mt.MISSIONS });
write('leap-seconds.json', { about: 'TAI-UTC in seconds from each UTC date. Source: IERS.', leapSeconds: mt.LEAP_SECONDS });

const columns = ['utc', 'msd', 'mtc', 'ls', 'marsYear', 'interimmDate', 'interimmClock', 'curiositySol', 'perseveranceSol'];
for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
  const rows = [];
  for (let ms = Date.UTC(year, 0, 1); ms < Date.UTC(year + 1, 0, 1); ms += 86400e3) {
    const m = mt.marsTime(ms), i = mt.interimmTime(ms);
    const sol = (k) => (Date.parse(mt.MISSIONS[k].landed) <= ms ? mt.missionTime(ms, k).sol : null);
    rows.push([day(ms), r(m.msd, 5), mt.formatHms(m.mtc), r(m.ls, 3), m.marsYear, `${i.year}-${i.month}-${i.day}`, i.clock,
      sol('curiosity'), sol('perseverance')]);
  }
  write(`daily/${year}.json`, { about: `Mars time at 00:00 UTC on each day of ${year}.`, columns, rows });
}

write('index.json', {
  name: 'InterImm Mars time API',
  version: mt.VERSION,
  docs: 'https://interimm.org/mars-clock/en/#api',
  library: 'https://cdn.jsdelivr.net/gh/InterImm/mars-clock@gh-pages/lib/marstime.js',
  endpoints: {
    daily: `daily/{year}.json for ${FIRST_YEAR}-${LAST_YEAR}: one row per UTC day`,
    marsYears: 'mars-years.json',
    interimmYears: 'interimm-years.json',
    missions: 'missions.json',
    leapSeconds: 'leap-seconds.json',
  },
});
console.log(`api/v1 written: ${LAST_YEAR - FIRST_YEAR + 1} daily files`);
