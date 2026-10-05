// Tests for lightyear.js. Run with: node --test lib/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as ly from './lightyear.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);

test('1 g in light years per year squared', () => near(ly.G, 1.0323, 0.0001));

test('story clock: 2026-10-03 is 2219-10-03', () => {
  assert.equal(ly.storyFromReal(Date.UTC(2026, 9, 3)).toISOString().slice(0, 10), '2219-10-03');
  assert.equal(ly.realFromStory(ly.storyFromReal(1.7e12)).getTime(), 1.7e12);
});

test('messages travel one year per light year', () => {
  const m = ly.message(Date.UTC(2219, 9, 3), 10.47, { replyAfter: 1 });
  near((m.arrives - m.sent) / ly.YEAR_MS, 10.47, 1e-9);
  near((m.earliestReply - m.sent) / ly.YEAR_MS, 21.94, 1e-9);
  const p = ly.messageProgress(m.sent, 10.47, m.sent.getTime() + 5 * ly.YEAR_MS);
  near(p.travelled, 5, 1e-9);
  assert.equal(p.arrived, false);
  assert.equal(ly.messageProgress(m.sent, 10.47, m.arrives).arrived, true);
  near((Date.UTC(2219, 9, 3) - ly.emitted(Date.UTC(2219, 9, 3), 4).getTime()) / ly.YEAR_MS, 4, 1e-9);
});

test('pure coast: time dilation by gamma', () => {
  const v = ly.voyage({ distance: 10, accel: 0, cruise: 0.6 });
  near(v.earthYears, 10 / 0.6, 1e-9);
  near(v.shipYears, (10 / 0.6) * 0.8, 1e-9);
});

test('1 g brachistochrone to Epsilon Eridani matches the relativistic rocket equations', () => {
  const v = ly.voyage({ distance: 10.47, accel: 1 });
  // cosh(phi) = 1 + a d / 2; tau = 2 phi / a; t = 2 sinh(phi) / a
  const phi = Math.acosh(1 + ly.G * 10.47 / 2);
  near(v.shipYears, 2 * phi / ly.G, 1e-9);
  near(v.earthYears, 2 * Math.sinh(phi) / ly.G, 1e-9);
  near(v.shipYears, 4.92, 0.02);
  near(v.earthYears, 12.25, 0.02);
  assert.equal(v.phases[1].distance, 0);
});

test('long trips reach the cruise speed and coast', () => {
  const v = ly.voyage({ distance: 10.47, accel: 0.05, cruise: 0.1 });
  assert.ok(v.phases[1].distance > 9);
  near(v.peakBeta, 0.1, 1e-12);
  assert.ok(v.earthYears > 104.7 && v.earthYears < 110);
  const sum = v.phases.reduce((s, p) => s + p.distance, 0);
  near(sum, 10.47, 1e-9);
});

test('voyageAt is continuous and ends at the destination', () => {
  for (const p of Object.keys(ly.PROFILES)) {
    const v = ly.profileVoyage(p, 10.47);
    let prev = ly.voyageAt(v, 0);
    for (let i = 1; i <= 2000; i++) {
      const s = ly.voyageAt(v, (v.earthYears * i) / 2000);
      assert.ok(s.distance >= prev.distance - 1e-9, `${p} moves forward`);
      assert.ok(s.distance - prev.distance <= v.earthYears / 2000 + 1e-9, `${p} slower than light`);
      assert.ok(s.shipYears >= prev.shipYears - 1e-9, `${p} ship clock runs forward`);
      prev = s;
    }
    near(prev.distance, 10.47, 1e-6, p);
    near(prev.shipYears, v.shipYears, 1e-6, p);
  }
});

test('voyageDates: news of arrival comes back one light-travel time later', () => {
  const v = ly.profileVoyage('torch', 10.47);
  const d = ly.voyageDates(v, Date.UTC(2219, 9, 3));
  near((d.newsHome - d.arrives) / ly.YEAR_MS, 10.47, 1e-9);
});

test('bad input is refused', () => {
  assert.throws(() => ly.voyage({ distance: -1 }));
  assert.throws(() => ly.voyage({ distance: 1, cruise: 1.2 }));
  assert.throws(() => ly.voyage({ distance: 1, accel: 0 }));
  assert.throws(() => ly.star('nope'));
  assert.equal(ly.star('epsilon-eridani').distance, 10.47);
});
