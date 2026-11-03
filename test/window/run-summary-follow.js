// run-summary-follow.js: the Summary follows the expanded screen (while it is shown), and the lock beside the gear stops that. Choosing an account in the Summary never moves a screen.
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const setup = async (b, o) => { const p = await open(b, Object.assign({ w: 1700, h: 1000 }, o || {})); await feedAll(p); await p.evaluate(() => { if (!ui.panel) document.getElementById('btnPanel').click(); }); await p.waitForTimeout(500); return p; };
const sel = p => p.dash().evaluate(() => selected);
const solo = p => p.evaluate(() => ui.solo);
const screens = p => p.evaluate(() => [1, 2, 3, 4].map(n => { const e = document.getElementById('panel' + n); return e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; }).join() + '|' + ui.solo + '|' + ui.hidden.join());
const tab = async (p, t) => { await p.dash().evaluate(t => document.querySelector('#tabs [data-tab="' + t + '"]').click(), String(t)); await p.waitForTimeout(150); };
const lockBtn = p => p.dash().evaluate(() => { const b = document.getElementById('btnSumLock'), g = document.getElementById('btnSumSettings'), br = b.getBoundingClientRect(), gr = g.getBoundingClientRect(); return { on: b.classList.contains('on'), pressed: b.getAttribute('aria-pressed'), title: b.title, aria: b.getAttribute('aria-label'), w: Math.round(br.width), h: Math.round(br.height), text: b.textContent.trim(), svg: !!b.querySelector('svg'), d: b.querySelector('svg').dataset.d || '', gap: Math.round(gr.left - br.right), sameRow: Math.abs((br.top + br.height / 2) - (gr.top + gr.height / 2)) < 2, inHead: !!b.closest('.side-head'), before: b.nextElementSibling === g, gw: Math.round(gr.width), gh: Math.round(gr.height), saved: localStorage.getItem('4h.summary') }; });
const pill = async (p, n) => { await p.click('#accBtns [data-panel="' + n + '"]'); await p.waitForTimeout(200); };
(async () => {
  const b = await chromium.launch();
  let p = await setup(b);
  // ---- the button
  let L = await lockBtn(p);
  ok('the lock is in the header of the Summary, right beside the gear (just before it, same row, a few pixels apart), same size as the gear (30 x 28), an icon with no text', L.inHead && L.before && L.sameRow && L.gap >= 4 && L.gap <= 12 && L.w === 30 && L.h === 28 && L.gw === 30 && L.gh === 28 && L.svg && L.text === '', L);
  ok('...unlocked at first: not lit, not pressed, an open padlock, with its name and what it does as the tooltip', !L.on && L.pressed === 'false' && L.aria === 'Lock the Summary' && L.title === 'Lock the Summary on what it shows now, so it does not follow the expanded screen' && /7\.6-1\.7/.test(L.d), L);
  // ---- it follows the expanded screen
  ok('before anything is expanded the Summary shows all accounts (as it always did)', (await sel(p)) === 'sum' && (await solo(p)) === null);
  await p.click('#panel2 .ex'); await p.waitForTimeout(250);
  ok('a screen is expanded (its own button): the Summary shows that account (account 2)', (await solo(p)) === 2 && (await sel(p)) === 1, [await solo(p), await sel(p)]);
  await pill(p, 3);
  ok('another account is chosen in the top bar while it is expanded: the Summary goes to account 3', (await solo(p)) === 3 && (await sel(p)) === 2, [await solo(p), await sel(p)]);
  await pill(p, 4);
  ok('...and to account 4', (await solo(p)) === 4 && (await sel(p)) === 3);
  await pill(p, 4);
  ok('going back to all the screens (the same account is chosen again) leaves the Summary where it is (account 4)', (await solo(p)) === null && (await sel(p)) === 3, [await solo(p), await sel(p)]);
  // ---- the Summary never moves a screen
  await p.click('#panel1 .ex'); await p.waitForTimeout(250);
  const before = await screens(p);
  await tab(p, 3); await tab(p, 'sum'); await tab(p, 0);
  ok('choosing another account in the Summary (tabs 4, Σ, 1) changes the Summary only: the expanded screen and the others stay exactly as they were', (await screens(p)) === before && (await solo(p)) === 1 && (await sel(p)) === 0, [before, await screens(p)]);
  await p.dash().evaluate(() => { const r = document.querySelector('tr[data-tab="2"]'); if (r) r.click(); }); await p.waitForTimeout(150);
  ok('...and a click on a row of the table (it also selects an account) does not move a screen either', (await screens(p)) === before && (await solo(p)) === 1, [before, await screens(p)]);
  await p.click('#panel1 .ex'); await p.waitForTimeout(250);
  const grid0 = await screens(p);
  await tab(p, 2); await tab(p, 1); await tab(p, 'sum');
  ok('with all the screens showing, choosing accounts in the Summary changes no screen (none expanded, none hidden)', (await screens(p)) === grid0 && (await solo(p)) === null && /true,true,true,true\|null\|/.test(await screens(p)), await screens(p));
  // a hand choice is kept until the screen changes again, or until Simple is turned off
  const simple = async p => { await p.evaluate(() => document.getElementById('btnSimple').click()); await p.waitForTimeout(250); return p.evaluate(() => ui.simple); };
  await p.click('#panel2 .ex'); await p.waitForTimeout(250); await tab(p, 'sum');
  await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(250); await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(250);
  ok('(the Panel button already took it back before: showing the Summary again shows the expanded account 2)', (await sel(p)) === 1 && (await solo(p)) === 2, [await sel(p), await solo(p)]);
  await tab(p, 'sum');
  ok('Simple on: a choice made by hand in the Summary before is left alone (all accounts)', (await simple(p)) === true && (await sel(p)) === 'sum' && (await solo(p)) === 2, [await sel(p), await solo(p)]);
  const simpleScreens = await screens(p);
  await tab(p, 0);
  ok('in Simple, choosing another account in the Summary (account 1) changes the Summary only: the top bar keeps account 2 chosen', (await sel(p)) === 0 && (await solo(p)) === 2 && (await screens(p)) === simpleScreens && await p.evaluate(() => { const on = [...document.querySelectorAll('#accBtns .pill.on')].map(b => b.dataset.panel); return on.join() === '2'; }), [await sel(p), await solo(p), simpleScreens, await screens(p)]);
  ok('Simple off: the Summary goes to the account of the expanded screen (account 2, as the top bar shows)', (await simple(p)) === false && (await sel(p)) === 1 && (await solo(p)) === 2, [await sel(p), await solo(p)]);
  await tab(p, 3);
  ok('...outside Simple a hand choice still stays while the same screen stays expanded (account 4)', (await sel(p)) === 3 && (await solo(p)) === 2, [await sel(p), await solo(p)]);
  await simple(p); await tab(p, 'sum'); await simple(p);
  ok('...and Simple on and off again takes it back to the expanded screen every time (account 2)', (await sel(p)) === 1, await sel(p));
  await simple(p); await pill(p, 4);
  ok('in Simple, another account chosen in the top bar (4) takes the Summary along as before', (await solo(p)) === 4 && (await sel(p)) === 3, [await solo(p), await sel(p)]);
  await tab(p, 2);
  await simple(p);
  ok('...and turning Simple off shows that account (4), not the one chosen by hand in Simple (3)', (await sel(p)) === 3 && (await solo(p)) === 4, [await sel(p), await solo(p)]);
  await p.click('#panel4 .ex'); await p.waitForTimeout(250);
  ok('(no screen expanded now)', (await solo(p)) === null, await solo(p));
  await simple(p); await tab(p, 1); await simple(p);
  ok('no screen expanded: turning Simple off leaves the Summary where it was chosen (account 2), nothing to follow', (await sel(p)) === 1 && (await solo(p)) === null && /true,true,true,true\|null\|/.test(await screens(p)), [await sel(p), await screens(p)]);
  await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(250);
  await p.click('#panel2 .ex'); await p.waitForTimeout(250); await tab(p, 'sum');
  await simple(p); await simple(p);
  ok('the Summary panel hidden (Panel off): turning Simple off does not touch it (all accounts)', (await sel(p)) === 'sum' && (await solo(p)) === 2 && await p.evaluate(() => ui.panel === false), [await sel(p), await solo(p)]);
  await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(400);
  await pill(p, 3);
  ok('...and the next screen that is chosen takes it along again (account 3)', (await sel(p)) === 2);
  await p.click('#panel3 .ex'); await p.waitForTimeout(250); await tab(p, 'sum'); await p.click('#panel3 .ex'); await p.waitForTimeout(250);
  ok('expanding the same account again after leaving takes the Summary to it again', (await sel(p)) === 2 && (await solo(p)) === 3, [await sel(p), await solo(p)]);
  await p.click('#panel3 .ex'); await p.waitForTimeout(250);
  // ---- the Panel button: only while the Summary is shown
  await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(300); await tab(p, 'sum');
  ok('the Summary panel is hidden (the Panel button): the Summary view is left alone', await p.evaluate(() => ui.panel === false), await p.evaluate(() => ui.panel));
  await p.click('#panel2 .ex'); await p.waitForTimeout(250); await pill(p, 4);
  ok('...while it is hidden, expanding screens and choosing accounts in the top bar does not touch it', (await solo(p)) === 4 && (await sel(p)) === 'sum', [await solo(p), await sel(p)]);
  await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(400);
  ok('...and when the Summary panel is shown again while a screen is expanded, it shows that screen\u2019s account (account 4)', (await sel(p)) === 3, await sel(p));
  await p.click('#panel4 .ex'); await p.waitForTimeout(250);
  // ---- the lock
  await tab(p, 'sum');
  await p.dash().evaluate(() => document.getElementById('btnSumLock').click()); await p.waitForTimeout(150);
  L = await lockBtn(p);
  ok('pressing the lock (on all accounts): lit, pressed, a closed padlock, and the tooltip says what it is locked on', L.on && L.pressed === 'true' && L.title === 'Locked on all accounts: the Summary does not follow the expanded screen. Press to unlock' && /M8 11V8a4 4 0 0 1 8 0v3/.test(L.d), L);
  ok('...and it is saved on this computer (locked, and on what)', JSON.parse(L.saved).locked === true && JSON.parse(L.saved).tab === 'sum', L.saved);
  await p.click('#panel2 .ex'); await p.waitForTimeout(250); await pill(p, 3); await pill(p, 4); await pill(p, 4);
  ok('locked on all accounts: expanding a screen, choosing others in the top bar, and going back, leave the Summary on all accounts', (await sel(p)) === 'sum' && (await solo(p)) === null, [await sel(p), await solo(p)]);
  await tab(p, 1);
  L = await lockBtn(p);
  ok('locked: an account can still be chosen in the Summary by hand, the lock now holds that one (saved) and says its name', (await sel(p)) === 1 && L.on && JSON.parse(L.saved).tab === 1 && /^Locked on /.test(L.title) && !/all accounts/.test(L.title), L);
  await p.click('#panel3 .ex'); await p.waitForTimeout(250); await pill(p, 4); await pill(p, 1);
  ok('...and the screens that are expanded do not move it (still account 2), while the screens themselves change as always (account 1 expanded)', (await sel(p)) === 1 && (await solo(p)) === 1, [await sel(p), await solo(p)]);
  const lockedScreens = await screens(p);
  await tab(p, 3);
  ok('locked or not, choosing an account in the Summary never changes a screen', (await screens(p)) === lockedScreens && (await solo(p)) === 1, [lockedScreens, await screens(p)]);
  await tab(p, 1);
  // ---- unlock
  await p.dash().evaluate(() => document.getElementById('btnSumLock').click()); await p.waitForTimeout(150);
  L = await lockBtn(p);
  ok('pressing the lock again unlocks: not lit, an open padlock, saved; the Summary stays where it is until the screen changes', !L.on && L.pressed === 'false' && JSON.parse(L.saved).locked === false && (await sel(p)) === 1 && (await solo(p)) === 1, [L, await sel(p)]);
  await pill(p, 3);
  ok('...and then it follows again (account 3)', (await sel(p)) === 2);
  await p.click('#panel3 .ex'); await p.waitForTimeout(250);
  // ---- kept between runs
  await tab(p, 2);
  await p.dash().evaluate(() => document.getElementById('btnSumLock').click()); await p.waitForTimeout(150);
  await p.dash().evaluate(() => location.reload()); await p.waitForTimeout(1500);
  L = await lockBtn(p);
  ok('after the Summary is loaded again (the next run of the app): it is still locked, on account 3', (await sel(p)) === 2 && L.on && L.pressed === 'true', [await sel(p), L]);
  await p.click('#panel1 .ex'); await p.waitForTimeout(250); await pill(p, 4);
  ok('...and it does not follow the screens', (await sel(p)) === 2, await sel(p));
  await p.dash().evaluate(() => document.getElementById('btnSumLock').click()); await p.waitForTimeout(100);
  await p.dash().evaluate(() => location.reload()); await p.waitForTimeout(1500);
  ok('with a screen expanded (account 4) and the Summary loaded again unlocked: the window takes it to that account', (await solo(p)) === 4 && (await sel(p)) === 3 && !(await lockBtn(p)).on, [await solo(p), await sel(p)]);
  await p.click('#panel4 .ex'); await p.waitForTimeout(250);
  // saved values that make no sense
  for (const [bad, expLocked, expSel] of [['{"locked":"yes","tab":"x"}', false, 'sum'], ['{"locked":true,"tab":9}', true, 'sum'], ['{"locked":true,"tab":-1}', true, 'sum'], ['{"locked":true,"tab":2.5}', true, 'sum'], ['{"locked":true,"tab":"2"}', true, 'sum'], ['not json', false, 'sum'], ['{"locked":true}', true, 'sum'], ['{"locked":true,"tab":3}', true, 3]]) {
    await p.dash().evaluate(v => localStorage.setItem('4h.summary', v), bad);
    await p.dash().evaluate(() => location.reload()); await p.waitForTimeout(1300);
    const lk = await lockBtn(p);
    ok('a saved setting that makes no sense (' + bad + ') is cleaned up: locked ' + expLocked + ', showing ' + expSel, lk.on === expLocked && (await sel(p)) === expSel, [lk.on, await sel(p)]);
  }
  await p.dash().evaluate(() => localStorage.setItem('4h.summary', '{"off":{"luxury-ball":true},"best":"quality","hot":20000}'));
  await p.dash().evaluate(() => location.reload()); await p.waitForTimeout(1300);
  ok('settings saved by an earlier version (no lock in them) load as before: unlocked, showing all accounts, and the other choices (balls, best catch, price) are kept', !(await lockBtn(p)).on && (await sel(p)) === 'sum' && await p.dash().evaluate(() => sumCfg.best === 'quality' && sumCfg.hot === 20000 && sumCfg.off['luxury-ball'] === true));
  await p.dash().evaluate(() => document.getElementById('btnSumLock').click()); await p.waitForTimeout(100);
  ok('...and the lock does not lose them when it is saved', await p.dash().evaluate(() => { const o = JSON.parse(localStorage.getItem('4h.summary')); return o.locked === true && o.best === 'quality' && o.hot === 20000 && o.off['luxury-ball'] === true; }));
  await p.dash().evaluate(() => document.getElementById('btnSumLock').click()); await p.waitForTimeout(100);
  // ---- what the Summary accepts
  await tab(p, 'sum');
  const sent = async (msg) => { await p.evaluate(m => document.getElementById('dash').contentWindow.postMessage(m, '*'), msg); await p.waitForTimeout(120); return sel(p); };
  ok('the request to show an account is only accepted for the accounts 1 to 4 (7, 0, 2.5, "2", null, nothing are ignored)', (await sent({ type: 'focus', account: 7 })) === 'sum' && (await sent({ type: 'focus', account: 0 })) === 'sum' && (await sent({ type: 'focus', account: 2.5 })) === 'sum' && (await sent({ type: 'focus', account: '2' })) === 'sum' && (await sent({ type: 'focus', account: null })) === 'sum' && (await sent({ type: 'focus' })) === 'sum');
  await p.dash().evaluate(() => window.postMessage({ type: 'focus', account: 3 }, '*')); await p.waitForTimeout(150);
  ok('...and only from the window that holds it (the same request from the page itself is ignored)', (await sel(p)) === 'sum', await sel(p));
  ok('...and a good one from the window works (account 3)', (await sent({ type: 'focus', account: 3 })) === 2);
  // ---- the report
  const view = await p.dash().evaluate(() => diagData().view);
  ok('the diagnostics data says what the Summary shows and whether it is locked', !!view && view.selected === 3 && view.locked === false, view);
  // ---- no errors
  ok('no JavaScript errors in the window', p.errors.length === 0, p.errors);
  await p.context().close();
  // ---- Portuguese
  p = await setup(b, { lang: 'pt-BR' });
  L = await lockBtn(p);
  ok('in Portuguese: "Travar o Resumo", with its tooltip', L.aria === 'Travar o Resumo' && L.title === 'Travar o Resumo no que ele mostra agora, para que não acompanhe a tela expandida', L);
  await p.dash().evaluate(() => document.getElementById('btnSumLock').click()); await p.waitForTimeout(150); L = await lockBtn(p);
  ok('...locked: "Travado em todas as contas: o Resumo não acompanha a tela expandida. Clique para destravar"', L.title === 'Travado em todas as contas: o Resumo não acompanha a tela expandida. Clique para destravar', L);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
