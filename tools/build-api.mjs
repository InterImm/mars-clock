// Writes the static JSON API in api/v1/ from lib/marstime.js. Run with: node tools/build-api.mjs
// Output is deterministic (no timestamps), so CI can check the committed files are up to date.
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
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

// OpenAPI description, so API tools and AI agents can discover the endpoints.
const str = { type: 'string' }, num = { type: 'number' }, int = { type: 'integer' };
const about = { about: str };
write('openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'InterImm Mars time API',
    version: mt.VERSION,
    description: 'Static, precomputed Mars time tables (GET only, no key, CORS open). For an arbitrary instant use the JavaScript library ' +
      '(https://cdn.jsdelivr.net/gh/InterImm/mars-clock@gh-pages/lib/marstime.js) or the MCP server (npx -y github:InterImm/mars-clock#gh-pages). ' +
      'Guide for language models: https://interimm.org/mars-clock/llms.txt',
    license: { name: 'MIT', identifier: 'MIT' },
  },
  servers: [{ url: 'https://interimm.org/mars-clock/api/v1' }],
  paths: {
    '/daily/{year}.json': {
      get: {
        operationId: 'getDailyTable',
        summary: `Mars time at 00:00 UTC on every day of an Earth year (${FIRST_YEAR}-${LAST_YEAR})`,
        parameters: [{ name: 'year', in: 'path', required: true, schema: { type: 'integer', minimum: FIRST_YEAR, maximum: LAST_YEAR } }],
        responses: { 200: { description: 'Rows are arrays in the order of `columns`.', content: { 'application/json': { schema: {
          type: 'object', properties: { ...about, columns: { type: 'array', items: str, example: columns },
            rows: { type: 'array', items: { type: 'array', prefixItems: [
              { ...str, description: 'UTC date' }, { ...num, description: 'Mars Sol Date' }, { ...str, description: 'Coordinated Mars Time hh:mm:ss' },
              { ...num, description: 'Solar longitude Ls, degrees' }, { ...int, description: 'Mars Year (Clancy)' },
              { ...str, description: 'InterImm date year-month-day, zone 0' }, { ...str, description: 'InterImm clock, zone 0' },
              { type: ['integer', 'null'], description: 'Curiosity sol' }, { type: ['integer', 'null'], description: 'Perseverance sol' }] } } } } } } } },
      },
    },
    '/mars-years.json': { get: { operationId: 'getMarsYears', summary: 'Start of Mars Years 1-80 and their Ls 90/180/270 dates',
      responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { ...about, years: { type: 'array', items: {
        type: 'object', properties: { marsYear: int, start: str, ls90: str, ls180: str, ls270: str } } } } } } } } } } },
    '/interimm-years.json': { get: { operationId: 'getInterimmYears', summary: 'Start and length of InterImm calendar years 1-80, and month names',
      responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { ...about,
        months: { type: 'array', items: { type: 'object', properties: { month: int, zh: str, en: str } } },
        years: { type: 'array', items: { type: 'object', properties: { year: int, start: str, sols: int } } } } } } } } } } },
    '/missions.json': { get: { operationId: 'getMissions', summary: 'Landers and rovers: landing time (UTC) and longitude (degrees east)',
      responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } } } } },
    '/leap-seconds.json': { get: { operationId: 'getLeapSeconds', summary: 'TAI-UTC table used for the conversion',
      responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } } } } },
  },
});

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
  openapi: 'openapi.json',
  llms: 'https://interimm.org/mars-clock/llms.txt',
  mcp: 'npx -y github:InterImm/mars-clock#gh-pages',
});
// llms-full.txt = hand-written guide + the library's own source, so a model sees exactly what runs.
const head = readFileSync(new URL('./llms-full.head.md', import.meta.url), 'utf8');
const lib = readFileSync(new URL('../lib/marstime.js', import.meta.url), 'utf8');
writeFileSync(new URL('../llms-full.txt', import.meta.url),
  `${head}\n## The library source (lib/marstime.js)\n\n\`\`\`js\n${lib}\`\`\`\n`);

console.log(`api/v1 written: ${LAST_YEAR - FIRST_YEAR + 1} daily files`);
