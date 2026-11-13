// run-topbar.js (lang-71): the triangle beside the lock of the Summary hides the window's top bar (▲) and shows it again (▼); Ctrl+B and the tray menu (through the main
// process) do the same; it is remembered; the bar is never hidden without the Summary on screen (the way back); while it is hidden a newer version puts a gold dot on the ▼
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const STUB = (update, store) => `window.__barCb = null; __bridgeObject.onBar = cb => { window.__barCb = cb; };
  __bridgeObject.updateGet = async () => ({ version: '1.0.9', latest: ${update ? "'1.1.0'" : "'1.0.9'"}, available: ${update ? 'true' : 'false'} });
  ${store ? `if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); ${Object.keys(store).map(k => `localStorage.setItem('hg.${k}', ${JSON.stringify(JSON.stringify(store[k]))});`).join(' ')} }` : ''}`;
const look = p => p.evaluate(() => { const bar = document.getElementById('bar'), g = document.getElementById('grid'); return { barShown: getComputedStyle(bar).display !== 'none' && bar.getBoundingClientRect().height > 0, gridTop: Math.round(g.getBoundingClientRect().top), gridH: Math.round(g.getBoundingClientRect().height), stored: localStorage.getItem('hg.nobar') }; });
const tri = p => p.dash().evaluate(() => { const b = document.getElementById('btnSumBar'), l = document.getElementById('btnSumLock'); const r = b.getBoundingClientRect(), rl = l.getBoundingClientRect();
  return { shown: !b.classList.contains('hidden') && r.width > 0, leftOfLock: r.right <= rl.left + 1 && Math.abs(r.top - rl.top) <= 1, d: b.querySelector('path').getAttribute('d'), title: b.title, on: b.classList.contains('on'), dot: b.classList.contains('dot'), dotShown: getComputedStyle(b, '::after').content !== 'none' && b.classList.contains('dot'), color: getComputedStyle(b).color, aria: b.getAttribute('aria-pressed') }; });
const UP = 'M12 7l7 10H5z', DOWN = 'M12 17L5 7h14z';
(async () => {
  const b = await chromium.launch();
  let p = await open(b, { extraInit: STUB(false), w: 1500, h: 900 }); await feedAll(p);
  await p.evaluate(() => { if (!ui.panel) document.getElementById('btnPanel').click(); }); await p.waitForTimeout(300);
  let T = await tri(p), L0 = await look(p);
  ok('the Summary has the triangle, beside the lock (to its left), pointing up ▲, "Hide the top bar (Ctrl+B)"', T.shown && T.leftOfLock && T.d === UP && T.title === 'Hide the top bar (Ctrl+B)' && !T.on && T.aria === 'false', T);
  ok('at the start the bar is shown', L0.barShown, L0);
  await p.dash().click('#btnSumBar'); await p.waitForTimeout(250);
  let L1 = await look(p); T = await tri(p);
  ok('pressing it hides the top bar: the game screens move up and get its room (' + L0.gridH + ' → ' + L1.gridH + ' px high)', !L1.barShown && L1.gridTop < L0.gridTop && L1.gridH - L0.gridH >= 50, [L0, L1]);
  ok('...the triangle points down ▼, in gold, "Show the top bar (Ctrl+B)"', T.d === DOWN && T.on && T.title === 'Show the top bar (Ctrl+B)' && T.aria === 'true' && T.color === 'rgb(227, 192, 107)', T);
  ok('...and it is remembered', L1.stored === 'true', L1.stored);
  await p.dash().click('#btnSumBar'); await p.waitForTimeout(250);
  ok('pressing it again shows the bar again, as it was, the triangle up', (await look(p)).barShown && (await look(p)).gridTop === L0.gridTop && (await tri(p)).d === UP && (await look(p)).stored === 'false');
  // Ctrl+B and the tray menu (the main process sends "toggle" / "show")
  await p.evaluate(() => window.__barCb('toggle')); await p.waitForTimeout(200);
  ok('Ctrl+B (from the main process, wherever the keyboard is): the bar is hidden', !(await look(p)).barShown && (await tri(p)).d === DOWN);
  await p.evaluate(() => window.__barCb('toggle')); await p.waitForTimeout(200);
  ok('...Ctrl+B again: shown', (await look(p)).barShown);
  await p.evaluate(() => window.__barCb('toggle')); await p.waitForTimeout(150); await p.evaluate(() => window.__barCb('show')); await p.waitForTimeout(200);
  ok('the tray menu "Show the top bar": shown (and pressing it while the bar is shown changes nothing)', (await look(p)).barShown && (await p.evaluate(() => (window.__barCb('show'), document.body.classList.contains('nobar')))) === false);
  // remembered after a restart
  await p.evaluate(() => window.__barCb('toggle')); await p.waitForTimeout(150);
  await p.reload(); await p.waitForTimeout(800);
  ok('the app starts again with the bar hidden (it was hidden when it closed), the triangle ▼', !(await look(p)).barShown && (await tri(p)).d === DOWN, [await look(p), await tri(p)]);
  // the way back is always there
  await p.evaluate(() => { ui.panel = false; applyUI(); }); await p.waitForTimeout(200);
  ok('the Summary is taken off the screen while the bar is hidden: the bar comes back (else nothing could show it)', (await look(p)).barShown);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // a remembered hidden bar, but no Summary on screen at the start (Panel off, Simple off): the bar is shown
  p = await open(b, { extraInit: STUB(false, { nobar: true, panel: false, simple: false }), w: 1500, h: 900 }); await p.waitForTimeout(600);
  ok('the bar was remembered hidden, but the Summary is not on screen at the start: the bar is shown', (await look(p)).barShown, await look(p));
  await p.context().close();
  p = await open(b, { extraInit: STUB(false, { nobar: true, panel: false, simple: true }), w: 1500, h: 900 }); await p.waitForTimeout(600);
  ok('...with Simple (the Overview and the Summary on screen) it may stay hidden', !(await look(p)).barShown, await look(p));
  await p.context().close();

  // a newer version is out while the bar is hidden: a gold dot on the ▼
  p = await open(b, { extraInit: STUB(true), w: 1500, h: 900 }); await feedAll(p);
  await p.evaluate(() => { if (!ui.panel) document.getElementById('btnPanel').click(); }); await p.waitForTimeout(400);
  T = await tri(p);
  ok('a newer version is out and the bar is shown: no dot (the Update button is in sight)', !T.dot, T);
  await p.dash().click('#btnSumBar'); await p.waitForTimeout(250); T = await tri(p);
  ok('...the bar is hidden: the ▼ gets a gold dot, and its tooltip says the Update button is in the top bar', T.dot && T.dotShown && /A newer version of 4horizon is out: the Update button is in the top bar/.test(T.title), T);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // Portuguese
  p = await open(b, { extraInit: STUB(false), w: 1500, h: 900, lang: 'pt-BR' }); await feedAll(p);
  await p.evaluate(() => { if (!ui.panel) document.getElementById('btnPanel').click(); }); await p.waitForTimeout(300);
  const t1 = (await tri(p)).title; await p.dash().click('#btnSumBar'); await p.waitForTimeout(250); const t2 = (await tri(p)).title;
  ok('in Portuguese: "Ocultar a barra superior (Ctrl+B)" and "Mostrar a barra superior (Ctrl+B)"', t1 === 'Ocultar a barra superior (Ctrl+B)' && t2 === 'Mostrar a barra superior (Ctrl+B)', [t1, t2]);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
