// run-panel-look.js: the four game panels look like the boxes of the calibration plan (dark navy inside, the colour of the account on the lines)
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const PAL = [['orchid', '#ecbafe'], ['cornflower', '#5995fb'], ['teal', '#05d6bd'], ['rose', '#f46683']];
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// "rgb(1, 2, 3)", "rgba(1, 2, 3, .5)" or "color(srgb 0.1 0.2 0.3 / 0.6)" -> [r, g, b, a]
const parse = c => { let m = /^rgba?\(([^)]+)\)$/.exec(c); if (m) { const v = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; }
  m = /^color\(srgb ([^)]+)\)$/.exec(c); if (m) { const v = m[1].split(/[ \/]+/).filter(Boolean).map(Number); return [v[0] * 255, v[1] * 255, v[2] * 255, v.length > 3 ? v[3] : 1]; } return null; };
const near = (a, b, d) => a && b && Math.abs(a[0] - b[0]) <= d && Math.abs(a[1] - b[1]) <= d && Math.abs(a[2] - b[2]) <= d;
(async () => {
  const b = await chromium.launch();
  for (const lang of ['en', 'pt-BR']) {
    const p = await open(b, { lang, w: 1500, h: 950 });
    await p.waitForTimeout(500);
    const info = await p.evaluate(() => [1, 2, 3, 4].map(n => { const el = document.getElementById('panel' + n), h = el.querySelector('.phead'), cs = getComputedStyle(el), hs = getComputedStyle(h), bt = h.querySelector('button.rl');
      return { n, vis: !!el.offsetParent, bl: cs.borderLeftWidth, blc: cs.borderLeftColor, bt: cs.borderTopWidth, btc: cs.borderTopColor, br: cs.borderRightWidth, brc: cs.borderRightColor, bb: cs.borderBottomWidth, rad: cs.borderTopLeftRadius, bg: cs.backgroundColor,
        hbg: hs.backgroundColor, hbgImg: hs.backgroundImage, htop: hs.borderTopWidth, hbot: hs.borderBottomColor, hbotW: hs.borderBottomWidth, btnBg: bt ? getComputedStyle(bt).backgroundColor : null }; }));
    const line = parse(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--line').trim() ? (() => { const d = document.createElement('i'); d.style.color = getComputedStyle(document.documentElement).getPropertyValue('--line'); document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; })() : 'rgb(31, 42, 77)'));
    const tag = lang + ': ';
    ok(tag + 'the four panels are on screen', info.every(i => i.vis), info.map(i => i.vis));
    ok(tag + 'the line at the TOP of each panel is 3 px, in the colour of its account (orchid, cornflower, teal, rose)', info.every((i, k) => i.bt === '3px' && near(parse(i.btc), hex(PAL[k][1]), 1)), info.map(i => [i.n, i.bt, i.btc]));
    ok(tag + 'the left, right and bottom edges are the thin neutral outline (1 px, the page line colour): nothing coloured on the left any more', info.every(i => i.bl === '1px' && i.br === '1px' && i.bb === '1px' && near(parse(i.blc), line, 1) && near(parse(i.brc), line, 1)), info.map(i => [i.bl, i.blc, i.br, i.brc]));
    ok(tag + 'the corners are a bit less round than before (6 px)', info.every(i => i.rad === '6px'), info.map(i => i.rad));
    ok(tag + 'inside is dark navy (#0c1222) in the panel and in its header, and the header is flat (no gradient, no coloured top band)', info.every(i => near(parse(i.bg), [12, 18, 34], 1) && near(parse(i.hbg), [12, 18, 34], 1) && i.hbgImg === 'none' && i.htop === '0px'), info.map(i => [i.bg, i.hbg, i.hbgImg, i.htop]));
    ok(tag + 'the line under the header is 1 px in the colour of the account', info.every((i, k) => { const c = parse(i.hbot); return i.hbotW === '1px' && c && near(c, hex(PAL[k][1]), 2) && c[3] > 0.4 && c[3] < 0.8; }), info.map(i => [i.hbotW, i.hbot]));
    ok(tag + 'the buttons of the header can be seen on the dark header (a light tint, not black)', info.every(i => { const c = parse(i.btnBg); return c && c[0] === 255 && c[3] > 0.04 && c[3] < 0.2; }), info.map(i => i.btnBg));
    if (lang === 'en') await p.screenshot({ path: 'panel-look.png', clip: { x: 0, y: 40, width: 1500, height: 330 } });
    ok(tag + 'no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  }
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
