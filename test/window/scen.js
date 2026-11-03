// scen.js: drives the real window (index.html) and its dashboard through many states, with the clock frozen, and returns everything a person could read in each:
// the visible text, the tooltips / placeholders / aria labels, and the options of every select.
// Used twice: to freeze what the English screens say (golden-en.json), and to look for English left over when the language is Portuguese.
const { chromium } = require('./pw');
const path = require('path'), fs = require('fs');

// the stand-ins of the window tests (the fake bridge, the data of the Diagnostics window), taken from the test files themselves so that they cannot drift apart
const head = fs.readFileSync('run-diag-ui.js', 'utf8'); const upto = head.indexOf('async function open(');
const defs = new Function('require', 'process', head.slice(0, upto) + '; return { MAIN, ACC, TEAM, BRIDGE, PREVIEW_FONTS, wiki };')(require, process);
const { BRIDGE, PREVIEW_FONTS, wiki } = defs;
const UI_BUILD = (fs.readFileSync('index.html', 'utf8').match(/UI_BUILD = '([^']+)'/) || [])[1] || 'x';
const MAIN = () => { const m = defs.MAIN(); m.meta.build = UI_BUILD; return m; };
const HUNT = require('./fixtures-accounts.js');            // V2 (a Gengar) and V4 (a Charmeleon) with everything the hunt model needs
const FROZEN = new Date('2026-10-29T12:00:00');

const HISTORY = { today: '2026-10-29', now: 0, days: {
  '2026-10-29': { trainer2: { kills: 3400, xp: 2100000, captures: 41, shiny: 1, loot: 210000, capture: 90000, supplies: 60000, ms: 4 * 3600000 }, trainer4: { kills: 4100, xp: 900000, captures: 4100, shiny: 0, loot: 120000, capture: 300000, supplies: 150000, ms: 4 * 3600000 } },
  '2026-10-28': { trainer2: { kills: 9000, xp: 6100000, captures: 120, shiny: 0, loot: 600000, capture: 200000, supplies: 150000, ms: 10 * 3600000 }, trainer3: { kills: 800, xp: 400000, captures: 9, shiny: 0, loot: 50000, capture: 10000, supplies: 20000, ms: 2 * 3600000 } },
  '2026-10-26': { trainer4: { kills: 2000, xp: 500000, captures: 2000, shiny: 2, loot: 80000, capture: 150000, supplies: 90000, ms: 2 * 3600000 } } } };

async function open(b, o) {
  o = Object.assign({ lang: 'en', seeds: null, loginResults: null, huntFile: null, w: 1700, h: 1000 }, o || {});
  const ctx = await b.newContext({ viewport: { width: o.w, height: o.h } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (o.huntFile) await ctx.route('**/hunt-data.js', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(o.huntFile, 'utf8') }));
  await ctx.clock.setFixedTime(FROZEN);
  const extra = `
    window.__diag = { main: ${JSON.stringify(MAIN())}, probeAnswer: [{ n: 2, signedIn: false }, { n: 3, signedIn: true }], copied: null, saved: null, copyAnswer: true, saveAnswer: 'C:\\\\x\\\\diag.txt', gets: 0 };
    __bridgeObject.diagGet = async () => JSON.parse(JSON.stringify(window.__diag.main));
    __bridgeObject.diagCopy = async t => { window.__diag.copied = t; return true; };
    __bridgeObject.diagSave = async t => { window.__diag.saved = t; return window.__diag.saveAnswer; };
    __bridgeObject.diagProbe = async () => window.__diag.probeAnswer;
    __bridgeObject.getHistory = async () => (${JSON.stringify(HISTORY)});
    ${o.extraInit || ''}
    ${o.loginResults ? `__bridgeObject.accountsLogin = async () => ({ results: ${JSON.stringify(o.loginResults)} });` : ''}
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__diag.clip = t; } }, configurable: true });
    HTMLUnknownElement.prototype.setZoomFactor = function () {};
    ${o.lang !== 'en' ? `try { localStorage.setItem('4h.lang', ${JSON.stringify(o.lang)}); } catch (e) {}` : ''}
    ${o.seeds ? `if (localStorage.getItem('huntSpeeds.v3') === null) localStorage.setItem('huntSpeeds.v3', ${JSON.stringify(JSON.stringify(o.seeds))});` : ''}
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(PREVIEW_FONTS)}; document.head.appendChild(s); });`;
  await ctx.addInitScript(BRIDGE.replace("name: '<img src=x onerror=\\\"window.__xss=1\\\">'", "name: 'trainer3'") + extra);
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
  await p.goto('file://' + path.resolve('index.html')); await p.waitForTimeout(700);
  p.s = (n, d) => p.evaluate(([n, d]) => window.__stats(n, d), [n, d]);
  p.dash = () => p.frames().find(f => /dashboard\.html/.test(f.url()));
  return p;
}

// everything readable in one document: text, tooltips, placeholders, labels, select options
const grab = target => target.evaluate(() => {
  // every text node of the page that a person could read at some point (also the views that are hidden at the moment), in order; the page's own scripts and styles are not text
  const set = s => Array.from(new Set(s)).filter(x => x && x.trim()).sort();
  const bad = e => { for (let x = e; x && x.nodeType === 1; x = x.parentElement) if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].indexOf(x.tagName) >= 0) return true; return false; };
  const parts = []; const tw = document.createTreeWalker(document.body, 4);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (bad(n.parentElement)) continue; const s = n.nodeValue.replace(/\s+/g, ' ').trim(); if (s) parts.push(s); }
  const attrs = []; document.querySelectorAll('[title],[placeholder],[aria-label],[alt]').forEach(e => ['title', 'placeholder', 'aria-label', 'alt'].forEach(a => { const v = e.getAttribute(a); if (v) attrs.push(a + ': ' + v); }));
  const opts = []; document.querySelectorAll('option').forEach(o => opts.push(o.textContent));
  return { text: parts.join('\n'), attrs: set(attrs), options: set(opts) };
});

const ACC2 = Object.assign({}, HUNT.V2, { money: 973376, diamonds: 20, vip: true, trainerXp: wiki(169) + 500000, hunt: undefined, captures: 74, catchesSeen: 3, minutes: 63, sessionTime: '1h 3m 10s', xpGained: 1053618, lootSell: 86955, captureSell: 253200, suppliesCost: 215750, ballsUsed: 1079, healsUsed: 1, profit: 124405, goldH: 117723, xpH: 997022,
  bestIV: { name: 'Gengar', iv: 168, max: 192, rarity: 'Lend\u00e1ria \u00d71.78', quality: 1.78, shiny: false }, lastCaught: { name: 'Horsea', iv: 101, max: 192, rarity: 'Rara \u00d71.37', quality: 1.37, shiny: false, time: '11:58' },
  drops: [{ name: 'Ghost essence', qty: 51, value: null }, { name: 'Venom stone', qty: 3, value: null }], breedSlots: 1, eggs: [], teamActiveId: '1',
  teamList: [{ id: '1', speciesId: 94, name: 'Gengar', level: 176, xp: wiki(176) + 380000, hp: 2032, maxHp: 3156, slot: 1, shiny: false }, { id: '2', speciesId: 7, name: 'Squirtle', level: 17, xp: wiki(17) + 100, hp: 100, maxHp: 100, slot: 2, shiny: true }],
  combat: { hits: 240, kills: 120, counterKills: 120, messageKills: 120, gapMs: 1700, gapN: 100, spawnMs: 1900, spawnN: 100, startedAt: 2, size: 1, since: 1 }, autoBall: 'ultra-ball' });
const ACC3 = { live: true, active: true, name: 'trainer3', level: 151, startedAt: 3, huntId: 'rock-60', defeated: 512, partyKills: 1024, partySize: 2, partyNames: ['trainer3', 'friend'], killsH: 520, minutes: 33, sessionTime: '33m 0s', money: 956725, diamonds: 20, vip: true, trainerXp: wiki(151) + 90000, captures: 34, catchesSeen: 0,
  lead: { speciesId: 5, level: 94, quality: 1.33, growth: { hp: 20, atk: 20, def: 20, spa: 22, spd: 20, spe: 22 } }, teamActiveId: '1', teamList: [{ id: '1', speciesId: 5, name: 'Charmeleon', level: 94, xp: wiki(94) + 2000, hp: 369, maxHp: 492, slot: 1, shiny: false }, { id: '2', speciesId: 7, name: 'Squirtle', level: 1, xp: 0, hp: 20, maxHp: 20, slot: 2, shiny: false }],
  breedSlots: 2, eggs: [{ progress: 60, target: 100, species: 'Exeggcute' }], drops: [], bestIV: null, lastCaught: null, goldH: 80000, xpH: 500000, xpGained: 200000, lootSell: 10000, captureSell: 5000, suppliesCost: 3000, profit: 12000 };
const ACC4 = Object.assign({}, HUNT.V4, { money: 973376, diamonds: 20, vip: true, trainerXp: wiki(134) + 4000, captures: 1614, catchesSeen: 51, minutes: 40, sessionTime: '40m 12s', goldH: 109735, xpH: 798973, xpGained: 400000, lootSell: 41133, captureSell: 100000, suppliesCost: 34200, profit: 77000,
  bestIV: { name: 'Exeggcute', iv: 115, max: 192, rarity: 'Rara \u00d71.50', quality: 1.5, shiny: false }, lastCaught: { name: 'Exeggcute', iv: 100, max: 192, rarity: 'Comum \u00d71.10', quality: 1.1, shiny: false, time: '11:59' }, drops: [{ name: 'Leaves', qty: 100, value: null }],
  teamActiveId: '2', teamList: [{ id: '1', speciesId: 1, name: 'Bulbasaur', level: 118, xp: wiki(118) + 100, hp: 1264, maxHp: 1416, slot: 1, shiny: false }, { id: '2', speciesId: 5, name: 'Charmeleon', level: 103, xp: wiki(103) + 20000, hp: 900, maxHp: 1000, slot: 2, shiny: false }], eggs: [], breedSlots: 1,
  combat: { hits: 100, kills: 50, counterKills: 50, messageKills: 40, gapMs: 1730, gapN: 40, spawnMs: 1500, spawnN: 40, startedAt: HUNT.V4.startedAt, size: 1, since: 1 } });
const ACC1 = { name: 'trainer1' };                                         // an account that has not sent anything: only its name

async function feedAll(p, extraCatches) {
  await p.s(1, ACC1); await p.s(2, ACC2); await p.s(3, ACC3); await p.s(4, ACC4);
  const mons = [['Exeggcute', 106, '\u00d71.18', 'Rara'], ['Exeggcute', 93, '\u00d71.18', 'Comum'], ['Gengar', 168, '\u00d71.78', 'Lend\u00e1ria'], ['Horsea', 92, '\u00d70.87', 'Fraca'], ['Staryu', 150, '\u00d71.42', '\u00c9pica'], ['Seel', 115, '\u00d71.5', 'Rara'], ['Magikarp', 191, '\u00d72.9', 'Divina'], ['Zubat', 40, '\u00d70.5', 'Fraca']];
  let seq = 0; for (let i = 0; i < mons.length; i++) { const n = 2 + (i % 3); await p.s(n, { catchEvent: { name: mons[i][0], iv: mons[i][1], max: 192, quality: parseFloat(mons[i][2].slice(1)), rarity: mons[i][3] + ' ' + mons[i][2], shiny: i === 2, time: '11:' + (50 + i) }, catchSeq: ++seq }); }
  await p.waitForTimeout(1500);
}
const clickIn = (fr, sel) => fr.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
const setView = (fr, v) => clickIn(fr, '#topTabs .vt[data-view="' + v + '"]');
const select = (fr, sel) => fr.evaluate(s => { selected = s; renderAll(); }, sel);

// opens Diagnostics from wherever the app keeps it
async function openDiagnostics(p) {
  if (await p.evaluate(() => !!document.getElementById('btnSettings'))) { await p.evaluate(() => document.getElementById('btnSettings').click()); await p.waitForTimeout(150); }
  await p.evaluate(() => document.getElementById('btnDiag').click());
  await p.waitForSelector('#diagCheck .ditem', { timeout: 5000 }); await p.waitForTimeout(250);
}

async function runAll(b, lang) {
  const R = {};
  const put = async (name, target) => { R[name] = await grab(target); };
  // ---- the window, with the dashboard fed ----
  let p = await open(b, { lang, huntFile: 'hunt-data.full.js' }); await feedAll(p);
  const fr = p.dash();
  await put('win:panels', p);
  await p.evaluate(() => document.getElementById('btnAccounts').click()); await p.waitForTimeout(400); await put('win:accounts-dialog', p);
  await p.evaluate(() => document.getElementById('aCancel').click()); await p.waitForTimeout(150);
  await openDiagnostics(p); await put('win:diag-check', p);
  await p.evaluate(() => document.getElementById('dtReport').click()); await p.waitForTimeout(150); await put('win:diag-report', p);
  await p.evaluate(() => document.getElementById('diagClose').click()); await p.waitForTimeout(150);
  // ---- the dashboard: the summary, each account, the other views ----
  for (const [name, sel] of [['sum', 'sum'], ['acc1', 0], ['acc2', 1], ['acc3', 2], ['acc4', 3]]) { await select(fr, sel); await p.waitForTimeout(250); await put('dash:' + name, fr); }
  // History is a section of Settings now: the dialog is opened with its numbers
  await p.evaluate(() => document.getElementById('btnSettings').click()); await p.waitForTimeout(500); await put('win:settings', p);
  await p.evaluate(() => { const s = document.getElementById('hxRange'); if (s) { s.value = 'all'; s.dispatchEvent(new Event('change')); } }); await p.waitForTimeout(200); await put('win:settings-history-all', p);
  await p.evaluate(() => document.getElementById('setClose').click()); await p.waitForTimeout(150);
  await setView(fr, 'overview');
  await fr.evaluate(() => { const b2 = document.querySelector('#capShiny, [data-shiny]'); if (b2) b2.click(); }); await p.waitForTimeout(200); await put('dash:captures-shiny-filter', fr);
  R.errors1 = p.errors.slice(); await p.context().close();

  R.errors2 = []; R.errors3 = [];                       // (the Where to hunt tab was here: it is not part of the app any more)

  // ---- the messages after "Log in all", and the other reasons ----
  const sets = [
    [{ n: 1, ok: true }, { n: 2, ok: true, opened: true }, { n: 3, ok: false, reason: 'no-login-form', lastMsgSec: 3 }, { n: 4, ok: false, reason: 'captcha-not-solved' }],
    [{ n: 1, ok: false, reason: 'no-saved-login' }, { n: 2, ok: false, reason: 'panel-not-ready' }, { n: 3, ok: false, reason: 'login-form-not-found', lastMsgSec: 40 }, { n: 4, ok: false, reason: 'no-login-form' }],
    [{ n: 1, ok: false, reason: 'no-answer' }, { n: 2, ok: false, reason: 'something-new' }]];
  for (let i = 0; i < sets.length; i++) {
    p = await open(b, { lang, loginResults: sets[i], huntFile: 'hunt-data.full.js' }); await feedAll(p);
    await p.evaluate(() => document.getElementById('btnLoginAll').click()); await p.waitForTimeout(500);
    R['win:toast-login-' + (i + 1)] = { text: await p.evaluate(() => (document.getElementById('toast') || {}).innerText || ''), attrs: [], options: [] };
    R['errors-login-' + (i + 1)] = p.errors.slice(); await p.context().close();
  }
  return R;
}
module.exports = { runAll, open, feedAll, grab, openDiagnostics, MAIN, HUNT };
if (require.main === module) (async () => {
  const lang = process.argv[2] || 'en', outFile = process.argv[3];
  const b = await chromium.launch(); const R = await runAll(b, lang); await b.close();
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(R, null, 1));
  const keys = Object.keys(R).filter(k => !/^errors/.test(k));
  console.log(keys.length + ' states captured for "' + lang + '"; characters of text: ' + keys.reduce((n, k) => n + R[k].text.length, 0));
  keys.forEach(k => console.log('  ' + k.padEnd(34) + String(R[k].text.length).padStart(6) + ' chars, ' + String(R[k].attrs.length).padStart(3) + ' tooltips/labels'));
  Object.keys(R).filter(k => /^errors/.test(k) && R[k].length).forEach(k => console.log('JS ERRORS in ' + k + ': ' + R[k].join(' | ')));
})().catch(e => { console.log('FAILED: ' + e.message + '\n' + e.stack); process.exit(1); });
