// run-panels-count.js (lang-49): Settings › Game panels (1 to 4): the panels not in use get no address (their game page is never loaded), and their pill,
// their account in the Summary and Overview, their row in Accounts and their line in Log in all are not shown; the report says "not in use".
// Also: the Diagnostics hide the character names at first (the choice is kept).
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 600))); c ? pass++ : fail++; };
const ACC = `__bridgeObject.accountsGet = async () => ({ encryption: true, autoLogin: false, rows: [1, 2, 3, 4].map(n => ({ n, name: 'acc' + n, user: 'u' + n, hasPassword: true })) });
  __bridgeObject.accountsLogin = async () => ({ results: [1, 2, 3, 4].map(n => ({ n, ok: n <= 2, reason: n <= 2 ? '' : 'panel-not-ready' })) });`;
const PRE = n => `try { localStorage.setItem('hg.panels', ${JSON.stringify(JSON.stringify(n))}); } catch (e) {}`;
const look = p => p.evaluate(() => ({
  src: [1, 2, 3, 4].map(n => document.getElementById('p' + n).getAttribute('src') || ''),
  shown: [1, 2, 3, 4].map(n => getComputedStyle(document.getElementById('panel' + n)).display !== 'none'),
  pills: Array.from(document.querySelectorAll('#accBtns .pill')).map(b => b.dataset.panel).join(),
  cols: document.getElementById('grid').style.gridTemplateColumns, rows: document.getElementById('grid').style.gridTemplateRows }));
const dashLook = p => p.dash().evaluate(() => ({ n: accounts.length, tabs: Array.from(document.querySelectorAll('#tabs [data-tab]')).map(b => b.dataset.tab).join(), rows: document.querySelectorAll('#tableWrap tbody tr').length }));

(async () => {
  const b = await chromium.launch();
  // ---- 4 at first
  let p = await open(b, { extraInit: ACC }); await feedAll(p);
  let v = await look(p);
  ok('at first: 4 game panels, each with the game\u2019s address, 4 pills', v.src.every(s => s === 'https://pokehorizonidle.com') && v.pills === '1,2,3,4' && v.shown.every(Boolean), v);
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const row = await p.evaluate(() => { const s = document.getElementById('panelsSel'); return { v: s.value, opts: Array.from(s.options).map(o => o.value).join(), title: s.closest('.srow').querySelector('b').textContent, first: s.closest('.srow') === document.querySelector('#settingsModal .srow') }; });
  ok('Settings › "Game panels", the first setting, 1 to 4, showing 4', row.v === '4' && row.opts === '1,2,3,4' && row.title === 'Game panels' && row.first, row);
  // choosing 2: kept, the window loads again
  await p.selectOption('#panelsSel', '2'); await p.waitForTimeout(250);
  const toastT = await p.evaluate(() => document.getElementById('toast').textContent);
  ok('choosing 2: kept, and a message says the window is loading again', /^2 game panels: the window is loading again/.test(toastT) && await p.evaluate(() => localStorage.getItem('hg.panels') === '2'), toastT);
  await p.waitForTimeout(1500); await feedAll(p);
  v = await look(p);
  ok('after the reload: panels 3 and 4 get NO address (their game page is never loaded) and are not shown; 2 pills; the two side by side', v.src.join('|') === 'https://pokehorizonidle.com|https://pokehorizonidle.com||' && v.shown.join() === 'true,true,false,false' && v.pills === '1,2' && v.cols === 'repeat(2, 1fr)' && v.rows === 'repeat(1, 1fr)', v);
  let d = await dashLook(p);
  ok('...the Summary and the Overview show only accounts 1 and 2 (tabs, table)', d.n === 2 && d.tabs === 'sum,0,1' && d.rows <= 3, d);
  await p.click('#btnAccounts'); await p.waitForTimeout(250);
  ok('...Accounts shows only rows 1 and 2 (3 and 4 keep their saved login)', (await p.evaluate(() => Array.from(document.querySelectorAll('#arows .arow')).map(r => r.dataset.n).join())) === '1,2');
  await p.evaluate(() => document.getElementById('aCancel').click());
  await p.click('#btnLoginAll'); await p.waitForTimeout(300);
  const lt = await p.evaluate(() => document.getElementById('toast').textContent);
  ok('...Log in all tells only about the panels in use', /acc1: login sent/.test(lt) && /acc2: login sent/.test(lt) && !/acc3|acc4|panel not ready/.test(lt), lt);
  await p.evaluate(() => window.__stats(4, { live: true, name: 'ghost', level: 9 })); await p.waitForTimeout(1200);
  ok('...data that would arrive for a panel not in use is ignored by the Summary', (await dashLook(p)).n === 2 && !(await p.dash().evaluate(() => document.getElementById('sideBody').textContent.includes('ghost'))));
  // the report
  await p.click('#btnSettings'); await p.waitForTimeout(250); await p.click('#btnDiag'); await p.waitForTimeout(1500);
  const rep = await p.evaluate(() => document.getElementById('diagReport') ? document.getElementById('diagReport').textContent : '');
  ok('Diagnostics: accounts 3 and 4 are "not in use (Settings: 2 game panels)", and the connection check counts only the 2 in use', /Account 3: not in use \(Settings: 2 game panels\)/.test(rep) && /Account 4: not in use \(Settings: 2 game panels\)/.test(rep) && /2 panels in use are sending data \(2 not in use\)|All 2 panels in use/.test(rep) && /\n  Account 3: not in use \(Settings: 2 game panels\)\n/.test(rep.slice(rep.indexOf('GAME MESSAGES'))), rep.slice(rep.indexOf('Game connection') - 10, rep.indexOf('Game connection') + 500));
  ok('...the character names are hidden at first ("Character names: hidden", no name in the report)', /Character names: hidden/.test(rep) && !/acc1|trainer\d|Conta 1/.test(rep.replace(/Account \d/g, '')), rep.slice(0, 400));
  await p.evaluate(() => { const c = document.getElementById('diagHide'); c.checked = false; c.dispatchEvent(new Event('change')); }); await p.waitForTimeout(400);
  ok('...unticking shows them, and that choice is kept for the next time', await p.evaluate(() => localStorage.getItem('hg.diagHide') === 'false') && /Character names: shown/.test(await p.evaluate(() => document.getElementById('diagReport').textContent)));
  await p.reload(); await p.waitForTimeout(800);
  ok('...(after a restart the box is still unticked)', await p.evaluate(() => document.getElementById('diagHide').checked === false));
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();
  // ---- 1 panel; a value that makes no sense
  p = await open(b, { extraInit: ACC + PRE(1) }); await feedAll(p);
  v = await look(p);
  ok('1 game panel: only panel 1 is loaded and fills the window; one pill', v.src.filter(Boolean).length === 1 && v.shown.join() === 'true,false,false,false' && v.cols === 'repeat(1, 1fr)' && v.pills === '1', v);
  ok('...the Summary has one account', (await dashLook(p)).n === 1);
  await p.context().close();
  p = await open(b, { extraInit: ACC + PRE(7) });
  ok('a saved number that makes no sense (7): 4 panels', (await look(p)).src.filter(Boolean).length === 4);
  ok('no JavaScript errors (1 panel, 7)', p.errors.length === 0, p.errors);
  await p.context().close();
  // ---- 3: two on top, one across
  p = await open(b, { extraInit: ACC + PRE(3) }); await feedAll(p);
  v = await look(p);
  ok('3 game panels: 3 loaded, 3 pills, two on top and the third across the bottom', v.src.filter(Boolean).length === 3 && v.pills === '1,2,3' && v.rows === 'repeat(2, 1fr)' && await p.evaluate(() => document.getElementById('panel3').style.gridColumn === '1 / -1'), v);
  await p.context().close();
  // ---- Portuguese
  p = await open(b, { extraInit: ACC, lang: 'pt-BR' }); await p.click('#btnSettings'); await p.waitForTimeout(250);
  const ptRow = await p.evaluate(() => { const s = document.getElementById('panelsSel').closest('.srow'); return [s.querySelector('b').textContent, s.querySelector('.sd').textContent]; });
  ok('in Portuguese: "Painéis do jogo" and its description', ptRow[0] === 'Painéis do jogo' && /^Quantas contas você joga ao mesmo tempo/.test(ptRow[1]), ptRow);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
