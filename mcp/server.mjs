#!/usr/bin/env node
// Mars time for AI assistants: a Model Context Protocol (MCP) server over stdio, with no dependencies.
//
// Add it to any MCP client (Claude Desktop, Claude Code, Cursor, ...) with:
//   command: npx    args: ["-y", "github:InterImm/mars-clock#gh-pages"]
// e.g.  claude mcp add mars-time -- npx -y github:InterImm/mars-clock#gh-pages
//
// It also works as a one-shot command for agents with a shell:
//   npx -y github:InterImm/mars-clock#gh-pages now [--longitude 137.44] [--zone 5] [--utc 2026-10-03T10:00:00Z]
import * as mt from '../lib/marstime.js';

const SERVER = { name: 'mars-time', title: 'InterImm Mars time', version: mt.VERSION };

const round = (x, n = 6) => (typeof x === 'number' ? Number(x.toFixed(n)) : x);
const roundAll = (o) => JSON.parse(JSON.stringify(o, (_, v) => round(v)));
const parseUtc = (s) => {
  if (s === undefined || s === null || s === '') return Date.now();
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) throw new Error(`Could not read "${s}" as a date; use ISO 8601 such as 2026-10-03T10:00:00Z`);
  return ms;
};

function marsTimeAt({ utc, longitude = 0, zone } = {}) {
  const ms = parseUtc(utc);
  const z = zone ?? mt.interimmZone(longitude);
  const s = mt.snapshot(ms, { longitude, zone: z });
  return roundAll({
    utc: s.earth.utc,
    longitudeEast: longitude,
    marsSolDate: s.mars.msd,
    coordinatedMarsTime: mt.formatHms(s.mars.mtc),
    localMeanSolarTime: mt.formatHms(s.mars.lmst),
    localTrueSolarTime: mt.formatHms(s.mars.ltst),
    solarLongitudeLs: s.mars.ls,
    season: s.mars.season,
    marsYear: s.mars.marsYear,
    subsolarLongitudeEast: s.mars.subsolarLongitude,
    solarDeclination: s.mars.solarDeclination,
    sunDistanceAU: s.mars.heliocentricDistance,
    interimm: {
      zone: s.interimm.zone, date: `${s.interimm.year}-${s.interimm.month}-${s.interimm.day}`,
      year: s.interimm.year, month: s.interimm.month, monthName: s.interimm.monthName, day: s.interimm.day,
      weekday: s.interimm.weekday, clock: s.interimm.clock, leapYear: s.interimm.leapYear,
    },
    missions: Object.fromEntries(Object.entries(s.missions).map(([k, v]) => [k, { sol: v.sol, lmst: mt.formatHms(v.lmst), ltst: mt.formatHms(v.ltst) }])),
    notes: 'Times are hh:mm:ss. MTC/LMST/LTST use Mars hours (1/24 sol); the InterImm clock uses Earth hours and runs to +39:35 after 24:00.',
  });
}

function interimmToEarth({ year, month = 1, day = 1, time = '00:00:00', zone = 0 }) {
  let hours;
  if (/^\+\d{1,2}:\d{2}$/.test(time)) {
    const [m, s] = time.slice(1).split(':').map(Number);
    hours = 24 + m / 60 + s / 3600;
  } else {
    const [h = 0, m = 0, s = 0] = String(time).split(':').map(Number);
    hours = h + m / 60 + s / 3600;
  }
  const d = mt.dateFromInterimm({ year, month, day, hours, zone });
  return { utc: d.toISOString(), interimm: `${year}-${month}-${day} ${time} (zone ${zone})`, mars: marsTimeAt({ utc: d.toISOString() }) };
}

function missionSol({ mission, utc }) {
  const key = String(mission).toLowerCase();
  if (!mt.MISSIONS[key]) throw new Error(`Unknown mission "${mission}". Known: ${Object.keys(mt.MISSIONS).join(', ')}`);
  const ms = parseUtc(utc);
  const t = mt.missionTime(ms, key);
  return { mission: mt.MISSIONS[key].name, utc: new Date(ms).toISOString(), sol: t.sol, lmst: mt.formatHms(t.lmst), ltst: mt.formatHms(t.ltst),
    landed: mt.MISSIONS[key].landed, longitudeEast: mt.MISSIONS[key].longitude, active: mt.MISSIONS[key].active };
}

function solToEarth({ mission, sol }) {
  const key = String(mission).toLowerCase();
  const m = mt.MISSIONS[key];
  if (!m) throw new Error(`Unknown mission "${mission}". Known: ${Object.keys(mt.MISSIONS).join(', ')}`);
  // Local sol N at the site starts when MSD + longitude/360 reaches landingLocalSol + N.
  const landing = mt.marsTime(Date.parse(m.landed), { longitude: m.longitude }).sol;
  const start = mt.dateFromMarsSolDate(landing + sol - m.longitude / 360);
  const end = mt.dateFromMarsSolDate(landing + sol + 1 - m.longitude / 360);
  return { mission: m.name, sol, startsUtc: start.toISOString(), endsUtc: end.toISOString(), note: 'A sol runs from local mean midnight to midnight at the landing site.' };
}

function marsYearDates({ marsYear }) {
  // Find each Ls crossing near the mean date, then bisect.
  const meanStart = mt.dateFromMarsSolDate(mt.MY1_START_MSD + (marsYear - 1) * mt.YEAR_IN_SOLS).getTime();
  const crossing = (target, from) => {
    const off = (ms) => ((mt.marsTime(ms).ls - target + 540) % 360) - 180;
    let a = from;
    const step = 86400e3;
    let guard = 0;
    while (!(off(a) < 0 && off(a + step) >= 0)) { a += step; if (++guard > 800) throw new Error('Search failed'); }
    let b = a + step;
    for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (off(m) < 0) a = m; else b = m; }
    return Math.round(b / 1000) * 1000;
  };
  const start = crossing(0, meanStart - 40 * 86400e3);
  const out = { marsYear, startUtc: new Date(start).toISOString() };
  let s = start;
  for (const ls of [90, 180, 270]) { s = crossing(ls, s); out[`ls${ls}Utc`] = new Date(s).toISOString(); }
  out.note = 'Ls 0 = northern spring equinox, 90 = northern summer solstice, 180 = autumn equinox, 270 = winter solstice. Clancy numbering (MY 1 began 1955-04-11).';
  return out;
}

const TOOLS = [
  {
    name: 'get_mars_time',
    title: 'Mars time now or at a given moment',
    description: 'Time on Mars for an Earth instant (default: now): Mars Sol Date, Coordinated Mars Time, local mean and true solar time at a longitude, season (Ls), Mars Year, the InterImm calendar date and clock, and current sols of active rovers.',
    inputSchema: {
      type: 'object',
      properties: {
        utc: { type: 'string', description: 'Earth date-time, ISO 8601 (e.g. 2026-10-03T10:00:00Z). Omit for now.' },
        longitude: { type: 'number', description: 'Degrees EAST on Mars (Gale crater 137.44, Jezero 77.45). West longitudes are negative. Default 0 (Airy-0).' },
        zone: { type: 'integer', minimum: 0, maximum: 24, description: 'InterImm timezone for the InterImm clock. Default: the zone containing the longitude.' },
      },
    },
    run: marsTimeAt,
  },
  {
    name: 'interimm_to_earth',
    title: 'InterImm Mars date to Earth time',
    description: 'Converts an InterImm calendar date and clock time (24 months, Earth-length hours, 25 zones) to the Earth UTC instant.',
    inputSchema: {
      type: 'object',
      required: ['year'],
      properties: {
        year: { type: 'integer', description: 'InterImm year; Year 1 began 1970-04-28' },
        month: { type: 'integer', minimum: 1, maximum: 24 },
        day: { type: 'integer', minimum: 1, maximum: 28 },
        time: { type: 'string', description: '"hh:mm:ss", or "+mm:ss" for the 39 min 35 s after 24:00. Default 00:00:00.' },
        zone: { type: 'integer', minimum: 0, maximum: 24 },
      },
    },
    run: interimmToEarth,
  },
  {
    name: 'mission_sol',
    title: 'Rover or lander sol number',
    description: `The mission sol and local solar time of a Mars lander or rover at an Earth instant (default: now). Missions: ${Object.keys(mt.MISSIONS).join(', ')}.`,
    inputSchema: {
      type: 'object', required: ['mission'],
      properties: { mission: { type: 'string', enum: Object.keys(mt.MISSIONS) }, utc: { type: 'string', description: 'ISO 8601; omit for now' } },
    },
    run: missionSol,
  },
  {
    name: 'sol_to_earth',
    title: 'When a mission sol happened on Earth',
    description: 'The Earth UTC start and end of a given mission sol (e.g. Perseverance sol 1000).',
    inputSchema: {
      type: 'object', required: ['mission', 'sol'],
      properties: { mission: { type: 'string', enum: Object.keys(mt.MISSIONS) }, sol: { type: 'integer' } },
    },
    run: solToEarth,
  },
  {
    name: 'mars_year_dates',
    title: 'Start and season dates of a Mars Year',
    description: 'Earth UTC dates when a Mars Year (Clancy numbering) starts and reaches Ls 90, 180 and 270.',
    inputSchema: { type: 'object', required: ['marsYear'], properties: { marsYear: { type: 'integer', minimum: 1, maximum: 200 } } },
    run: marsYearDates,
  },
];

// ---------------------------------------------------------------- one-shot CLI

const args = process.argv.slice(2);
if (args[0] === 'now' || args[0] === '--help' || args[0] === '-h') {
  if (args[0] !== 'now') {
    console.log('Usage: marstime-mcp                 run as an MCP server on stdio\n       marstime-mcp now [--utc ISO] [--longitude deg_east] [--zone 0-24]   print Mars time as JSON');
    process.exit(0);
  }
  const opt = (k) => { const i = args.indexOf(`--${k}`); return i > 0 ? args[i + 1] : undefined; };
  const lon = opt('longitude');
  const zone = opt('zone');
  console.log(JSON.stringify(marsTimeAt({ utc: opt('utc'), longitude: lon === undefined ? 0 : Number(lon), zone: zone === undefined ? undefined : Number(zone) }), null, 2));
  process.exit(0);
}

// ---------------------------------------------------------------- MCP over stdio (newline-delimited JSON-RPC 2.0)

const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');

function handle(req) {
  const { id, method, params = {} } = req;
  const isRequest = id !== undefined && id !== null;
  switch (method) {
    case 'initialize':
      return send({ id, result: {
        protocolVersion: params.protocolVersion || '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: 'Use get_mars_time for "what time is it on Mars" questions. Longitudes are degrees east. Results are computed locally with NASA\'s Mars24 algorithm.',
      } });
    case 'ping':
      return send({ id, result: {} });
    case 'tools/list':
      return send({ id, result: { tools: TOOLS.map(({ run, ...t }) => t) } });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return send({ id, error: { code: -32602, message: `Unknown tool: ${params.name}` } });
      try {
        const result = tool.run(params.arguments || {});
        return send({ id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result } });
      } catch (e) {
        return send({ id, result: { content: [{ type: 'text', text: String(e.message || e) }], isError: true } });
      }
    }
    default:
      if (isRequest) send({ id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { send({ id: null, error: { code: -32700, message: 'Parse error' } }); continue; }
    for (const m of Array.isArray(msg) ? msg : [msg]) handle(m);
  }
});
process.stdin.on('end', () => process.exit(0));
