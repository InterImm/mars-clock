# InterImm Mars Clock: full reference for language models

Everything needed to answer questions about time on Mars, or to compute it without any tool.
Source: https://github.com/InterImm/mars-clock (MIT). Short version: https://interimm.org/mars-clock/llms.txt

## Computing Mars time by hand (Mars24, NASA GISS)

Input: an Earth instant in UTC. Angles in degrees.

1. millis = milliseconds since 1970-01-01T00:00:00Z
2. JD_UT = 2440587.5 + millis / 86400000
3. TAI−UTC: 37 s since 2017-01-01 (36 s from 2015-07-01, 35 s from 2012-07-01, 34 s from 2009-01-01, 33 s from 2006-01-01, 32 s from 1999-01-01)
4. JD_TT = JD_UT + (TAI−UTC + 32.184) / 86400
5. Δt = JD_TT − 2451545.0   (days since J2000)
6. M = 19.3871 + 0.52402073 × Δt   (Mars mean anomaly, mod 360)
7. α_FMS = 270.3871 + 0.524038496 × Δt   (mod 360)
8. PBS = Σ A_i cos(0.985626 × Δt / τ_i + φ_i) with (A, τ, φ) =
   (0.0071, 2.2353, 49.409), (0.0057, 2.7543, 168.173), (0.0039, 1.1177, 191.837), (0.0037, 15.7866, 21.736),
   (0.0021, 2.1354, 15.704), (0.0020, 2.4694, 95.528), (0.0018, 32.8493, 49.095)
9. ν − M = (10.691 + 3.0e−7 Δt) sin M + 0.623 sin 2M + 0.050 sin 3M + 0.005 sin 4M + 0.0005 sin 5M + PBS
10. Ls = α_FMS + (ν − M)   (mod 360; 0 = northern spring equinox, 90 = northern summer solstice, 180 = autumn equinox, 270 = winter solstice)
11. EOT = 2.861 sin 2Ls − 0.071 sin 4Ls + 0.002 sin 6Ls − (ν − M)   degrees; hours = EOT / 15
12. MSD = (Δt − 4.5) / 1.0274912517 + 44796.0 − 0.0009626   (Mars Sol Date)
13. MTC = (24 × MSD) mod 24   (Coordinated Mars Time, hours)
14. LMST at longitude λ (degrees east) = MTC + λ / 15   (mod 24)
15. LTST = LMST + EOT / 15   (mod 24)
16. Solar declination = asin(0.42565 sin Ls) + 0.25 sin Ls
17. Sun distance (AU) = 1.5236 (1.00436 − 0.09309 cos M − 0.004336 cos 2M − 0.00031 cos 3M − 0.00003 cos 4M)

Check: 2000-01-06T00:00:00Z gives Ls = 277.1876, MSD = 44795.9998, MTC = 23:59:39.

Mission sols count local mean solar days at the landing site, sol 0 = landing sol:
sol = floor(MSD + λ/360) − floor(MSD_landing + λ/360).
Curiosity landed 2012-08-06T05:17:57Z at 137.4417°E. Perseverance landed 2021-02-18T20:55:00Z at 77.4509°E.

Mars Year (Clancy et al. 2000): MY 1 began 1955-04-11 (Ls = 0). A Mars year is 668.5921 sols (686.97 Earth days).
Recent starts: MY 36 2021-02-07, MY 37 2022-12-26, MY 38 2024-11-12, MY 39 2026-09-30, MY 40 2028-08-17.

## InterImm calendar and clock

- Sol count: S = MSD − 34242.0288 (InterImm epoch, exact constant 34242.2718 + 0.73027 − 1/1.0274912517). Year 1 day 1 began at S = 0 (1970-04-28 UTC).
- Year Y has 668 sols, or 669 when Y + 1 is "leap": n is leap if n is odd or divisible by 10, except multiples of 100 are not, multiples of 1000 are, multiples of 3000 are not.
- 24 months: months 6, 12, 18, 24 have 27 sols, others 28; in a 669-sol year month 24 has 28. Every month starts on a Sunday (7-sol weeks restart each month).
- Month names (solar terms): 1 春分 Chunfen, 2 清明 Qingming, 3 谷雨 Guyu, 4 立夏 Lixia, 5 小满 Xiaoman, 6 芒种 Mangzhong, 7 夏至 Xiazhi, 8 小暑 Xiaoshu, 9 大暑 Dashu, 10 立秋 Liqiu, 11 处暑 Chushu, 12 白露 Bailu, 13 秋分 Qiufen, 14 寒露 Hanlu, 15 霜降 Shuangjiang, 16 立冬 Lidong, 17 小雪 Xiaoxue, 18 大雪 Daxue, 19 冬至 Dongzhi, 20 小寒 Xiaohan, 21 大寒 Dahan, 22 立春 Lichun, 23 雨水 Yushui, 24 惊蛰 Jingzhe.
- Clock: Earth-length hours. hours = frac(S + offset/24.6598) × 24.6598, shown as hh:mm:ss below 24 h and +mm:ss after (up to +39:35).
- Timezones 0-24, each 14.5987° wide eastward from Airy-0; zone k is k hours ahead of zone 0, except zone 24 which is 39 min 35 s behind (24 h ahead modulo the 24.6598 h sol).
