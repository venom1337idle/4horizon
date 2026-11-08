// run-selftest.js (lang-67): "Check the game" looks in every game page for what 4horizon relies on, presses nothing, and says what is missing
// and which feature that affects.
const { chromium } = require('./pw');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 500))); c ? pass++ : fail++; };
const ST = require('./selftest');
const menu = (items, hiddenOnes = []) => `<div id="menu" style="position:fixed;top:6px;left:20px;display:flex;gap:6px">${items.map(t => `<div class="mi" style="padding:8px;cursor:pointer;${hiddenOnes.includes(t) ? 'display:none' : ''}"><span>${t}</span></div>`).join('')}</div>`;
const ALL = ['Perfil', 'Hunts', 'Mochila', 'Centro', 'Análise'];
const GO_MARKET = '<div style="position:fixed;right:20px;bottom:20px;cursor:pointer"><span>Ir ao Market</span></div>';
const counter = `<script>window.__clicks = 0; document.addEventListener('click', () => window.__clicks++, true); document.addEventListener('input', () => window.__clicks++, true);</script>`;
const page = body => `<!doctype html><meta charset=utf-8><body style="margin:0;width:1108px;height:893px;background:#111;color:#eee;font:13px sans-serif">${body}${counter}`;
const HUNTS = `<div id="hp" style="position:fixed;left:22px;top:117px;width:1068px;height:750px;background:#0b1020">
  <div style="position:absolute;left:150px;top:80px;display:flex;gap:10px">${['Kanto', 'Johto', 'Hoen', 'Sinnoh'].map(r => `<div style="cursor:pointer;padding:8px"><img alt="${r}" width="80" height="30" src="data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2780%27 height=%2730%27/>"></div>`).join('')}</div>
  <input type="text" placeholder="Buscar hunt ou Pokémon..." style="position:absolute;left:18px;top:140px;width:560px;height:36px">
  <div style="position:absolute;left:600px;top:140px"><span>Fraco contra:</span> <span>Qualquer</span></div>
  <div style="position:absolute;left:18px;top:200px"><button>Todos</button> <button>Todos os níveis</button></div>
  <div style="position:absolute;left:18px;top:300px;width:640px">${['Paras', 'Oddish', 'Exeggcute'].map(n => `<div style="display:inline-block;width:110px;height:82px;margin:6px;cursor:pointer"><img width="40" height="40" alt=""><span>${n}</span></div>`).join('')}</div>
  <div style="position:absolute;left:690px;top:300px;width:340px;height:400px"><button style="position:absolute;bottom:10px;left:10px">Caçar</button></div></div>`;

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1108, height: 893 } });
  const mk = async html => { const p = await ctx.newPage(); await p.setContent(html); await p.waitForTimeout(40); return p; };
  const pages = {
    1: await mk(page(menu(ALL) + GO_MARKET)),                                                     // everything, Hunt Analyzer closed
    2: await mk(page(menu(ALL, ['Análise']) + '<div style="position:fixed;right:20px;top:120px"><span>Hunt Analyzer</span></div>')),      // narrow toolbar, analyzer open
    3: await mk(page(menu(ALL.filter(x => x !== 'Centro')) + HUNTS)),                // no Centro; the Hunts panel open
    4: await mk(page('<form><input type="text"><input type="password"></form>')),     // signed out
  };
  const guests = Object.keys(pages).map(n => ({ n: Number(n), wc: { executeJavaScript: code => pages[n].evaluate(code) } }));
  guests.push({ n: 5, wc: { executeJavaScript: () => new Promise(() => {}) } });     // a page that never answers
  const s = await ST.run(guests);
  const info = ST.info(), P = n => info.panels.find(p => p.n === n);
  ok('every panel looked at (5), its result kept for the report', s.panels === 5 && info.panels.length === 5);
  ok('panel 1: signed in, every toolbar icon found and visible, "Ir ao Market" found, the Hunt Analyzer closed', P(1).signedIn && Object.values(P(1).toolbar).every(v => v === 'visible') && P(1).analyzer === 'closed' && P(1).hunts === null, P(1));
  ok('lang-67: "Ir ao Market" not on the page (panel 2): "not on the page now", NOT a problem (it appears after Centro)', P(2).toolbar.market === 'notnow' && !info.problems.some(x => x.n === 2));
  ok('panel 2: Análise HIDDEN in a narrow toolbar counts as found ("hidden"), not as a problem; the Hunt Analyzer open', P(2).toolbar.analise === 'hidden' && P(2).analyzer === 'open' && !info.problems.some(x => x.n === 2), [P(2), info.problems]);
  ok('panel 3: Centro missing is a problem, with what it affects (the Centro and Market buttons)', info.problems.some(x => x.n === 3 && /centro icon/.test(x.what) && /Centro and Market buttons/.test(x.affects)), info.problems);
  const h = P(3).hunts;
  ok('panel 3: the open Hunts panel is looked at: search box, region tabs (pictures, by their alt), Todos / Todos os níveis, "Fraco contra", the cards, the Caçar button', h && h.search && h.regions.join() === 'kanto,johto,hoen,sinnoh' && h.todos && h.levels && h.weak === 'qualquer' && h.cards === 3 && h.cacar === 'found', h);
  ok('panel 4: a signed-out page is said to be signed out; its missing toolbar is not counted as a problem', P(4).signedIn === false && !info.problems.some(x => x.n === 4), [P(4), info.problems]);
  ok('panel 5: a page that does not answer: said so (after the time limit), no crash', (P(5).timeout || P(5).error) && info.problems.some(x => x.n === 5 && /did not answer/.test(x.what)));
  ok('the summary for the window: 5 panels, the Hunts panel was seen, 2 problems', s.huntsSeen === true && s.problems === 2, s);
  const clicks = await Promise.all([1, 2, 3, 4].map(n => pages[n].evaluate(() => window.__clicks)));
  ok('NOTHING was pressed or typed in any page', clicks.every(c => c === 0), clicks);
  // the report
  const D = require('./diag-core');
  const rep = D.analyse({ main: { meta: {}, selftest: info }, ui: {} }).report, sec = rep.slice(rep.indexOf('GAME CHECK'), rep.indexOf('\n\n', rep.indexOf('GAME CHECK')));
  ok('report: GAME CHECK, the problems with what they affect, then each panel (toolbar, Hunt Analyzer, the Hunts panel)', /^GAME CHECK \(Diagnostics › Check the game/.test(sec) && /2 things NOT FOUND:\n    Account 3: the centro icon of the toolbar was not found → affects the Centro and Market buttons/.test(sec) && /Account 2: signed in · toolbar: Hunts yes, Análise yes \(hidden in a narrow toolbar\), Centro yes, Mochila yes · "Ir ao Market" not on the page now \(it appears after Centro\)/.test(sec) && /Hunt Analyzer open/.test(sec) && /Hunts panel open: search box yes · region tabs kanto, johto, hoen, sinnoh · "Todos" yes · "Todos os níveis" yes · "Fraco contra": qualquer · cards 3 · Caçar button yes/.test(sec) && /Account 4: SIGNED OUT/.test(sec), sec);
  const rep2 = D.analyse({ main: { meta: {}, selftest: { ageSec: 3, panels: [{ n: 1, signedIn: true, toolbar: { hunts: 'visible', analise: 'visible', centro: 'visible', mochila: 'visible', market: 'notnow' }, analyzer: 'closed', hunts: null }], problems: [] } }, ui: {} }).report;
  ok('...all found: "everything 4horizon needs was found", and a hint to open the Hunts panel to have it checked too', /everything 4horizon needs was found/.test(rep2) && /no Hunts panel was open: open it on one account before "Check the game"/.test(rep2));
  ok('never pressed since the start: no GAME CHECK section', D.analyse({ main: { meta: {}, selftest: null }, ui: {} }).report.indexOf('GAME CHECK') < 0);
  const dsrc = require('fs').readFileSync('diag.js', 'utf8');
  ok('diag.js answers "diag:selftest" (only its own window), sends the result to the report, and its self-check knows selftest.js', /ipcMain\.handle\('diag:selftest'/.test(dsrc) && /out\.selftest = require\('\.\/selftest'\)\.info\(\)/.test(dsrc) && /\['selftest\.js', 'Check the game/.test(dsrc) && /diagSelfTest: \(\) => ipcRenderer\.invoke\('diag:selftest'\)/.test(require('fs').readFileSync('preload.js', 'utf8')));
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
