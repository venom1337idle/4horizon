// run-today.js: the day's tracker of the Overview (lang-47): shinies, great catches (IV 170+ or Legendary or better), valuable drops, hatched eggs,
// evolutions and new hunts, from 00:00 to 23:59, kept on this computer (it survives a restart, a new day starts empty), each thing once
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 700))); c ? pass++ : fail++; };
let seq = 700;
const cat = (p, n, name, iv, q, rarity, extra) => p.s(n, { catchEvent: Object.assign({ name, iv, max: 192, quality: q, rarity: rarity + ' \u00d7' + q, shiny: false, time: '12:' + String(seq % 60).padStart(2, '0') }, extra || {}), catchSeq: ++seq });
const rows = p => p.dash().evaluate(() => Array.from(document.querySelectorAll('#todayList .ev')).map(e => ({ kind: e.className.replace('ev ', ''), tm: e.querySelector('.when').textContent, ic: e.querySelector('.mk').textContent, tx: e.querySelector('.tx').textContent.replace(/\s+/g, ' ').trim(), title: e.querySelector('.tx').title }))).then(l => l.filter(x => !/Magikarp · IV 191/.test(x.tx)));      // (the test data's own capture, a real great catch, is left out of the counts)
const settle = p => p.waitForTimeout(1300);

(async () => {
  const b = await chromium.launch();
  let p = await open(b, { w: 1700, h: 1000 }); await feedAll(p);
  await p.evaluate(() => { if (!ui.simple) document.getElementById('btnSimple').click(); }); await p.waitForTimeout(300);
  await p.dash().evaluate(() => { localStorage.removeItem('4h.today'); location.reload(); }); await p.waitForTimeout(1500);
  const lay = await p.dash().evaluate(() => { const c = document.getElementById('todayCard'), cap = document.getElementById('capList').closest('.card'), r = c.getBoundingClientRect(), rc = cap.getBoundingClientRect();
    return { title: c.querySelector('.h span').textContent, beside: Math.abs(r.top - rc.top) < 2 && r.left > rc.right, empty: (document.querySelector('#todayList .empty') || {}).textContent || '', count: document.getElementById('todayCount').textContent }; });
  ok('a "Today · 00:00 to 23:59" card beside Latest captures', lay.title === 'Today · 00:00 to 23:59' && lay.beside, lay);
  const emptyNow = await p.dash().evaluate(() => today.items.length);
  ok('the capture the test data had already sent (Magikarp IV 191), sent again when the Summary was loaded again, is NOT taken as new', emptyNow === 0, emptyNow);
  await p.dash().evaluate(() => { today.items = []; drawToday(); });
  lay.empty = await p.dash().evaluate(() => (document.querySelector('#todayList .empty') || {}).textContent || ''); lay.count = await p.dash().evaluate(() => document.getElementById('todayCount').textContent);
  ok('...empty, it says what will show there (IV 170, Legendary, the highlight price of the Summary) and that it is kept through a restart', /^Nothing yet today\. Shinies, great catches \(IV 170 or more, or Legendary or better\), valuable drops \(worth \$10K or more each\), hatched eggs, evolutions and new hunts show here/.test(lay.empty) && /also after the app is closed and opened again\.$/.test(lay.empty) && lay.count === '', lay);
  // ---- captures
  await cat(p, 2, 'Gengar', 120, 1.2, 'Rara', { shiny: true }); await cat(p, 1, 'Magikarp', 175, 1.0, 'Comum'); await cat(p, 3, 'Rhyhorn', 74, 1.8, 'Lendária'); await cat(p, 4, 'Zubat', 150, 1.4, 'Épica'); await cat(p, 1, 'Eevee', 180, 2.9, 'Divina', { shiny: true });
  await settle(p);
  let r = await rows(p);
  ok('captures: a shiny, IV 175, a Legendary roll (IV 74) and a shiny Divine IV 180 are listed, newest first; IV 150 Épica is not', r.map(x => x.kind).join() === 'shiny,catch,catch,shiny' && /Eevee/.test(r[0].tx) && /Gengar/.test(r[3].tx), r.map(x => x.kind + ' ' + x.tx));
  ok('...each row: the time, a mark, the account and what happened', r[1].tx === 'trainer3: Great catch: Rhyhorn · IV 74/192 · Lendária ×1.8' && r[3].tx === 'trainer2: Shiny captured: Gengar · IV 120/192 · Rara ×1.2' && /^\d\d:\d\d$/.test(r[0].tm) && r[0].ic === '✦' && r[1].ic === '★', r);
  ok('...a shiny that is also a great catch is ONE row (shiny)', r.filter(x => /Eevee/.test(x.tx)).length === 1);
  ok('...the count on the card', (await p.dash().evaluate(() => document.getElementById('todayCount').textContent)) === String(await p.dash().evaluate(() => today.items.length)));
  await p.dash().evaluate(() => location.reload()); await p.waitForTimeout(1600);
  ok('the Summary loaded again (the window sends the last capture of each account again): nothing doubled, everything still there', (await rows(p)).length === 4, (await rows(p)).map(x => x.tx));
  // ---- drops (the session's totals; the highlight price of the Summary: $10K each)
  const drops = (n, sid, list) => p.s(n, { startedAt: sid, drops: list.map(([name, qty, each]) => ({ name, qty, value: qty * each })) });
  await drops(1, 9001, [['Water gem', 1, 15000], ['Small stone', 40, 20]]); await settle(p);
  ok('drops: what an account already had when first seen is not announced', (await rows(p)).length === 4);
  await drops(1, 9001, [['Water gem', 3, 15000], ['Small stone', 80, 20]]); await settle(p);
  r = await rows(p);
  ok('...2 more Water gems ($15K each) are; 40 more Small stones ($20) are not', r.length === 5 && r[0].kind === 'drop' && r[0].tx === 'trainer1: Valuable drop: Water gem ×2 · $15K each' && r[0].ic === '$', r[0]);
  await drops(1, 9002, [['Water gem', 1, 15000]]); await settle(p);
  ok('...a new hunt session starts again from what it holds (nothing announced at once)', (await rows(p)).length === 5);
  await drops(1, 9002, [['Water gem', 2, 15000]]); await settle(p);
  ok('...and announces what it gets after that', (await rows(p))[0].tx === 'trainer1: Valuable drop: Water gem ×1 · $15K each');
  // ---- evolution (a member of the team, same id, another species)
  const tm = (sp, name) => [{ id: '7', speciesId: 62, name: 'Poliwrath', level: 160, xp: 1, hp: 1, maxHp: 2, slot: 1 }, { id: '8', speciesId: sp, name, level: 76, xp: 1, hp: 1, maxHp: 2, slot: 2 }];
  await p.s(3, { teamList: tm(116, 'Horsea'), teamActiveId: '7' }); await settle(p);
  await p.s(3, { teamList: tm(117, 'Seadra'), teamActiveId: '7' }); await settle(p);
  r = await rows(p);
  ok('evolution: "Evolved: Horsea → Seadra"', r[0].kind === 'evo' && r[0].tx === 'trainer3: Evolved: Horsea → Seadra' && r[0].ic === '⇧', r[0]);
  // ---- new hunts (the trainer level)
  const U = await p.dash().evaluate(() => Math.max(...HUNT_DATA.hunts.map(x => x.unlock || 0)));          // (the hunt data of the tests is small: its highest unlock level)
  const unl = await p.dash().evaluate(u => HUNT_DATA.hunts.filter(x => x.unlock === u).map(x => x.name), U);
  await p.s(4, { level: U - 1 }); await settle(p);
  const nBefore = (await rows(p)).filter(x => x.kind === 'hunt' && / \(level /.test(x.tx) && x.tx.endsWith('(level ' + U + ')')).length;
  await p.s(4, { level: U }); await settle(p);
  r = await rows(p);
  const mine = r.filter(x => x.kind === 'hunt' && x.tx.endsWith('(level ' + U + ')'));
  ok('trainer level ' + (U - 1) + ' → ' + U + ': each hunt it opens ("New hunt unlocked: … (level ' + U + ')")', unl.length > 0 && nBefore === 0 && mine.length === Math.min(6, unl.length) && mine.some(x => x.tx === 'trainer4: New hunt unlocked: ' + unl[0] + ' (level ' + U + ')') && mine[0].ic === '⚑', [U, unl, mine]);
  // ---- eggs
  const now = await p.evaluate(() => Date.now());
  await p.s(2, { eggs: [{ id: 'e1', speciesName: 'Charmander', status: 'incubating', startedAt: now - 7 * 3600e3, readyAt: now - 3600e3 }, { id: 'e2', speciesName: 'Eevee', shiny: true, status: 'incubating', startedAt: now - 3600e3, readyAt: now + 5 * 3600e3 }] }); await settle(p);
  await p.s(2, { eggs: [{ id: 'e2', speciesName: 'Eevee', shiny: true, status: 'incubating', startedAt: now - 3600e3, readyAt: now + 5 * 3600e3 }] }); await settle(p);
  r = await rows(p);
  ok('eggs: one whose time was up and is gone from the incubator hatched ("Egg hatched: Charmander")', r[0].kind === 'egg' && r[0].tx === 'trainer2: Egg hatched: Charmander', r[0]);
  await p.s(2, { eggs: [] }); await settle(p);
  ok('...one taken out before its time is not counted as hatched', (await rows(p)).filter(x => x.kind === 'egg').length === 1);
  // ---- kept through a restart, a new day starts empty
  const before = (await rows(p)).map(x => x.tx);
  await p.dash().evaluate(() => location.reload()); await p.waitForTimeout(1600);
  ok('closed and opened again (the same day): the whole list is still there', JSON.stringify((await rows(p)).map(x => x.tx)) === JSON.stringify(before), (await rows(p)).length);
  await p.clock.setFixedTime(new Date(now + 26 * 3600e3)); await p.dash().evaluate(() => renderAll()); await p.waitForTimeout(300);
  ok('the next day: empty again', (await rows(p)).length === 0 && /^Nothing yet today/.test(await p.dash().evaluate(() => document.querySelector('#todayList .empty').textContent)));
  ok('a capture the window sends again when the Summary is loaded again on a NEW day (yesterday\u2019s last one) is not taken as today\u2019s', (await p.dash().evaluate(() => { location.reload(); return 1; })) && (await p.waitForTimeout(1600), (await rows(p)).length === 0), await rows(p));
  await p.dash().evaluate(() => { localStorage.setItem('4h.today', '{"date":"' + new Date().toISOString().slice(0, 10) + '","items":[{"t":"x"},null,{"t":1,"kind":"shiny"}],"keys":[5]}'); location.reload(); }); await p.waitForTimeout(1500);
  ok('saved data that makes no sense is left out (no error)', (await rows(p)).length === 0 && p.errors.length === 0, p.errors);
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();
  // ---- Portuguese, and a list made in English shown in Portuguese
  p = await open(b, { w: 1700, h: 1000 }); await feedAll(p);
  await p.evaluate(() => { if (!ui.simple) document.getElementById('btnSimple').click(); }); await p.waitForTimeout(300);
  await p.dash().evaluate(() => { localStorage.removeItem('4h.today'); location.reload(); }); await p.waitForTimeout(1500);
  await cat(p, 2, 'Gengar', 120, 1.2, 'Rara', { shiny: true }); await settle(p);
  await p.evaluate(() => { const s = document.getElementById('langSel'); s.value = 'pt-BR'; s.dispatchEvent(new Event('change')); }); await p.waitForTimeout(900);
  await p.dash().evaluate(() => renderAll()); await p.waitForTimeout(300);
  r = await rows(p);
  const ptTitle = await p.dash().evaluate(() => document.querySelector('#todayCard .h span').textContent);
  ok('in Portuguese: "Hoje · 00:00 às 23:59", and a row kept in English is written in Portuguese ("Shiny capturado")', ptTitle === 'Hoje · 00:00 às 23:59' && r.length === 1 && r[0].tx === 'trainer2: Shiny capturado: Gengar · IV 120/192 · Rara ×1.2', [ptTitle, r]);
  ok('no JavaScript errors (Portuguese)', p.errors.length === 0, p.errors);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
