// Tests for marstime.js. Run with: node --test lib/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as mt from './marstime.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test('leap seconds: sorted, one second apart, and 37 s today', () => {
  for (let i = 1; i < mt.LEAP_SECONDS.length; i++) {
    assert.ok(mt.LEAP_SECONDS[i][0] > mt.LEAP_SECONDS[i - 1][0]);
    assert.equal(mt.LEAP_SECONDS[i][1], mt.LEAP_SECONDS[i - 1][1] + 1);
  }
  assert.equal(mt.taiMinusUtc(Date.UTC(2026, 9, 3)), 37);
  assert.equal(mt.taiMinusUtc(Date.UTC(2016, 11, 31, 23, 59, 59)), 36);
  assert.equal(mt.taiMinusUtc(Date.UTC(2017, 0, 1)), 37);
  assert.equal(mt.taiMinusUtc(Date.UTC(2000, 0, 1)), 32);
});

test('leap seconds agree with the IERS table used by InterImm/marsapi', () => {
  // NTP seconds (since 1900) of each change, copied from marsapi/api/time/functions/mars.py
  const ntp = [2272060800, 2287785600, 2303683200, 2335219200, 2366755200, 2398291200, 2429913600, 2461449600,
    2492985600, 2524521600, 2571782400, 2603318400, 2634854400, 2698012800, 2776982400, 2840140800, 2871676800,
    2918937600, 2950473600, 2982009600, 3029443200, 3076704000, 3124137600, 3345062400, 3439756800, 3550089600,
    3644697600, 3692217600];
  assert.deepEqual(mt.LEAP_SECONDS.map(([d]) => Date.parse(d + 'T00:00:00Z') / 1000 + 2208988800), ntp);
});

test('Mars24 worked example, 2000-01-06 00:00 UTC (Allison & McEwen 2000, GISS)', () => {
  const t = mt.marsTime(Date.UTC(2000, 0, 6));
  near(mt.julianDates(Date.UTC(2000, 0, 6)).j2000, 4.500743, 1e-6, 'ΔtJ2000');
  near(t.meanAnomaly, 21.74558, 1e-4, 'M');
  near(t.ls, 277.18758, 1e-4, 'Ls');
  near(t.eot * 15, -5.18774, 1e-4, 'EOT degrees');
  near(t.mtc, 23.99425, 1e-4, 'MTC');
  near(t.solarDeclination, -25.2282, 1e-3, 'declination');
  near(t.heliocentricDistance, 1.39351, 1e-4, 'distance');
  assert.equal(mt.formatHms(t.mtc), '23:59:39');
});

test('Mars Years start at the published equinoxes (Clancy numbering)', () => {
  const starts = { 1: '1955-04-11', 24: '1998-07-14', 36: '2021-02-07', 37: '2022-12-26', 38: '2024-11-12', 39: '2026-09-30' };
  for (const [my, day] of Object.entries(starts)) {
    const noon = Date.parse(day + 'T12:00:00Z');
    // The equinox falls on that UTC day; check one Earth day either side.
    assert.equal(mt.marsTime(noon - 86400e3 * 1.5).marsYear, +my - 1, `MY ${my} - 1.5 d`);
    assert.equal(mt.marsTime(noon + 86400e3 * 1.5).marsYear, +my, `MY ${my} + 1.5 d`);
  }
  // Ls goes through 0 on 2026-09-30.
  assert.ok(mt.marsTime(Date.parse('2026-09-30T00:00:00Z')).ls > 359);
  assert.ok(mt.marsTime(Date.parse('2026-09-30T23:59:00Z')).ls < 1);
});

test('Mars Year agrees with Ls over two centuries', () => {
  let prev = mt.marsTime(Date.UTC(1950, 0, 1));
  for (let t = Date.UTC(1950, 0, 1); t < Date.UTC(2150, 0, 1); t += 86400e3 * 3) {
    const cur = mt.marsTime(t);
    if (cur.ls < prev.ls) assert.equal(cur.marsYear, prev.marsYear + 1, new Date(t).toISOString());
    else assert.equal(cur.marsYear, prev.marsYear, new Date(t).toISOString());
    prev = cur;
  }
});

test('Mars Sol Date round-trips to the millisecond', () => {
  for (const t of [Date.UTC(1976, 6, 20), Date.UTC(2017, 0, 1), Date.UTC(2026, 9, 3, 10, 41, 9, 123), Date.UTC(2099, 11, 31)]) {
    near(+mt.dateFromMarsSolDate(mt.marsSolDate(t)), t, 1, new Date(t).toISOString());
  }
});

test('local times at a longitude', () => {
  const t = Date.UTC(2026, 9, 3, 10);
  const prime = mt.marsTime(t);
  const east90 = mt.marsTime(t, { longitude: 90 });
  near((east90.lmst - prime.lmst + 24) % 24, 6, 1e-9);
  near((east90.ltst - east90.lmst + 24) % 24, (prime.eot + 24) % 24, 1e-9);
  // At the subsolar longitude it is local true noon.
  near(mt.marsTime(t, { longitude: prime.subsolarLongitude }).ltst, 12, 1e-6);
});

test('seasons', () => {
  assert.deepEqual(mt.season(10), { north: 'spring', south: 'autumn' });
  assert.deepEqual(mt.season(270), { north: 'winter', south: 'summer' });
});

test('mission sols: 0 on landing', () => {
  for (const key of Object.keys(mt.MISSIONS)) {
    assert.equal(mt.missionTime(Date.parse(mt.MISSIONS[key].landed) + 60e3, key).sol, 0, key);
  }
  // Curiosity's sol count is also checked against the original clock in the legacy test below.
});

test('InterImm calendar: month and year lengths', () => {
  for (let y = -50; y < 3000; y++) {
    let sum = 0;
    for (let m = 1; m <= 24; m++) sum += mt.interimmMonthLength(y, m);
    assert.equal(sum, mt.interimmYearLength(y), `year ${y}`);
  }
  // Ten-year average close to the Mars tropical year.
  let total = 0;
  for (let y = 1; y <= 1000; y++) total += mt.interimmYearLength(y);
  near(total / 1000, mt.YEAR_IN_SOLS, 0.01);
});

test('InterImm calendar stays near the equinox: month 1 day 1 within a few sols of Ls 0', () => {
  for (let y = 1; y <= 60; y++) {
    const ls = mt.marsTime(mt.dateFromInterimm({ year: y, month: 1, day: 1 })).ls;
    assert.ok(angleDiff(ls, 0) < 6, `year ${y}: Ls ${ls}`);
  }
});

test('InterImm date round-trips', () => {
  for (const d of [{ year: 31, month: 1, day: 3, hours: 6.25, zone: 5 }, { year: 1, month: 24, day: 27 },
    { year: 0, month: 12, day: 2, hours: 24.5, zone: 24 }, { year: 120, month: 6, day: 27, hours: 0.001, zone: 13 }]) {
    const back = mt.interimmTime(mt.dateFromInterimm(d), { zone: d.zone ?? 0 });
    assert.deepEqual([back.year, back.month, back.day], [d.year, d.month, d.day]);
    near(back.hours, d.hours ?? 0, 1e-5);
  }
});

test('InterImm date format', () => {
  assert.equal(mt.formatInterimmDate({ year: 31, month: 1, day: 3 }), '31-01-03');
  assert.equal(mt.formatInterimmDate({ year: 1234, month: 24, day: 28 }), '1234-24-28');
  assert.equal(mt.formatInterimmDate({ year: -2, month: 12, day: 7 }), '-2-12-07');
  assert.deepEqual(mt.parseInterimmDate('31-01-03'), { year: 31, month: 1, day: 3 });
  assert.deepEqual(mt.parseInterimmDate('0031-01-03'), { year: 31, month: 1, day: 3 });
  assert.deepEqual(mt.parseInterimmDate('31-1-3'), { year: 31, month: 1, day: 3 });
  assert.deepEqual(mt.parseInterimmDate('-0002-12-07'), { year: -2, month: 12, day: 7 });
  assert.throws(() => mt.parseInterimmDate('31/1/3'), RangeError);
  assert.equal(mt.interimmTime(Date.UTC(2026, 9, 3, 10), { zone: 5 }).iso, '31-01-03');
});

test('InterImm clock format', () => {
  assert.equal(mt.formatInterimmClock(0), '00:00:00');
  assert.equal(mt.formatInterimmClock(23.999), '23:59:56');
  assert.equal(mt.formatInterimmClock(24.5), '+30:00');
  assert.equal(mt.formatInterimmClock(24.6597), '+39:34');
});

test('InterImm timezones', () => {
  assert.equal(mt.interimmZone(0), 0);
  assert.equal(mt.interimmZone(137.4), 9); // Curiosity, per the timezones page
  assert.equal(mt.interimmZone(354.47), 24); // Opportunity
  assert.equal(mt.interimmZone(-5.53), 24);
  near(mt.INTERIMM_ZONE_WIDTH, 14.5987, 1e-4);
  const t = Date.UTC(2026, 9, 3, 10);
  near((mt.interimmTime(t, { zone: 5 }).solCount - mt.interimmTime(t).solCount) * 24 * mt.SOL_IN_DAYS, 5, 1e-9);
  near((mt.interimmTime(t, { zone: 24 }).solCount - mt.interimmTime(t).solCount) * 24 * mt.SOL_IN_DAYS, -0.659790, 1e-5);
});

test('matches the dates and times the original clock showed', () => {
  const { rows } = JSON.parse(readFileSync(new URL('./legacy-fixture.json', import.meta.url)));
  let same = 0, boundary = 0;
  for (const r of rows) {
    const t = Date.parse(r.utc);
    const i = mt.interimmTime(t, { zone: r.zone });
    const m = mt.marsTime(t);
    // The original used TAI-UTC = 35 s always, so times differ by up to a few seconds; Ls by under 0.01 degrees (Mars24 constants were refined in 2012).
    near(angleDiff(m.ls, r.ls), 0, 1e-2, `Ls ${r.utc}`);
    const daySec = 24 * mt.SOL_IN_DAYS * 3600;
    const toSec = (s) => s.startsWith('+') ? 86400 + +s.slice(1, 3) * 60 + +s.slice(4, 6) : +s.slice(0, 2) * 3600 + +s.slice(3, 5) * 60 + +s.slice(6, 8);
    // The original assumed TAI-UTC = 35 s always, so its clock is off by (TAI-UTC - 35) seconds.
    const shift = 35 - mt.taiMinusUtc(t);
    const raw = toSec(i.clock) - toSec(r.clock) + shift;
    const dt = Math.abs(((raw % daySec) + daySec) % daySec);
    // The original rounded seconds up to 60 and showed it as :00 without carrying the minute, so allow that case.
    const tol = r.clock.endsWith(':00') ? 65 : 5;
    assert.ok(Math.min(dt, daySec - dt) <= tol, `clock ${r.utc}: ${i.clock} vs ${r.clock}`);
    assert.equal(mt.missionTime(t, 'curiosity').sol, r.curiositySol, `Curiosity sol ${r.utc}`);
    if (`${i.year}-${i.month}-${i.day}` === r.date) same++;
    else if (i.dayOfYear <= 2 || i.dayOfYear >= 667) boundary++; // the original skipped or repeated a sol at some year ends
    else assert.fail(`date ${r.utc} zone ${r.zone}: ${i.year}-${i.month}-${i.day} vs ${r.date}`);
  }
  assert.ok(same / rows.length > 0.98, `${same}/${rows.length} identical, ${boundary} at year ends`);
});

test('snapshot is JSON-safe and complete', () => {
  const s = JSON.parse(JSON.stringify(mt.snapshot(Date.UTC(2026, 9, 3, 10), { zone: 5 })));
  assert.equal(s.earth.taiMinusUtc, 37);
  assert.equal(s.mars.marsYear, 39);
  assert.equal(s.interimm.year, 31);
  assert.ok(s.missions.curiosity && s.missions.perseverance);
  assert.throws(() => mt.marsTime(new Date('nope')), TypeError);
});
