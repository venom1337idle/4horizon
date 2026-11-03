// run-nav-ui.js: the buttons of each panel header (Centro, Market, Mochila, Hunts) and "Back to last hunt"
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const STUB = (nav, hunt) => `window.__BACK_AFTER_MS = 300; window.__nav = { calls: [], answer: ${JSON.stringify(nav)}, wait: 0 }; window.__bk = { calls: [], answer: ${JSON.stringify(hunt)}, wait: 0 };
  __bridgeObject.navGo = async (what, n) => { window.__nav.calls.push([what, n]); if (window.__nav.wait) await new Promise(r => setTimeout(r, window.__nav.wait)); if (window.__nav.answer === 'throw') throw new Error('x'); return window.__nav.answer; };
  __bridgeObject.navHunt = async (n, hunt) => { window.__bk.calls.push([n, hunt]); if (window.__bk.wait) await new Promise(r => setTimeout(r, window.__bk.wait)); if (window.__bk.answer === 'throw') throw new Error('x'); return window.__bk.answer; };`;
const toast = p => p.locator('#toast').innerText();
const kind = p => p.evaluate(() => document.getElementById('toast').className);
const calls = (p, k) => p.evaluate(k => window[k].calls.slice(), k || '__nav');
const set = (p, k, o) => p.evaluate(([k, o]) => Object.assign(window[k], o), [k, o]);
const hunting = (p, n, id, name) => p.evaluate(([n, id, name]) => window.__stats(n, { live: true, startedAt: 1, active: true, minutes: 5, huntId: id, huntName: name, level: 334 }), [n, id, name]);
const stopped = (p, n) => p.evaluate(n => window.__stats(n, { active: false }), n);
const back = (p, n) => p.evaluate(n => { const b = document.querySelector('#panel' + n + ' .pback'), r = b.getBoundingClientRect(); return { shown: !b.classList.contains('hidden') && b.getClientRects().length > 0, w: Math.round(r.width), h: Math.round(r.height), label: b.querySelector('.pbt').offsetParent !== null, title: b.title, aria: b.getAttribute('aria-label'), text: b.textContent.trim() }; }, n);
const heads = p => p.evaluate(() => [1, 2, 3, 4].map(n => { const h = document.querySelector('#panel' + n + ' .phead'), nav = h.querySelector('.pnav'), r = e => { const x = h.querySelector(e); return x ? x.getBoundingClientRect() : null; }; const hb = h.getBoundingClientRect(), pt = r('.ptxt'), pn = nav.getBoundingClientRect(), lv = r('.lvl'), zo = r('.zoom');
  return { n, over: h.scrollWidth - h.clientWidth, navShown: nav.getClientRects().length > 0, btns: Array.from(nav.querySelectorAll('button')).map(b => [b.dataset.nav, Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height), b.getAttribute('aria-label'), b.title, !!b.querySelector('svg'), b.textContent.trim()]), pnL: Math.round(pn.left - hb.left), pnR: Math.round(pn.right - hb.left), ptR: Math.round(pt.right - hb.left), zoL: zo ? Math.round(zo.left - hb.left) : null, head: Math.round(hb.width), cy: Math.round(pn.top + pn.height / 2 - hb.top), hcy: Math.round(hb.height / 2) }; }));
(async () => {
  const b = await chromium.launch();
  let p = await open(b, { extraInit: STUB({ ok: true }, { ok: true }), w: 1500, h: 900 }); await p.waitForTimeout(300);
  let H = await heads(p);
  ok('the buttons are in the header of EACH panel (four panels), not in the top bar: no group in the bar any more', H.length === 4 && H.every(h => h.navShown) && (await p.evaluate(() => !document.getElementById('navGrp') && document.querySelectorAll('#bar .nv, #bar [id^="btnNav"]').length === 0)), H.map(h => h.navShown));
  ok('...each header has Centro, Market, Mochila and Hunts, in this order, 30 x 30 (bigger than the 27 px buttons of the header), with an icon (no text), a name and a tooltip', H.every(h => JSON.stringify(h.btns.map(x => x[0])) === '["center","market","bag","hunts"]' && h.btns.every(x => x[1] === 30 && x[2] === 30 && x[5] && x[6] === '') && JSON.stringify(h.btns.map(x => x[3])) === '["Center","Market","Backpack","Hunts"]' && /^Centro: back to the city/.test(h.btns[0][4]) && /^Market: goes to Centro and then to the Market/.test(h.btns[1][4]) && /^Mochila: opens the backpack/.test(h.btns[2][4]) && /^Hunts: opens the Hunts panel of the game/.test(h.btns[3][4])), H[0].btns);
  ok('...in the free middle of the header: after the name and the status, before the level and the zoom, on the middle line', H.every(h => h.pnL > h.ptR && h.pnR < h.zoL && Math.abs(h.cy - h.hcy) <= 2 && Math.abs(((h.pnL + h.pnR) / 2) - ((h.ptR + h.zoL) / 2)) <= 70), H.map(h => [h.ptR, h.pnL, h.pnR, h.zoL]));
  ok('...and no header is too full (nothing sticks out of any of them)', H.every(h => h.over <= 0), H.map(h => h.over));
  // each button asks for ITS panel, also when nothing is expanded
  for (const [n, what] of [[3, 'market'], [1, 'center'], [4, 'bag'], [2, 'hunts']]) { await p.click('#panel' + n + ' .pn[data-nav="' + what + '"]'); await p.waitForTimeout(100); }
  ok('a press asks the main process for its own panel (3 market, 1 center, 4 bag, 2 hunts), with no panel expanded', JSON.stringify(await calls(p)) === '[["market",3],["center",1],["bag",4],["hunts",2]]', await calls(p));
  ok('...and a press that worked says nothing', (await p.evaluate(() => !document.getElementById('toast').textContent.trim() || document.getElementById('toast').classList.contains('hidden'))), await toast(p));
  await p.click('#panel2 .ex'); await p.waitForTimeout(250);
  await set(p, '__nav', { calls: [] }); await p.click('#panel2 .pn[data-nav="bag"]'); await p.waitForTimeout(100);
  ok('expanded, the same: the buttons of the expanded panel (2) ask for panel 2', JSON.stringify(await calls(p)) === '[["bag",2]]', await calls(p));
  await p.dblclick('#panel2 .pn[data-nav="center"]'); await p.waitForTimeout(200);
  ok('a double click on one of the buttons does not expand or restore the panel (it is not the header)', (await p.evaluate(() => ui.solo)) === 2, await p.evaluate(() => ui.solo));
  await p.click('#panel2 .ex'); await p.waitForTimeout(250);
  // failures: with the number of the panel of the button
  const say = async (n, what, ans) => { await set(p, '__nav', { answer: ans }); await p.click('#panel' + n + ' .pn[data-nav="' + what + '"]'); await p.waitForTimeout(150); return [await toast(p), await kind(p)]; };
  let m = await say(3, 'center', { ok: false, reason: 'button not found' });
  ok('Centro not found in panel 3: "Account 3: the Centro button was not found", as a warning', m[0] === 'Account 3: the Centro button was not found' && m[1] === 'warn', m);
  m = await say(4, 'bag', { ok: false, reason: 'button not found' }); ok('Mochila: "Account 4: the Mochila button was not found"', m[0] === 'Account 4: the Mochila button was not found', m);
  m = await say(1, 'hunts', { ok: false, reason: 'button not found' }); ok('Hunts: "Account 1: the Hunts button was not found"', m[0] === 'Account 1: the Hunts button was not found', m);
  m = await say(2, 'market', { ok: false, reason: 'market button not found' }); ok('Market that did not show up after Centro: "the Market button did not appear after Centro"', m[0] === 'Account 2: the Market button did not appear after Centro', m);
  m = await say(2, 'center', { ok: false, reason: 'not signed in' }); ok('not signed in: "Account 2: not signed in"', m[0] === 'Account 2: not signed in', m);
  m = await say(2, 'center', { ok: false, reason: 'no game screen' }); ok('no game screen: "Account 2: No game screen is ready yet."', m[0] === 'Account 2: No game screen is ready yet.', m);
  m = await say(2, 'center', { ok: false, reason: 'page did not answer' }); ok('the page does not answer: "Account 2: the page did not answer"', m[0] === 'Account 2: the page did not answer', m);
  m = await say(2, 'center', null); ok('an answer of nothing: "Could not reach the game screens."', m[0] === 'Could not reach the game screens.' && m[1] === 'warn', m);
  m = await say(2, 'center', 'throw'); ok('if the request fails: "Could not reach the game screens."', m[0] === 'Could not reach the game screens.', m);
  // one at a time per panel
  await set(p, '__nav', { calls: [], answer: { ok: true }, wait: 450 });
  await p.click('#panel1 .pn[data-nav="market"]'); const busy1 = await p.evaluate(() => document.querySelector('#panel1 .pn[data-nav="market"]').classList.contains('busy'));
  await p.evaluate(() => document.querySelector('#panel1 .pn[data-nav="bag"]').click()); await p.click('#panel2 .pn[data-nav="market"]'); await p.waitForTimeout(700);
  ok('while a button of panel 1 is working it looks busy and the other buttons of panel 1 are ignored; panel 2 is not held up by it (two requests in all)', busy1 && JSON.stringify(await calls(p)) === '[["market",1],["market",2]]', await calls(p));
  await set(p, '__nav', { wait: 0 });
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // ---- Back to last hunt
  p = await open(b, { extraInit: STUB({ ok: true }, { ok: true }), w: 1920, h: 900 }); await p.waitForTimeout(300);
  ok('no hunt remembered yet: "Back to last hunt" is not shown in any panel', (await Promise.all([1, 2, 3, 4].map(n => back(p, n)))).every(x => !x.shown));
  await hunting(p, 1, 'grass-100', 'Cratera dos Torchic'); await p.waitForTimeout(500);
  ok('on a hunt: not shown (it is only for when you are not on one)', !(await back(p, 1)).shown, await back(p, 1));
  ok('...but the hunt is remembered (and kept in the window storage for the next run)', (await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('hg.huntMemo'))))) === '{"1":{"id":"grass-100","name":"Cratera dos Torchic"}}', await p.evaluate(() => localStorage.getItem('hg.huntMemo')));
  await stopped(p, 1); await p.waitForTimeout(100);
  ok('it stops hunting: it does not show at once (a hunt that is about to start must not make it flash)', !(await back(p, 1)).shown, await back(p, 1));
  await p.waitForTimeout(700);
  let B = await back(p, 1);
  ok('a moment later "Back to last hunt" shows in that panel, right after the name, with its words in a wide header, and the hunt in its tooltip', B.shown && B.label && B.text === 'Back to last hunt' && B.title === 'Back to last hunt: Cratera dos Torchic' && B.aria === 'Back to last hunt' && B.h === 26, B);
  const pos = await p.evaluate(() => { const h = document.querySelector('#panel1 .phead'), b = document.querySelector('#panel1 .pback').getBoundingClientRect(), t = document.querySelector('#panel1 .ptxt').getBoundingClientRect(), n = document.querySelector('#panel1 .pnav').getBoundingClientRect(), hb = h.getBoundingClientRect(); return { gap: Math.round(b.left - t.right), beforeNav: b.right < n.left, over: h.scrollWidth - h.clientWidth }; });
  ok('...where the green arrow of the screenshot points: right after the name and status, before the four buttons, and the header is not overfull', pos.gap >= 6 && pos.gap <= 16 && pos.beforeNav && pos.over <= 0, pos);
  ok('the other panels, that never hunted, do not show it', (await Promise.all([2, 3, 4].map(n => back(p, n)))).every(x => !x.shown));
  // press
  await p.click('#panel1 .pback'); await p.waitForTimeout(150);
  ok('a press asks for panel 1 and its hunt ({id grass-100, name Cratera dos Torchic}), once; then says "Going back to the hunt: Cratera dos Torchic"', JSON.stringify(await calls(p, '__bk')) === '[[1,{"id":"grass-100","name":"Cratera dos Torchic"}]]' && (await toast(p)) === 'Going back to the hunt: Cratera dos Torchic' && (await kind(p)) === '', [await calls(p, '__bk'), await toast(p)]);
  await set(p, '__bk', { answer: { ok: true, already: true } }); await p.click('#panel1 .pback'); await p.waitForTimeout(150);
  ok('if the game says it is the hunt in progress: "You are already hunting there: Cratera dos Torchic"', (await toast(p)) === 'You are already hunting there: Cratera dos Torchic', await toast(p));
  for (const [reason, text] of [['hunts button not found', 'the Hunts button was not found'], ['hunts panel did not open', 'the Hunts panel did not open'], ['search box not found', 'the search box of the Hunts panel was not found'], ['hunt not found', 'that hunt was not found in the Hunts panel'], ['hunt did not open', 'the Hunts panel did not show that hunt, so Caçar was not pressed'], ['not signed in', 'not signed in'], ['page did not answer', 'the page did not answer'], ['no game screen', 'No game screen is ready yet.']]) {
    await set(p, '__bk', { answer: { ok: false, reason } }); await p.click('#panel1 .pback'); await p.waitForTimeout(130);
    ok('failed with "' + reason + '": "Account 1: ' + text + '", as a warning', (await toast(p)) === 'Account 1: ' + text && (await kind(p)) === 'warn', [await toast(p), await kind(p)]);
  }
  await set(p, '__bk', { answer: null }); await p.click('#panel1 .pback'); await p.waitForTimeout(130);
  ok('an answer of nothing: "Could not reach the game screens."', (await toast(p)) === 'Could not reach the game screens.', await toast(p));
  await set(p, '__bk', { answer: 'throw' }); await p.click('#panel1 .pback'); await p.waitForTimeout(130);
  ok('if the request fails: "Could not reach the game screens."', (await toast(p)) === 'Could not reach the game screens.', await toast(p));
  await set(p, '__bk', { calls: [], answer: { ok: true }, wait: 400 });
  await p.click('#panel1 .pback'); const bz = await p.evaluate(() => document.querySelector('#panel1 .pback').classList.contains('busy')); await p.evaluate(() => document.querySelector('#panel1 .pback').click()); await p.evaluate(() => document.querySelector('#panel1 .pback').click()); await p.waitForTimeout(650);
  ok('three quick presses make one request, and the button looks busy while it works', bz && (await calls(p, '__bk')).length === 1, await calls(p, '__bk'));
  await set(p, '__bk', { wait: 0 });
  // it goes away when the hunt starts again
  await hunting(p, 1, 'grass-100', 'Cratera dos Torchic'); await p.waitForTimeout(150);
  ok('when the panel is on a hunt again the button goes away', !(await back(p, 1)).shown);
  // another hunt replaces the memory; a stopped state with another name does not
  await hunting(p, 1, 'psychic-200', 'Templo dos Unown'); await stopped(p, 1); await p.evaluate(() => window.__stats(1, { huntName: 'Outra coisa', huntId: 'x-1' })); await p.waitForTimeout(700);
  ok('the memory is the LAST hunt it was on (Templo dos Unown), and a name that arrives while it is stopped does not replace it', JSON.stringify(await p.evaluate(() => JSON.parse(localStorage.getItem('hg.huntMemo'))[1])) === '{"id":"psychic-200","name":"Templo dos Unown"}' && (await back(p, 1)).title === 'Back to last hunt: Templo dos Unown', await p.evaluate(() => localStorage.getItem('hg.huntMemo')));
  // each panel has its own
  await hunting(p, 3, 'rock-60', 'Pedreira dos Onix'); await stopped(p, 3); await p.waitForTimeout(700);
  await set(p, '__bk', { calls: [] }); await p.click('#panel3 .pback'); await p.waitForTimeout(120);
  ok('each account has its own: panel 3 goes back to its own hunt (Pedreira dos Onix) while panel 1 keeps Templo dos Unown', JSON.stringify(await calls(p, '__bk')) === '[[3,{"id":"rock-60","name":"Pedreira dos Onix"}]]' && (await back(p, 1)).title === 'Back to last hunt: Templo dos Unown', await calls(p, '__bk'));
  // a quick restart of the hunt does not flash the button
  await hunting(p, 4, 'grass-100', 'Cratera dos Torchic'); await stopped(p, 4); await p.waitForTimeout(100); await hunting(p, 4, 'grass-100', 'Cratera dos Torchic'); await p.waitForTimeout(600);
  ok('stopped and hunting again within a moment: it never showed (no flash)', !(await back(p, 4)).shown);
  // a panel that was showing it and goes offline
  await hunting(p, 2, 'fire-200', 'Prado Flamejante dos Quilava'); await stopped(p, 2); await p.waitForTimeout(700);
  const was = (await back(p, 2)).shown;
  await p.evaluate(() => window.__stats(2, { live: false })); await p.waitForTimeout(150);
  ok('a panel that showed it and then goes offline (its game screen is gone: "Waiting") no longer shows it', was && !(await back(p, 2)).shown, [was, await back(p, 2)]);
  // memory kept between runs; "Connected" (no hunt data yet) also counts as not on a hunt
  await p.reload(); await p.waitForTimeout(500);
  ok('after the window is loaded again nothing shows while the panels are not online', (await Promise.all([1, 2, 3, 4].map(n => back(p, n)))).every(x => !x.shown));
  await p.evaluate(() => window.__stats(1, { live: true })); await p.waitForTimeout(800);
  B = await back(p, 1);
  ok('...and when panel 1 connects and is not on a hunt, the hunt of the last run is offered (Templo dos Unown)', B.shown && B.title === 'Back to last hunt: Templo dos Unown', B);
  await p.click('#panel1 .pback'); await p.waitForTimeout(120);
  ok('...and a press asks for it', JSON.stringify((await calls(p, '__bk')).slice(-1)) === '[[1,{"id":"psychic-200","name":"Templo dos Unown"}]]', await calls(p, '__bk'));
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  // ---- lang-46: no game timer is waited for (travelReadyAt, used by lang-43 to 45, is not the Hunts countdown: the game lets you travel at any time)
  p = await open(b, { extraInit: STUB({ ok: true }, { ok: true }), w: 1920, h: 900 }); await p.waitForTimeout(300);
  const now0 = await p.evaluate(() => Date.now());
  await hunting(p, 1, 'grass-100', 'Cratera dos Torchic'); await p.evaluate(t => window.__stats(1, { huntReadyAt: t }), now0 + 78000);
  await stopped(p, 1); await p.waitForTimeout(800);
  ok('a travel timer 78 s ahead (as in the report) does NOT keep the button hidden: it shows a moment after the account stops (the bug of lang-43 to 45)', (await back(p, 1)).shown, await back(p, 1));
  await hunting(p, 3, 'rock-60', 'Pedreira dos Rhyhorn'); await p.evaluate(t => window.__stats(3, { huntReadyAt: t }), now0 + 12 * 60e3);
  await stopped(p, 3); await p.waitForTimeout(800);
  ok('...nor one 12 minutes ahead (what a travel leaves behind)', (await back(p, 3)).shown, await back(p, 3));
  await hunting(p, 2, 'fire-200', 'Prado Flamejante dos Quilava'); await stopped(p, 2); await p.waitForTimeout(800);
  ok('a panel with no timer at all: shown a moment after it stops, as always', (await back(p, 2)).shown);
  ok('no JavaScript errors (hunt timer)', p.errors.length === 0, p.errors); await p.context().close();

  // narrow headers
  for (const [w, solo] of [[1920, false], [1500, false], [1330, false], [1100, false], [900, false], [1500, true], [900, true]]) {
    const q = await open(b, { extraInit: STUB({ ok: true }, { ok: true }), w, h: 800 }); await q.waitForTimeout(250);
    await hunting(q, 1, 'grass-100', 'Cratera dos Torchic'); await stopped(q, 1); await q.waitForTimeout(700);
    if (solo) { await q.click('#panel1 .ex'); await q.waitForTimeout(300); }
    const g = await q.evaluate(() => { const h = document.querySelector('#panel1 .phead'), vis = e => { const x = h.querySelector(e); return !!x && x.getClientRects().length > 0 && getComputedStyle(x).display !== 'none'; }; return { head: Math.round(h.getBoundingClientRect().width), over: h.scrollWidth - h.clientWidth, back: vis('.pback'), label: vis('.pbt'), nav: vis('.pnav'), lvl: vis('.lvl'), name: Math.round(h.querySelector('.ptxt').getBoundingClientRect().width) }; });
    ok(w + ' px, ' + (solo ? 'one panel expanded' : 'the four panels') + ' (header ' + g.head + ' px): nothing sticks out; the Back button ' + (g.label ? 'has its words' : 'is an icon') + ', the four buttons ' + (g.nav ? 'show' : 'give way') + ', the name keeps at least 100 px', g.over <= 0 && g.back && g.name >= 100 && (g.head >= 830 ? g.label : true) && (g.head >= 640 ? g.nav : true), g);
    await q.context().close();
  }
  // without the bridge
  p = await open(b, { w: 1500, h: 900 }); await p.waitForTimeout(250); await p.click('#panel2 .pn[data-nav="market"]'); await p.waitForTimeout(100);
  ok('without the bridge function (the installer was not run): the buttons say to run install-diagnostics.js, as a warning, and nothing breaks', /Centro, Market, Mochila and Hunts buttons need install-diagnostics\.js/.test(await toast(p)) && (await kind(p)) === 'warn' && p.errors.length === 0, [await toast(p), p.errors]);
  await hunting(p, 2, 'grass-100', 'Cratera dos Torchic'); await stopped(p, 2); await p.waitForTimeout(9000);
  await p.evaluate(() => { const b = document.querySelector('#panel2 .pback'); b.classList.remove('hidden'); b.click(); }); await p.waitForTimeout(150);
  ok('...and "Back to last hunt" too ("The Back to last hunt button needs install-diagnostics.js...")', /Back to last hunt button needs install-diagnostics\.js/.test(await toast(p)) && (await kind(p)) === 'warn', await toast(p));
  await p.context().close();

  // Portuguese
  p = await open(b, { extraInit: STUB({ ok: false, reason: 'button not found' }, { ok: false, reason: 'search box not found' }), lang: 'pt-BR', w: 1920, h: 900 }); await p.waitForTimeout(300);
  const PT = await p.evaluate(() => Array.from(document.querySelectorAll('#panel1 .pn')).map(b => [b.getAttribute('aria-label'), b.title]));
  ok('in Portuguese: Centro, Market, Mochila, Hunts, with tooltips in Portuguese', JSON.stringify(PT.map(x => x[0])) === '["Centro","Market","Mochila","Hunts"]' && /^Centro: volta para a cidade/.test(PT[0][1]) && /vai ao Centro e depois ao Market/.test(PT[1][1]) && /abre a mochila/.test(PT[2][1]) && /abre o painel de Hunts do jogo/.test(PT[3][1]), PT);
  await p.click('#panel3 .pn[data-nav="bag"]'); await p.waitForTimeout(150);
  ok('...a failure: "Conta 3: o botão Mochila não foi encontrado"', (await toast(p)) === 'Conta 3: o botão Mochila não foi encontrado', await toast(p));
  await hunting(p, 1, 'grass-100', 'Cratera dos Torchic'); await stopped(p, 1); await p.waitForTimeout(700);
  B = await back(p, 1);
  ok('...and "Voltar para a última hunt", with the hunt in the tooltip', B.shown && B.text === 'Voltar para a última hunt' && B.title === 'Voltar para a última hunt: Cratera dos Torchic', B);
  await p.click('#panel1 .pback'); await p.waitForTimeout(150);
  ok('...and its failure: "Conta 1: a caixa de busca do painel de Hunts não foi encontrada"', (await toast(p)) === 'Conta 1: a caixa de busca do painel de Hunts não foi encontrada', await toast(p));
  // links of the game: the panels may ask for new windows (external.js sends them to the default browser)
  p = await open(b, { w: 1500, h: 900 }); await p.waitForTimeout(200);
  const wv = await p.evaluate(() => Array.from(document.querySelectorAll('webview')).map(w => [w.id, w.hasAttribute('allowpopups'), w.getAttribute('partition'), w.getAttribute('src')]));
  ok('the four game panels carry allowpopups (without it Electron refuses the window of the Wiki, of a stream or of a vote link before the app is even asked, and nothing happens)', wv.length === 4 && wv.every(x => x[1]), wv);
  ok('...and nothing else changed about them (same partitions and address)', JSON.stringify(wv.map(x => [x[2], x[3]])) === JSON.stringify([1, 2, 3, 4].map(n => ['persist:conta' + n, 'https://pokehorizonidle.com'])), wv);
  await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
