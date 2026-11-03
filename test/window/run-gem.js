// run-gem.js: the diamonds are the gem picture of the user (not a character), and the numbers next to it have the colour of the gem
const { chromium } = require('./pw');
const { spawnSync } = require('child_process');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const py = spawnSync('python3', ['-c', `
import json
from PIL import Image
import numpy as np
im = Image.open('gem.png'); a = np.array(im.convert('RGBA')).astype(float); al = a[..., 3]
lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
part = (al > 4) & (al < 250); op = al > 250; facets = op & (lum > 110)
avg = a[facets][:, :3].mean(0)
print(json.dumps({'size': im.size, 'mode': im.mode, 'corners': [float(al[0, 0]), float(al[0, -1]), float(al[-1, 0]), float(al[-1, -1])], 'transparent': float((al < 4).mean()), 'edgeN': int(part.sum()), 'edgeMed': float(np.median(lum[part])), 'edge99': float(np.quantile(lum[part], .99)), 'avg': [round(float(v)) for v in avg]}))
`], { encoding: 'utf8' });
const F = JSON.parse(py.stdout || '{}');
ok('the picture is a PNG with transparency, 114 x 96, the corners are see-through', F.mode === 'RGBA' && F.size && F.size[0] === 114 && F.size[1] === 96 && F.corners.every(v => v === 0) && F.transparent > 0.2, F);
ok('no grey fringe: the soft edge pixels are the dark navy of the outline (median brightness below 90, 99% below 150), the background grey (213) is gone', F.edgeN > 200 && F.edgeMed < 90 && F.edge99 < 150, [F.edgeN, F.edgeMed, F.edge99]);
const num = c => (String(c).match(/\d+/g) || []).map(Number);
const same = (c, ref) => num(c).length === 3 && num(c).every((v, i) => Math.abs(v - ref[i]) <= 3);          // the saved picture is a shrunk copy: its average is a unit or two from the one of the big picture
const GEM = 'rgb(' + F.avg.join(', ') + ')';
(async () => {
  const b = await chromium.launch();
  let p = await open(b, { w: 1700, h: 1000 }); await feedAll(p); await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500);
  const fr = p.dash(); await fr.evaluate(() => { selected = 'sum'; renderAll(); }); await p.waitForTimeout(250);
  const S = await fr.evaluate(() => { const cards = Array.from(document.querySelectorAll('.acard .dia')).map(d => { const i = d.querySelector('img.gem'), r = i && i.getBoundingClientRect(), fs = parseFloat(getComputedStyle(d).fontSize); return { img: !!i, src: i && i.getAttribute('src'), done: !!(i && i.complete && i.naturalWidth === 114), h: r && +r.height.toFixed(1), w: r && +r.width.toFixed(1), fs: fs, text: d.textContent.trim(), color: getComputedStyle(d).color, alt: i && i.alt }; });
    const kv = document.querySelectorAll('.duo .kv')[3], i2 = kv.querySelector('.l img.gem');
    return { cards: cards, kvLabel: kv.querySelector('.l').textContent.trim(), kvImg: !!i2, kvDone: !!(i2 && i2.complete && i2.naturalWidth === 114), kvColor: getComputedStyle(kv.querySelector('.v')).color, kvBlue: kv.querySelector('.v').classList.contains('blue'), body: document.body.innerText.indexOf('\\u25c6'), html: document.body.innerHTML.indexOf('\\u25c6'), res: performance.getEntriesByType('resource').map(x => x.name.split('/').pop()) }; });
  ok('the cards of the four accounts show the gem picture (not a character) before the number of diamonds, loaded', S.cards.length === 4 && S.cards.every(c => c.img && c.src === 'gem.png' && c.done && /^\d/.test(c.text) && c.alt === ''), S.cards);
  ok('...as big as the text beside it (a bit more than its height: 1.15 em, about 13.8 px at 12 px) and with the shape of the picture kept (width / height = 1.19)', S.cards.every(c => Math.abs(c.h - c.fs * 1.15) <= 1 && Math.abs(c.w / c.h - 114 / 96) < 0.03), S.cards.map(c => [c.fs, c.h, c.w]));
  ok('the number next to the gem has the colour of the gem (the average of its facets, ' + GEM + ')', S.cards.every(c => same(c.color, F.avg)) && S.cards.every(c => c.color === 'rgb(117, 207, 248)'), [GEM, S.cards.map(c => c.color)]);
  ok('Assets: "total" beside the gem under the number of diamonds, which is in the gem colour too (it was blue)', S.kvLabel === 'total' && S.kvImg && S.kvDone && same(S.kvColor, F.avg) && !S.kvBlue, [S.kvLabel, S.kvImg, S.kvDone, S.kvColor, S.kvBlue]);
  ok('there is no diamond character left in the dashboard (neither in the text nor in the page)', S.body === -1 && S.html === -1, [S.body, S.html]);
  await fr.evaluate(() => { selected = 1; renderAll(); }); await p.waitForTimeout(250);
  const W = await fr.evaluate(() => { const d = document.querySelector('.wealthbar .dia'), i = d && d.querySelector('img.gem'), r = i && i.getBoundingClientRect(); return { has: !!d, img: !!i, done: !!(i && i.complete && i.naturalWidth === 114), h: r && +r.height.toFixed(1), fs: d && parseFloat(getComputedStyle(d).fontSize), color: d && getComputedStyle(d).color, text: d && d.textContent.trim() }; });
  ok('one account (the bar with its money): the gem and the number, same colour, sized to the text', W.has && W.img && W.done && /^\d/.test(W.text) && same(W.color, F.avg) && Math.abs(W.h - W.fs * 1.15) <= 1, W);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  // Portuguese
  p = await open(b, { w: 1700, h: 1000, lang: 'pt-BR' }); await feedAll(p); await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500);
  const fr2 = p.dash(); await fr2.evaluate(() => { selected = 'sum'; renderAll(); }); await p.waitForTimeout(250);
  const P = await fr2.evaluate(() => Array.from(document.querySelectorAll('.duo .kv .l')).map(e => e.textContent.trim()));
  ok('in Portuguese the labels are Bolas, Poções, Total $ and total (with the gem)', /Bolas/i.test(P[0]) && /Po/i.test(P[1]) && P[3] === 'total', P);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
