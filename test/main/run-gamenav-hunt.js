// run-gamenav-hunt.js: "Back to last hunt": the Hunts panel of the game (search box, filters, cards, details with Caçar / Caçando), on a page that stands in for it
const { chromium } = require('./pw');
const Module = require('module');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const MENU = ['Pokédex', 'Talentos', 'Breed', 'Hunts', 'Missões', 'Mochila', 'Trade', 'Amigos'];
const HUNTS = [['grass-100', 'Cratera dos Torchic', 'Torchic', 100, 'Fogo', 0], ['psychic-100', 'Cripta dos Gengar', 'Gengar', 100, 'Fantasma', 1], ['fire-200', 'Prado Flamejante dos Quilava', 'Quilava', 200, 'Fogo', 1], ['psychic-200', 'Templo dos Unown', 'Unown', 200, 'Psíquico', 1], ['unown-250', 'Ruínas dos Unown', 'Unown', 250, 'Psíquico', 0], ['steel-300', 'Mina de Ferro dos Aron', 'Aron', 300, 'Aço', 1]];
const page = cfg => { cfg = Object.assign({ menu: MENU, startOpen: false, preselect: null, current: null, tab: 'all', typeFilter: null, levelFilter: null, noSearch: false, brokenSelect: false, login: false, plainInput: false }, cfg || {});
  return `<!doctype html><meta charset=utf-8><body style="margin:0;background:#111;color:#eee;font:13px sans-serif;width:1108px;height:893px;overflow:hidden">
<div id="menu" style="position:fixed;top:6px;left:60px;display:flex;gap:6px">${cfg.menu.map(t => `<div class="mi" style="padding:8px;border:1px solid #555;cursor:pointer"><span class="lb">${t}</span></div>`).join('')}</div>
<div id="chat" style="position:fixed;left:6px;top:850px;width:300px"><button>Todos</button> Fulano: vai na Cratera dos Torchic</div>
${cfg.login ? '<input type="password" style="position:fixed;top:300px;left:300px">' : ''}
<div id="hp" style="display:none;position:fixed;left:22px;top:117px;width:1068px;height:750px;background:#0b1020;border:2px solid #3c3">
  ${cfg.noSearch ? '' : '<input id="q" type="text" placeholder="Buscar hunt ou Pokémon…" style="position:absolute;left:18px;top:140px;width:640px;height:36px">'}
  <div style="position:absolute;left:18px;top:200px"><button id="ftodos">Todos</button> <button id="faco">Aço</button> <button id="ffogo">Fogo</button></div>
  <div style="position:absolute;left:18px;top:262px"><button id="fniveis">Todos os níveis</button> <button id="fn300">Nv. 300</button></div>
  <div style="position:absolute;left:18px;top:322px"><button id="tall"><span>◆</span> TODOS</button> <button id="tfav"><span>★</span> FAVORITOS <b>1</b></button></div>
  <div id="list" style="position:absolute;left:18px;top:376px;width:705px;height:360px;overflow:auto"></div>
  <div id="det" style="position:absolute;left:740px;top:376px;width:310px;height:360px;background:#202636">
    <div id="dtitle" style="position:absolute;left:12px;top:12px;font-size:16px;width:200px">—</div><div style="position:absolute;right:10px;top:16px">Nv. <span id="dlv">—</span></div>
    <div id="here" style="position:absolute;left:12px;top:72px;display:none">Você está aqui</div>
    <div style="position:absolute;left:12px;top:100px;width:280px;height:90px"><div id="dname" style="font-size:15px">—</div><div>5.520 EXP por abate</div></div>
    <button id="cacar" style="position:absolute;left:12px;bottom:10px;width:285px;height:36px">Caçar</button>
  </div>
</div>
<script>
const cfg = ${JSON.stringify(cfg)}, H = ${JSON.stringify(HUNTS)}; window.__log = [];
let tab = cfg.tab, tf = cfg.typeFilter, lf = cfg.levelFilter, query = '', sel = cfg.preselect, cur = cfg.current;
const P = s => s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
const find = id => H.find(h => h[0] === id);
function render() {
  const rows = H.filter(h => (tab === 'all' || h[5]) && (!tf || h[4] === tf) && (!lf || h[3] === lf) && (!query || P(h[1]).includes(P(query)) || P(h[2]).includes(P(query))));
  const levels = [...new Set(rows.map(h => h[3]))].sort((a, b) => a - b); let html = '';
  levels.forEach(lv => { html += '<div class="hd" style="background:#124;padding:6px;width:693px;height:20px"><span>Nível ' + lv + '</span><span> · libera no treinador Nv. ' + lv + '</span></div><div style="padding:8px 0;display:flex;gap:10px;flex-wrap:wrap">'; rows.filter(h => h[3] === lv).forEach(h => { html += '<div class="card" data-id="' + h[0] + '" style="position:relative;width:110px;height:82px;border:1px solid #556"><span class="star" style="position:absolute;right:4px;top:4px;cursor:pointer">★</span><img src="data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'30\\' height=\\'48\\'><rect width=\\'30\\' height=\\'48\\' fill=\\'gray\\'/></svg>" width="30" height="48" style="position:absolute;left:40px;top:10px"><b class="nm" style="position:absolute;left:0;right:0;bottom:3px;text-align:center">' + h[2] + '</b></div>'; }); html += '</div>'; });
  document.getElementById('list').innerHTML = html;
  const h = sel && find(sel);
  document.getElementById('dtitle').textContent = h ? h[1] : '—'; document.getElementById('dname').textContent = h ? h[2] : '—'; document.getElementById('dlv').textContent = h ? h[3] : '—';
  document.getElementById('here').style.display = (h && sel === cur) ? 'block' : 'none';
  document.getElementById('cacar').textContent = (h && sel === cur) ? 'Caçando' : 'Caçar';
}
render();
if (cfg.startOpen) document.getElementById('hp').style.display = 'block';
document.getElementById('menu').addEventListener('click', e => { const it = e.target.closest('.mi'); if (it && it.querySelector('.lb').textContent === 'Hunts') { const hp = document.getElementById('hp'); const open = hp.style.display === 'none'; hp.style.display = open ? 'block' : 'none'; window.__log.push(open ? 'hunts-open' : 'hunts-close'); } });
const q = document.getElementById('q'); if (q) q.addEventListener('input', () => { query = q.value; window.__log.push('search:' + q.value); render(); });
document.getElementById('ftodos').addEventListener('click', () => { tf = null; window.__log.push('f:todos'); render(); });
document.getElementById('faco').addEventListener('click', () => { tf = 'Aço'; window.__log.push('f:aco'); render(); });
document.getElementById('ffogo').addEventListener('click', () => { tf = 'Fogo'; render(); });
document.getElementById('fniveis').addEventListener('click', () => { lf = null; window.__log.push('f:niveis'); render(); });
document.getElementById('fn300').addEventListener('click', () => { lf = 300; render(); });
document.getElementById('tall').addEventListener('click', () => { tab = 'all'; window.__log.push('tab-all'); render(); });
document.getElementById('tfav').addEventListener('click', () => { tab = 'fav'; window.__log.push('tab-fav'); render(); });
document.getElementById('chat').querySelector('button').addEventListener('click', () => window.__log.push('chat-todos'));
document.getElementById('list').addEventListener('click', e => { if (e.target.closest('.star')) { window.__log.push('star'); return; } const c = e.target.closest('.card'); if (!c) return; window.__log.push('select:' + find(c.dataset.id)[1]); if (!cfg.brokenSelect) { sel = c.dataset.id; render(); } });
document.getElementById('cacar').addEventListener('click', () => { if (document.getElementById('cacar').textContent === 'Caçar' && sel) { cur = sel; window.__log.push('hunt:' + find(sel)[1]); render(); } else window.__log.push('pressed-while-hunting'); });
</script>`; };
const open = async (ctx, cfg) => { const p = await ctx.newPage(); await p.setContent(page(cfg)); await p.waitForTimeout(60); return p; };
const guestOf = p => ({ executeJavaScript: code => p.evaluate(code), p });
const log = p => p.evaluate(() => window.__log.slice());
const q = p => p.evaluate(() => (document.getElementById('q') || {}).value);
const TORCHIC = { id: 'grass-100', name: 'Cratera dos Torchic' };

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1108, height: 893 } });
  const A = require('./gamenav'), accounts = require('./accounts');
  const put = (n, p) => { accounts._guests[n] = guestOf(p); };
  A._reset(); A._setMarketWait(3000); A._setTimeout(9000);
  Object.keys(accounts._guests).forEach(k => delete accounts._guests[k]);
  A._setHuntData({ hunts: HUNTS.map((h, i) => ({ id: h[0], name: h[1], level: h[3], unlock: h[3], ids: [i + 1] })), species: Object.fromEntries(HUNTS.map((h, i) => [i + 1, { n: h[2] }])) });

  // ---- the data of the hunt
  ok('the Pokémon of a hunt comes from the hunt data: grass-100 = Cratera dos Torchic (level 100), Pokémon Torchic', JSON.stringify(A.huntInfo({ id: 'grass-100', name: '' })) === JSON.stringify({ name: 'Cratera dos Torchic', level: 100, species: ['Torchic'] }), A.huntInfo({ id: 'grass-100', name: '' }));
  ok('...by name when the id is not known; and a hunt that is not in the data keeps its name with no Pokémon', A.huntInfo({ id: '', name: 'Templo dos Unown' }).species[0] === 'Unown' && JSON.stringify(A.huntInfo({ id: 'x-1', name: 'Lugar dos Nada' })) === JSON.stringify({ name: 'Lugar dos Nada', level: undefined, species: [] }), A.huntInfo({ id: 'x-1', name: 'Lugar dos Nada' }));
  // ---- closed panel, another hunt shown: search, press the card, wait for the details, Caçar
  let p = await open(ctx, { preselect: 'steel-300', tab: 'fav', typeFilter: 'Aço' }); put(1, p);
  let r = await A.goHunt(1, TORCHIC);
  const L = await log(p);
  ok('closed panel (a favorites tab and a type filter "Aço" were left on): the Hunts button is pressed once, the filters are set back to "Todos", "Torchic" is typed, its card is pressed and Caçar is pressed: hunts-open ... select:Cratera dos Torchic, hunt:Cratera dos Torchic', r.ok === true && L[0] === 'hunts-open' && L.includes('f:todos') && L.includes('f:niveis') && L.includes('tab-all') && L.includes('search:Torchic') && L.indexOf('select:Cratera dos Torchic') > L.indexOf('search:Torchic') && L[L.length - 1] === 'search:' && L.indexOf('hunt:Cratera dos Torchic') > L.indexOf('select:Cratera dos Torchic'), [r, L]);
  ok('...the star was not pressed, only one hunt was started, and the search box of the game was emptied again', !L.includes('star') && L.filter(x => x.startsWith('hunt:')).length === 1 && (await q(p)) === '', [L, await q(p)]);
  ok('...the "Todos" button of the chat (outside the panel) was not pressed', !L.includes('chat-todos'), L);
  // ---- the details already show the hunt
  p = await open(ctx, { startOpen: true, preselect: 'grass-100' }); put(1, p); r = await A.goHunt(1, TORCHIC);
  ok('the details of the panel already show the hunt: nothing is searched or filtered, only Caçar is pressed (and the Hunts button is not pressed: the panel was open)', r.ok === true && JSON.stringify(await log(p)) === '["hunt:Cratera dos Torchic"]', [r, await log(p)]);
  // ---- already there
  p = await open(ctx, { startOpen: true, preselect: 'grass-100', current: 'grass-100' }); put(1, p); r = await A.goHunt(1, TORCHIC);
  ok('the button says "Caçando" (it is the hunt in progress): ok, "already", nothing pressed', r.ok === true && r.already === true && (await log(p)).length === 0, [r, await log(p)]);
  // ---- the same Pokémon in two hunts
  p = await open(ctx, { startOpen: true, preselect: 'steel-300' }); put(2, p); r = await A.goHunt(2, { id: 'unown-250', name: 'Ruínas dos Unown' });
  const L2 = await log(p);
  ok('two hunts with Unown (Templo, level 200, and Ruínas, level 250): the card of the wrong one is tried first, the details show it is not the hunt, the next card is pressed, and Caçar is pressed only for Ruínas dos Unown', r.ok === true && L2.filter(x => x.startsWith('hunt:')).join() === 'hunt:Ruínas dos Unown' && L2.filter(x => x.startsWith('select:')).length === 2 && !L2.includes('hunt:Templo dos Unown'), [r, L2]);
  // ---- the typing must be a real input event
  p = await open(ctx, { startOpen: true, preselect: 'steel-300' }); put(2, p); r = await A.goHunt(2, { id: 'psychic-100', name: 'Cripta dos Gengar' });
  ok('the search box reacts to an input event (like the page of a real game), which is what is sent: the list was filtered and Gengar was found', r.ok === true && (await log(p)).includes('search:Gengar') && (await log(p)).includes('hunt:Cripta dos Gengar'), [r, await log(p)]);
  // ---- failures: Caçar is never pressed for another hunt
  p = await open(ctx, { startOpen: true, preselect: 'steel-300', brokenSelect: true }); put(3, p); r = await A.goHunt(3, TORCHIC);
  ok('the details never show the hunt (the card does not select it): "hunt did not open", Caçar NOT pressed, the search box emptied again', r.ok === false && r.reason === 'hunt did not open' && !(await log(p)).some(x => x.startsWith('hunt:')) && (await q(p)) === '', [r, await log(p)]);
  p = await open(ctx, { startOpen: true, preselect: 'steel-300' }); put(3, p); r = await A.goHunt(3, { id: 'x-9', name: 'Castelo dos Mewtwo' });
  ok('a hunt that has no card (the Pokémon is not in the list): "hunt not found", nothing selected or started, search emptied', r.ok === false && r.reason === 'hunt not found' && !(await log(p)).some(x => x.startsWith('select:') || x.startsWith('hunt:')) && (await q(p)) === '', [r, await log(p)]);
  p = await open(ctx, { startOpen: true, preselect: 'steel-300', noSearch: true }); put(3, p); r = await A.goHunt(3, TORCHIC);
  // (lang-63: the Hunts panel is recognised by its search box; one without it is not taken for the panel, so it is not found either)
  ok('no search box in the panel: not done ("hunts panel did not open" / "search box not found"), with the buttons of the page for the report, and no card or Caçar pressed', r.ok === false && /hunts panel did not open|search box not found/.test(r.reason) && r.labels.indexOf('todos') >= 0 && !(await log(p)).some(x => x.startsWith('select:') || x.startsWith('hunt:')), [r, await log(p)]);
  p = await open(ctx, { menu: ['Pokédex', 'Breed'] }); put(3, p); r = await A.goHunt(3, TORCHIC);
  ok('no Hunts button in the menu: "hunts button not found"', r.ok === false && r.reason === 'hunts button not found' && r.labels.length > 0, r);
  p = await open(ctx, { login: true, menu: ['Entrar'] }); put(3, p); r = await A.goHunt(3, TORCHIC);
  ok('not signed in: "not signed in"', r.reason === 'not signed in', r);
  delete accounts._guests[4]; r = await A.goHunt(4, TORCHIC);
  ok('no game screen yet: "no game screen"', r.reason === 'no game screen', r);
  accounts._guests[2] = { executeJavaScript: () => Promise.reject(new Error('destroyed')) }; r = await A.goHunt(2, TORCHIC);
  ok('a page that fails: "page did not answer"', r.reason === 'page did not answer', r);
  A._setTimeout(300); accounts._guests[2] = { executeJavaScript: () => new Promise(() => {}) }; const t0 = Date.now(); r = await A.goHunt(2, TORCHIC);
  ok('a page that never answers is given up after the time limit (the limit plus the time the search may take)', r.reason === 'page did not answer' && Date.now() - t0 < 9000, [r, Date.now() - t0]);
  A._setTimeout(9000);
  // ---- the hunt data is not needed: the Pokémon is taken from the name
  A._setHuntData({ hunts: [], species: {} });
  p = await open(ctx, { startOpen: true, preselect: 'steel-300' }); put(1, p); r = await A.goHunt(1, { id: 'grass-100', name: 'Cratera dos Torchic' });
  ok('without hunt data the Pokémon is taken from the name ("... dos Torchic" = Torchic) and it still works', r.ok === true && (await log(p)).includes('search:Torchic') && (await log(p)).includes('hunt:Cratera dos Torchic'), [r, await log(p)]);
  p = await open(ctx, { startOpen: true, preselect: 'grass-100' }); put(1, p); r = await A.goHunt(1, { id: 'steel-300', name: 'Mina de Ferro dos Aron' });
  ok('a name with another "de" in it ("Mina de Ferro dos Aron") gives Aron, not "Ferro dos Aron": it is found and started', r.ok === true && (await log(p)).includes('search:Aron') && (await log(p)).includes('hunt:Mina de Ferro dos Aron'), [r, await log(p)]);
  // ---- requests that make no sense
  const bad = [await A.goHunt(0, TORCHIC), await A.goHunt(5, TORCHIC), await A.goHunt('1', TORCHIC), await A.goHunt(1, null), await A.goHunt(1, {}), await A.goHunt(1, { id: '', name: '' }), await A.goHunt(1, 'Torchic')];
  ok('a request that makes no sense (panel 0, 5, text; no hunt; empty hunt) is refused with "bad request"', bad.every(x => x.ok === false && x.reason === 'bad request'), bad);
  // ---- the report and the request of the window
  const info = A.lastInfo();
  ok('the report gets what the last press did: what ("lasthunt"), the hunt, which panel, ok, and no page text', info && info.what === 'lasthunt' && info.hunt && typeof info.ok === 'boolean' && JSON.stringify(info).indexOf('Fulano') < 0, info);
  const handlers = {};
  const stub = { app: { whenReady: () => new Promise(() => {}), getAppPath: () => __dirname, getLocale: () => 'en-US', getPath: () => __dirname }, BrowserWindow: { fromWebContents: wc => (wc && wc.ours ? {} : null) }, ipcMain: { handle: (ch, fn) => { handlers[ch] = fn; } } };
  const orig = Module._load; Module._load = function (req) { return req === 'electron' ? stub : orig.apply(this, arguments); };
  Object.keys(require.cache).filter(k => /gamenav\.js|settings\.js|accounts\.js/.test(k)).forEach(k => delete require.cache[k]);
  const A2 = require('./gamenav'), acc2 = require('./accounts'); A2.init(); Module._load = orig; A2._setHuntData({ hunts: [], species: {} });
  const z = await open(ctx, { startOpen: true, preselect: 'grass-100' }); acc2._guests[2] = guestOf(z);
  ok('the request exists in the main process', typeof handlers['nav:hunt'] === 'function', Object.keys(handlers));
  ok('a game panel (not our window) gets nothing and nothing is pressed', (await handlers['nav:hunt']({ sender: { ours: false } }, 2, TORCHIC)) === null && (await log(z)).length === 0);
  const ans = await handlers['nav:hunt']({ sender: { ours: true } }, 2, TORCHIC);
  ok('our own window gets the answer and Caçar is pressed', ans && ans.ok === true && (await log(z)).includes('hunt:Cratera dos Torchic'), [ans, await log(z)]);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
