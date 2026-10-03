// <mars-clock> custom element: a live Mars time readout for any web page.
//
//   <script type="module" src="https://cdn.jsdelivr.net/gh/InterImm/mars-clock@gh-pages/lib/mars-clock-element.js"></script>
//   <mars-clock></mars-clock>                       Coordinated Mars Time, e.g. 01:58:35
//   <mars-clock show="interimm" zone="5"></mars-clock>   InterImm clock in zone 5, e.g. 06:19:12
//   <mars-clock show="lmst" longitude="137.44"></mars-clock>   local mean solar time at Gale crater
//   <mars-clock show="sol" mission="perseverance"></mars-clock>   Perseverance's sol number
//   <mars-clock show="ls"></mars-clock>             solar longitude (season), e.g. 1.5°
//   <mars-clock show="date"></mars-clock>           InterImm date, e.g. 31-01-03
//
// It renders plain text with no styles of its own, so it takes the font and colour of where it sits.
import { marsTime, interimmTime, missionTime, formatHms } from './marstime.js';

class MarsClock extends HTMLElement {
  static observedAttributes = ['show', 'zone', 'longitude', 'mission'];

  connectedCallback() {
    this.tick();
    this.timer = setInterval(() => this.tick(), 500);
  }

  disconnectedCallback() { clearInterval(this.timer); }

  attributeChangedCallback() { if (this.isConnected) this.tick(); }

  tick() {
    const now = Date.now();
    const show = this.getAttribute('show') || 'mtc';
    const longitude = Number(this.getAttribute('longitude') || 0);
    let text;
    if (show === 'interimm' || show === 'date') {
      const t = interimmTime(now, { zone: Number(this.getAttribute('zone') || 0) });
      text = show === 'date' ? t.iso : t.clock;
    } else if (show === 'sol') {
      text = String(missionTime(now, this.getAttribute('mission') || 'curiosity').sol);
    } else {
      const t = marsTime(now, { longitude });
      if (show === 'ls') text = `${t.ls.toFixed(1)}°`;
      else if (show === 'msd') text = t.msd.toFixed(5);
      else if (show === 'lmst') text = formatHms(t.lmst);
      else if (show === 'ltst') text = formatHms(t.ltst);
      else text = formatHms(t.mtc);
    }
    if (this.textContent !== text) this.textContent = text;
  }
}

if (!customElements.get('mars-clock')) customElements.define('mars-clock', MarsClock);
