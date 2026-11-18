// run-clean.js (lang-73): clean.js, the clean mini screens: while a game screen is a mini (the window says which, 'clean:set'), style rules hide the game's boxes in
// that page (the player card, the icon bar, the hunt box, the chat, the Auto Helper) and nothing else; expanded again, the rules are taken out; a page that loads
// again gets them again; only the app's own window is answered; the report says which panels are clean. The rules are tried on a page drawn like the game's.
const { chromium } = require('./pw');
const electron = require('electron');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 600))); c ? pass++ : fail++; };
const A = require('./accounts'); const C = require('./clean');
// a fake game page (what Check the game reported on 2026-11-17): the names of the boxes inside the .hud layer, the map behind
const wcOf = n => { const ls = {}; return { n, css: [], removed: [], isDestroyed: () => false, on(ev, f) { (ls[ev] = ls[ev] || []).push(f); }, fire: ev => (ls[ev] || []).forEach(f => f()),
  insertCSS(c) { this.css.push(c); return Promise.resolve('k' + n + '-' + this.css.length); }, removeInsertedCSS(k) { this.removed.push(k); return Promise.resolve(); } }; };
const tick = () => new Promise(r => setTimeout(r, 20));
(async () => {
  const g = A._guests; const W = { 1: wcOf(1), 2: wcOf(2), 3: wcOf(3), 4: wcOf(4) }; [1, 2, 3, 4].forEach(n => { g[n] = W[n]; });
  C._reset();
  // ---- the rules themselves, on a page like the game's
  const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent('<body style="margin:0"><div class="map" style="position:absolute;inset:0;background:#363"><span id="mon">Cranidos</span></div><div class="hud" style="position:absolute;inset:0;pointer-events:none">' +
    '<section class="trainer-card frame" id="card" style="position:absolute;left:14px;top:14px;width:290px;height:396px">VENOM <div class="team-head">EQUIPE 4/6</div></section>' +
    '<div class="toolbar-wrap" id="bar" style="position:absolute;left:318px;top:14px;width:848px;height:158px"><nav class="toolbar frame"><button class="tool"><span class="tool-label">Perfil</span></button></nav></div>' +
    '<div class="hunt-pill" id="hunt" style="position:absolute;right:14px;top:14px;width:324px;height:87px">Covil <button class="defeat-toggle">ABATES</button></div>' +
    '<div class="chat-panel" id="chat" style="position:absolute;left:14px;bottom:14px;width:670px;height:280px"><button>GERAL</button><input placeholder="Falar em Geral..."></div>' +
    '<section class="capture frame" id="helper" style="position:absolute;right:14px;bottom:14px;width:310px;height:131px"><span class="frame-title auto-helper-title">AUTO HELPER</span></section>' +
    '<div class="timers" id="timers" style="position:absolute;left:360px;top:160px">18m · 11h 25m</div><div class="beta-rank" id="rank" style="position:absolute;left:540px;top:440px">Beta Rank</div></div>' +
    '<div class="modal" id="modal" style="position:absolute;left:300px;top:200px"><section class="capture">a shop card that is NOT in the hud</section></div>');
  const shown = id => p.evaluate(id => getComputedStyle(document.getElementById(id)).display !== 'none', id);
  ok('before the rules: everything is drawn', (await Promise.all(['card', 'bar', 'hunt', 'chat', 'helper', 'timers', 'rank', 'mon', 'modal'].map(shown))).every(Boolean));
  await p.addStyleTag({ content: C.CSS });
  const after = {}; for (const id of ['card', 'bar', 'hunt', 'chat', 'helper', 'timers', 'rank', 'mon', 'modal']) after[id] = await shown(id);
  ok('with the rules: the player card, the icon bar, the hunt box, the chat and the Auto Helper are hidden', !after.card && !after.bar && !after.hunt && !after.chat && !after.helper, after);
  ok('...and nothing else: the map and the Pokémon, the timers, the Beta Rank, and a shop card outside the hud (the same word "capture") are still drawn', after.timers && after.rank && after.mon && after.modal, after);
  ok('the rules only ever hide (display: none inside .hud), they change nothing else', /^[^{]+\{ display: none !important; \}$/.test(C.CSS.replace(/\n/g, ' ')) && C.CSS.split('{')[0].split(',').every(s => /\.hud /.test(s)), C.CSS);
  await b.close();
  // ---- the clean expanded screen: only the chat, the hunt box and the Auto Helper go
  const p2 = await (await chromium.launch()).newPage();
  await p2.setContent('<body><div class="hud"><section class="trainer-card frame" id="card">card</section><div class="toolbar-wrap" id="bar">bar</div><div class="hunt-pill" id="hunt">hunt</div><div class="chat-panel" id="chat">chat</div><section class="capture frame" id="helper">helper</section></div>');
  await p2.addStyleTag({ content: C.CSS_BIG });
  const big = {}; for (const id of ['card', 'bar', 'hunt', 'chat', 'helper']) big[id] = await p2.evaluate(id => getComputedStyle(document.getElementById(id)).display !== 'none', id);
  ok('the rules of the clean expanded screen hide the hunt box, the chat and the Auto Helper, and keep the player card and the icon bar', !big.hunt && !big.chat && !big.helper && big.card && big.bar, big);
  await p2.context().browser().close();
  // the icon bar takes the room of the hunt box: a page laid out as the game's (the bar centred with equal margins, 848 px wide at 1484)
  const p3 = await (await chromium.launch()).newPage(); await p3.setViewportSize({ width: 1484, height: 903 });
  await p3.setContent('<body style="margin:0"><div class="hud" style="position:absolute;inset:0"><section class="trainer-card frame" style="position:absolute;left:14px;top:14px;width:290px;height:396px"></section>' +
    '<div class="toolbar-wrap" id="wrap" style="position:absolute;top:14px;left:318px;width:848px;height:158px"><nav class="toolbar frame" id="nav" style="width:848px;overflow-x:auto;white-space:nowrap">' + '<span style="display:inline-block;width:48px;height:60px;margin:0 6px;background:#345"></span>'.repeat(18) + '</nav></div>' +
    '<div class="hunt-pill" id="hunt" style="position:absolute;right:14px;top:14px;width:324px;height:87px"></div></div>');
  const before3 = await p3.evaluate(() => { const r = document.getElementById('wrap').getBoundingClientRect(), n = document.getElementById('nav'); return { l: r.left, r: Math.round(r.right), w: Math.round(r.width), scrolls: n.scrollWidth > n.clientWidth + 1 }; });
  await p3.addStyleTag({ content: C.CSS_BIG });
  const after3 = await p3.evaluate(() => { const r = document.getElementById('wrap').getBoundingClientRect(), n = document.getElementById('nav'); return { l: r.left, r: Math.round(r.right), w: Math.round(r.width), scrolls: n.scrollWidth > n.clientWidth + 1, hunt: getComputedStyle(document.getElementById('hunt')).display }; });
  ok('with the hunt box hidden the icon bar runs to 14 px from the right edge (from 848 to 1152 px wide), its left edge unchanged, so more icons fit (it no longer scrolls here)', before3.w === 848 && before3.scrolls && after3.l === 318 && after3.r === 1484 - 14 && after3.w === 1152 && !after3.scrolls && after3.hunt === 'none', [before3, after3]);
  await p3.context().browser().close();
  // ---- the window says which panels are minis
  let r = C.set([2, 3, 4]); await tick();
  ok('clean:set [2, 3, 4]: the rules go into panels 2, 3 and 4, not 1', r.minis.join() === '2,3,4' && W[2].css.length === 1 && W[3].css.length === 1 && W[4].css.length === 1 && W[1].css.length === 0 && W[2].css[0] === C.CSS, [r, W.map]);
  r = C.set([1, 3, 4]); await tick();
  ok('the big one and a mini swap (2 expanded, 1 a mini): 2 gets its rules taken out (its key), 1 gets them, 3 and 4 are left as they are (not put in twice)', W[2].removed.join() === 'k2-1' && W[1].css.length === 1 && W[3].css.length === 1 && W[4].css.length === 1 && W[3].removed.length === 0, [W[2].removed, W[1].css.length, W[3].css.length]);
  r = C.set([1, 3, 4]); await tick();
  ok('the same list again: nothing happens', W[1].css.length === 1 && W[1].removed.length === 0 && C.info().sets === 3);
  W[3].fire('dom-ready'); await tick();
  ok('a mini whose page loads again (a reload, a login): its rules are put in again', W[3].css.length === 2 && W[3].removed.length === 0, W[3].css.length);
  r = C.set([]); await tick();
  ok('the strip closed (no mini): every rule is taken out, with the right keys', r.minis.length === 0 && W[1].removed.join() === 'k1-1' && W[3].removed.join() === 'k3-2' && W[4].removed.join() === 'k4-1', [W[1].removed, W[3].removed, W[4].removed]);
  W[4].fire('dom-ready'); await tick();
  ok('a page that loads again while it is NOT a mini gets nothing', W[4].css.length === 1);
  // the clean expanded screen, with the minis
  r = C.set({ minis: [2, 3, 4], big: 1 }); await tick();
  ok('{ minis: [2, 3, 4], big: 1 }: the minis get the full rules, the expanded screen (1) the partial ones', r.big === 1 && W[1].css[W[1].css.length - 1] === C.CSS_BIG && W[2].css[W[2].css.length - 1] === C.CSS && C.info().panels.find(x => x.n === 1).kind === 'big' && C.info().panels.find(x => x.n === 2).kind === 'mini', [r, C.info().panels]);
  const k1 = W[1].css.length, rm1 = W[1].removed.length;
  r = C.set({ minis: [1, 3, 4], big: 2 }); await tick();
  ok('1 and 2 swap (2 expanded and clean, 1 a mini): 1 trades its partial rules for the full ones (out, then in), 2 its full ones for the partial', W[1].removed.length === rm1 + 1 && W[1].css.length === k1 + 1 && W[1].css[W[1].css.length - 1] === C.CSS && W[2].css[W[2].css.length - 1] === C.CSS_BIG && C.info().panels.find(x => x.n === 2).kind === 'big', C.info().panels);
  r = C.set({ minis: [1, 3, 4], big: null }); await tick();
  ok('the clean button off (big: null): 2 gets its rules taken out, the minis keep theirs', C.info().panels.find(x => x.n === 2).kind === null && C.info().panels.find(x => x.n === 1).kind === 'mini');
  r = C.set({ minis: [1, 2], big: 2 }); await tick();
  ok('a screen that is both a mini and "big" in the same message (cannot happen; a race): it is a mini', r.big === null && C.info().panels.find(x => x.n === 2).kind === 'mini');
  r = C.set([]); await tick();
  ok('odd lists (text, numbers out of range, nothing) are ignored or trimmed, no crash', C.set('nope').minis.length === 0 && C.set([0, 9, 2.5, 3, '4']).minis.join() === '3,4' && (C.set(null), true));
  const dead = wcOf(9); dead.isDestroyed = () => true; g[2] = dead; C.set([2]); await tick();
  ok('a panel whose page is gone: skipped, no crash', dead.css.length === 0); g[2] = W[2];
  const thrower = wcOf(7); thrower.insertCSS = () => Promise.reject(new Error('no page')); g[1] = thrower; C.set([1]); await tick();
  ok('a page that refuses the rules: noted for the report, no crash', /no page/.test(C.info().error || ''), C.info()); g[1] = W[1];
  // ---- only the app's own window
  C.init();
  const H = electron._handlers, WIN = { sender: electron._WINDOW }, PANEL = { sender: { id: 'panel' } };
  ok('clean:set answers the app window, never a game panel', H['clean:set'](WIN, [3]) && H['clean:set'](WIN, [3]).minis.join() === '3' && H['clean:set'](PANEL, [1, 2, 3, 4]) === null); await tick();
  // ---- the report
  C.set([3, 4]); await tick();
  const D = require('./diag-core');
  const rep = D.analyse({ main: { meta: {}, clean: C.info() }, ui: {} }).report, sec = rep.slice(rep.indexOf('CLEAN MINI SCREENS'), rep.indexOf('\n\n', rep.indexOf('CLEAN MINI SCREENS')));
  ok('report: CLEAN MINI SCREENS, the minis now, each panel clean or whole, the counts', /^CLEAN MINI SCREENS \(while a game screen is a mini screen/.test(sec) && /minis now: Account 3, Account 4 · clean expanded screen: none · Account 1 whole, Account 2 whole, Account 3 clean \(mini\), Account 4 clean \(mini\) · rules put in \d+ times, taken out \d+/.test(sec) && !/\(!\)/.test(sec), sec);
  const rep2 = D.analyse({ main: { meta: {}, clean: { minis: [2], panels: [{ n: 1, mini: false, clean: false }, { n: 2, mini: true, clean: false }], applied: 1, removed: 0, error: null } }, ui: {} }).report;
  ok('...a mini without its rules is flagged "(!)", with what to do', /Account 2 whole \(!\)/.test(rep2) && /\(!\) a screen without the rules it should have/.test(rep2) && /Account 1 clean \(expanded: chat, hunt box and Auto Helper hidden\)/.test(D.analyse({ main: { meta: {}, clean: { minis: [], big: 1, panels: [{ n: 1, mini: false, big: true, clean: true, kind: 'big' }], applied: 1, removed: 0, error: null } }, ui: {} }).report));
  ok('an older app without clean.js: no section', D.analyse({ main: { meta: {} }, ui: {} }).report.indexOf('CLEAN MINI SCREENS') < 0);
  const fs = require('fs'), dsrc = fs.readFileSync('diag.js', 'utf8');
  ok('diag.js starts it, puts it in the report, and its self-check knows it (and the bridge in preload.js, and the window sends the list)', /require\('\.\/clean'\)\.init\(\)/.test(dsrc) && /out\.clean = require\('\.\/clean'\)\.info\(\)/.test(dsrc) && /\['clean\.js', 'the clean mini screens/.test(dsrc) && /cleanSet: \(minis\) => ipcRenderer\.invoke\('clean:set', minis\)/.test(fs.readFileSync('preload.js', 'utf8')) && /api\.cleanSet\(\{ minis: list, big: big \}\)/.test(fs.readFileSync('index.html', 'utf8')));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
