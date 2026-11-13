// run-layout.js: everything in Settings is aligned (measured, in English and Portuguese, in a large and in a small window)
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const STUB = `window.__n = { cfg: { enabled: true, startupNotice: true, sound: true, events: { shiny: true, goodCatch: true, rareDrop: true, suppliesLow: true, stopped: true, huntUnlocked: true }, goodCatch: { minIV: 140, minQuality: 1.7, mode: 'and' }, goodCatch2: { enabled: true, minIV: 170, minQuality: 5, mode: 'or' }, rareDrop: { minValue: 10000 }, suppliesLow: { minRunwayHours: 1, minSampleMinutes: 10 }, stopped: { noKillsSeconds: 180, silentSeconds: 120 }, quietHours: { enabled: false, from: '23:00', to: '07:00', allowShiny: false } } };
  __bridgeObject.notifyGet = async () => JSON.parse(JSON.stringify(window.__n.cfg)); __bridgeObject.notifySet = async () => Object.assign(JSON.parse(JSON.stringify(window.__n.cfg)), { saved: true }); __bridgeObject.notifyTest = async () => true;
  window.__s = { cfg: { supported: true, enabled: true, hidden: false, hiddenReady: true } }; __bridgeObject.startupGet = async () => JSON.parse(JSON.stringify(window.__s.cfg)); __bridgeObject.startupSet = async () => JSON.parse(JSON.stringify(window.__s.cfg)); __bridgeObject.lightGet = async () => ({ on: false }); __bridgeObject.lightSet = async v => ({ on: v === true, saved: true }); __bridgeObject.streamerGet = async () => ({ on: false, atStart: false, needsRestart: false }); __bridgeObject.streamerSet = async v => ({ on: v === true, saved: true, atStart: false, needsRestart: v === true });`;
const measure = p => p.evaluate(() => {
  const R = e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, cy: r.top + r.height / 2 }; };
  const $ = id => document.getElementById(id);
  const ctls = Array.from(document.querySelectorAll('#settingsModal .ctl')).map(c => ({ id: (c.querySelector('[id]') || {}).id, ...R(c) }));
  const fields = id => R($(id));
  const rows = Array.from(document.querySelectorAll('#settingsModal .srow')).filter(r => r.querySelector(':scope > .ctl')).map(r => {
    const title = r.querySelector(':scope > div:first-child > b'), first = r.querySelector(':scope > .ctl').firstElementChild;
    const line = first.matches('.f') ? first.querySelector('input') : first.matches('.tick') ? first : first;
    return { name: title.firstChild.textContent.trim(), titleCy: R(title).cy, firstCy: R(line).cy };
  });
  const titleHeights = Array.from(document.querySelectorAll('#settingsModal .srow > div:first-child > b')).map(b => ({ name: b.firstChild.textContent.trim(), h: Math.round(b.getBoundingClientRect().height) }));
  const clipped = Array.from(document.querySelectorAll('#settingsModal label.f')).filter(l => l.scrollWidth > l.clientWidth + 1).map(l => l.textContent.trim());
  const dlg = R(document.querySelector('#settingsModal .dlg')), body = document.querySelector('#settingsModal .sbody');
  return { ctls, rows, titleHeights, clipped, dlg, sideways: body.scrollWidth > body.clientWidth + 1,
    A: ['nIV', 'nDrop', 'nRunway', 'nNoKills', 'nQFrom'].map(id => ({ id, ...fields(id) })), B: ['nSample', 'nSilent', 'nQTo'].map(id => ({ id, ...fields(id) })),
    mode: fields('nMode'), ivBox: fields('nIV'), qBox: fields('nQuality'),
    ticks: ['sStartup', 'sHidden', 'nEnabled', 'nQuiet', 'nQShiny', 'nSound', 'nStartup'].map(id => ({ id, ...R($(id).closest('label')) })),
    wide: ['langSel', 'nTest', 'btnDiag'].map(id => ({ id, ...R($(id)) })) };
});
const eq = (a, d) => a.every(v => Math.abs(v - a[0]) <= (d === undefined ? 1 : d));
(async () => {
  const b = await chromium.launch();
  for (const [lang, w, h] of [['en', 1400, 900], ['pt-BR', 1400, 900], ['pt-BR', 1100, 640], ['en', 1100, 640]]) {
    const tag = lang + ' ' + w + 'x' + h + ': ';
    const p = await open(b, { extraInit: STUB, lang, w, h });
    await p.click('#btnSettings'); await p.waitForTimeout(500);
    const M = await measure(p);
    ok(tag + 'all 19 control areas (lang-41: Minimize to tray; lang-49: Game panels; lang-58: Accounts; lang-67: Settings backup; 1.0.6: Disable GPU acceleration; lang-70: Great catch, 2nd rule, Light mode; lang-71: Streamer mode) have the same left edge and the same right edge', M.ctls.length === 19 && eq(M.ctls.map(c => c.l)) && eq(M.ctls.map(c => c.r)), M.ctls.map(c => [c.id, Math.round(c.l), Math.round(c.r)]));
    ok(tag + 'the first boxes (IV, Worth, Hours, No kills, From) all start at the same x and are the same width', eq(M.A.map(f => f.l)) && eq(M.A.map(f => f.w)), M.A.map(f => [f.id, Math.round(f.l), Math.round(f.w)]));
    ok(tag + 'the second boxes (Minutes, No data, Until) start exactly under the E of the AND | OR choice and are the same width as the first boxes', eq(M.B.map(f => f.l).concat([M.mode.l])) && eq(M.B.map(f => f.w).concat(M.A.map(f => f.w))), [M.mode.l, M.B.map(f => [f.id, Math.round(f.l), Math.round(f.w)])]);
    ok(tag + 'Quality is the one box to the right of the choice, 12 px after it, and ends at the right edge of the control area', Math.abs(M.qBox.l - (M.mode.r + 12)) <= 1 && Math.abs(M.qBox.r - M.ctls[0].r) <= 1, [M.mode.r, M.qBox.l, M.qBox.r, M.ctls[0].r]);
    ok(tag + 'every box is the same height (34 px) as the AND | OR choice, and the choice sits between the two boxes of its row on their line', eq(M.A.concat(M.B).map(f => f.h).concat([M.mode.h, 34])) && M.ivBox.r < M.mode.l && M.mode.r < M.qBox.l && Math.abs(M.mode.cy - M.ivBox.cy) <= 1, [M.mode, M.ivBox.r, M.qBox.l]);
    ok(tag + 'the tick boxes (Start, Enabled, Keep quiet, Shinies, Sound, Tell me) start at the left edge of the control area', M.ticks.every(t => Math.abs(t.l - M.ctls[0].l) <= 1), M.ticks.map(t => [t.id, Math.round(t.l - M.ctls[0].l)]));
    ok(tag + 'the language list and the two buttons start at the same left edge too', M.wide.every(t => Math.abs(t.l - M.ctls[0].l) <= 1) && eq(M.wide.map(t => t.w)), M.wide.map(t => [t.id, Math.round(t.l - M.ctls[0].l), Math.round(t.w)]));
    ok(tag + 'the name of each setting is on the line of its first control (within 2 px)', M.rows.length === 19 && M.rows.every(r => Math.abs(r.titleCy - r.firstCy) <= 2), M.rows.map(r => [r.name, Math.round(r.titleCy - r.firstCy)]));
    ok(tag + 'no caption is cut off above a box, and nothing makes the dialog scroll sideways', M.clipped.length === 0 && !M.sideways, [M.clipped, M.sideways]);
    const H = await p.evaluate(() => ['hxRange', 'hxAcc', 'hxCsv', 'hxToggle'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return { id, h: Math.round(r.height), cy: Math.round(r.top + r.height / 2) }; }));
    ok(tag + 'the History controls (Period, Account, Export, and the Daily totals header) are 34 px tall like every other box, and the first three are on the same line', H.every(x => x.h === 34) && Math.abs(H[0].cy - H[1].cy) <= 1 && Math.abs(H[1].cy - H[2].cy) <= 1, H);
    ok(tag + 'the dialog is narrower: 780 px at most, and no setting name wraps onto a second line', M.dlg.w <= 781 && M.titleHeights.every(t => t.h < 24), [Math.round(M.dlg.w), M.titleHeights.filter(t => t.h >= 24)]);
    ok(tag + 'the control areas are inside the dialog', M.ctls.every(c => c.r <= M.dlg.r - 10 && c.l >= M.dlg.l), [M.dlg.r, M.ctls[0].r]);
    if (w === 1400) await p.screenshot({ path: 'layout-' + lang + '.png' });
    ok(tag + 'no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  }
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
