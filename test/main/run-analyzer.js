// run-analyzer.js: the Analyzer button of the top bar, tried on real pages that stand in for the game panels
const { chromium } = require('./pw');
const Module = require('module');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const MENU = ['Perfil', 'Wiki', 'Rank', 'Pokédex', 'Talentos', 'Centro', 'Análise', 'Inventário'];
const page = cfg => { cfg = Object.assign({ menu: MENU, openOn: ['Análise'], chat: '<span>Fulano: oi</span> <span>Análise</span>', delay: 0, closeDelay: 0, login: false, broken: false, exactClick: false, xKind: 'text' }, cfg || {});
  return `<!doctype html><meta charset=utf-8><body style="margin:0;background:#222;color:#eee;font:12px sans-serif;width:1100px;height:760px">
<div id="menu" style="position:fixed;top:6px;left:6px;display:flex;gap:6px">${cfg.menu.map(t => `<div class="mi" style="padding:10px;border:1px solid #555;cursor:pointer"><span class="ic">▣</span><br><span class="lb">${t}</span></div>`).join('')}</div>
<div id="chat" style="position:fixed;left:6px;top:560px;width:300px;height:100px;border:1px solid #444">${cfg.chat}</div>
${cfg.login ? '<input type="password" style="position:fixed;top:300px;left:300px">' : ''}
<script>
const cfg = ${JSON.stringify(cfg)};
window.__clicks = 0;
function openWin() {
  if (document.getElementById('ha')) return;
  const w = document.createElement('div'); w.id = 'ha'; w.style.cssText = 'position:fixed;top:110px;left:40px;width:380px;height:440px;background:#123;border:1px solid #6c6';
  const x = cfg.xKind === 'aria' ? '<button class="x" aria-label="Fechar" style="position:absolute;top:8px;right:8px;width:28px;height:28px"></button>' : '<button class="x" style="position:absolute;top:8px;right:8px;width:28px;height:28px">\\u2715</button>';
  w.innerHTML = '<div style="padding:12px"><span>HUNT ANALYZER</span> <span style="margin-left:60px">Zerar</span></div><div style="padding:12px">sess\\u00e3o atual</div>' + x;
  document.body.appendChild(w);
  w.querySelector('.x').addEventListener('click', () => setTimeout(() => w.remove(), cfg.closeDelay));
}
document.getElementById('menu').addEventListener('click', e => {
  window.__clicks++;
  const it = e.target.closest('.mi'); if (!it) return;
  if (cfg.exactClick && e.target !== it) return;                           // this stand-in only reacts to a click on the box itself, not on its text
  const label = it.querySelector('.lb').textContent;
  if (cfg.openOn.indexOf(label) >= 0 && !cfg.broken) setTimeout(openWin, cfg.delay);
});
</script>`; };
const open = async (ctx, cfg) => { const p = await ctx.newPage(); await p.setContent(page(cfg)); await p.waitForTimeout(40); return p; };
const guestOf = p => ({ executeJavaScript: code => p.evaluate(code), p });
const isOpen = p => p.evaluate(() => !!document.getElementById('ha'));

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1100, height: 760 } });
  const A = require('./analyzer'), accounts = require('./accounts');
  const setGuests = o => { Object.keys(accounts._guests).forEach(k => delete accounts._guests[k]); Object.keys(o).forEach(k => { accounts._guests[k] = guestOf(o[k]); }); };
  A._reset();

  // ---- everything closed: the button opens the analyzer on all
  let pg = { 2: await open(ctx), 3: await open(ctx), 4: await open(ctx) }; setGuests(pg);
  let r = await A.toggle();
  ok('closed everywhere: the button opens it, on the three accounts that have a panel', r.action === 'open' && r.results.length === 3 && r.results.every(x => x.ok), r);
  ok('...and the Hunt Analyzer is really on screen in the three pages', (await Promise.all([2, 3, 4].map(n => isOpen(pg[n])))).every(Boolean));
  ok('...by pressing the "Análise" button of the menu only (one press of the menu on each page), not the word "Análise" of the chat', (await pg[2].evaluate(() => window.__clicks)) === 1);
  // ---- open everywhere: the button closes it
  r = await A.toggle();
  ok('open everywhere: the button closes it on all', r.action === 'close' && r.results.every(x => x.ok && !x.skipped) && !(await Promise.all([2, 3, 4].map(n => isOpen(pg[n])))).some(Boolean), r);
  // ---- mixed: closes where it is open, leaves the rest alone, and everybody ends the same
  const clicks2 = await pg[2].evaluate(() => window.__clicks);          // (lang-62: closing presses the Análise icon too: counted from here)
  await pg[3].evaluate(() => { document.querySelectorAll('.mi')[6].click(); }); await pg[3].waitForTimeout(80);
  r = await A.toggle();
  ok('open on one panel only: the button CLOSES it (the others have nothing to close), so all end closed', r.action === 'close' && r.results.find(x => x.n === 3).ok && r.results.filter(x => x.skipped).length === 2 && !(await Promise.all([2, 3, 4].map(n => isOpen(pg[n])))).some(Boolean), r);
  const clicksBefore = await pg[2].evaluate(() => window.__clicks);
  ok('...and the panels that had it closed were not touched', clicksBefore === clicks2, [clicks2, clicksBefore]);

  // ---- the words of the menu in other languages and spellings
  for (const [label, why] of [['Analysis', 'English'], ['Analyzer', 'English (analyzer)'], ['ANÁLISE', 'capitals and accent'], ['analise', 'no accent']]) {
    const q = await open(ctx, { menu: MENU.map(m => m === 'Análise' ? label : m), openOn: [label] }); setGuests({ 2: q });
    const rr = await A.toggle(); ok('the menu button is found when it says "' + label + '" (' + why + ')', rr.action === 'open' && rr.results[0].ok && await isOpen(q), rr);
  }
  // ---- how it can be pressed
  let q = await open(ctx, { exactClick: true }); setGuests({ 2: q }); r = await A.toggle();
  ok('a menu box that reacts only to a click on the box itself (not on its text) is still opened: the parents are pressed in turn', r.results[0].ok && await isOpen(q), r);
  q = await open(ctx, { delay: 500 }); setGuests({ 2: q }); r = await A.toggle();
  ok('a game that takes half a second to show the window is waited for', r.results[0].ok && await isOpen(q), r);
  q = await open(ctx, { xKind: 'aria', closeDelay: 300 }); setGuests({ 2: q }); await A.toggle(); r = await A.toggle();
  ok('the close button found by its label (aria-label "Fechar", no text) works, and a slow close is waited for', r.action === 'close' && r.results[0].ok && !(await isOpen(q)), r);

  // ---- what cannot be done is said, with the reason
  q = await open(ctx, { login: true, menu: ['Entrar'] }); const q2 = await open(ctx); setGuests({ 2: q, 3: q2 }); r = await A.toggle();
  ok('a panel that is not signed in: "not signed in" for it, the signed-in one is opened', r.action === 'open' && r.results.find(x => x.n === 2).reason === 'not signed in' && r.results.find(x => x.n === 3).ok && await isOpen(q2), r);
  q = await open(ctx, { menu: ['Perfil', 'Wiki', 'Rank', 'Centro', 'Inventário'] }); setGuests({ 4: q }); r = await A.toggle();
  ok('a menu without that button: "button not found", and the words of the top of the page are given for the report', !r.results[0].ok && r.results[0].reason === 'button not found' && r.results[0].labels.indexOf('perfil') >= 0 && r.results[0].labels.indexOf('wiki') >= 0, r);
  ok('...the words are only short words of the top of the page, with no chat in them (the chat says "Fulano: oi")', r.results[0].labels.every(w => w.length <= 18) && !r.results[0].labels.some(w => /fulano/.test(w)), r.results[0].labels);
  ok('...and the "Análise" word in the chat (low on the page) is not taken for the button: nothing was pressed', (await q.evaluate(() => window.__clicks)) === 0, await q.evaluate(() => window.__clicks));
  q = await open(ctx, { broken: true }); setGuests({ 2: q }); r = await A.toggle();
  ok('a button that does nothing: "did not open" after trying it and its parents (not an endless wait)', !r.results[0].ok && r.results[0].reason === 'did not open', r);
  const t0 = Date.now(); q = await open(ctx, { broken: true }); setGuests({ 2: q }); await A.toggle(); const took = Date.now() - t0;
  ok('...that took less than 5 seconds', took < 5000, took);
  // ---- no panel, a page that fails, a page that does not answer
  setGuests({}); r = await A.toggle();
  ok('no game panel yet: action "none", nothing thrown', r.action === 'none' && r.results.length === 0, r);
  accounts._guests[2] = { executeJavaScript: () => Promise.reject(new Error('Object has been destroyed')) }; accounts._guests[3] = guestOf(await open(ctx)); r = await A.toggle();
  ok('a panel whose page fails does not stop the others: "page did not answer" for it, the other is opened', r.results.find(x => x.n === 2).reason === 'page did not answer' && r.results.find(x => x.n === 3).ok, r);
  A._setTimeout(300); accounts._guests[2] = { executeJavaScript: () => new Promise(() => {}) }; accounts._guests[3] = guestOf(await open(ctx)); const t1 = Date.now(); r = await A.toggle();
  ok('a page that never answers is given up after the time limit (here 0.3 s), the others still work', Date.now() - t1 < 2500 && r.results.find(x => x.n === 2).reason === 'page did not answer' && r.results.find(x => x.n === 3).ok, [Date.now() - t1, r]);
  A._setTimeout(6000);
  // ---- in parallel
  pg = { 1: await open(ctx, { delay: 700 }), 2: await open(ctx, { delay: 700 }), 3: await open(ctx, { delay: 700 }), 4: await open(ctx, { delay: 700 }) }; setGuests(pg);
  const t2 = Date.now(); r = await A.toggle(); const dt = Date.now() - t2;
  ok('four panels that each need 0.7 s are done together in about 0.7 s, not one after the other (' + dt + ' ms)', r.results.length === 4 && r.results.every(x => x.ok) && dt < 1800, dt);
  // ---- what the report gets
  const info = A.lastInfo();
  ok('the report gets what the last press did: the action, how long ago, and a line per account (no page text)', info && info.action === 'open' && info.ageSec <= 5 && info.results.length === 4 && JSON.stringify(info).indexOf('Fulano') < 0, info);
  A._reset(); ok('nothing pressed yet: no information', A.lastInfo() === null);

  // ---- the request of the window: only our own window may ask
  const handlers = {};
  const stub = { app: { whenReady: () => new Promise(() => {}), getAppPath: () => __dirname, getLocale: () => 'en-US', getPath: () => __dirname }, BrowserWindow: { fromWebContents: wc => (wc && wc.ours ? {} : null) }, ipcMain: { handle: (ch, fn) => { handlers[ch] = fn; } } };
  const orig = Module._load; Module._load = function (req) { return req === 'electron' ? stub : orig.apply(this, arguments); };
  Object.keys(require.cache).filter(k => /analyzer\.js|settings\.js|accounts\.js/.test(k)).forEach(k => delete require.cache[k]);
  const A2 = require('./analyzer'), acc2 = require('./accounts'); A2.init(); Module._load = orig;
  acc2._guests[2] = guestOf(await open(ctx));
  ok('the request exists in the main process', typeof handlers['analyzer:toggle'] === 'function', Object.keys(handlers));
  ok('a game panel (not our window) gets nothing and nothing is pressed', (await handlers['analyzer:toggle']({ sender: { ours: false } })) === null && !(await isOpen(acc2._guests[2].p)));
  const rr = await handlers['analyzer:toggle']({ sender: { ours: true } });
  ok('our own window gets the answer and the analyzer opens', rr && rr.action === 'open' && rr.results[0].ok && await isOpen(acc2._guests[2].p), rr);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
