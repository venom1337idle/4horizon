// run-economy-ui.js: the two buttons left of Analyzer (set apart from it): economy mode (the leaf) and silent mode (the bell).
// Economy mode: the game screens are hidden and the Overview takes their place (as with Simple, without changing the Simple choice); the Overview keeps drawing;
// the main process is told (economySet); the counters of each account are there for the main process (__4hEcoSample).
// Silent mode: the same switch as "Notifications" in Settings and the tray menu (notifySet({ enabled })), shown as it is.
const fs = require('fs');
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x).slice(0, 600))); c ? pass++ : fail++; };
const ECO = 'window.__eco = { calls: [] }; __bridgeObject.economySet = async on => { window.__eco.calls.push(on); return { on: on, since: 1 }; };';
const nsrc = fs.readFileSync('run-notify-ui.js', 'utf8'), NSTUB = new Function(nsrc.slice(nsrc.indexOf('const STUB = `'), nsrc.indexOf('`;', nsrc.indexOf('const STUB = `')) + 2) + ' return STUB;')();
const sess = (p, n, sid, name, min, extra) => p.s(n, Object.assign({ live: true, active: true, startedAt: sid, huntId: 'h' + sid, huntName: name, minutes: min, sessionTime: min + 'm 0s', goldH: 700000, xpH: 9000000, killsH: 780, defeated: min * 10, xpGained: min * 1000 }, extra || {}));
const state = p => p.evaluate(() => {
  const b = document.getElementById('btnEco'), dash = document.getElementById('dash'), st = document.getElementById('stage').getBoundingClientRect(), dr = dash.getBoundingClientRect();
  return { on: document.body.classList.contains('eco'), btnOn: b.classList.contains('on'), pressed: b.getAttribute('aria-pressed'), simpleLayout: document.body.classList.contains('simple'), simpleBtn: document.getElementById('btnSimple').classList.contains('on'), uiSimple: ui.simple,
    wv: Array.from(document.querySelectorAll('#grid webview')).map(w => getComputedStyle(w).visibility).join(), dash: getComputedStyle(dash).visibility, dashCovers: Math.abs(dr.left - st.left) < 1 && Math.abs(dr.width - st.width) < 1 && Math.abs(dr.height - st.height) < 1,
    cover: !!document.getElementById('ecoScreen'), calls: window.__eco ? window.__eco.calls.slice() : null };
});
const overview = p => p.dash().evaluate(() => { const k = document.getElementById('kpis'); return !!k && k.getBoundingClientRect().height > 0 && getComputedStyle(k).visibility !== 'hidden' ? k.textContent.replace(/\s+/g, ' ').trim() : null; });
const silent = p => p.evaluate(() => { const b = document.getElementById('btnSilent'); return { on: b.classList.contains('on'), pressed: b.getAttribute('aria-pressed'), slash: getComputedStyle(b.querySelector('.b-off')).display !== 'none', toast: document.getElementById('toast').textContent, calls: window.__n ? window.__n.calls.slice() : null, cfg: window.__n ? window.__n.cfg.enabled : null }; });

(async () => {
  const b = await chromium.launch();
  let p = await open(b, { extraInit: ECO + NSTUB });
  await p.evaluate(() => { if (ui.simple) document.getElementById('btnSimple').click(); if (!ui.panel) document.getElementById('btnPanel').click(); }); await p.waitForTimeout(300);
  await sess(p, 1, 501, 'Crateras dos Torchic', 30, { level: 300 }); await p.waitForTimeout(1300);
  // ---- the buttons: leaf, bell, then a wide gap, then Analyzer
  const pos = await p.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(), e = r('btnEco'), s = r('btnSilent'), a = r('btnAnalyzer'), pnl = r('btnPanel');
    return { order: [document.getElementById('btnEco').nextElementSibling.id, document.getElementById('btnSilent').nextElementSibling.className, document.getElementById('btnSilent').nextElementSibling.nextElementSibling.id].join(), gapEcoSilent: Math.round(s.left - e.right), gapSilentAnalyzer: Math.round(a.left - s.right), gapAnalyzerPanel: Math.round(pnl.left - a.right), sizes: [e.width, e.height, s.width, s.height].map(Math.round).join() }; });
  ok('leaf, bell, a separator, then Analyzer: the bell sits next to the leaf as usual, and both stand well apart from Analyzer (gap 3 times the usual)', pos.order === 'btnSilent,sep far,btnAnalyzer' && pos.gapSilentAnalyzer >= 3 * pos.gapEcoSilent && pos.gapSilentAnalyzer >= 30 && pos.sizes === '28,28,28,28', pos);
  const tips = await p.evaluate(() => ['btnEco', 'btnSilent'].map(id => { const b = document.getElementById(id); return b.title + '|' + b.getAttribute('aria-label') + '|' + b.getAttribute('aria-pressed'); }));
  ok('the tooltips say what each one does', tips[0] === 'Economy mode: hides the game screens and shows the Overview, to save your computer while you are away. The games keep hunting.|Economy mode|false' &&
    tips[1] === 'Silent mode: no notifications until you turn it off (the same switch as Notifications in Settings and in the tray menu)|Silent mode|false', tips);
  // ---- economy mode
  let s = await state(p);
  ok('economy off at the start: the game screens shown, no Overview over them, no cover screen any more', !s.on && !s.simpleLayout && s.wv === 'visible,visible,visible,visible' && !s.cover && s.calls.length === 0, s);
  await p.click('#btnEco'); await p.waitForTimeout(400);
  s = await state(p);
  ok('economy on: the button lit, the main process told (economySet(true))', s.on && s.btnOn && s.pressed === 'true' && JSON.stringify(s.calls) === '[true]', s);
  ok('...the game screens are hidden (visibility hidden: not drawn, still running)', s.wv === 'hidden,hidden,hidden,hidden', s.wv);
  ok('...and the Overview takes their place, over the whole space (as with Simple)', s.simpleLayout && s.dash === 'visible' && s.dashCovers && (await overview(p)) !== null, [s, await overview(p)]);
  ok('...without changing your Simple choice (the Simple button stays off)', !s.simpleBtn && s.uiSimple === false, s);
  const ov1 = await overview(p);
  await sess(p, 1, 501, 'Crateras dos Torchic', 45, { level: 301, killsH: 990 }); await p.waitForTimeout(1500);
  const ov2 = await overview(p);
  ok('while it is on the Overview keeps drawing new numbers', ov2 !== null && ov2 !== ov1, [ov1, ov2]);
  const smp = await p.evaluate(() => window.__4hEcoSample());
  ok('the counters for the main process are still there', JSON.stringify(smp) === JSON.stringify({ 1: { sid: '501', hunt: 'Crateras dos Torchic', k: 450, x: 45000 } }), smp);
  await p.click('#btnEco'); await p.waitForTimeout(500);
  s = await state(p);
  ok('economy off: back to the game screens (your layout), the main process told (economySet(false))', !s.on && !s.simpleLayout && s.wv === 'visible,visible,visible,visible' && JSON.stringify(s.calls) === '[true,false]', s);
  ok('...the panel header shows what came meanwhile (level 301)', (await p.evaluate(() => document.querySelector('#panel1 .lvl').textContent)).indexOf('301') >= 0);
  // with Simple on before
  await p.evaluate(() => document.getElementById('btnSimple').click()); await p.waitForTimeout(200);
  await p.click('#btnEco'); await p.waitForTimeout(200); await p.click('#btnEco'); await p.waitForTimeout(300);
  s = await state(p);
  ok('with Simple on, economy on and off leaves Simple on (the Overview stays)', s.simpleLayout && s.simpleBtn && s.uiSimple, s);
  await p.click('#btnEco'); await p.waitForTimeout(200);
  await p.evaluate(() => document.getElementById('btnSimple').click()); await p.waitForTimeout(300);
  s = await state(p);
  ok('Simple pressed while economy is on: the Overview stays (economy), the game screens stay hidden', s.on && s.simpleLayout && !s.uiSimple && s.wv === 'hidden,hidden,hidden,hidden', s);
  await p.click('#btnEco'); await p.waitForTimeout(300);
  s = await state(p);
  ok('...and when economy is turned off, the layout is your new choice (the game screens)', !s.simpleLayout && s.wv === 'visible,visible,visible,visible', s);
  await p.focus('#btnEco'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  ok('the keyboard turns it on too', (await state(p)).on);
  await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  // ---- silent mode
  let q = await silent(p);
  ok('silent mode off at the start: notifications are on (read from the settings), the bell has no slash', !q.on && q.pressed === 'false' && !q.slash, q);
  await p.click('#btnSilent'); await p.waitForTimeout(300);
  q = await silent(p);
  ok('click: silent on: notifications turned off (notifySet({ enabled: false })), the bell lit with a slash, and a message says so', q.on && q.pressed === 'true' && q.slash && JSON.stringify(q.calls) === '[{"enabled":false}]' && q.cfg === false && /Silent mode on: no notifications until you turn it off/.test(q.toast), q);
  ok('...the Settings window shows the same (its Notifications switch off)', await p.evaluate(() => document.getElementById('nEnabled').checked === false));
  await p.click('#btnSilent'); await p.waitForTimeout(300);
  q = await silent(p);
  ok('click again: silent off, notifications on again', !q.on && !q.slash && q.cfg === true && JSON.stringify(q.calls.slice(-1)) === '[{"enabled":true}]' && /Silent mode off: notifications are on again/.test(q.toast), q);
  await p.evaluate(() => { const c = document.getElementById('nEnabled'); c.checked = false; c.dispatchEvent(new Event('change')); }); await p.waitForTimeout(300);
  ok('notifications turned off in Settings: the bell shows silent mode on', (await silent(p)).on);
  await p.evaluate(() => { window.__n.cfg.enabled = true; window.dispatchEvent(new Event('focus')); }); await p.waitForTimeout(300);
  ok('turned on again from the tray menu (seen when the window gets the focus): the bell shows it off', !(await silent(p)).on);
  await p.evaluate(() => { window.__n.saved = false; }); await p.click('#btnSilent'); await p.waitForTimeout(300);
  q = await silent(p);
  ok('a save that fails says so, and the bell shows what the settings really are', /Could not save the notification settings/.test(q.toast), q);
  await p.evaluate(() => { window.__n.saved = true; });
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();
  p = await open(b, { extraInit: ECO + NSTUB.replace('cfg: { enabled: true', 'cfg: { enabled: false') });
  await p.waitForTimeout(400);
  ok('notifications already off when the app starts: the bell shows silent mode on', (await silent(p)).on);
  await p.context().close();
  p = await open(b, { extraInit: ECO + NSTUB, w: 1100, h: 700 });
  ok('the top bar still fits at 1100 px with both buttons and the wider gap', await p.evaluate(() => { const bar = document.getElementById('bar'), x = document.getElementById('btnSettings').getBoundingClientRect(); return bar.scrollWidth <= bar.clientWidth + 1 && x.right <= innerWidth; }));
  await p.context().close();
  // ---- an app whose preload.js lacks the functions (install-diagnostics.js not run)
  p = await open(b, {});
  await p.click('#btnEco'); await p.waitForTimeout(300);
  s = await state(p);
  ok('economy without its bridge: the screens are still hidden and the Overview shown, and a warning says the rest needs install-diagnostics.js', s.on && s.simpleLayout && s.wv === 'hidden,hidden,hidden,hidden' && /muting the games and measuring it need install-diagnostics\.js/.test(await p.evaluate(() => document.getElementById('toast').textContent)), s);
  await p.click('#btnSilent'); await p.waitForTimeout(300);
  ok('silent mode without its bridge: a warning, nothing changes', /Silent mode needs install-diagnostics\.js/.test(await p.evaluate(() => document.getElementById('toast').textContent)) && !(await silent(p)).on);
  ok('no JavaScript errors (no bridge)', p.errors.length === 0, p.errors);
  await p.context().close();
  // ---- Portuguese
  p = await open(b, { extraInit: ECO + NSTUB, lang: 'pt-BR' });
  const pt = await p.evaluate(() => ['btnEco', 'btnSilent'].map(id => { const b = document.getElementById(id); return b.title + '|' + b.getAttribute('aria-label'); }));
  await p.click('#btnSilent'); await p.waitForTimeout(300);
  ok('in Portuguese: both tooltips and labels, and the message', /^Modo economia: esconde as telas dos jogos e mostra a Visão geral/.test(pt[0]) && /\|Modo economia$/.test(pt[0]) && /^Modo silencioso: nenhuma notificação até você desligá-lo/.test(pt[1]) && /\|Modo silencioso$/.test(pt[1]) &&
    /Modo silencioso ligado/.test(await p.evaluate(() => document.getElementById('toast').textContent)), pt);
  ok('no JavaScript errors (Portuguese)', p.errors.length === 0, p.errors);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
