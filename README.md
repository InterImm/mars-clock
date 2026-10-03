# mars-clock

What time is it on Mars? A clock page, a JavaScript library and a static JSON API, all served free from GitHub Pages.

- Page: https://interimm.org/mars-clock/ (中文) and https://interimm.org/mars-clock/en/
- Library: [`lib/marstime.js`](lib/marstime.js), one ES module with no dependencies
- JSON: https://interimm.org/mars-clock/api/v1/index.json

火星时钟：火星时间网页、JavaScript 库和静态 JSON 接口，全部以 GitHub Pages 免费托管。

## The library

```js
import * as marstime from 'https://cdn.jsdelivr.net/gh/InterImm/mars-clock@gh-pages/lib/marstime.js';
// or, from a checkout: import * as marstime from './lib/marstime.js';

marstime.marsTime(new Date(), { longitude: 137.44 });
// { msd, mtc, ls, marsYear, eot, lmst, ltst, subsolarLongitude, solarDeclination, heliocentricDistance, meanAnomaly, sol }

marstime.interimmTime(new Date(), { zone: 5 });
// { year: 31, month: 1, day: 3, weekday: 'Tuesday', monthName: { zh: '春分', en: 'Chunfen' }, clock: '06:19:12', hours, ... }
```

Runs in browsers, Node 18+, Deno and Bun. Every function is pure and takes a `Date` or milliseconds since 1970.

| Function | Returns |
| --- | --- |
| `marsTime(date, { longitude })` | Mars24 quantities. Longitude is degrees **east**. Times are in Mars hours (1/24 sol). |
| `marsSolDate(date)` / `dateFromMarsSolDate(msd)` | Mars Sol Date and its inverse. |
| `season(ls)` | `{ north, south }` season names for a solar longitude. |
| `missionTime(date, 'curiosity')` | `{ sol, lmst, ltst }` for a lander or rover in `MISSIONS`, or for `{ landed, longitude }`. |
| `interimmTime(date, { zone })` | InterImm calendar date and clock in one of the 25 zones. |
| `dateFromInterimm({ year, month, day, hours, zone })` | The Earth instant of an InterImm date and time. |
| `interimmZone(longitude)` / `interimmZoneOffset(zone)` | Zone for a longitude, and its offset from zone 0 in Earth hours. |
| `taiMinusUtc(date)`, `julianDates(date)` | Earth time scales used underneath. |
| `formatHms(hours)`, `formatInterimmClock(hours)` | `"hh:mm:ss"` and the InterImm `"hh:mm:ss"` / `"+mm:ss"` reading. |
| `snapshot(date, { longitude, zone })` | All of the above in one JSON-friendly object. |

### Live element

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/InterImm/mars-clock@gh-pages/lib/mars-clock-element.js"></script>
<mars-clock></mars-clock>                               <!-- Coordinated Mars Time -->
<mars-clock show="interimm" zone="5"></mars-clock>      <!-- InterImm clock -->
<mars-clock show="sol" mission="perseverance"></mars-clock>
```

`show` is one of `mtc` (default), `interimm`, `date`, `lmst`, `ltst` (with `longitude`), `sol` (with `mission`), `ls`, `msd`. It renders plain text and inherits the surrounding style.

## The JSON API

Static files, regenerated from the library by `npm run build:api` (CI fails if they are stale).

| File | Content |
| --- | --- |
| `api/v1/daily/{year}.json` | 2000–2050, one row per day at 00:00 UTC: MSD, MTC, Ls, Mars Year, InterImm date and clock (zone 0), Curiosity and Perseverance sols |
| `api/v1/mars-years.json` | Start of Mars Years 1–80 and when each reaches Ls 90, 180, 270 |
| `api/v1/interimm-years.json` | Start and length of InterImm years 1–80, and the month names |
| `api/v1/missions.json` | Landing times and longitudes |
| `api/v1/leap-seconds.json` | The leap-second table |

```sh
curl -s https://interimm.org/mars-clock/api/v1/daily/2026.json | jq '.rows[275]'
```

## Accuracy and sources

- Mars time: [Mars24 algorithm](https://www.giss.nasa.gov/tools/mars24/help/algorithm.html) (Allison & McEwen 2000, with the constants as published by NASA GISS). The tests check NASA's worked example for 2000-01-06 and the published start dates of Mars Years 1, 24 and 36–39.
- Leap seconds: the IERS table, TAI − UTC = 37 s since 2017. The original page assumed 35 s, so its clock ran 2 s behind. **If IERS announces a new leap second, add a row to `LEAP_SECONDS` in `lib/marstime.js`.**
- Mars Years use the Clancy et al. (2000) numbering: Mars Year 1 began on 1955-04-11.

## InterImm calendar and timekeeping

Described on the page (and in the [Book of Interplanetary Civilization](https://book.interimm.org/)): 24 months named after the Chinese solar terms, months 6/12/18/24 have 27 sols and the rest 28, a leap year adds a sol to month 24. InterImm clocks count Earth-length hours, so a sol runs 00:00:00 to 23:59:59 and then +00:00 to +39:35, and Mars has 25 zones each 14.5987° wide.

Two details follow the original code rather than the old documentation, so that every date the clock has shown stays the same:

- Years are numbered from 1 (the docs called the first year "Year 0"). Year 1 began on 1970-04-28.
- The leap rule (odd years and multiples of 10 are leap, except multiples of 100, but multiples of 1000 are, except multiples of 3000) is applied to year + 1.

Fixed relative to the original: it sometimes showed "day 0" or repeated a day at the turn of a year, zone 24 was 39:35 ahead of zone 0 instead of behind it, and seconds could read :60 as :00 without carrying the minute.

## Development

```sh
npm test            # node --test, no install needed
npm run build:api   # regenerate api/v1
python3 -m http.server   # then open http://localhost:8000/
```

The page uses the shared InterImm kit (`https://interimm.org/kit/interimm.css` and `interimm.js`) for fonts, colours, header and footer; `app/clock.css` only adds what this page needs.

## Credits

Based on [jtauber/mars-clock](https://github.com/jtauber/mars-clock) (MIT). InterImm calendar, timekeeping and timezones by the Interplanetary Immigration Center (星际移民中心).
