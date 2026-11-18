// run-layout.js (lang-74): everything in Settings is aligned (measured, in English and Portuguese, in a large and in a small window).
// The dialog is six cards: Game & accounts · Startup & tray · Display (three side by side), Notifications (its switches in the header; Great catch and the
// Simple alerts side by side; Valuable drop, Supplies running low and Account stopped side by side; Quiet hours), History, Diagnostics.
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 700))); c ? pass++ : fail++; };
const STUB = `window.__n = { cfg: { enabled: true, startupNotice: true, sound: true, events: { shiny: true, goodCatch: true, rareDrop: true, suppliesLow: true, stopped: true, huntUnlocked: true }, goodCatch: { minIV: 140, minQuality: 1.7, mode: 'and' }, goodCatch2: { enabled: true, minIV: 170, minQuality: 5, mode: 'or' }, rareDrop: { minValue: 10000 }, suppliesLow: { minRunwayHours: 1, minSampleMinutes: 10 }, stopped: { noKillsSeconds: 180, silentSeconds: 120 }, quietHours: { enabled: false, from: '23:00', to: '07:00', allowShiny: false } } };
  __bridgeObject.notifyGet = async () => JSON.parse(JSON.stringify(window.__n.cfg)); __bridgeObject.notifySet = async () => Object.assign(JSON.parse(JSON.stringify(window.__n.cfg)), { saved: true }); __bridgeObject.notifyTest = async () => true;
  window.__s = { cfg: { supported: true, enabled: true, hidden: false, hiddenReady: true, toTray: false } }; __bridgeObject.startupGet = async () => JSON.parse(JSON.stringify(window.__s.cfg)); __bridgeObject.startupSet = async () => JSON.parse(JSON.stringify(window.__s.cfg)); __bridgeObject.lightGet = async () => ({ on: false }); __bridgeObject.lightSet = async v => ({ on: v === true, saved: true }); __bridgeObject.streamerGet = async () => ({ on: false, atStart: false, needsRestart: false }); __bridgeObject.streamerSet = async v => ({ on: v === true, saved: true, atStart: false, needsRestart: v === true });`;
const measure = p => p.evaluate(() => {
  const R = e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, cy: r.top + r.height / 2 }; };
  const $ = id => document.getElementById(id), all = s => Array.from(document.querySelectorAll(s));
  const cards3 = ['cGame', 'cStart', 'cDisplay'].map(id => ({ id, ...R($(id)) }));
  const boxes = all('#settingsModal .card select, #settingsModal .card button:not(.chead > button), #settingsModal .f input, #settingsModal input[type=time]').filter(e => e.offsetParent).map(e => ({ id: e.id || e.textContent.trim().slice(0, 20), h: Math.round(R(e).h) }));
  const sw = all('#settingsModal .srow.sw').filter(r => r.offsetParent).map(r => { const i = r.querySelector('input'), l = r.querySelector('label'); return { id: i.id, sw: [Math.round(R(i).w), Math.round(R(i).h)], dcy: Math.round(R(i).cy - R(l).cy), lh: Math.round(R(l).h), lines: Math.round(R(l).h / 16) }; });
  const head = ['nEnabled', 'nSound', 'nStartup', 'nTest'].map(id => ({ id, cy: Math.round(R($(id)).cy), r: Math.round(R($(id)).r) }));
  const headTitle = R(document.querySelector('#cNotif .sh'));
  const rule = ids => ids.map(id => ({ id, ...R($(id)) }));
  const r1 = rule(['nIV', 'nMode', 'nQuality']), r2 = rule(['nIV2', 'nMode2', 'nQuality2']);
  const three = ['nDrop', 'nRunway', 'nNoKills'].map(id => ({ id, ...R($(id).closest('.sub')) }));
  const subs = all('#cNotif .sub').map(s => ({ id: s.id || (s.querySelector('input') || {}).id || s.className, l: Math.round(R(s).l), r: Math.round(R(s).r) }));
  const clipped = all('#settingsModal label.f').filter(l => l.offsetParent && l.scrollWidth > l.clientWidth + 1).map(l => l.textContent.trim());
  const dlg = R(document.querySelector('#settingsModal .dlg')), body = document.querySelector('#settingsModal .sbody'), bodyR = R(body);
  const inside = all('#settingsModal .card').map(c => ({ id: c.id, l: Math.round(R(c).l), r: Math.round(R(c).r) }));
  const names = all('#settingsModal .srow b, #settingsModal .srow > label:not(.f), #settingsModal .sh').filter(e => e.offsetParent).map(e => ({ t: e.textContent.trim().slice(0, 30), h: Math.round(R(e).h) }));
  const quiet = ['nQuiet', 'nQFrom', 'nQTo', 'nQShiny'].map(id => ({ id, cy: Math.round(R($(id)).cy), l: Math.round(R($(id)).l) }));
  const flds = all('#settingsModal .srow.fld').filter(r => r.offsetParent).map(r => { const b = r.querySelector('b'), s = r.querySelector('select'); return { id: s.id, dl: Math.round(R(s).l - R(b).l), full: Math.abs(R(s).r - R(r).r) <= 1 && Math.abs(R(s).l - R(r).l) <= 1 }; });
  const hist = ['hxRange', 'hxAcc', 'hxCsv', 'hxToggle'].map(id => { const e = $(id); return { id, h: e ? Math.round(R(e).h) : null, cy: e ? Math.round(R(e).cy) : null }; });
  return { cards3, boxes, sw, head, headTitle: Math.round(headTitle.cy), r1, r2, three, subs, clipped, dlg: { w: Math.round(dlg.w), l: dlg.l, r: dlg.r }, sideways: body.scrollWidth > body.clientWidth + 1, inside, names, quiet, flds, hist, bodyR: { l: Math.round(bodyR.l), r: Math.round(bodyR.r) } };
});
const eq = (a, d) => a.every(v => Math.abs(v - a[0]) <= (d === undefined ? 1 : d));
(async () => {
  const b = await chromium.launch();
  for (const [lang, w, h] of [['en', 1400, 900], ['pt-BR', 1400, 900], ['pt-BR', 1100, 640], ['en', 1100, 640]]) {
    const tag = lang + ' ' + w + 'x' + h + ': ';
    const p = await open(b, { extraInit: STUB, lang, w, h });
    await p.click('#btnSettings'); await p.waitForTimeout(500);
    const M = await measure(p);
    ok(tag + 'the three top cards (Game & accounts, Startup & tray, Display) are side by side, the same width and the same height, on one line', eq(M.cards3.map(c => c.w)) && eq(M.cards3.map(c => c.h)) && eq(M.cards3.map(c => c.t)) && M.cards3[0].r <= M.cards3[1].l && M.cards3[1].r <= M.cards3[2].l, M.cards3.map(c => [c.id, Math.round(c.w), Math.round(c.h)]));
    ok(tag + 'every list, button and number box of the cards is 34 px tall (' + M.boxes.length + ' of them)', M.boxes.length >= 20 && M.boxes.every(x => x.h === 34), M.boxes.filter(x => x.h !== 34));
    ok(tag + 'every switch is the same pill (34 x 18), on the line of its name (within 2 px), and no name of a switch wraps onto more than two lines', M.sw.length >= 8 && M.sw.every(s => s.sw[0] === 34 && s.sw[1] === 18 && Math.abs(s.dcy) <= 2 && s.lh < 40), M.sw.filter(s => !(s.sw[0] === 34 && s.sw[1] === 18 && Math.abs(s.dcy) <= 2 && s.lh < 40)));
    ok(tag + 'the header of Notifications: its title, the three switches and "Send test" on one line, inside the card', eq(M.head.map(x => x.cy).concat([M.headTitle]), 3) && M.head.every(x => x.r <= M.inside.find(c => c.id === 'cNotif').r), [M.headTitle, M.head]);
    ok(tag + 'Great catch: IV, AND | OR and Quality on one line, 34 px each; Rule 2 in the same three columns under them', eq(M.r1.map(x => x.cy)) && M.r1.every(x => Math.round(x.h) === 34) && M.r1[0].r <= M.r1[1].l && M.r1[1].r <= M.r1[2].l && M.r2.every((x, i) => Math.abs(x.l - M.r1[i].l) <= 1 && Math.abs(x.w - M.r1[i].w) <= 1) && M.r2[0].t > M.r1[0].b, [M.r1.map(x => [Math.round(x.l), Math.round(x.w)]), M.r2.map(x => [Math.round(x.l), Math.round(x.w)])]);
    ok(tag + 'Valuable drop, Supplies running low and Account stopped: three cards side by side, the same width, on one line', eq(M.three.map(x => x.w)) && eq(M.three.map(x => x.t)) && M.three[0].r <= M.three[1].l && M.three[1].r <= M.three[2].l, M.three.map(x => [x.id, Math.round(x.l), Math.round(x.w)]));
    ok(tag + 'Quiet hours: the switch, the two times and "Shinies still notify" on one line, the tick box at the right end', eq(M.quiet.map(x => x.cy), 2) && M.quiet[0].l < M.quiet[1].l && M.quiet[1].l < M.quiet[2].l && M.quiet[2].l < M.quiet[3].l, M.quiet);
    ok(tag + 'a list (Game panels, Language, Mini screens, Fit) fills the width of its field, under its name', M.flds.length === 4 && M.flds.every(f => f.full && f.dl === 0), M.flds);
    ok(tag + 'no caption is cut off above a box, nothing makes the dialog scroll sideways, and every card is inside the dialog', M.clipped.length === 0 && !M.sideways && M.inside.every(c => c.l >= M.bodyR.l && c.r <= M.bodyR.r), [M.clipped, M.sideways, M.inside, M.bodyR]);
    ok(tag + 'no name of a setting or card wraps onto more than two lines', M.names.every(n => n.h < 40), M.names.filter(n => n.h >= 40));
    ok(tag + 'the History controls (Period, Account, Export, and the Daily totals header) are 34 px tall like every other box, and the first three are on the same line', M.hist.every(x => x.h === 34) && Math.abs(M.hist[0].cy - M.hist[1].cy) <= 1 && Math.abs(M.hist[1].cy - M.hist[2].cy) <= 1, M.hist);
    ok(tag + 'the dialog is 820 px wide at most', M.dlg.w <= 821, M.dlg.w);
    if (w === 1400) await p.screenshot({ path: 'layout-' + lang + '.png' });
    ok(tag + 'no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  }
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
