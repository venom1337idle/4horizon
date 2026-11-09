// run-light.js (lang-70): light.js, Settings › "Light mode" for slower PCs: kept in settings.json, and the game's own "reduced motion" asked for in each game panel
// (through the reader's connection, one command), with nothing at all sent while it is off. Also the settings backup and the line of the Diagnostics report.
const fs = require('fs'), path = require('path'), os = require('os');
process.env.HG_USERDATA = fs.mkdtempSync(path.join(os.tmpdir(), '4h-light-'));
const electron = require('electron');
const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const UD = electron._USERDATA, SF = path.join(UD, 'settings.json');
const L = require('./light');
const tick = () => new Promise(r => setTimeout(r, 0));
// a game panel as Electron gives it: its type, its events, and the reader's debugger (attached or not)
function panel(type, attached) {
  const ls = {}, dl = {}, cmds = [];
  const wc = { cmds, getType: () => type || 'webview', isDestroyed: () => false, on(ev, f) { (ls[ev] = ls[ev] || []).push(f); }, fire: ev => (ls[ev] || []).forEach(f => f()),
    debugger: { attached: attached !== false, isAttached() { return this.attached; }, on(ev, f) { (dl[ev] = dl[ev] || []).push(f); }, detach: () => (dl.detach || []).forEach(f => f()),
      sendCommand(m, p) { if (this.fail) return Promise.reject(new Error('Not allowed')); cmds.push([m, JSON.parse(JSON.stringify(p))]); return Promise.resolve({}); } } };
  return wc;
}
const RM = on => JSON.stringify(['Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: on ? 'reduce' : '' }] }]);
let queued = []; L._setLater((f, ms) => queued.push([f, ms]));
const runQueued = async () => { const q = queued; queued = []; q.forEach(x => x[0]()); await tick(); await tick(); };

(async () => {
  // ---- off (the start of every install)
  try { fs.unlinkSync(SF); } catch (e) {}
  L._reset(); L.init();
  const H = electron._handlers;
  ok('a new install: Light mode is off', L.isOn() === false && L.info().on === false);
  const p1 = panel(); L.hook(p1); p1.fire('dom-ready'); await runQueued();
  ok('while it is off NOTHING is sent to the game panel (not even "no reduced motion")', p1.cmds.length === 0, p1.cmds);
  const win = panel('window'); L.hook(win); win.fire('dom-ready'); await runQueued();
  ok('the window of the app itself is never touched', win.cmds.length === 0);

  // ---- the Settings window turns it on
  ok('only the app\u2019s own window may ask: a game panel gets nothing', H['light:get']({ sender: {} }) === null && H['light:set']({ sender: {} }, true) === null && L.isOn() === false);
  let r = H['light:set']({ sender: electron._WINDOW }, true); await tick(); await tick();
  ok('turned on from Settings: saved in settings.json ("lightMode": true), the answer says so', r.on === true && r.saved === true && JSON.parse(fs.readFileSync(SF, 'utf8')).lightMode === true && H['light:get']({ sender: electron._WINDOW }).on === true, r);
  ok('...and at once (no restart) the game panel gets the game\u2019s own "reduced motion", once', p1.cmds.length === 1 && JSON.stringify(p1.cmds[0]) === RM(true), p1.cmds);
  p1.fire('dom-ready'); await runQueued();
  ok('a new page in the panel (a sign-in, a reload): it is asked for again', p1.cmds.length === 2 && JSON.stringify(p1.cmds[1]) === RM(true), p1.cmds.length);
  p1.debugger.detach(); ok('the reader let go of the panel: it is asked for again a little later (after the reader attached again, 1 s)', queued.length === 1 && queued[0][1] >= 1500); await runQueued();
  ok('...and it was sent again', p1.cmds.length === 3);
  const p2 = panel('webview', false); L.hook(p2); await runQueued();
  ok('a panel whose reader is not attached yet: nothing is sent (the next page tries again)', p2.cmds.length === 0, p2.cmds);
  p2.debugger.attached = true; p2.fire('did-finish-load'); await runQueued();
  ok('...once it is attached it gets it', p2.cmds.length === 1 && JSON.stringify(p2.cmds[0]) === RM(true), p2.cmds);
  const p3 = panel(); p3.debugger.fail = true; L.hook(p3); let threw = false; try { await runQueued(); } catch (e) { threw = true; }
  ok('a panel that refuses the command takes nothing down (nothing is thrown)', !threw && p3.cmds.length === 0);
  ok('the other kinds of value are not taken as "on": only a real true', (() => { const r2 = H['light:set']({ sender: electron._WINDOW }, 'yes'); return r2.on === false; })());
  await tick(); await tick();
  ok('...(that turned it off: the panels got "no reduced motion" back, once each)', JSON.stringify(p1.cmds[p1.cmds.length - 1]) === RM(false) && JSON.stringify(p2.cmds[p2.cmds.length - 1]) === RM(false), [p1.cmds.slice(-1), p2.cmds.slice(-1)]);
  const n1 = p1.cmds.length; p1.fire('dom-ready'); await runQueued();
  ok('turned off: a new page gets nothing at all any more (the page\u2019s own setting is back)', p1.cmds.length === n1, p1.cmds.length - n1);

  // ---- a restart: the choice is read from settings.json
  fs.writeFileSync(SF, JSON.stringify({ lang: 'en', lightMode: true })); L._reset();
  ok('a restart with "lightMode": true in settings.json: on', L.isOn() === true);
  [['false', false], ['the text "true"', 'true'], ['the number 1', 1]].forEach(([what, v]) => { fs.writeFileSync(SF, JSON.stringify({ lightMode: v })); L._reset(); ok('"lightMode": ' + what + ': off', L.isOn() === false); });
  fs.writeFileSync(SF, '{ broken'); L._reset();
  ok('a broken settings.json: off, nothing thrown', L.isOn() === false);

  // ---- the settings backup keeps it
  fs.writeFileSync(SF, JSON.stringify({ lang: 'en', lightMode: true })); L._reset();
  const B = require('./backup'), file = B.build({}, '1.0.8');
  ok('the settings backup saves Light mode with the app\u2019s settings', file.app && file.app.lightMode === true, file.app);
  fs.writeFileSync(SF, JSON.stringify({ lang: 'en' })); L._reset();
  const res = B.apply(Object.assign({}, file, { app: { lang: 'en', lightMode: true } }));
  ok('...and loading the file turns it on again (saved, and on at once)', res.ok && JSON.parse(fs.readFileSync(SF, 'utf8')).lightMode === true && L.isOn() === true, [res, fs.readFileSync(SF, 'utf8')]);

  // ---- the Diagnostics report
  const D = require('./diag-core');
  const rep = on => { const d = { main: { meta: {}, light: { on: on, panels: [{ n: 1, reduced: true, sent: 2, ageSec: 30, error: '' }, { n: 2, reduced: false, sent: 0, ageSec: null, error: 'the reader is not attached yet' }] } }, ui: {} }; return D.analyse(d).report; };
  ok('the report says whether Light mode is on, and for each panel whether reduced motion was set (and why not)', /LIGHT MODE \(Settings, for slower PCs[^\n]*: ON/.test(rep(true)) && /reduced motion on \(set /.test(rep(true)) && /NOT set yet \(the reader is not attached yet\)/.test(rep(true)), rep(true).slice(rep(true).indexOf('LIGHT MODE'), rep(true).indexOf('LIGHT MODE') + 400));
  ok('...and only one line when it is off', /LIGHT MODE[^\n]*: off\n\n/.test(rep(false)) && !/reduced motion on/.test(rep(false)));
  out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { out('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
