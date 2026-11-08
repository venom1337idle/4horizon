// run-brand.js: the logo at the top left of the app ("4 Horizon", cut out of its white background)
const { chromium } = require('./pw');
const { spawnSync } = require('child_process');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
// ---- the picture file
const PY = ['python3', 'python'].find(p => { try { return spawnSync(p, ['--version']).status === 0; } catch (e) { return false; } }) || 'python3';      // (1.0.7: Windows has only "python")
const py = spawnSync(PY, ['-c', `
import json
from PIL import Image
import numpy as np
from scipy import ndimage as ndi
im = Image.open('brand.png'); a = np.array(im.convert('RGBA')).astype(float); al = a[..., 3]
part = (al > 4) & (al < 250); lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
lab, n = ndi.label(al < 4); border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
holes = [i for i in range(1, n + 1) if i not in border and (lab == i).sum() >= 6]
print(json.dumps({'mode': im.mode, 'size': im.size, 'transparent': float((al < 4).mean()), 'corners': [float(al[0, 0]), float(al[0, -1]), float(al[-1, 0]), float(al[-1, -1])], 'edgeMax': float(lum[part].max()), 'edge995': float(np.quantile(lum[part], .995)), 'edgeN': int(part.sum()), 'holes': len(holes), 'opaque': float((al > 250).mean())}))
`], { encoding: 'utf8' });
if (py.status !== 0 && /No module named ['"]?(PIL|numpy|scipy)/.test(py.stderr || '')) {          // (the picture is read with Python's Pillow, numpy and scipy)
  console.log('  FAIL  a Python library this test needs is missing (' + (/No module named ['"]?([\w.]+)/.exec(py.stderr) || [])[1] + '): run "pip install pillow numpy scipy"'); console.log('\n0 passed, 1 failed'); process.exit(1);
}
if (py.status !== 0) { console.log('  FAIL  the picture could not be read: ' + String(py.stderr || '').trim().split('\n').pop()); console.log('\n0 passed, 1 failed'); process.exit(1); }
const F = JSON.parse(py.stdout || '{}');
ok('the file is a PNG with transparency, 388 x 120 (a 3x picture of a logo that is shown 40 px high)', F.mode === 'RGBA' && F.size && F.size[0] === 388 && F.size[1] === 120, F);
ok('the background is gone: the four corners are fully transparent, and a good part of the picture is transparent', F.corners.every(v => v === 0) && F.transparent > 0.35 && F.opaque > 0.3, F);
ok('the holes inside the letters (the "o"s, the "4", gaps of the vines) are see-through too: at least 4 enclosed transparent areas', F.holes >= 4, F.holes);
ok('no white halo on the edges: the colour of the soft edge pixels is dark/green/pink, never white (brightest edge pixel below 240, 99.5% below 175)', F.edgeN > 1000 && F.edgeMax < 240 && F.edge995 < 175, [F.edgeN, F.edgeMax, F.edge995]);
(async () => {
  const b = await chromium.launch();
  for (const lang of ['en', 'pt-BR']) {
    const p = await open(b, { lang, w: 1500, h: 900 }); await p.waitForTimeout(400);
    const R = await p.evaluate(() => { const i = document.querySelector('.brand img[alt="4horizon"]'), m = document.querySelector('.brand .mark'), r = i.getBoundingClientRect(), bar = document.getElementById('bar').getBoundingClientRect();
      return { src: i.getAttribute('src'), done: i.complete && i.naturalWidth > 0, nat: [i.naturalWidth, i.naturalHeight], h: Math.round(r.height), w: Math.round(r.width), left: Math.round(r.left), top: Math.round(r.top - bar.top), bottom: Math.round(bar.bottom - r.bottom), markShown: getComputedStyle(m).display !== 'none', res: performance.getEntriesByType('resource').map(x => x.name.split('/').pop()), alt: i.alt, barH: Math.round(bar.height) }; });
    const t = lang + ': ';
    ok(t + 'the top left shows the new logo (brand.png), loaded, 40 px high and about 129 px wide', R.src === 'brand.png' && R.done && R.h === 40 && R.w >= 127 && R.w <= 131 && R.nat[0] === 388, R);
    ok(t + 'the old wordmark picture is not used any more, and the bulb is not shown next to the new logo', R.res.indexOf('wordmark-bar.png') < 0 && !R.markShown, [R.res, R.markShown]);
    ok(t + 'it is centred in the top bar (the same space above and below) and not cut off', Math.abs(R.top - R.bottom) <= 1 && R.top >= 6, [R.top, R.bottom, R.barH]);
    ok(t + 'its text alternative is "4horizon"', R.alt === '4horizon', R.alt);
    ok(t + 'no JavaScript errors', p.errors.length === 0, p.errors);
    if (lang === 'en') await p.screenshot({ path: 'brand-bar.png', clip: { x: 0, y: 0, width: 760, height: 60 } });
    await p.context().close();
  }
  // widths: the bar still fits, and below 1000 px the small bulb replaces the logo
  for (const w of [1920, 1500, 1330, 1100, 1000, 999, 900]) {
    const p = await open(b, { w, h: 800 }); await p.waitForTimeout(250);
    const R = await p.evaluate(() => { const bar = document.getElementById('bar'), i = document.querySelector('.brand img[alt="4horizon"]'), m = document.querySelector('.brand .mark'); return { over: bar.scrollWidth > bar.clientWidth + 1, logo: getComputedStyle(i).display !== 'none', mark: getComputedStyle(m).display !== 'none', markBox: Math.round(m.getBoundingClientRect().width) }; });
    ok(w + ' px: the bar fits, ' + (w >= 1000 ? 'the logo shows and the small bulb does not' : 'the small bulb (28 px) shows instead of the logo'), !R.over && (w >= 1000 ? (R.logo && !R.mark) : (!R.logo && R.mark && R.markBox === 28)), R);
    await p.context().close();
  }
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
