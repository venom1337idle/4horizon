// run-today-row.js (lang-71): the Overview's Today row (today's totals of every account, from the daily history) and the shinies of all time (the game's Perfil) in the Summary
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const H = 3600000;
// today's history as history.js keeps it: per character, gold = loot + captures sold - supplies
const ROWS = {
  venom: { kills: 8000, xp: 250e6, captures: 60, shiny: 0, shinyKills: 50, loot: 5.5e6, capture: 0.5e6, supplies: 0.6e6, ms: 3 * H },
  venom2: { kills: 7000, xp: 200e6, captures: 50, shiny: 0, shinyKills: 40, loot: 4.5e6, capture: 0.3e6, supplies: 0.7e6, ms: 3 * H },
  venom3: { kills: 7613, xp: 150e6, captures: 50, shiny: 0, shinyKills: 30, loot: 2.5e6, capture: 0.2e6, supplies: 0.5e6, ms: 3 * H },
  venom4: { kills: 5000, xp: 79e6, captures: 36, shiny: 0, shinyKills: 18, loot: 1.5e6, capture: 0.1e6, supplies: 0.3e6, ms: 2 * H + 37 * 60000 }
};
const STUB = rows => `window.__hist = { calls: 0 }; const __d = new Date(), __p = n => (n < 10 ? '0' : '') + n, __today = __d.getFullYear() + '-' + __p(__d.getMonth() + 1) + '-' + __p(__d.getDate());
  __bridgeObject.getHistory = async () => { window.__hist.calls++; return { days: { [__today]: ${JSON.stringify(rows)} }, today: __today, now: Date.now() }; };`;
const row = fr => fr.evaluate(() => { const el = document.getElementById('todayRow'); if (!el || el.classList.contains('hidden')) return null; const R = e => e.getBoundingClientRect();
  return { title: el.querySelector('.th').firstChild.textContent.trim(), sub: el.querySelector('.th .sub').textContent, boxes: Array.from(el.querySelectorAll('.tc')).map(b => ({ v: b.querySelector('.v').textContent.replace(/\s+/g, ' ').trim(), l: b.querySelector('.l').textContent.trim(), s: b.querySelector('.s').textContent.trim(), tip: b.getAttribute('title'), x: Math.round(R(b).left), w: Math.round(R(b).width), align: getComputedStyle(b).textAlign })),
    kpis: Array.from(document.querySelectorAll('#kpis .kpi')).map(k => ({ x: Math.round(R(k).left), w: Math.round(R(k).width) })), top: Math.round(R(el).top), bottom: Math.round(R(el).bottom), kpiTop: Math.round(R(document.getElementById('kpis')).top), tabsBottom: Math.round(R(document.getElementById('topTabs')).bottom),
    expect: new Date().toLocaleDateString(I18N.locale(), { weekday: 'short', day: 'numeric', month: 'short' }) }; });
(async () => {
  const b = await chromium.launch();
  const showOverview = pg => pg.evaluate(() => { if (!ui.simple) document.getElementById('btnSimple').click(); });          // (the Overview is on screen in Simple)
  let p = await open(b, { extraInit: STUB(ROWS), w: 1600, h: 1000 }); await feedAll(p); await showOverview(p); await p.waitForTimeout(400);
  let fr = p.dash(); let R = await row(fr);
  ok('the Overview has the Today row, asked for from the history at the start', R && (await p.evaluate(() => window.__hist.calls)) >= 1, R);
  ok('...between the Overview button and the live cards', R && R.top > R.tabsBottom && R.bottom <= R.kpiTop, R && [R.tabsBottom, R.top, R.bottom, R.kpiTop]);
  ok('the title is "Today · " and today\u2019s date ("' + (R && R.expect) + '"), with what it counts', R.title === 'Today \u00b7 ' + R.expect && /00:00 to now · all accounts · counted even while 4horizon is in the tray/.test(R.sub), [R.title, R.sub]);
  ok('six boxes, centred, in the same columns as the six live cards below', R.boxes.length === 6 && R.boxes.every((x, i) => Math.abs(x.x - R.kpis[i].x) <= 1 && Math.abs(x.w - R.kpis[i].w) <= 1) && R.boxes.every(x => x.align === 'center'), [R.boxes.map(x => [x.x, x.w]), R.kpis]);
  const B = l => R.boxes.find(x => x.l === l) || {};
  ok('Net gold: 5.5+0.5-0.6 + 4.5+0.3-0.7 + 2.5+0.2-0.5 + 1.5+0.1-0.3 = +13.0M, and the average per hour of each account added up (5.4M/3h + 4.1M/3h + 2.2M/3h + 1.3M/2.62h = +4.4M/h)', B('Net gold').v === '+13M' && B('Net gold').s === '+4.4M/h', B('Net gold'));
  ok('XP 679M (83.3M/h + 66.7M/h + 50M/h + 30.2M/h = 230M/h)', B('XP').v === '679M' && B('XP').s === '230M/h', B('XP'));
  ok('Kills 27,613 and Captures 196, each with its average per hour', B('Kills').v === '27,613' && /\/h$/.test(B('Kills').s) && B('Captures').v === '196' && /\/h$/.test(B('Captures').s), [B('Kills'), B('Captures')]);
  ok('Shiny captured / encountered: "0 / 138" (the game\u2019s shinies met: 50 + 40 + 30 + 18)', B('Shiny captured / encountered').v === '0 / 138', B('Shiny captured / encountered'));
  ok('Hunted: 3 h + 3 h + 3 h + 2 h 37 min = "11h 37m", "4 accounts"', B('Hunted').v === '11h 37m' && B('Hunted').s === '4 accounts', B('Hunted'));
  ok('the pointer on a box shows each account\u2019s share, the biggest first ("venom: +5.4M ...")', /^venom: \+5\.4M\nvenom2: \+4\.1M\nvenom3: \+2\.2M\nvenom4: \+1\.3M$/.test(B('Net gold').tip || '') && /venom4: 2h 37m/.test(B('Hunted').tip || ''), [B('Net gold').tip, B('Hunted').tip]);
  const kpi = await fr.evaluate(() => Array.from(document.querySelectorAll('#kpis .kpi .l')).map(e => e.textContent.trim()));
  ok('the live cards below are unchanged', JSON.stringify(kpi) === JSON.stringify(['Net gold/h', 'Total XP/h', 'Kills/h', 'Captures (session)', 'Shiny captured', 'Active accounts']), kpi);
  // a day of before 1.0.9: no shinies met in the history
  await fr.evaluate(() => { const d = new Date(), p = n => (n < 10 ? '0' : '') + n; window.postMessage({ type: 'today-totals', day: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()), rows: { venom: { kills: 10, xp: 5, captures: 1, shiny: 1, loot: 100, capture: 0, supplies: 0, ms: 60000 } } }, '*'); }); await p.waitForTimeout(200); R = await row(fr);
  ok('a day without the shinies met (saved before 1.0.9): "1 / —", and the tooltip says from when they are counted', R.boxes[4].v === '1 / \u2014' && /counted from version 1\.0\.9 on/.test(R.boxes[4].tip), R.boxes[4]);
  ok('...one account: "1 account", and too little time for an average per hour (nothing under the numbers)', R.boxes[5].s === '1 account' && R.boxes[0].s === '', [R.boxes[5], R.boxes[0]]);
  await fr.evaluate(() => { const d = new Date(), p = n => (n < 10 ? '0' : '') + n; window.postMessage({ type: 'today-totals', day: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()), rows: {} }, '*'); }); await p.waitForTimeout(200); R = await row(fr);
  ok('nothing hunted yet today: zeros, nothing breaks', R && R.boxes[0].v === '+0' && R.boxes[5].v === '0h 0m' && R.boxes[5].s === '0 accounts', R && R.boxes.map(x => x.v));
  await fr.evaluate(() => window.postMessage({ type: 'today-totals', day: 'not a day', rows: {} }, '*')); await p.waitForTimeout(150);
  ok('an odd message (not a day) is ignored', (await row(fr)) !== null);
  // the window asks again when it shows again
  const c0 = await p.evaluate(() => window.__hist.calls);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(200);
  ok('the window shows again (from the tray): today\u2019s totals are asked for at once', (await p.evaluate(() => window.__hist.calls)) === c0 + 1);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); }); const c1 = await p.evaluate(() => window.__hist.calls);
  await p.evaluate(() => pushToday()); ok('while the window is hidden nothing is asked for', (await p.evaluate(() => window.__hist.calls)) === c1);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });

  // ---- the shinies of all time in the Summary
  await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(300);
  const sel = () => fr.evaluate(() => { selected = 'sum'; renderAll(); });
  await sel(); const tile0 = await fr.evaluate(() => document.querySelector('#sideBody .grid4 .stat:nth-child(4) .l').textContent.trim());
  ok('before any Perfil was opened: the 4th box is still "Balls at shinies" (this session) and the cards show this session', tile0 === 'Balls at shinies', tile0);
  const hint = await fr.evaluate(() => document.querySelectorAll('.acard')[1].querySelector('.ln.dim span').getAttribute('title'));
  ok('...and the pointer on a card\u2019s shiny line says to open Perfil once in the game', /Open Perfil once in the game on this account/.test(hint || ''), hint);
  await p.s(2, { shinyAll: { caught: 5, balls: 512, at: Date.now(), sinceCaught: 0, sinceBalls: 0 } }); await p.waitForTimeout(250); await sel();
  const card = await fr.evaluate(() => { const s = document.querySelectorAll('.acard')[1].querySelector('.ln.dim .sall'); return s ? { txt: s.textContent.replace(/\s+/g, ' ').trim(), tip: s.getAttribute('title') } : null; });
  ok('Perfil opened on account 2: its card shows "✦ 5 / 512 all time"', card && card.txt === '\u2726 5 / 512 all time', card);
  ok('...the tooltip: the all-time numbers, "1 shiny per 102 balls", and this session', card && /5 shinies captured, 512 balls spent at shinies, 1 shiny per 102 balls\./.test(card.tip) && /This session: \d+ captured, \d+ thrown\./.test(card.tip), card && card.tip);
  await p.s(4, { shinyAll: { caught: 8, balls: 1378, at: Date.now(), sinceCaught: 0, sinceBalls: 0 } }); await p.waitForTimeout(250); await sel();
  const tile = await fr.evaluate(() => { const s = document.querySelector('#sideBody .grid4 .stat:nth-child(4)'); return { v: s.querySelector('.v').textContent.trim(), l: s.querySelector('.l').textContent.trim(), tip: s.getAttribute('title') }; });
  ok('the 4th box of the Session: "13/1.9K" (5 + 8 captured, 512 + 1,378 balls; short, no comma), "Shinies all time"', tile.v === '13/1.9K' && tile.l === 'Shinies all time', tile);
  ok('...its tooltip: 1 shiny per 145 balls, and that 2 of 4 accounts are counted (open Perfil on the others)', /1 shiny per 145 balls/.test(tile.tip) && /2 of 4 accounts: open Perfil once in the game on the others/.test(tile.tip), tile.tip);
  const fit = await fr.evaluate(() => { const v = document.querySelector('#sideBody .grid4 .stat:nth-child(4) .v'); return v.scrollWidth <= v.clientWidth + 1; });
  ok('...and the number fits in its box', fit);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // ---- Portuguese
  p = await open(b, { extraInit: STUB(ROWS), w: 1600, h: 1000, lang: 'pt-BR' }); await feedAll(p); await showOverview(p); await p.waitForTimeout(400); fr = p.dash(); R = await row(fr);
  ok('in Portuguese: "Hoje · " and the date in Portuguese ("' + (R && R.expect) + '"), "Ouro líquido", "Shiny capturados / encontrados", "Caçado", "4 contas"', R && R.title === 'Hoje \u00b7 ' + R.expect && R.boxes[0].l === 'Ouro líquido' && R.boxes[4].l === 'Shiny capturados / encontrados' && R.boxes[5].l === 'Caçado' && R.boxes[5].s === '4 contas', R && [R.title, R.boxes.map(x => x.l + ' ' + x.s)]);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // ---- an older main process without the history: no row
  p = await open(b, { extraInit: 'delete __bridgeObject.getHistory;', w: 1600, h: 1000 }); await feedAll(p); await showOverview(p); await p.waitForTimeout(300);
  ok('an app without the history (no getHistory): the row is not shown, the live cards are', (await row(p.dash())) === null && (await p.dash().evaluate(() => document.querySelectorAll('#kpis .kpi').length)) === 6);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
