// Embed builder: pick options, see the widget live, copy the snippet.
import '../lib/mars-clock-card.js';

const form = document.getElementById('embed-form');
const preview = document.getElementById('embed-preview');
const code = document.getElementById('embed-code');
const copy = document.getElementById('embed-copy');
const CDN = 'https://cdn.jsdelivr.net/gh/InterImm/mars-clock@gh-pages/lib/mars-clock-card.js';
const PAGE = 'https://interimm.org/mars-clock/embed/';

for (let z = 0; z <= 24; z++) form.elements.zone.add(new Option(String(z), z));
form.elements.lang.value = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';

function render() {
  const f = form.elements;
  const attrs = [];
  if (f.lang.value !== 'en') attrs.push(['lang', f.lang.value]);
  if (f.zone.value !== '0') attrs.push(['zone', f.zone.value]);
  if (f.theme.value !== 'auto') attrs.push(['theme', f.theme.value]);
  if (f.rovers.checked) attrs.push(['rovers', '']);
  if (f.compact.checked) attrs.push(['compact', '']);

  for (const a of [...preview.attributes]) if (a.name !== 'id') preview.removeAttribute(a.name);
  for (const [k, v] of attrs) preview.setAttribute(k, v);

  if (f.method.value === 'iframe') {
    const q = attrs.map(([k, v]) => (v ? `${k}=${encodeURIComponent(v)}` : k)).join('&');
    const h = f.compact.checked ? 150 : f.rovers.checked ? 270 : 240;
    code.textContent = `<iframe src="${PAGE}${q ? `?${q}` : ''}" title="Mars Clock" width="360" height="${h}" style="border:0;max-width:100%" loading="lazy"></iframe>`;
  } else {
    const a = attrs.map(([k, v]) => (v ? ` ${k}="${v}"` : ` ${k}`)).join('');
    code.textContent = `<script type="module" src="${CDN}"></script>\n<mars-clock-card${a}></mars-clock-card>`;
  }
}

form.addEventListener('input', render);
copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(code.textContent);
    copy.textContent = copy.dataset.done;
    setTimeout(() => { copy.textContent = copy.dataset.label; }, 1500);
  } catch { /* clipboard blocked: the code stays selectable */ }
});
render();
