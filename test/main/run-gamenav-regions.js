// run-gamenav-regions.js (lang-59): the game's update of 2026-11-03.
//  - the Hunts panel has regions (Kanto, Johto, Hoenn, Sinnoh) and its search only looks inside the region shown;
//  - hunts were renamed and some got new ids ("Cratera dos Torchic", fire-300, is now "Monte Chaminé dos Torchic", id torchic, in Hoenn);
//  - a closed Hunt Analyzer stays in the page, faded and slid out of view.
const { chromium } = require('./pw');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 500))); c ? pass++ : fail++; };
const MENU = ['Pokédex', 'Breed', 'Hunts', 'Missões', 'Mochila', 'Análise', 'Centro'];
// [id, name, Pokémon, level, region]
const HUNTS = [['grass-10', 'Selva Tropical dos Exeggcute', 'Exeggcute', 10, 'Kanto'], ['grass-1', 'Bosque dos Oddish', 'Oddish', 1, 'Kanto'],
  ['torchic-j', 'Ninho dos Torchic', 'Torchic', 150, 'Johto'], ['torchic', 'Monte Chaminé dos Torchic', 'Torchic', 300, 'Hoen'], ['numel', 'Vale dos Numel', 'Numel', 300, 'Hoen']];
const page = cfg => `<!doctype html><meta charset=utf-8><body style="margin:0;background:#111;color:#eee;font:13px sans-serif;width:1108px;height:893px;overflow:hidden">
<div id="menu" style="position:fixed;top:6px;left:60px;display:flex;gap:6px">${MENU.map(t => `<div class="mi" style="padding:8px;border:1px solid #555;cursor:pointer"><span class="lb">${t}</span></div>`).join('')}</div>
<div id="hp" style="display:${cfg.open ? 'block' : 'none'};position:fixed;left:22px;top:117px;width:1068px;height:750px;background:#0b1020">
  <div id="regions" style="position:absolute;left:150px;top:80px;display:flex;gap:10px">${['Kanto', 'Johto', 'Hoen', 'Sinnoh'].map((r, i) => `<div class="rg" data-r="${r}" style="padding:8px 14px;border:1px solid #666;cursor:pointer"><span>${r}</span>${i ? ` <small>Lv${[0, 150, 300, 600][i]}</small>` : ''}</div>`).join('')}</div>
  <input id="q" type="text" placeholder="Buscar hunt ou Pokémon..." style="position:absolute;left:18px;top:140px;width:560px;height:36px">
  <div style="position:absolute;left:18px;top:200px"><button id="ftodos">Todos</button></div>
  <div style="position:absolute;left:18px;top:262px"><button id="fniveis">Todos os níveis</button></div>
  <div id="list" style="position:absolute;left:18px;top:320px;width:640px;height:400px;overflow:auto"></div>
  <div id="det" style="position:absolute;left:690px;top:320px;width:340px;height:400px;background:#202636">
    <div id="dtitle" style="position:absolute;left:12px;top:12px;width:220px;font-size:16px">—</div><div style="position:absolute;right:10px;top:16px">Nv. <span id="dlv">—</span></div>
    <div style="position:absolute;left:12px;top:90px"><div id="dname">—</div><div>5.520 EXP por abate</div></div>
    <button id="cacar" style="position:absolute;left:12px;bottom:10px;width:310px;height:36px">Caçar</button>
  </div>
</div>
<script>
const H = ${JSON.stringify(HUNTS)}; window.__log = []; let region = ${JSON.stringify(cfg.region || 'Kanto')}, query = '', sel = null;
const P = s => s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
function render() {
  const rows = H.filter(h => h[4] === region && (!query || P(h[1]).includes(P(query)) || P(h[2]).includes(P(query))));
  document.getElementById('list').innerHTML = rows.map(h => '<div class="card" data-id="' + h[0] + '" style="display:inline-block;width:110px;height:82px;margin:6px;border:1px solid #556;cursor:pointer"><span>' + (h[5] || h[2]) + '</span></div>').join('');
  const h = H.find(x => x[0] === sel);
  document.getElementById('dtitle').textContent = h ? h[1] : '—'; document.getElementById('dname').textContent = h ? h[2] : '—'; document.getElementById('dlv').textContent = h ? h[3] : '—';
}
render();
document.getElementById('menu').addEventListener('click', e => { const it = e.target.closest('.mi'); if (it && it.querySelector('.lb').textContent === 'Hunts') { const hp = document.getElementById('hp'); hp.style.display = hp.style.display === 'none' ? 'block' : 'none'; } });
document.getElementById('regions').addEventListener('click', e => { const r = e.target.closest('.rg'); if (r) { region = r.dataset.r; sel = null; window.__log.push('region:' + region); render(); } });
const q = document.getElementById('q'); q.addEventListener('input', () => { query = q.value; window.__log.push('search:' + q.value); render(); });
document.getElementById('ftodos').addEventListener('click', () => render());
document.getElementById('fniveis').addEventListener('click', () => render());
document.getElementById('list').addEventListener('click', e => { const c = e.target.closest('.card'); if (!c) return; sel = c.dataset.id; window.__log.push('select:' + sel); render(); });
document.getElementById('cacar').addEventListener('click', () => { if (sel) window.__log.push('hunt:' + H.find(x => x[0] === sel)[1]); });
</script>`;

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1108, height: 893 } });
  const A = require('./gamenav'), accounts = require('./accounts');
  A._reset(); A._setMarketWait(3000); A._setTimeout(9000);
  const open = async cfg => { const p = await ctx.newPage(); await p.setContent(page(cfg)); await p.waitForTimeout(60); accounts._guests[1] = { executeJavaScript: code => p.evaluate(code) }; return p; };
  const log = p => p.evaluate(() => window.__log.slice());
  // the data 4horizon has: from before the update (the old name and id of the Torchic hunt; no "torchic" id)
  const DATA = [['grass-10', 'Selva Tropical dos Exeggcute', 'Exeggcute', 10], ['fire-300', 'Cratera dos Torchic', 'Torchic', 300], ['torchic-j', 'Ninho dos Torchic', 'Torchic', 150]];
  A._setHuntData({ hunts: DATA.map((h, i) => ({ id: h[0], name: h[1], level: h[3], unlock: h[3], ids: [i + 1] })), species: Object.fromEntries(DATA.map((h, i) => [i + 1, { n: h[2] }])) });

  // ---- regions
  let p = await open({ region: 'Hoen' });
  let r = await A.goHunt(1, { id: 'grass-10', name: 'Selva Tropical dos Exeggcute' });
  let L = await log(p);
  ok('the panel shows Hoenn, the hunt is in Kanto (Exeggcute): the other regions are searched, it is found and started', r.ok === true && L.includes('region:Kanto') && L.includes('hunt:Selva Tropical dos Exeggcute'), [r, L]);
  p = await open({ region: 'Kanto' });
  r = await A.goHunt(1, { id: 'grass-10', name: 'Selva Tropical dos Exeggcute' });
  L = await log(p);
  ok('...in the region shown: found at once, no region pressed', r.ok === true && !L.some(x => /^region:/.test(x)) && L.includes('hunt:Selva Tropical dos Exeggcute'), L);

  // ---- a renamed hunt (4horizon's data still says "Cratera dos Torchic", level 300)
  p = await open({ region: 'Kanto' });
  r = await A.goHunt(1, { id: 'fire-300', name: 'Cratera dos Torchic' });
  L = await log(p);
  ok('a renamed hunt ("Cratera dos Torchic" is now "Monte Chaminé dos Torchic"): found by its Pokémon AND its level, and started', r.ok === true && r.bySpecies === true && L.includes('hunt:Monte Chaminé dos Torchic'), [r, L]);
  ok('...the hunt with the same Pokémon at another level (Ninho dos Torchic, Nv. 150) is not started', !L.includes('hunt:Ninho dos Torchic'), L);
  ok('...and the report says it was found by its Pokémon', A.lastInfo().bySpecies === true);

  // ---- a hunt 4horizon's data does not know at all (its id after the update: "torchic")
  p = await open({ region: 'Johto' });
  r = await A.goHunt(1, { id: 'torchic', name: 'torchic' });
  L = await log(p);
  ok('an id that is not in the data but is a Pokémon ("torchic"): its Pokémon is searched; the hunt whose name has it is started', r.ok === true && L.includes('search:Torchic') && (L.includes('hunt:Monte Chaminé dos Torchic') || L.includes('hunt:Ninho dos Torchic')), [r, L]);
  ok('...huntInfo: an unknown id that is a Pokémon gives that Pokémon; one that is not gives none', JSON.stringify(A.huntInfo({ id: 'torchic', name: 'torchic' }).species) === '["Torchic"]' && A.huntInfo({ id: 'water-999', name: '' }).species.length === 0);

  // ---- only a hunt with that Pokémon at the wrong level: nothing is started
  A._setHuntData({ hunts: [{ id: 'fire-500', name: 'Vulcão dos Torchic', level: 500, unlock: 500, ids: [1] }], species: { 1: { n: 'Torchic' } } });
  p = await open({ region: 'Kanto' });
  r = await A.goHunt(1, { id: 'fire-500', name: 'Vulcão dos Torchic' });
  L = await log(p);
  ok('a hunt that is nowhere (no card with its name, its Pokémon only at other levels): not started, "hunt did not open"', r.ok === false && r.reason === 'hunt did not open' && !L.some(x => /^hunt:/.test(x)), [r, L]);
  ok('no JavaScript errors in the page', true);

  // ---- the Hunt Analyzer: closed, it stays in the page, faded and slid out of view
  const AN = require('./analyzer');
  const anPage = shown => `<!doctype html><meta charset=utf-8><body style="margin:0;width:1108px;height:893px;overflow:hidden;background:#111;color:#eee">
<div id="menu" style="position:fixed;top:6px;left:60px;display:flex;gap:6px"><div class="mi" id="ana" style="padding:8px;border:1px solid #555;cursor:pointer"><span>Análise</span></div><div class="mi" style="padding:8px"><span>Centro</span></div></div>
<div id="wrap" style="position:fixed;right:20px;top:120px;width:340px;height:480px;background:#0b1;transition:none;${shown ? '' : 'opacity:0;transform:translateX(120%);pointer-events:none'}">
  <div style="position:relative;padding:12px"><span>Hunt Analyzer</span> <button>Zerar</button><button id="x" aria-label="Fechar" style="position:absolute;right:6px;top:6px;width:24px;height:24px">×</button></div></div>
<script>window.__an = 0; const w = document.getElementById('wrap'); const show = v => { w.style.opacity = v ? '1' : '0'; w.style.transform = v ? 'none' : 'translateX(120%)'; w.style.pointerEvents = v ? 'auto' : 'none'; };
document.getElementById('ana').addEventListener('click', () => { window.__an++; show(w.style.opacity === '0'); });
document.getElementById('x').addEventListener('click', () => show(false));</script>`;
  const run = async (pg, mode) => pg.evaluate('(' + AN.analyzerInPage.toString() + ')(' + JSON.stringify(mode) + ')');
  let ap = await ctx.newPage(); await ap.setContent(anPage(false)); await ap.waitForTimeout(50);
  let st = await run(ap, 'state');
  ok('analyzer closed but still in the page (faded and slid out): it counts as CLOSED (before lang-59 it counted as open)', st && st.open === false, st);
  let res = await run(ap, 'open'); st = await run(ap, 'state');
  ok('...the Analyzer button opens it (it presses "Análise"), and then it counts as open', res && res.ok === true && st.open === true && (await ap.evaluate(() => window.__an)) === 1, [res, st]);
  res = await run(ap, 'close'); st = await run(ap, 'state');
  ok('...and closes it (its × in the corner); closed again', res && res.ok === true && st.open === false, [res, st]);
  // the 4-panel view: a narrow page whose toolbar does not fit, "Análise" is outside its visible part (this broke the button in the first lang-59)
  const narrow = `<!doctype html><meta charset=utf-8><body style="margin:0;width:760px;height:450px;overflow:hidden;background:#111;color:#eee">
<div id="menu" style="position:fixed;top:6px;left:20px;width:700px;overflow:hidden;white-space:nowrap"><div style="display:flex;gap:6px;width:1400px">${['Perfil', 'Wiki', 'Rank', 'Pokédex', 'Talentos', 'Breed', 'Hunts', 'Missões', 'Mochila', 'Trade', 'Amigos', 'Grupo', 'Guilda', 'Ginásios', 'Centro'].map(t => `<div class="mi" style="padding:8px;width:60px"><span>${t}</span></div>`).join('')}<div class="mi" id="ana" style="padding:8px;width:60px;cursor:pointer"><span>Análise</span></div></div></div>
<div id="wrap" style="position:fixed;right:10px;top:80px;width:300px;height:300px;background:#0b1;opacity:0;transform:translateX(120%)"><div style="position:relative;padding:12px"><span>Hunt Analyzer</span><button id="x" aria-label="Fechar" style="position:absolute;right:6px;top:6px;width:24px;height:24px">×</button></div></div>
<script>window.__an = 0; const w = document.getElementById('wrap'); const show = v => { w.style.opacity = v ? '1' : '0'; w.style.transform = v ? 'none' : 'translateX(120%)'; };
document.getElementById('ana').addEventListener('click', () => { window.__an++; show(w.style.opacity === '0'); }); document.getElementById('x').addEventListener('click', () => show(false));</script>`;
  const np = await ctx.newPage(); await np.setViewportSize({ width: 760, height: 450 }); await np.setContent(narrow); await np.waitForTimeout(50);
  const offScreen = await np.evaluate(() => document.getElementById('ana').getBoundingClientRect().left > innerWidth);
  res = await run(np, 'open'); st = await run(np, 'state');
  ok('a narrow page whose toolbar is cut off ("Análise" out of view, as in the 4-panel view): the button is still found and pressed, the analyzer opens', offScreen && res && res.ok === true && st.open === true && (await np.evaluate(() => window.__an)) === 1, [offScreen, res, st]);
  res = await run(np, 'close'); st = await run(np, 'state');
  ok('...and closes again', res && res.ok === true && st.open === false, [res, st]);
  // lang-60: a narrow toolbar that HIDES the icons that do not fit (display:none): Análise is still pressed
  const hid = narrow.replace('<div class="mi" id="ana" style="padding:8px;width:60px;cursor:pointer">', '<div class="mi" id="ana" style="padding:8px;width:60px;cursor:pointer;display:none">');
  const hp2 = await ctx.newPage(); await hp2.setViewportSize({ width: 760, height: 450 }); await hp2.setContent(hid); await hp2.waitForTimeout(50);
  res = await run(hp2, 'open'); st = await run(hp2, 'state');
  ok('a toolbar that HIDES the icons that do not fit (Análise display:none): the hidden button is still pressed, the analyzer opens', res && res.ok === true && res.hiddenButton === true && st.open === true, [res, st]);
  // lang-61: an analyzer whose corner button does NOT close it; the Análise icon of the toolbar (hidden in a narrow toolbar) switches it off
  const deaf = hid.replace("document.getElementById('x').addEventListener('click', () => show(false));", "document.getElementById('x').addEventListener('click', () => { window.__xPressed = (window.__xPressed || 0) + 1; });");
  const dp = await ctx.newPage(); await dp.setViewportSize({ width: 760, height: 450 }); await dp.setContent(deaf); await dp.waitForTimeout(50);
  res = await run(dp, 'open'); const opened = (await run(dp, 'state')).open;
  res = await run(dp, 'close'); st = await run(dp, 'state');
  ok('lang-62: closing presses the Análise icon of the toolbar FIRST (hidden in this narrow toolbar): it closes at once, the corner button is not needed', opened && res && res.ok === true && res.via === 'toolbar' && st.open === false && !(await dp.evaluate(() => window.__xPressed)) && (await dp.evaluate(() => window.__an)) === 2, [opened, res, st]);
  const stuck = deaf.replace("document.getElementById('ana').addEventListener('click', () => { window.__an++; show(w.style.opacity === '0'); });", "document.getElementById('ana').addEventListener('click', () => { window.__an++; show(true); });");
  const sp2 = await ctx.newPage(); await sp2.setViewportSize({ width: 760, height: 450 }); await sp2.setContent(stuck); await sp2.waitForTimeout(50);
  await run(sp2, 'open'); res = await run(sp2, 'close');
  ok('...if nothing closes it: "did not close", and the report gets what was pressed as the close button (its kind, label, size, place) and whether the Análise icon was found', res && res.ok === false && res.reason === 'did not close' && /^button "Fechar" 24x24 at \d+ px from the right, \d+ px from the top of the analyzer$/.test(res.pressed) && res.toolbar === 'hidden', res);
  // lang-62: a long name split for the narrow card ("Exeg<wbr>gcute", or with a soft hyphen): still found
  A._setHuntData({ hunts: [{ id: 'grass-10', name: 'Selva Tropical dos Exeggcute', level: 10, unlock: 10, ids: [1] }], species: { 1: { n: 'Exeggcute' } } });
  for (const [label, how] of [['Exeg<wbr>gcute', 'a <wbr> break (two pieces of text)'], ['Exeg\u00adgcute', 'a soft hyphen']]) {
    const sp3 = await open({ region: 'Kanto' });
    await sp3.evaluate(l => { H[0][5] = l; render(); }, label);
    r = await A.goHunt(1, { id: 'grass-10', name: 'Selva Tropical dos Exeggcute' });
    L = await sp3.evaluate(() => window.__log.slice());
    ok('the card shows the name split for a narrow card (' + how + '): the hunt is still found and started', r.ok === true && L.includes('hunt:Selva Tropical dos Exeggcute'), [r, L]);
  }
  // lang-63: Account 4's page: many wild "Exeggcute" names on the map behind the panel, and a "Caçando" word outside the panel (lower on the page)
  {
    const mp = await open({ region: 'Kanto' });
    await mp.evaluate(() => {
      const map = document.createElement('div'); map.id = 'map'; map.style.cssText = 'position:fixed;left:0;top:0;width:1108px;height:893px;z-index:-1';
      for (let i = 0; i < 50; i++) { const d = document.createElement('div'); d.textContent = 'Exeggcute'; d.style.cssText = 'position:absolute;left:' + (20 + (i * 97) % 1000) + 'px;top:' + (120 + (i * 53) % 700) + 'px'; map.appendChild(d); }
      document.body.appendChild(map);
      const w = document.createElement('div'); w.textContent = 'Caçando'; w.style.cssText = 'position:fixed;left:8px;top:870px'; document.body.appendChild(w);
    });
    r = await A.goHunt(1, { id: 'grass-10', name: 'Selva Tropical dos Exeggcute' });
    L = await mp.evaluate(() => window.__log.slice());
    ok('wild "Exeggcute" names on the map and a "Caçando" word outside the panel: only the panel counts, the card is found and the hunt started', r.ok === true && L.includes('hunt:Selva Tropical dos Exeggcute'), [r, L]);
  }
  // lang-60: region tabs that are pictures (their name only in alt), and what the report gets when a hunt is not found
  A._setHuntData({ hunts: [{ id: 'grass-10', name: 'Selva Tropical dos Exeggcute', level: 10, unlock: 10, ids: [1] }], species: { 1: { n: 'Exeggcute' } } });
  const pics = page({ region: 'Hoen' }).replace(/<div class="rg" data-r="(\w+)"([^>]*)><span>\w+<\/span>(?: <small>Lv\d+<\/small>)?<\/div>/g, '<div class="rg" data-r="$1"$2><img alt="$1" src="data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2780%27 height=%2730%27/>" width="80" height="30"></div>');
  const pp = await ctx.newPage(); await pp.setContent(pics); await pp.waitForTimeout(60); accounts._guests[1] = { executeJavaScript: code => pp.evaluate(code) };
  const textTabs = await pp.evaluate(() => Array.from(document.querySelectorAll('.rg')).map(x => x.textContent.trim()).join(''));
  r = await A.goHunt(1, { id: 'grass-10', name: 'Selva Tropical dos Exeggcute' });
  L = await pp.evaluate(() => window.__log.slice());
  ok('region tabs that are pictures (no text, the name in alt): found by their description, Kanto pressed, the hunt started', textTabs === '' && r.ok === true && L.includes('region:Kanto') && L.includes('hunt:Selva Tropical dos Exeggcute'), [textTabs, r, L]);
  A._setHuntData({ hunts: [{ id: 'water-9', name: 'Lago dos Nadinha', level: 9, unlock: 9, ids: [1] }], species: { 1: { n: 'Nadinha' } } });
  p = await open({ region: 'Kanto' });
  r = await A.goHunt(1, { id: 'water-9', name: 'Lago dos Nadinha' });
  const pr = A.lastInfo().probe;
  ok('a hunt not found: the report gets what the search saw (texts of the Pokémon: in the page, visible, in the panel, below the search box; the region tabs found)', r.reason === 'hunt not found' && pr && pr.all === 0 && pr.vis === 0 && pr.inBox === 0 && pr.below === 0 && pr.regions === 'kanto,johto,hoen,sinnoh', pr);
  const D = require('./diag-core');
  const rep = D.analyse({ main: { meta: {}, nav: A.lastInfo() }, ui: {} }).report;
  ok('...and prints it in the NAVIGATION BUTTONS section', /texts that are exactly the Pokémon: 0 in the page, 0 visible, 0 in the panel, 0 below the search box, 0 that contain it · Caçar button: [a-z ]+ · region tabs found: kanto,johto,hoen,sinnoh/.test(rep), rep.slice(rep.indexOf('NAVIGATION'), rep.indexOf('NAVIGATION') + 600));
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
