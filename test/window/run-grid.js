// run-grid.js: the game screens fill the space (no quarter of the window left empty), in every number of screens
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const rects = p => p.evaluate(() => { const g = document.getElementById('grid').getBoundingClientRect(), cs = getComputedStyle(document.getElementById('grid'));
  const pad = parseFloat(cs.paddingLeft), gap = parseFloat(cs.columnGap);
  return { g: { l: g.left + pad, r: g.right - pad, t: g.top + pad, b: g.bottom - pad }, gap, panels: [1, 2, 3, 4].map(n => { const e = document.getElementById('panel' + n), r = e.getBoundingClientRect(); return { n, shown: e.style.display !== 'none' && !!e.offsetParent, l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => x.shown) }; });
const area = R => R.panels.reduce((s, x) => s + x.w * x.h, 0), total = R => Math.round((R.g.r - R.g.l) * (R.g.b - R.g.t));
const near = (a, b, d) => Math.abs(a - b) <= (d === undefined ? 1 : d);
const pill = (p, n) => p.click('.pill[data-panel="' + n + '"]');
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1500, 950], [1100, 700]]) {
    const p = await open(b, { w, h }); await p.waitForTimeout(500);
    const tag = w + 'x' + h + ': ';
    let R = await rects(p);
    ok(tag + 'four screens: a 2 x 2 grid, as before (same size, aligned)', R.panels.length === 4 && near(R.panels[0].w, R.panels[1].w, 2) && near(R.panels[0].h, R.panels[2].h, 2) && near(R.panels[0].t, R.panels[1].t) && near(R.panels[0].l, R.panels[2].l), R.panels);
    const sp = await p.evaluate(() => { const r = n => document.getElementById('panel' + n).getBoundingClientRect(), g = getComputedStyle(document.getElementById('grid')); return { pad: g.paddingTop, gap: g.columnGap, left: Math.round(r(1).left), top: Math.round(r(1).top - document.getElementById('grid').getBoundingClientRect().top), right: Math.round(innerWidth - r(2).right), bottom: Math.round(innerHeight - r(3).bottom), between: Math.round(r(2).left - r(1).right), betweenV: Math.round(r(3).top - r(1).bottom) }; });
    ok(tag + 'little space around the screens (4 px at the window edges and under the top bar) and 6 px between them', sp.pad === '4px' && sp.gap === '6px' && sp.left === 4 && sp.top === 4 && sp.right === 4 && sp.bottom === 4 && sp.between === 6 && sp.betweenV === 6, sp);
    await p.click('#btnPanel'); await p.waitForTimeout(400);
    const side = await p.evaluate(() => { const d = document.getElementById('dash').getBoundingClientRect(), r = document.getElementById('panel1').getBoundingClientRect(); return { sideRight: Math.round(d.right), panelLeft: Math.round(r.left), gap: Math.round(r.left - d.right), top: Math.round(r.top - document.getElementById('grid').getBoundingClientRect().top), right: Math.round(innerWidth - document.getElementById('panel2').getBoundingClientRect().right) }; });
    ok(tag + 'with the Summary beside the screens: 4 px between the Summary and the first screen, and 4 px at the other edges', side.gap === 4 && side.top === 4 && side.right === 4, side);
    await p.click('#btnPanel'); await p.waitForTimeout(300);
    await pill(p, 1); await p.waitForTimeout(250); R = await rects(p);
    const [a, c, d] = R.panels;
    ok(tag + 'three screens (account 1 hidden): two on top, side by side and the same size', R.panels.length === 3 && near(a.t, c.t) && near(a.w, c.w, 2) && near(a.h, c.h, 2) && a.r < c.l, R.panels);
    ok(tag + '...and the third goes across the whole bottom, from the left edge of the first to the right edge of the second', near(d.l, a.l) && near(d.r, c.r) && d.t >= a.b, [a, c, d]);
    ok(tag + '...it reaches the bottom of the grid, the top screens reach the top, and the rows are the same height', near(d.b, R.g.b, 2) && near(a.t, R.g.t, 2) && near(a.h, d.h, 2), [R.g, a.h, d.h]);
    ok(tag + '...so the three screens use the whole area (nothing but the 10 px gaps is left)', area(R) >= total(R) - (R.g.r - R.g.l) * R.gap - (R.g.b - R.g.t) * R.gap - 10, [area(R), total(R)]);
    await pill(p, 1); await p.waitForTimeout(150); await pill(p, 2); await p.waitForTimeout(250); R = await rects(p);
    ok(tag + 'three screens with another one hidden (account 2): same layout, the last of the three is the wide one', R.panels.length === 3 && R.panels.map(x => x.n).join() === '1,3,4' && near(R.panels[2].l, R.panels[0].l) && near(R.panels[2].r, R.panels[1].r), R.panels);
    await pill(p, 3); await p.waitForTimeout(250); R = await rects(p);
    ok(tag + 'two screens: side by side, each the whole height', R.panels.length === 2 && near(R.panels[0].h, R.g.b - R.g.t, 2) && near(R.panels[0].w, R.panels[1].w, 2), R.panels);
    ok(tag + '...and there is no leftover grid column on the wide panel when one is shown again (the wide panel goes back to normal)', await p.evaluate(() => [1, 2, 3, 4].every(n => document.getElementById('panel' + n).style.gridColumn === '')), 0);
    await pill(p, 4); await p.waitForTimeout(250); R = await rects(p);
    ok(tag + 'one screen: it takes the whole grid', R.panels.length === 1 && near(R.panels[0].w, R.g.r - R.g.l, 2) && near(R.panels[0].h, R.g.b - R.g.t, 2), R.panels);
    await pill(p, 2); await pill(p, 3); await pill(p, 4); await p.waitForTimeout(250); await pill(p, 1); await p.waitForTimeout(250);
    // expand one (the button of the panel) and go back
    await p.click('#panel2 .ex'); await p.waitForTimeout(250); R = await rects(p);
    ok(tag + 'expanding a screen: only that one, filling the grid; the wide panel setting of the other layout is gone', R.panels.length === 1 && R.panels[0].n === 2 && near(R.panels[0].w, R.g.r - R.g.l, 2) && near(R.panels[0].h, R.g.b - R.g.t, 2), R.panels);
    await p.click('#panel2 .ex'); await p.waitForTimeout(250); R = await rects(p);
    ok(tag + 'going back brings the layout that there was (' + R.panels.length + ' screens)', R.panels.length >= 3 && R.panels.length <= 4, R.panels.length);
    ok(tag + 'no JavaScript errors', p.errors.length === 0, p.errors);
    await p.context().close();
  }
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
