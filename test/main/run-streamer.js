// run-streamer.js (lang-71): streamer.js, Settings › "Streamer mode": read before the app is ready (only a real true), the Chromium switches that keep a covered
// window drawn, the panels told not to slow down, the e-mails hidden in the game panels at once (and shown again when it is turned off), economy mode refused,
// the settings backup and the Diagnostics report
const fs = require('fs'), path = require('path'), os = require('os');
process.env.HG_USERDATA = fs.mkdtempSync(path.join(os.tmpdir(), '4h-streamer-'));
const electron = require('electron');
const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const UD = electron._USERDATA, SF = path.join(UD, 'settings.json');
const quiet = f => { const l = console.log; console.log = () => {}; try { return f(); } finally { console.log = l; } };
const S = require('./streamer');
const fakeApp = () => { const sw = []; return { sw, getPath: () => UD, commandLine: { appendSwitch: (a, b) => sw.push(b === undefined ? a : a + '=' + b) } }; };
const tick = () => new Promise(r => setTimeout(r, 0));
// a game panel (webview) or the app's window, as Electron gives them
const wcOf = type => { const ls = {}; return { type, css: [], removed: [], throttle: [], getType: () => type, isDestroyed: () => false, on(ev, f) { (ls[ev] = ls[ev] || []).push(f); }, fire: ev => (ls[ev] || []).forEach(f => f()),
  insertCSS(c) { this.css.push(c); return Promise.resolve('key' + this.css.length); }, removeInsertedCSS(k) { this.removed.push(k); return Promise.resolve(); }, setBackgroundThrottling(v) { this.throttle.push(v); } }; };

(async () => {
  // ---- 1. read before the app is ready
  try { fs.unlinkSync(SF); } catch (e) {}
  let A = fakeApp(); S._reset();
  ok('a new install (no settings.json): off, no Chromium switch is set', quiet(() => S.applyAtStart(A)) === false && A.sw.length === 0, A.sw);
  for (const [what, v] of [['false', false], ['the text "true"', 'true'], ['the number 1', 1]]) { fs.writeFileSync(SF, JSON.stringify({ streamerMode: v })); A = fakeApp(); S._reset(); ok('"streamerMode": ' + what + ': off, nothing set', quiet(() => S.applyAtStart(A)) === false && A.sw.length === 0); }
  fs.writeFileSync(SF, '{ broken'); A = fakeApp(); S._reset();
  ok('a broken settings.json: off, nothing thrown', quiet(() => S.applyAtStart(A)) === false && A.sw.length === 0);
  fs.writeFileSync(SF, JSON.stringify({ lang: 'en', streamerMode: true })); A = fakeApp(); S._reset();
  ok('"streamerMode": true: the switches that keep a covered window drawn are set, once each', quiet(() => S.applyAtStart(A)) === true && JSON.stringify(A.sw) === JSON.stringify(['disable-backgrounding-occluded-windows', 'disable-renderer-backgrounding', 'disable-background-timer-throttling', 'disable-features=CalculateNativeWinOcclusion']), A.sw);
  const main = fs.readFileSync('main.js', 'utf8');
  ok('main.js reads it first thing, before the app is ready (right after the GPU setting, before whenReady)', main.indexOf("require('./streamer').applyAtStart(app)") > 0 && main.indexOf("require('./streamer').applyAtStart(app)") < main.indexOf('app.whenReady()') && main.indexOf("require('./gpu').applyAtStart(app)") < main.indexOf("require('./streamer').applyAtStart(app)"));

  // ---- 2. the window and the game panels, the Settings window
  S.init();
  const H = electron._handlers, WIN = { sender: electron._WINDOW };
  const win = wcOf('window'), p1 = wcOf('webview'), p2 = wcOf('webview');
  S.hook(win); S.hook(p1); S.hook(p2); await tick();
  ok('started in streamer mode: the window and each game panel are told not to slow down in the background', JSON.stringify(win.throttle) === '[false]' && JSON.stringify(p1.throttle) === '[false]');
  ok('...the e-mails are hidden in each game panel (one set of style rules), never in the app\u2019s own window', p1.css.length === 1 && p1.css[0] === S.CSS && p2.css.length === 1 && win.css.length === 0);
  ok('...the rules cover the game\u2019s login box (dots), its "Did you mean", and the e-mail of the game\u2019s settings', /input\[autocomplete="username"\][^{]*\{ -webkit-text-security: disc/.test(S.CSS) && /\.auth-email-suggest b/.test(S.CSS) && /\.pf-table \.pf-row:first-child strong/.test(S.CSS));
  p1.fire('dom-ready'); await tick();
  ok('a new page in the panel: the rules are put in again', p1.css.length === 2, p1.css.length);
  ok('only the app\u2019s own window may ask: a game panel gets nothing', H['streamer:get']({ sender: {} }) === null && H['streamer:set']({ sender: {} }, false) === null);
  let r = H['streamer:get'](WIN);
  ok('Settings sees: on, running since the start, no restart needed', r.on === true && r.atStart === true && r.needsRestart === false, r);
  ok('economy mode is refused while it is on (economy.js asks)', S.blocksEconomy() === true);
  r = H['streamer:set'](WIN, false); await tick();
  ok('turned off: saved, the e-mails are shown again at once in each panel, and a restart is needed for the background part', r.saved === true && r.on === false && r.needsRestart === true && JSON.parse(fs.readFileSync(SF, 'utf8')).streamerMode === false && p1.removed.length === 1 && p2.removed.length === 1, [r, p1.removed, p2.removed]);
  ok('...economy mode is still refused until the restart (the screens are still drawn by the switches)', S.blocksEconomy() === true);
  p1.fire('dom-ready'); await tick();
  ok('...a new page gets no rules any more', p1.css.length === 2, p1.css.length);
  r = H['streamer:set'](WIN, 'yes'); ok('anything that is not a real true is "off"', r.on === false);
  // started without it, turned on
  fs.writeFileSync(SF, JSON.stringify({ streamerMode: false })); S._reset(); A = fakeApp(); quiet(() => S.applyAtStart(A)); S.init();
  const p3 = wcOf('webview'), w3 = wcOf('window'); S.hook(p3); S.hook(w3); await tick();
  ok('started without it: nothing is set, nothing hidden, the panels may slow down as usual', p3.css.length === 0 && p3.throttle.length === 0 && w3.throttle.length === 0 && S.blocksEconomy() === false);
  r = H['streamer:set'](WIN, true); await tick();
  ok('turned on: the e-mails are hidden at once, economy mode is refused at once, and a restart is needed for the background part', r.on === true && r.needsRestart === true && p3.css.length === 1 && S.blocksEconomy() === true, [r, p3.css.length]);

  // ---- 3. economy.js refuses, the backup, the report
  const E = require('./economy');
  const er = E.set ? E.set(true) : (await H['economy:set'](WIN, true));
  ok('economy mode asked for while streamer mode is on: refused (it stays off, and says why)', er && er.on === false && er.blocked === 'streamer', er);
  const B = require('./backup'), file = B.build({}, '1.0.9');
  ok('the settings backup saves Streamer mode', file.app && file.app.streamerMode === true, file.app);
  fs.writeFileSync(SF, JSON.stringify({ lang: 'en' })); S._reset();
  const res = B.apply(Object.assign({}, file, { app: { lang: 'en', streamerMode: true } }));
  ok('...and loading the file turns it on again', res.ok && JSON.parse(fs.readFileSync(SF, 'utf8')).streamerMode === true, fs.readFileSync(SF, 'utf8'));
  const D = require('./diag-core');
  const rep = st => D.analyse({ main: { meta: {}, streamer: st }, ui: {} }).report;
  ok('the report: "STREAMER MODE ... ON · running since the start", and per panel whether the e-mails are hidden', /STREAMER MODE[^\n]*: ON · running since the start \(4 Chromium switches\)/.test(rep({ on: true, atStart: true, needsRestart: false, switches: ['a', 'b', 'c', 'd'], panels: [{ n: 1, hidden: true }] })) && /e-mails hidden/.test(rep({ on: true, atStart: true, switches: [], panels: [{ n: 1, hidden: true }] })), rep({ on: true, atStart: true, switches: ['a', 'b', 'c', 'd'], panels: [{ n: 1, hidden: true }] }).split('\n').filter(l => /STREAMER/.test(l)));
  ok('...and when it was changed but the app not started again: "RESTART NEEDED"', /STREAMER MODE[^\n]*: ON · RESTART NEEDED/.test(rep({ on: true, atStart: false, needsRestart: true, switches: [], panels: [] })));
  out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { out('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
