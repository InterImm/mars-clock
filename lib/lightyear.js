// Light-year time: messages and voyages to nearby stars, and the InterImm story clock.
// One ES module, no dependencies. Units: light years (ly) and Julian years (yr), so c = 1 ly/yr.
// Every function is pure and takes milliseconds since 1970 or a Date where it needs an instant.

export const VERSION = '1.0.0';

export const YEAR_MS = 365.25 * 86400e3; // Julian year
export const LY_M = 9460730472580800; // metres in a light year (IAU)
export const G = 9.80665 * (365.25 * 86400) ** 2 / LY_M; // 1 g in ly/yr^2, about 1.0323
const MARS_YEAR_DAYS = 686.9796;

// The InterImm story runs 70,491 days (about 193 years) ahead of the real calendar:
// 2026-10-03 on Earth is 2219-10-03 in the story, the first year of terraforming phase 1.
export const STORY_OFFSET_DAYS = 70491;
const OFFSET_MS = STORY_OFFSET_DAYS * 86400e3;
const ms = (d) => (d instanceof Date ? d.getTime() : Number(d));

export const storyFromReal = (date) => new Date(ms(date) + OFFSET_MS);
export const realFromStory = (date) => new Date(ms(date) - OFFSET_MS);

// Nearby stars. Distances from the Sun in light years, rounded from SIMBAD/Gaia values; the Earth and Mars
// are both within 0.00003 ly of the Sun, so the same numbers hold from either planet.
export const STARS = [
  { id: 'proxima', name: { en: 'Proxima Centauri', zh: '比邻星' }, distance: 4.2465, type: 'M5.5V', planets: true },
  { id: 'alpha-centauri', name: { en: 'Alpha Centauri A/B', zh: '南门二（半人马座α）' }, distance: 4.37, type: 'G2V+K1V' },
  { id: 'barnard', name: { en: "Barnard's Star", zh: '巴纳德星' }, distance: 5.96, type: 'M4V', planets: true },
  { id: 'wolf-359', name: { en: 'Wolf 359', zh: '沃尔夫359' }, distance: 7.86, type: 'M6V' },
  { id: 'lalande-21185', name: { en: 'Lalande 21185', zh: '拉兰德21185' }, distance: 8.31, type: 'M2V', planets: true },
  { id: 'sirius', name: { en: 'Sirius', zh: '天狼星' }, distance: 8.60, type: 'A1V+DA2' },
  { id: 'epsilon-eridani', name: { en: 'Epsilon Eridani', zh: '天苑四（波江座ε）' }, distance: 10.47, type: 'K2V', planets: true },
  { id: 'procyon', name: { en: 'Procyon', zh: '南河三' }, distance: 11.46, type: 'F5IV+DQZ' },
  { id: 'tau-ceti', name: { en: 'Tau Ceti', zh: '天仓五（鲸鱼座τ）' }, distance: 11.91, type: 'G8V', planets: true },
  { id: 'teegarden', name: { en: "Teegarden's Star", zh: '蒂加登星' }, distance: 12.50, type: 'M7V', planets: true },
  { id: 'altair', name: { en: 'Altair', zh: '牛郎星（河鼓二）' }, distance: 16.73, type: 'A7V' },
  { id: 'vega', name: { en: 'Vega', zh: '织女星' }, distance: 25.04, type: 'A0V' },
  { id: 'trappist-1', name: { en: 'TRAPPIST-1', zh: 'TRAPPIST-1' }, distance: 40.66, type: 'M8V', planets: true },
  { id: 'betelgeuse', name: { en: 'Betelgeuse', zh: '参宿四' }, distance: 548, type: 'M1-2Ia', note: 'distance uncertain, 500-650 ly' },
];

export function star(idOrDistance) {
  if (typeof idOrDistance === 'number') return { id: 'custom', name: { en: `${idOrDistance} ly`, zh: `${idOrDistance} 光年` }, distance: idOrDistance };
  const s = STARS.find((x) => x.id === String(idOrDistance).toLowerCase());
  if (!s) throw new Error(`Unknown star "${idOrDistance}". Known: ${STARS.map((x) => x.id).join(', ')}`);
  return s;
}

// ---------------------------------------------------------------- messages at light speed

// A message sent at `sent` reaches a star `distance` ly away one light-travel time later; an answer written
// `replyAfter` years after it arrives gets back one light-travel time after that.
export function message(sent, distance, { replyAfter = 0 } = {}) {
  const t0 = ms(sent);
  const arrives = t0 + distance * YEAR_MS;
  const reply = arrives + replyAfter * YEAR_MS + distance * YEAR_MS;
  return { sent: new Date(t0), arrives: new Date(arrives), earliestReply: new Date(reply), oneWayYears: distance, roundTripYears: 2 * distance + replyAfter };
}

// How far a message sent at `sent` has travelled by `now`, in ly and as a fraction of the way (0..1).
export function messageProgress(sent, distance, now = Date.now()) {
  const travelled = Math.max(0, (ms(now) - ms(sent)) / YEAR_MS);
  return { travelled: Math.min(travelled, distance), fraction: Math.min(1, travelled / distance), arrived: travelled >= distance };
}

// Light received from a star at `received` left it one light-travel time earlier.
export const emitted = (received, distance) => new Date(ms(received) - distance * YEAR_MS);

// ---------------------------------------------------------------- voyages

// A voyage: accelerate at `accel` (in g, felt aboard) up to `cruise` (fraction of c), coast, then brake the
// same way if `decelerate`. With no cruise cap the ship accelerates to the midpoint and flips (or, without
// braking, all the way). With accel 0 or null the ship is put at cruise speed instantly (pure coast).
// Special relativity for constant proper acceleration (hyperbolic motion); times in the departure frame
// (the Sun/Mars frame) are `earthYears`, times aboard are `shipYears`.
export function voyage({ distance, accel = 1, cruise = null, decelerate = true }) {
  if (!(distance > 0)) throw new Error('distance must be a positive number of light years');
  if (cruise !== null && !(cruise > 0 && cruise < 1)) throw new Error('cruise must be between 0 and 1 (a fraction of light speed), or null');
  const burns = decelerate ? 2 : 1;
  const a = accel > 0 ? accel * G : 0;
  if (!a && cruise === null) throw new Error('give a cruise speed when there is no acceleration');

  let phi = cruise === null ? Infinity : Math.atanh(cruise); // rapidity at cruise
  let burnDist = a ? (Math.cosh(phi) - 1) / a : 0;
  if (a && burns * burnDist >= distance) { // never reaches cruise: accelerate to the midpoint (or the end) and flip
    phi = Math.acosh(1 + (a * distance) / burns);
    burnDist = distance / burns;
  }
  const beta = Math.tanh(phi), gamma = Math.cosh(phi);
  const burnEarth = a ? Math.sinh(phi) / a : 0;
  const burnShip = a ? phi / a : 0;
  const coastDist = distance - burns * burnDist;
  const coastEarth = coastDist / beta, coastShip = coastEarth / gamma;
  const earthYears = burns * burnEarth + coastEarth;
  const shipYears = burns * burnShip + coastShip;
  return {
    distance, accel: accel || 0, cruise, decelerate,
    peakBeta: beta, peakGamma: gamma, rapidity: phi,
    earthYears, shipYears, marsYears: earthYears * 365.25 / MARS_YEAR_DAYS,
    timeSavedYears: earthYears - shipYears,
    // Ideal photon rocket (exhaust at c): initial / final mass. A beamed sail carries no propellant.
    photonRocketMassRatio: Math.exp(burns * phi),
    phases: [
      { phase: 'accelerate', earthYears: burnEarth, shipYears: burnShip, distance: burnDist },
      { phase: 'coast', earthYears: coastEarth, shipYears: coastShip, distance: coastDist },
      ...(decelerate ? [{ phase: 'decelerate', earthYears: burnEarth, shipYears: burnShip, distance: burnDist }] : []),
    ],
  };
}

// Where the ship is `t` Earth-frame years after departure: distance covered, speed, and time aboard.
export function voyageAt(v, t) {
  const a = v.accel * G;
  const [acc, coast] = v.phases;
  const T = v.earthYears;
  if (t <= 0) return { t: 0, distance: 0, beta: 0, shipYears: 0, arrived: false };
  if (t >= T) return { t, distance: v.distance, beta: v.decelerate ? 0 : v.peakBeta, shipYears: v.shipYears + (v.decelerate ? t - T : (t - T) / v.peakGamma), arrived: true };
  const hyper = (s) => ({ x: (Math.sqrt(1 + (a * s) ** 2) - 1) / a, beta: (a * s) / Math.sqrt(1 + (a * s) ** 2), tau: Math.asinh(a * s) / a });
  if (a && t < acc.earthYears) { const h = hyper(t); return { t, distance: h.x, beta: h.beta, shipYears: h.tau, arrived: false }; }
  const tc = t - acc.earthYears;
  if (tc < coast.earthYears) {
    return { t, distance: acc.distance + tc * v.peakBeta, beta: v.peakBeta, shipYears: acc.shipYears + tc / v.peakGamma, arrived: false };
  }
  const h = hyper(T - t); // braking mirrors the first burn
  return { t, distance: v.distance - h.x, beta: h.beta, shipYears: v.shipYears - h.tau, arrived: false };
}

// Ready-made ship designs for the tools. Speeds and accelerations are illustrative, in the range of published studies.
export const PROFILES = {
  sail: { name: { en: 'Light-sail probe (flyby)', zh: '光帆探测器（飞掠）' }, accel: 1000, cruise: 0.2, decelerate: false,
    note: { en: 'Gram-scale probe pushed by a laser array, like Breakthrough Starshot. No braking.', zh: '激光阵列推动的克级探测器，类似“突破摄星”。不减速。' } },
  ark: { name: { en: 'Fusion ark', zh: '聚变方舟' }, accel: 0.05, cruise: 0.1, decelerate: true,
    note: { en: 'A crewed fusion ship at a tenth of light speed, braking at the far end.', zh: '载人聚变飞船，以十分之一光速巡航，到达时减速。' } },
  fast: { name: { en: 'Beamed sail, crewed', zh: '载人光帆' }, accel: 0.3, cruise: 0.3, decelerate: true,
    note: { en: 'A crewed sail pushed out from the solar system and braked by a magnetic sail.', zh: '从太阳系推出、靠磁帆减速的载人光帆。' } },
  torch: { name: { en: 'Torch ship at 1 g', zh: '1 g 火炬船' }, accel: 1, cruise: null, decelerate: true,
    note: { en: 'Constant 1 g all the way, flipping at the midpoint. Needs an antimatter-class engine.', zh: '全程 1 g 加速，中点掉头减速，需要反物质级的发动机。' } },
};

export function profileVoyage(profile, distance) {
  const p = PROFILES[profile];
  if (!p) throw new Error(`Unknown profile "${profile}". Known: ${Object.keys(PROFILES).join(', ')}`);
  return voyage({ distance, accel: p.accel, cruise: p.cruise, decelerate: p.decelerate });
}

// Dates for a voyage leaving at `depart`: arrival in the departure frame, and the first news of arrival back home.
export function voyageDates(v, depart) {
  const d = ms(depart);
  const arrives = d + v.earthYears * YEAR_MS;
  return { depart: new Date(d), arrives: new Date(arrives), newsHome: new Date(arrives + v.distance * YEAR_MS) };
}
