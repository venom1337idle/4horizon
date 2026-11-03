// run-eggs.js: the incubators of the Overview (lang-44): each egg a ring that fills as it incubates (green, deeper at the start and brighter at the tip),
// the % and the time LEFT inside (6h ... 0h); only the eggs that are in an incubator, only the accounts that have one, no card when none has
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 600))); c ? pass++ : fail++; };
const H = 3600e3;
const look = p => p.dash().evaluate(() => {
  const card = document.getElementById('eggCard');
  return { shown: !card.classList.contains('hidden'), cols: Array.from(document.querySelectorAll('#eggGrid .eggcol')).map(c => ({ name: c.querySelector('.top').textContent.replace(/\s+/g, ' ').trim(),
    rings: Array.from(c.querySelectorAll('.ring')).map(r => ({ pct: r.querySelector('.in b').textContent, time: (r.querySelector('.in span') || {}).textContent || '', nm: r.querySelector('.nm').textContent, ready: r.classList.contains('ready'), title: r.title,
      p: r.querySelector('.arc').style.getPropertyValue('--p'), tip: r.querySelector('.arc').style.getPropertyValue('--tip'), w: Math.round(r.getBoundingClientRect().width), h: Math.round(r.querySelector('.dial').getBoundingClientRect().height),
      bg: getComputedStyle(r.querySelector('.arc')).backgroundImage })) })), oldBars: document.querySelectorAll('#eggGrid .egg .bar').length };
});
const green = rgb => Number((/rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(rgb) || [])[2]);

(async () => {
  const b = await chromium.launch();
  let p = await open(b, { w: 1700, h: 1000 }); await feedAll(p);
  await p.evaluate(() => { if (!ui.simple) document.getElementById('btnSimple').click(); }); await p.waitForTimeout(300);
  const now = await p.evaluate(() => Date.now());
  const egg = (id, sp, done, extra) => Object.assign({ id: String(id), speciesName: sp, status: 'incubating', startedAt: now - done * 6 * H, readyAt: now + (1 - done) * 6 * H }, extra || {});
  await p.s(1, { breedSlots: 6, eggs: [egg(1, 'Charmander', 0.25), egg(2, 'Growlithe', 0), egg(3, 'Eevee', 0.5, { shiny: true }), egg(4, 'Magnemite', 0.8), egg(5, 'Igglybuff', 0.97), egg(6, 'Torchic', 1.2, { status: 'ready' })] });
  await p.s(2, { breedSlots: 2, eggs: [egg(7, 'Rhyhorn', 0.6)] });
  await p.s(3, { breedSlots: 1, eggs: [egg(9, 'Gengar', 1, { status: 'hatched' })] });
  await p.s(4, { breedSlots: 2, eggs: [] });
  await p.waitForTimeout(1400);
  let v = await look(p);
  ok('only the accounts with an egg in an incubator: trainer1 (6/6) and trainer2 (1/2); trainer3 (its egg hatched) and trainer4 (none) are not shown', v.shown && v.cols.map(c => c.name).join('|') === 'trainer16 / 6|trainer21 / 2', v.cols.map(c => c.name));
  const r = v.cols[0].rings;
  ok('each egg is a ring (78 px), six side by side, no long bars any more', r.length === 6 && r.every(x => x.w === 78 && x.h === 78) && v.oldBars === 0, r.map(x => [x.w, x.h]));
  ok('the time counts DOWN from 6h: just started "0%, 6h 0m", a quarter "25%, 4h 30m", half "50%, 3h 0m", 97% "11m"', r[1].pct === '0%' && r[1].time === '6h 0m' && r[0].pct === '25%' && r[0].time === '4h 30m' && r[2].pct === '50%' && r[2].time === '3h 0m' && r[4].pct === '97%' && r[4].time === '11m', r.map(x => x.pct + ' ' + x.time));
  ok('the ring fills with it (its % drives the arc) and the arc goes from a deep green at the start to its tip', r[0].p === '25.0' && /conic-gradient\(rgb\(29, 107, 58\)/.test(r[0].bg), [r[0].p, r[0].bg.slice(0, 80)]);
  ok('...the tip gets brighter as the egg gets closer to hatching (green 0% < 25% < 50% < 80% < 97%)', green(r[1].tip) < green(r[0].tip) && green(r[0].tip) < green(r[2].tip) && green(r[2].tip) < green(r[3].tip) && green(r[3].tip) < green(r[4].tip), r.map(x => x.tip));
  ok('a ready egg: "100%", "ready", full ring and its own look', r[5].pct === '100%' && r[5].time === 'ready' && r[5].ready && r[5].p === '100.0' && r.filter(x => x.ready).length === 1, r[5]);
  ok('the name under each ring; a shiny one has its star; the tooltip says it all', r[0].nm === 'Charmander' && r[2].nm === '✦ Eevee' && r[0].title === 'Charmander · 25% · ready in 4h 30m' && r[2].title === '✦ Eevee · 50% · ready in 3h 0m', [r[0].nm, r[2].nm, r[0].title, r[2].title]);
  await p.clock.setFixedTime(new Date(now + 90 * 60e3)); await p.dash().evaluate(() => renderAll()); await p.waitForTimeout(200);
  v = await look(p);
  ok('an hour and a half later the rings move on by themselves (25% → 50%, 4h 30m → 3h 0m)', v.cols[0].rings[0].pct === '50%' && v.cols[0].rings[0].time === '3h 0m', v.cols[0].rings[0]);
  await p.s(1, { eggs: [] }); await p.s(2, { eggs: [egg(7, 'Rhyhorn', 1, { status: 'claimed' })] }); await p.waitForTimeout(1400);
  v = await look(p);
  ok('no egg in any incubator: the whole card is not shown', !v.shown && v.cols.length === 0, v);
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();
  // the older shape of an egg (progress / target, as in the test data): the % only
  p = await open(b, { w: 1700, h: 1000 }); await feedAll(p);
  await p.evaluate(() => { if (!ui.simple) document.getElementById('btnSimple').click(); }); await p.waitForTimeout(300);
  v = await look(p);
  ok('an egg in the older shape (60 of 100) still shows: "60%", no time, its name', v.shown && v.cols.length === 1 && v.cols[0].rings[0].pct === '60%' && v.cols[0].rings[0].time === '' && v.cols[0].rings[0].nm === 'Exeggcute', v.cols);
  ok('no JavaScript errors (older shape)', p.errors.length === 0, p.errors);
  await p.context().close();
  // Portuguese
  p = await open(b, { w: 1700, h: 1000, lang: 'pt-BR' }); await feedAll(p);
  await p.evaluate(() => { if (!ui.simple) document.getElementById('btnSimple').click(); }); await p.waitForTimeout(300);
  const n2 = await p.evaluate(() => Date.now());
  await p.s(1, { breedSlots: 2, eggs: [{ id: '1', speciesName: 'Torchic', status: 'ready', startedAt: n2 - 7 * H, readyAt: n2 - H }, { id: '2', speciesName: 'Eevee', status: 'incubating', startedAt: n2 - H, readyAt: n2 + 5 * H }] }); await p.waitForTimeout(1400);
  v = await look(p);
  const c1 = v.cols.find(c => c.rings.some(x => x.nm === 'Torchic'));
  ok('in Portuguese: "pronto" in a ready ring, "pronto em" in the tooltip', c1 && c1.rings[0].time === 'pronto' && /pronto em 5h 0m$/.test(c1.rings[1].title), c1);
  ok('no JavaScript errors (Portuguese)', p.errors.length === 0, p.errors);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
