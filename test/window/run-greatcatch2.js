// run-greatcatch2.js (lang-70): Settings › Notifications › "Great catch, 2nd rule": a second combination of IV / AND-OR / quality, with its own "Active" box
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const STUB = (withRule2) => `
  window.__n = { cfg: { enabled: true, startupNotice: true, sound: true, events: { shiny: true, goodCatch: true, rareDrop: true, suppliesLow: true, stopped: true, huntUnlocked: true },
    goodCatch: { minIV: 175, minQuality: 1.7, mode: 'or' }, ${withRule2 ? "goodCatch2: { enabled: false, minIV: 170, minQuality: 5, mode: 'or' }," : ''} rareDrop: { minValue: 10000 }, suppliesLow: { minRunwayHours: 1, minSampleMinutes: 10 }, stopped: { noKillsSeconds: 180, silentSeconds: 120 }, quietHours: { enabled: false, from: '23:00', to: '07:00', allowShiny: false } }, calls: [] };
  const LIM = { 'goodCatch.minIV': [0, 200, 0], 'goodCatch.minQuality': [0, 5, 2], 'goodCatch2.minIV': [0, 200, 0], 'goodCatch2.minQuality': [0, 5, 2] };
  __bridgeObject.notifyGet = async () => JSON.parse(JSON.stringify(window.__n.cfg));
  __bridgeObject.notifySet = async p => {                      // what the main process does (notify.js)
    window.__n.calls.push(JSON.parse(JSON.stringify(p))); const c = window.__n.cfg;
    ['goodCatch', 'goodCatch2'].forEach(g => { if (c[g] && p[g] && (p[g].mode === 'and' || p[g].mode === 'or')) c[g].mode = p[g].mode; });
    if (c.goodCatch2 && p.goodCatch2 && typeof p.goodCatch2.enabled === 'boolean') c.goodCatch2.enabled = p.goodCatch2.enabled;
    Object.keys(LIM).forEach(key => { const [g, f] = key.split('.'); if (c[g] && p[g] && typeof p[g][f] === 'number') { const l = LIM[key], m = Math.pow(10, l[2]); c[g][f] = Math.round(Math.min(l[1], Math.max(l[0], p[g][f])) * m) / m; } });
    return Object.assign(JSON.parse(JSON.stringify(c)), { saved: true });
  };
  __bridgeObject.notifyTest = async () => true;`;
const last = p => p.evaluate(() => JSON.stringify(window.__n.calls.slice(-1)[0]));
const setNum = async (p, id, v) => { await p.fill('#' + id, String(v)); await p.press('#' + id, 'Tab'); await p.waitForTimeout(100); };
const row = p => p.evaluate(() => { const r = document.getElementById('nGc2Row'), v = id => document.getElementById(id).value;
  return { shown: !r.classList.contains('hidden') && r.getBoundingClientRect().height > 0, title: r.querySelector('b').textContent.trim(), active: document.getElementById('nGc2On').checked, iv: v('nIV2'), q: v('nQuality2'),
    mode: Array.from(document.querySelectorAll('#nMode2 input')).filter(x => x.checked).map(x => x.value).join(), mode1: Array.from(document.querySelectorAll('#nMode input')).filter(x => x.checked).map(x => x.value).join(),
    dim: getComputedStyle(r.querySelector('.f')).opacity, words: Array.from(document.querySelectorAll('#nMode2 label')).map(l => l.textContent.trim()), tick: document.getElementById('nGc2On').closest('label').textContent.trim(), tip: r.getAttribute('title') || (r.querySelector('.sd') || {}).textContent }; });
(async () => {
  const b = await chromium.launch();
  let p = await open(b, { extraInit: STUB(true), w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(300);
  let R = await row(p);
  ok('Settings has a second row under Great catch: "Great catch, 2nd rule", with "Active" unticked, IV 170, OR, quality 5', R.shown && R.title === 'Great catch, 2nd rule' && R.tick === 'Active' && !R.active && R.iv === '170' && R.q === '5' && R.mode === 'or' && JSON.stringify(R.words) === '["AND","OR"]', R);
  ok('...while it is off its boxes are dimmed (they can still be filled in)', R.dim === '0.5' && !(await p.evaluate(() => document.getElementById('nIV2').disabled)), R.dim);
  const pos = await p.evaluate(() => ['nIV', 'nMode', 'nQuality', 'nIV2', 'nMode2', 'nQuality2', 'nGc2On'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return { id, x: Math.round(r.left), y: Math.round(r.top), cy: Math.round(r.top + r.height / 2) }; }));
  const P = id => pos.find(q => q.id === id);
  ok('the 2nd rule is right under the first, in the same three columns (IV, AND | OR, Quality), on one line, with "Active" above them', P('nIV2').x === P('nIV').x && P('nMode2').x === P('nMode').x && P('nQuality2').x === P('nQuality').x && Math.abs(P('nIV2').cy - P('nMode2').cy) <= 2 && Math.abs(P('nMode2').cy - P('nQuality2').cy) <= 2 && P('nIV2').y > P('nQuality').y && P('nGc2On').y < P('nIV2').y, pos);

  await p.evaluate(() => document.getElementById('nGc2Row').scrollIntoView({ block: 'center' })); await p.waitForTimeout(100); await p.screenshot({ path: 'greatcatch2-off.png' });
  await p.check('#nGc2On'); await p.waitForTimeout(120); R = await row(p); await p.screenshot({ path: 'greatcatch2-on.png' });
  ok('ticking "Active" asks for exactly goodCatch2.enabled = true, and the boxes are no longer dimmed', (await last(p)) === '{"goodCatch2":{"enabled":true}}' && R.active && R.dim === '1', [await last(p), R]);
  await setNum(p, 'nIV2', 168);
  ok('changing its IV asks for goodCatch2.minIV only (the first rule is not touched)', (await last(p)) === '{"goodCatch2":{"minIV":168}}', await last(p));
  await setNum(p, 'nQuality2', 2);
  ok('changing its quality asks for goodCatch2.minQuality', (await last(p)) === '{"goodCatch2":{"minQuality":2}}', await last(p));
  await p.click('#nMode2 label:has(input[value="and"])'); await p.waitForTimeout(120); R = await row(p);
  ok('choosing AND in the 2nd rule asks for goodCatch2.mode = "and"; the first rule stays OR', (await last(p)) === '{"goodCatch2":{"mode":"and"}}' && R.mode === 'and' && R.mode1 === 'or', [await last(p), R]);
  await p.click('#nMode label:has(input[value="and"])'); await p.waitForTimeout(120); R = await row(p);
  ok('...and AND in the first rule asks for goodCatch.mode only; the 2nd rule keeps its own', (await last(p)) === '{"goodCatch":{"mode":"and"}}' && R.mode === 'and' && R.mode1 === 'and', [await last(p), R]);
  await setNum(p, 'nIV2', 999); R = await row(p);
  ok('a number above the limit comes back as the main process keeps it (200)', R.iv === '200', R);

  // the Summary's day tracker follows the same rules
  await p.click('#nMode2 label:has(input[value="or"])'); await setNum(p, 'nIV2', 170); await setNum(p, 'nQuality2', 5); await p.click('#nMode label:has(input[value="or"])'); await p.waitForTimeout(250);
  let D = await p.dash().evaluate(() => ({ rule: todayRule, a: isGreatCatch(172, 1.0, 'Rara'), b: isGreatCatch(160, 1.0, 'Rara'), c: isGreatCatch(176, 1.0, 'Rara') }));
  ok('the Summary (Today\u2019s highlights) gets the 2nd rule when it is on: IV 172 + quality 1.0 is great there too; IV 160 is not; rule 1 still works (176)', D.rule && D.rule.goodCatch2 && D.rule.goodCatch2.minIV === 170 && D.a === true && D.b === false && D.c === true, D);
  await p.uncheck('#nGc2On'); await p.waitForTimeout(250);
  D = await p.dash().evaluate(() => ({ rule: todayRule, a: isGreatCatch(172, 1.0, 'Rara') }));
  ok('...and not when it is off: IV 172 + quality 1.0 is not great (rule 1 is IV 175 OR 1.7)', (await last(p)) === '{"goodCatch2":{"enabled":false}}' && D.rule && !D.rule.goodCatch2 && D.a === false, D);
  await p.click('#setClose'); await p.evaluate(() => { window.__n.cfg.goodCatch2.enabled = true; window.__n.cfg.goodCatch2.minIV = 150; }); await p.click('#btnSettings'); await p.waitForTimeout(250); R = await row(p);
  ok('opening Settings again shows what the main process has (Active, IV 150)', R.active && R.iv === '150', R);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // an older main process that does not know the 2nd rule: the row is not shown, the rest works
  p = await open(b, { extraInit: STUB(false), w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(300);
  R = await row(p);
  ok('an app whose main process has no 2nd rule (an update half copied): the row is hidden and Settings still fills in (IV 175)', !R.shown && (await p.evaluate(() => document.getElementById('nIV').value)) === '175', R);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // Portuguese
  p = await open(b, { extraInit: STUB(true), lang: 'pt-BR', w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(300); R = await row(p);
  ok('in Portuguese: "Ótima captura, 2ª regra", "Ativa", E | OU', R.title === 'Ótima captura, 2ª regra' && R.tick === 'Ativa' && JSON.stringify(R.words) === '["E","OU"]', R);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
