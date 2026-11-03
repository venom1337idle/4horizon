// run-gamenav.js: the Centro, Market and Mochila buttons of the top bar, tried on real pages that stand in for the game panels
const { chromium } = require('./pw');
const Module = require('module');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const MENU = ['Grupo', 'Guilda', 'Ginásios', 'PvP', 'Centro', 'Análise', 'Indicação', 'Lives', 'Breed', 'Hunts', 'Missões', 'Mochila', 'Trade', 'Amigos'];
const page = cfg => { cfg = Object.assign({ menu: MENU, center: 'Centro', bag: 'Mochila', hunts: 'Hunts', market: 'Ir ao Market', cityDelay: 0, inCity: false, hasMarket: true, login: false, exactClick: false, chat: '<span>Fulano: vai no Centro e abre a Mochila</span>' }, cfg || {});
  return `<!doctype html><meta charset=utf-8><body style="margin:0;background:#222;color:#eee;font:12px sans-serif;width:1100px;height:760px">
<div id="menu" style="position:fixed;top:6px;left:6px;display:flex;gap:6px">${cfg.menu.map(t => `<div class="mi" style="padding:10px;border:1px solid #555;cursor:pointer"><span class="ic">▣</span><br><span class="lb">${t}</span></div>`).join('')}</div>
<div id="chat" style="position:fixed;left:6px;top:560px;width:380px;height:120px;border:1px solid #444">${cfg.chat}</div>
<div style="position:fixed;left:500px;top:620px"><button id="sair">Sair</button> <a href="#" id="loja">Loja</a> <button id="empty"></button></div>
${cfg.login ? '<input type="password" style="position:fixed;top:300px;left:300px">' : ''}
<script>
const cfg = ${JSON.stringify(cfg)}; window.__log = [];
function addMarket() { if (document.getElementById('mk') || !cfg.hasMarket) return; const b = document.createElement('button'); b.id = 'mk'; b.style.cssText = 'position:fixed;right:20px;bottom:20px;padding:12px 18px;background:#0a3;color:#fff;border:2px solid #4f4'; b.innerHTML = '<span>\\u2726</span> <span>' + cfg.market + '</span>'; b.addEventListener('click', () => window.__log.push('market')); document.body.appendChild(b); }
if (cfg.inCity) addMarket();
document.getElementById('menu').addEventListener('click', e => {
  const it = e.target.closest('.mi'); if (!it) return;
  if (cfg.exactClick && e.target !== it) return;
  const label = it.querySelector('.lb').textContent;
  if (label === cfg.center) { window.__log.push('center'); setTimeout(addMarket, cfg.cityDelay); }
  if (label === cfg.hunts) window.__log.push('hunts');
  if (label === cfg.bag) { window.__log.push('bag'); const old = document.getElementById('bagwin'); if (old) old.remove(); else { const w = document.createElement('div'); w.id = 'bagwin'; w.style.cssText = 'position:fixed;top:300px;left:300px;width:300px;height:200px;background:#123'; w.innerHTML = '<div style="padding:8px">' + cfg.bag + '</div>'; document.body.appendChild(w); } }
});
</script>`; };
const open = async (ctx, cfg) => { const p = await ctx.newPage(); await p.setContent(page(cfg)); await p.waitForTimeout(40); return p; };
const guestOf = p => ({ executeJavaScript: code => p.evaluate(code), p });
const log = p => p.evaluate(() => window.__log.slice());

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1100, height: 760 } });
  const A = require('./gamenav'), accounts = require('./accounts');
  const put = (n, p) => { accounts._guests[n] = guestOf(p); };
  A._reset(); A._setMarketWait(3000); A._setTimeout(9000);
  Object.keys(accounts._guests).forEach(k => delete accounts._guests[k]);

  // ---- Centro and Mochila
  let p = await open(ctx); put(3, p);
  let r = await A.go('center', 3);
  ok('Centro: the "Centro" button of the menu is pressed, once, and nothing else', r.ok === true && r.what === 'center' && r.n === 3 && JSON.stringify(await log(p)) === '["center"]', [r, await log(p)]);
  r = await A.go('bag', 3);
  ok('Mochila: the "Mochila" button of the menu is pressed, once (the word is also in the chat and in the title of the window that opens, lower down: those are not pressed)', r.ok === true && JSON.stringify(await log(p)) === '["center","bag"]' && await p.evaluate(() => !!document.getElementById('bagwin')), [r, await log(p)]);
  // ---- Hunts: the Hunts button of the menu, once
  r = await A.go('hunts', 3);
  ok('Hunts: the "Hunts" button of the menu is pressed, once, and nothing else (the word is not in the chat, which is low on the page)', r.ok === true && r.what === 'hunts' && r.n === 3 && JSON.stringify(await log(p)) === '["center","bag","hunts"]', [r, await log(p)]);
  for (const label of ['Hunts', 'Hunt', 'HUNTS']) {
    const q = await open(ctx, { menu: MENU.map(m => m === 'Hunts' ? label : m), hunts: label }); put(4, q); const rr = await A.go('hunts', 4);
    ok('the Hunts button is found when it says "' + label + '"', rr.ok === true && (await log(q)).indexOf('hunts') === 0, [rr, await log(q)]);
  }
  const noHunts = await open(ctx, { menu: ['Grupo', 'Guilda', 'Breed', 'Mochila'] }); put(1, noHunts); r = await A.go('hunts', 1);
  ok('no "Hunts" in the menu: "button not found", with the texts of the buttons of the page for the report', r.ok === false && r.reason === 'button not found' && r.labels.indexOf('sair') >= 0 && (await log(noHunts)).length === 0, r);
  const su = await open(ctx, { login: true, menu: ['Entrar'] }); put(2, su);
  ok('a panel that is not signed in: "not signed in" for Hunts too', (await A.go('hunts', 2)).reason === 'not signed in');
  // ---- Market: Centro first, then the Market button that shows up
  p = await open(ctx, { cityDelay: 700 }); put(2, p);
  const t0 = Date.now(); r = await A.go('market', 2); const dt = Date.now() - t0;
  ok('Market: "Centro" is pressed first, then it waits for "Ir ao Market" (it shows up after 0.7 s) and presses it', r.ok === true && JSON.stringify(await log(p)) === '["center","market"]' && dt >= 650 && dt < 3500, [r, await log(p), dt]);
  p = await open(ctx, { inCity: true }); put(2, p); r = await A.go('market', 2);
  ok('Market when "Ir ao Market" is already on screen (you are in the city): it is pressed at once and Centro is NOT pressed', r.ok === true && JSON.stringify(await log(p)) === '["market"]', [r, await log(p)]);
  // ---- other languages and spellings
  for (const [label, key, cfg] of [['Center', 'center', { menu: MENU.map(m => m === 'Centro' ? 'Center' : m), center: 'Center' }], ['CENTRO', 'center', { menu: MENU.map(m => m === 'Centro' ? 'CENTRO' : m), center: 'CENTRO' }], ['Backpack', 'bag', { menu: MENU.map(m => m === 'Mochila' ? 'Backpack' : m), bag: 'Backpack' }], ['Bag', 'bag', { menu: MENU.map(m => m === 'Mochila' ? 'Bag' : m), bag: 'Bag' }], ['Inventory', 'bag', { menu: MENU.map(m => m === 'Mochila' ? 'Inventory' : m), bag: 'Inventory' }]]) {
    const q = await open(ctx, cfg); put(4, q); const rr = await A.go(key, 4);
    ok('the menu button is found when it says "' + label + '"', rr.ok === true && (await log(q)).indexOf(key) === 0, [rr, await log(q)]);
  }
  for (const label of ['Go to Market', 'Go to the Market', 'IR AO MARKET', 'Ir ao market']) {
    const q = await open(ctx, { inCity: true, market: label }); put(4, q); const rr = await A.go('market', 4);
    ok('the market button is found when it says "' + label + '"', rr.ok === true && JSON.stringify(await log(q)) === '["market"]', [rr, await log(q)]);
  }
  // ---- what cannot be done is said, with the reason
  p = await open(ctx, { menu: ['Grupo', 'Guilda', 'Breed', 'Hunts'] }); put(1, p);
  r = await A.go('bag', 1);
  ok('no "Mochila" in the menu: "button not found", with the texts of the buttons of the page for the report (buttons and links only: Sair, Loja)', r.ok === false && r.reason === 'button not found' && r.labels.indexOf('sair') >= 0 && r.labels.indexOf('loja') >= 0 && !r.labels.some(w => /fulano/.test(w)), r);
  ok('...nothing was pressed, and the chat says "Centro" and "Mochila" low on the page: those are not the button', (await log(p)).length === 0);
  r = await A.go('market', 1);
  ok('Market with no "Centro" in the menu: "button not found"', r.ok === false && r.reason === 'button not found', r);
  p = await open(ctx, { hasMarket: false }); put(2, p); const t1 = Date.now(); r = await A.go('market', 2);
  ok('"Centro" works but the "Ir ao Market" button never shows up: "market button not found" after the wait (here 3 s), not an endless wait', r.ok === false && r.reason === 'market button not found' && Date.now() - t1 < 8000 && JSON.stringify(await log(p)).indexOf('center') >= 0, [r, Date.now() - t1]);
  p = await open(ctx, { login: true, menu: ['Entrar'] }); put(3, p);
  r = await A.go('center', 3); const r2 = await A.go('market', 3);
  ok('a panel that is not signed in: "not signed in" for Centro, Market and Mochila', r.reason === 'not signed in' && r2.reason === 'not signed in' && (await A.go('bag', 3)).reason === 'not signed in', [r, r2]);
  delete accounts._guests[4]; r = await A.go('center', 4);
  ok('a panel that has no game screen yet: "no game screen"', r.ok === false && r.reason === 'no game screen', r);
  accounts._guests[2] = { executeJavaScript: () => Promise.reject(new Error('Object has been destroyed')) }; r = await A.go('bag', 2);
  ok('a panel whose page fails: "page did not answer", nothing thrown', r.ok === false && r.reason === 'page did not answer', r);
  A._setTimeout(300); accounts._guests[2] = { executeJavaScript: () => new Promise(() => {}) }; const t2 = Date.now(); r = await A.go('bag', 2);
  ok('a page that never answers is given up after the time limit (here 0.3 s)', Date.now() - t2 < 2500 && r.reason === 'page did not answer', [Date.now() - t2, r]);
  A._setTimeout(9000);
  const bad = [await A.go('stone', 1), await A.go('center', 0), await A.go('center', 5), await A.go('center', '1'), await A.go('center', 1.5), await A.go(undefined, 1), await A.go('center', null)];
  ok('a request that makes no sense (unknown button, panel 0, 5, text, decimal, nothing) is refused with "bad request" and nothing is pressed', bad.every(x => x.ok === false && x.reason === 'bad request'), bad);
  // ---- two panels at once
  const pa = await open(ctx, { cityDelay: 600 }), pb = await open(ctx, { cityDelay: 600 }); put(1, pa); put(2, pb);
  const t3 = Date.now(); const both = await Promise.all([A.go('market', 1), A.go('market', 2)]);
  ok('two panels at the same time do not wait for each other (about 0.6 s, not 1.2 s)', both.every(x => x.ok) && Date.now() - t3 < 1500, [both, Date.now() - t3]);
  // ---- the report
  const info = A.lastInfo();
  ok('the report gets what the last press did (what, which panel, how long ago, ok) and no page text', info && info.what === 'market' && info.ageSec <= 5 && typeof info.ok === 'boolean' && JSON.stringify(info).indexOf('Fulano') < 0, info);
  A._reset(); ok('nothing pressed yet: no information', A.lastInfo() === null);
  // ---- the request of the window: only our own window may ask
  const handlers = {};
  const stub = { app: { whenReady: () => new Promise(() => {}), getAppPath: () => __dirname, getLocale: () => 'en-US', getPath: () => __dirname }, BrowserWindow: { fromWebContents: wc => (wc && wc.ours ? {} : null) }, ipcMain: { handle: (ch, fn) => { handlers[ch] = fn; } } };
  const orig = Module._load; Module._load = function (req) { return req === 'electron' ? stub : orig.apply(this, arguments); };
  Object.keys(require.cache).filter(k => /gamenav\.js|settings\.js|accounts\.js/.test(k)).forEach(k => delete require.cache[k]);
  const A2 = require('./gamenav'), acc2 = require('./accounts'); A2.init(); Module._load = orig;
  const q = await open(ctx); acc2._guests[2] = guestOf(q);
  ok('the request exists in the main process', typeof handlers['nav:go'] === 'function', Object.keys(handlers));
  ok('a game panel (not our window) gets nothing and nothing is pressed', (await handlers['nav:go']({ sender: { ours: false } }, 'center', 2)) === null && (await log(q)).length === 0);
  const ans = await handlers['nav:go']({ sender: { ours: true } }, 'center', 2);
  ok('our own window gets the answer and Centro is pressed', ans && ans.ok === true && JSON.stringify(await log(q)) === '["center"]', ans);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
