// run-grid-settings.js (lang-73): Settings › Grid, the strip of mini screens beside an expanded screen, and the clean button of the expanded screen.
// The grid stays 2 × 2. Fit: in a 2 × 2 with three screens the third stretches across the bottom (as before)
// or keeps its own quarter. Mini screens: an arrow in the header of the expanded screen (left of the level) shows the other screens as mini screens in a strip
// on the right or along the bottom; a mini is a monitor (its header and its screen take every click and expand it; the game gets none), its header keeps only
// the name, the status and the zoom of the minis (one zoom for all of them, 150% at first, apart from each screen's own zoom). All of it is kept between runs.
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 700))); c ? pass++ : fail++; };
const R = e => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
const lay = p => p.evaluate(() => {
  const R = e => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
  const out = { grid: R(document.getElementById('grid')), cls: document.getElementById('grid').className, panels: {} };
  for (let n = 1; n <= 4; n++) { const el = document.getElementById('panel' + n); const shown = el.style.display !== 'none'; const st = el.querySelector('.st'), zv = el.querySelector('.zv'), sh = el.querySelector('.shield');
    out.panels[n] = Object.assign({}, shown ? R(el) : {}, { shown, mini: el.classList.contains('mini'), box: shown ? R(el) : null, head: shown ? R(el.querySelector('.phead')).h : null, arrow: shown && !st.classList.contains('hidden'), arrowOn: st.classList.contains('on'), arrowTitle: st.title, zoomText: zv.textContent, zoomTitle: zv.title, shield: shown && getComputedStyle(sh).display !== 'none', shieldTitle: sh.title, zoomFactor: (window.__zoomSet || {})[n],
      hiddenBits: shown ? ['.pnav', '.rl', '.ex', '.lvl'].filter(s => el.querySelector(s) && getComputedStyle(el.querySelector(s)).display === 'none') : null }); }
  return out;
});
const EXT = `window.__zoomSet = {}; window.__clean = []; window.__big = []; __bridgeObject.cleanSet = async v => { window.__clean.push(v.minis.slice()); window.__big.push(v.big); return v; }; document.addEventListener('DOMContentLoaded', () => { [1, 2, 3, 4].forEach(n => { const w = document.getElementById('p' + n); if (w) w.setZoomFactor = f => { window.__zoomSet[n] = f; }; }); });`;
const setup = async (b, o) => { const p = await open(b, Object.assign({ w: 1700, h: 1000, extraInit: EXT }, o || {})); await feedAll(p); await p.evaluate(() => { [1, 2, 3, 4].forEach(n => { const w = document.getElementById('p' + n); w.setZoomFactor = f => { window.__zoomSet[n] = f; }; }); }); await p.waitForTimeout(200); return p; };
const near = (a, b, d) => Math.abs(a - b) <= (d || 2);
const expand = (p, n) => p.evaluate(n => document.querySelector('#panel' + n + ' .ex').click(), n);
const pickSetting = async (p, id, v) => { await p.evaluate(([id, v]) => { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new Event('change')); }, [id, v]); await p.waitForTimeout(150); };

(async () => {
  const b = await chromium.launch();
  let p = await setup(b);
  let L = await lay(p);
  ok('at first: the 2 × 2 grid as before, no mini, no arrow in any header, no shield', [1, 2, 3, 4].every(n => L.panels[n].shown && !L.panels[n].mini && !L.panels[n].arrow && !L.panels[n].shield) && L.cls === '' && near(L.panels[1].w, L.panels[2].w) && L.panels[1].t === L.panels[2].t && L.panels[3].t > L.panels[1].b, L);
  // ---- the arrow and the strip on the right
  await expand(p, 2); await p.waitForTimeout(200); L = await lay(p);
  ok('a screen expanded: only it shows (as before), and its header has the arrow, left of the level, not lit', L.panels[2].shown && [1, 3, 4].every(n => !L.panels[n].shown) && L.panels[2].arrow && !L.panels[2].arrowOn && /Show the other screens as mini screens beside this one/.test(L.panels[2].arrowTitle) && (await p.evaluate(() => { const h = document.querySelector('#panel2 .phead'), a = Array.from(h.children); return a.indexOf(h.querySelector('.st')) === a.indexOf(h.querySelector('.lvl')) - 1; })), L.panels[2]);
  await p.click('#panel2 .st'); await p.waitForTimeout(250); L = await lay(p);
  const m = [1, 3, 4].map(n => L.panels[n]);
  ok('the arrow pressed: the strip on the right with the 3 other screens as minis, one above the other, the expanded screen on the left taking the whole height', L.cls === 'strip-right' && m.every(x => x.shown && x.mini) && L.panels[2].shown && !L.panels[2].mini && m.every(x => x.box.l > L.panels[2].r) && m[0].b <= m[1].t && m[1].b <= m[2].t && near(L.panels[2].t, L.grid.t, 6) && near(L.panels[2].b, L.grid.b, 6) && near(m[0].t, L.grid.t, 6) && near(m[2].b, L.grid.b, 6), L);
  ok('...the strip is about a quarter of the width (240 to 420 px), the minis the same height', m.every(x => x.w >= 240 && x.w <= 420) && near(m[0].h, m[1].h, 3) && near(m[1].h, m[2].h, 3), m.map(x => x.box));
  ok('...the arrow is lit, says "Hide the other screens", and the choice is kept', L.panels[2].arrowOn && /Hide the other screens/.test(L.panels[2].arrowTitle) && (await p.evaluate(() => localStorage.getItem('hg.strip') === 'true')), L.panels[2]);
  ok('a mini: a thin header (30 px) with the name and the status; the Centro… buttons, Reload, Expand and the level are gone; a see-through shield over it', m.every(x => x.head === 30 && x.shield && x.hiddenBits.length === 4 && /Click to expand this screen \(the game does not get the click\)/.test(x.shieldTitle)) && L.panels[2].head === 40 && !L.panels[2].shield, m);
  ok('...the minis get the minis\u2019 zoom (150% at first), the expanded screen keeps its own (100%)', m.every(x => x.zoomText === '150%' && x.zoomFactor === 1.5 && /mini screens.*150%/.test(x.zoomTitle)) && L.panels[2].zoomText === '100%' && (L.panels[2].zoomFactor === undefined || L.panels[2].zoomFactor === 1), [m.map(x => [x.zoomText, x.zoomFactor]), L.panels[2].zoomText]);
  // the zoom of the minis
  await p.click('#panel3 .zm'); await p.waitForTimeout(150); L = await lay(p);
  ok('− on one mini: ALL the minis go to 140%, the expanded one stays at 100%, and it is kept (hg.miniZoom)', [1, 3, 4].every(n => L.panels[n].zoomText === '140%' && L.panels[n].zoomFactor === 1.4) && L.panels[2].zoomText === '100%' && (await p.evaluate(() => localStorage.getItem('hg.miniZoom'))) === '1.4' && (await p.evaluate(() => localStorage.getItem('hg.zoom'))) === null, [L.panels[3].zoomText, L.panels[2].zoomText]);
  await p.click('#panel3 .zv'); await p.waitForTimeout(150); L = await lay(p);
  ok('...the number pressed: back to 150%', L.panels[3].zoomText === '150%' && L.panels[1].zoomFactor === 1.5);
  // the game never gets a click on a mini: the shield covers it, and a click expands the mini
  const covered = await p.evaluate(() => { const w = document.getElementById('p3'), r = w.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && e.classList.contains('shield'); });
  ok('a click on the game part of a mini lands on the shield, never on the game', covered === true);
  await p.mouse.click((await p.evaluate(() => { const r = document.getElementById('p3').getBoundingClientRect(); return r.left + r.width / 2; })), (await p.evaluate(() => { const r = document.getElementById('p3').getBoundingClientRect(); return r.top + r.height / 2; }))); await p.waitForTimeout(250); L = await lay(p);
  ok('...and it expands that screen: 3 is the big one now, 2 became a mini (the strip stays), the zooms follow (3 back to 100%, 2 to 150%)', L.panels[3].shown && !L.panels[3].mini && L.panels[2].mini && L.panels[1].mini && L.panels[4].mini && L.cls === 'strip-right' && L.panels[3].zoomFactor === 1 && L.panels[2].zoomFactor === 1.5 && L.panels[3].arrow && L.panels[3].arrowOn, L);
  await p.click('#panel1 .pname'); await p.waitForTimeout(250); L = await lay(p);
  ok('a click on the header of a mini expands it too (1)', L.panels[1].shown && !L.panels[1].mini && L.panels[3].mini, L);
  const sent = await p.evaluate(() => window.__clean.map(l => l.join('')));
  ok('the main process is told which panels are minis, each time the list changes (clean.js hides the game\u2019s boxes there): nothing at first (no mini), [1,3,4] with 2 expanded, [1,2,4] after the click on 3, [2,3,4] after the click on 1', sent.join('|') === '134|124|234', sent);
  // the minis never show through what covers the screens: the Overview (Simple), the Settings dialog
  await p.click('#btnSimple'); await p.waitForTimeout(300);
  const over = await p.evaluate(() => { const h = document.querySelector('#panel3 .phead').getBoundingClientRect(); const e = document.elementFromPoint(h.left + h.width / 2, h.top + h.height / 2); return { id: e && e.id, tag: e && e.tagName, onTop: !!(e && (e.id === 'dash' || e.closest('#dash'))) }; });
  ok('Simple (the Overview over the screens): the header of a mini does not show through it (what is under the pointer there is the Overview)', over.onTop, over);
  await p.click('#btnSimple'); await p.waitForTimeout(300);
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const over2 = await p.evaluate(() => { const h = document.querySelector('#panel3 .phead').getBoundingClientRect(); const e = document.elementFromPoint(h.left + h.width / 2, h.top + h.height / 2); return !!(e && e.closest('#settingsModal')); });
  ok('...nor through the Settings dialog', over2); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // the clean button of the expanded screen: left of the arrow, hides the chat, the hunt box and the Auto Helper there (the main process is told { big: n })
  const clBtn = () => p.evaluate(() => { const h = document.querySelector('#panel1 .phead'), a = Array.from(h.children), c = h.querySelector('.cl'); return { shown: !c.classList.contains('hidden'), on: c.classList.contains('on'), title: c.title, leftOfArrow: a.indexOf(c) === a.indexOf(h.querySelector('.st')) - 1, pressed: c.getAttribute('aria-pressed'), big: window.__big[window.__big.length - 1], n: window.__big.length }; });
  let CB = await clBtn();
  ok('the expanded screen has a clean button (the eye), left of the mini-screens arrow, off: "Hide the chat, the hunt box and the Auto Helper of this screen"', CB.shown && !CB.on && CB.leftOfArrow && CB.title === 'Hide the chat, the hunt box and the Auto Helper of this screen' && CB.pressed === 'false' && !CB.big, CB);
  ok('...a mini has no clean button (it is clean already)', (await p.evaluate(() => getComputedStyle(document.querySelector('#panel3 .cl')).display)) === 'none');
  await p.click('#panel1 .cl'); await p.waitForTimeout(200); CB = await clBtn();
  ok('pressed: lit, "Show ... again", the main process is told that 1 is the clean expanded screen (the minis unchanged), and it is kept', CB.on && CB.pressed === 'true' && /^Show the chat, the hunt box and the Auto Helper of this screen again$/.test(CB.title) && CB.big === 1 && (await p.evaluate(() => window.__clean[window.__clean.length - 1].join(''))) === '234' && (await p.evaluate(() => localStorage.getItem('hg.clean'))) === 'true', CB);
  await p.click('#panel3 .pname'); await p.waitForTimeout(250);
  ok('...another screen expanded (3): the clean follows it (big: 3), 1 is a mini again', (await p.evaluate(() => window.__big[window.__big.length - 1])) === 3 && (await p.evaluate(() => window.__clean[window.__clean.length - 1].join(''))) === '124');
  await p.click('#panel3 .cl'); await p.waitForTimeout(200);
  ok('...pressed again: off, the main process told big: null', (await p.evaluate(() => window.__big[window.__big.length - 1])) === null && (await p.evaluate(() => localStorage.getItem('hg.clean'))) === 'false');
  await p.click('#panel1 .pname'); await p.waitForTimeout(250);
  // the pills still work in the expanded view
  await p.click('#accBtns [data-panel="4"]'); await p.waitForTimeout(250); L = await lay(p);
  ok('a pill in the top bar still switches the expanded screen (4), the others are the minis', !L.panels[4].mini && L.panels[4].shown && L.panels[1].mini && L.panels[2].mini && L.panels[3].mini, L);
  // the arrow again: back to the plain expanded view
  await p.click('#panel4 .st'); await p.waitForTimeout(250); L = await lay(p);
  ok('...the strip closed: the main process is told "no mini" (the rules go out of every page)', (await p.evaluate(() => window.__clean[window.__clean.length - 1].length)) === 0);
  ok('the arrow pressed again: the plain expanded view (only 4), the arrow not lit, the zoom of 4 untouched (100%)', L.panels[4].shown && [1, 2, 3].every(n => !L.panels[n].shown && !L.panels[n].mini) && !L.panels[4].arrowOn && L.cls === '' && (L.panels[4].zoomFactor === undefined || L.panels[4].zoomFactor === 1), L);
  // back to all
  await expand(p, 4); await p.waitForTimeout(250); L = await lay(p);
  ok('back to all screens: 2 × 2 again, no mini left, every screen at its own zoom', [1, 2, 3, 4].every(n => L.panels[n].shown && !L.panels[n].mini && (L.panels[n].zoomFactor === undefined || L.panels[n].zoomFactor === 1)) && L.cls === '', L);
  // ---- Settings › Grid
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const rows = await p.evaluate(() => Array.from(document.querySelectorAll('#cDisplay .srow b')).map(x => x.textContent.trim()));
  const heads = await p.evaluate(() => Array.from(document.querySelectorAll('#settingsModal .sh')).map(x => x.textContent.trim()));
  ok('Settings (lang-74 cards): Mini screens and Fit are the two lists of the Display card, under Light mode and GPU; no Grid row (the grid stays 2 × 2)', heads.indexOf('Display') >= 0 && rows.join() === 'Mini screens,Fit' && !(await p.evaluate(() => document.getElementById('gridSel'))) && (await p.evaluate(() => !!(document.getElementById('miniSel').closest('#cDisplay') && document.getElementById('fitSel').closest('#cDisplay') && document.getElementById('sLight').closest('#cDisplay')))), [heads, rows]);
  const opts = await p.evaluate(() => ['miniSel', 'fitSel'].map(id => Array.from(document.getElementById(id).options).map(o => o.value + '=' + o.textContent)));
  ok('...their choices: On the right / Along the bottom; Across the bottom / Its own quarter (the first of each at first)', JSON.stringify(opts) === JSON.stringify([['right=On the right', 'bottom=Along the bottom'], ['wide=Across the bottom', 'quarter=Its own quarter']]) && (await p.evaluate(() => [document.getElementById('miniSel').value, document.getElementById('fitSel').value].join())) === 'right,wide', opts);
  // Fit, with 3 screens
  await p.keyboard.press('Escape'); await p.waitForTimeout(150); await p.click('#accBtns [data-panel="4"]'); await p.waitForTimeout(250); L = await lay(p);
  ok('3 screens in a 2 × 2, Fit "Across the bottom" (as before): the third stretches across the whole bottom', !L.panels[4].shown && near(L.panels[3].w, L.grid.w - 8, 6) && L.panels[3].t > L.panels[1].b, L);
  await p.click('#btnSettings'); await p.waitForTimeout(250); await pickSetting(p, 'fitSel', 'quarter'); L = await lay(p);
  ok('Fit "Its own quarter": the third keeps the size of the others (bottom left), the other quarter empty', near(L.panels[3].w, L.panels[1].w) && near(L.panels[3].h, L.panels[1].h) && L.panels[3].l === L.panels[1].l, L);
  await pickSetting(p, 'fitSel', 'wide'); await p.keyboard.press('Escape'); await p.waitForTimeout(150); await p.click('#accBtns [data-panel="4"]'); await p.waitForTimeout(250);
  // Mini along the bottom
  await p.click('#btnSettings'); await p.waitForTimeout(250); await pickSetting(p, 'miniSel', 'bottom'); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await expand(p, 1); await p.waitForTimeout(250); await p.click('#panel1 .st'); await p.waitForTimeout(250); L = await lay(p);
  ok('Mini "Along the bottom", a screen expanded and the arrow pressed: the 3 minis side by side under the expanded screen, the whole width', L.cls === 'strip-bottom' && [2, 3, 4].every(n => L.panels[n].mini && L.panels[n].t >= L.panels[1].b) && L.panels[2].r <= L.panels[3].l && L.panels[3].r <= L.panels[4].l && near(L.panels[1].w, L.grid.w - 8, 6) && [2, 3, 4].every(n => L.panels[n].h >= 160 && L.panels[n].h <= 320), L);
  // the strip with only some screens: a hidden screen is not a mini; only 1 screen in use: no arrow
  await p.click('#accBtns [data-panel="3"]'); await p.waitForTimeout(250); L = await lay(p);
  ok('a pill while expanded still switches the expanded screen (3); a screen hidden by its pill before expanding is not among the minis', !L.panels[3].mini && L.panels[3].shown && L.panels[1].mini, L);
  await expand(p, 3); await p.waitForTimeout(200); await p.click('#accBtns [data-panel="2"]'); await p.waitForTimeout(200); await expand(p, 1); await p.waitForTimeout(250); L = await lay(p);
  ok('...2 hidden by its pill, 1 expanded: the minis are 3 and 4 only', L.panels[1].shown && !L.panels[1].mini && L.panels[3].mini && L.panels[4].mini && !L.panels[2].shown, L);
  await expand(p, 1); await p.waitForTimeout(200); await p.click('#accBtns [data-panel="2"]'); await p.waitForTimeout(200);
  // kept after a reload
  await p.evaluate(() => location.reload()); await p.waitForTimeout(1500); await p.evaluate(() => { [1, 2, 3, 4].forEach(n => { const w = document.getElementById('p' + n); w.setZoomFactor = f => { window.__zoomSet[n] = f; }; }); });
  await expand(p, 2); await p.waitForTimeout(300); L = await lay(p);
  ok('after the window is loaded again: Mini "bottom" and the strip on are remembered (expanding a screen shows the strip along the bottom at once), the minis at 150%', L.cls === 'strip-bottom' && [1, 3, 4].every(n => L.panels[n].mini && L.panels[n].zoomText === '150%') && L.panels[2].arrowOn, L);
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();
  // ---- only one screen in use: no arrow, nothing to show
  p = await setup(b, { extraInit: EXT + `localStorage.setItem('hg.panels', '1'); localStorage.setItem('hg.strip', 'true');` });
  await expand(p, 1); await p.waitForTimeout(250); L = await lay(p);
  ok('with one game panel in use: the expanded header has no arrow (no other screen to show), no mini', !L.panels[1].arrow && !L.panels[1].mini && L.cls === '', L.panels[1]);
  await p.context().close();
  // ---- with the Summary panel open: Summary | big | strip
  p = await setup(b, { extraInit: EXT + `localStorage.setItem('hg.strip', 'true'); localStorage.setItem('hg.panel', 'true');` });
  await expand(p, 1); await p.waitForTimeout(300); L = await lay(p);
  const dash = await p.evaluate(() => { const r = document.getElementById('dash').getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) }; });
  ok('Summary | expanded screen | strip, left to right, until the Summary or the strip is hidden', dash.w > 300 && L.panels[1].l >= dash.r && L.panels[2].l > L.panels[1].r && L.cls === 'strip-right', [dash, L.panels[1].box, L.panels[2].box]);
  await p.context().close();
  // ---- Portuguese
  p = await setup(b, { lang: 'pt-BR' });
  await expand(p, 2); await p.waitForTimeout(200); L = await lay(p);
  await p.click('#panel2 .st'); await p.waitForTimeout(250); const L2 = await lay(p);
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const pt = await p.evaluate(() => ({ rows: Array.from(document.querySelectorAll('#cDisplay .srow b')).map(x => x.textContent.trim()), opts: Array.from(document.getElementById('miniSel').options).map(o => o.textContent), head: Array.from(document.querySelectorAll('#settingsModal .sh')).map(x => x.textContent.trim()).indexOf('Tela') >= 0 }));
  ok('in Portuguese: the arrow "Mostrar as outras telas como telas mini ao lado desta" / "Esconder as outras telas", the shield "Clique para expandir esta tela…", Settings "Tela" (the card), "Telas mini", "Encaixe", "À direita" / "Embaixo"', /^Mostrar as outras telas como telas mini ao lado desta$/.test(L.panels[2].arrowTitle) && /^Esconder as outras telas$/.test(L2.panels[2].arrowTitle) && /^Clique para expandir esta tela \(o jogo não recebe o clique\)$/.test(L2.panels[1].shieldTitle) && pt.rows.join() === 'Telas mini,Encaixe' && pt.opts.join('|') === 'À direita|Embaixo' && pt.head, [L.panels[2].arrowTitle, L2.panels[2].arrowTitle, L2.panels[1].shieldTitle, pt]);
  ok('no JavaScript errors (Portuguese)', p.errors.length === 0, p.errors);
  await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
