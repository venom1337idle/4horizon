// run-startup.js: "start 4horizon with the PC" (settings.js asks Windows; nothing is saved by the app)
const Module = require('module'), fs = require('fs'), path = require('path');
const REG = new Map(); let HANDLERS = {}, PACKAGED = false, THROW = false; const APPON = {};
const key = o => JSON.stringify([o.path, o.args || []]);
const electronStub = { app: { on: (ev, fn) => { APPON[ev] = fn; }, get isPackaged() { return PACKAGED; }, getAppPath: () => '/home/x/4horizon', getLocale: () => 'en-US', whenReady: () => new Promise(() => {}), getPath: () => __dirname,
    setLoginItemSettings: o => { if (THROW) throw new Error('registry says no'); if (o.openAtLogin) REG.set(key(o), true); else REG.delete(key(o)); },
    getLoginItemSettings: o => ({ openAtLogin: REG.has(key(o)) }) },
  BrowserWindow: { fromWebContents: wc => (wc && wc.ours ? {} : null) }, ipcMain: { handle: (ch, fn) => { HANDLERS[ch] = fn; } } };
const origLoad = Module._load; Module._load = function (req, ...a) { return req === 'electron' ? electronStub : origLoad.call(this, req, ...a); };
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const platform = p => Object.defineProperty(process, 'platform', { value: p, configurable: true });
const realPlatform = process.platform, MAIN = path.join(__dirname, 'main.js');
function fresh(mainText) {
  REG.clear(); HANDLERS = {}; PACKAGED = false; THROW = false;
  if (mainText === null) { try { fs.unlinkSync(MAIN); } catch (e) {} } else fs.writeFileSync(MAIN, mainText);
  Object.keys(require.cache).filter(k => /settings\.js|i18n/.test(k)).forEach(k => delete require.cache[k]);
  const S = require('./settings'); S.init(); return S;
}
const entries = () => Array.from(REG.keys()).map(k => JSON.parse(k));
(async () => {
  platform('linux'); let S = fresh('const x = 1;');
  ok('on a system that is neither Windows nor macOS: not supported, nothing is registered', S.startupState().supported === false && S.setStartup({ enabled: true }).saved === false && REG.size === 0);

  platform('win32'); S = fresh("const startHidden = process.argv.includes('--hidden');");
  let st = S.startupState();
  ok('Windows: supported, off at first, and main.js is known to start hidden when asked', st.supported && !st.enabled && !st.hidden && st.hiddenReady && !st.packaged, st);
  st = S.setStartup({ enabled: true });
  ok('switching it on registers electron with the project folder as its argument, once', st.enabled && !st.hidden && st.saved && entries().length === 1 && entries()[0][0] === process.execPath && JSON.stringify(entries()[0][1]) === JSON.stringify([path.resolve('/home/x/4horizon')]), [st, entries()]);
  st = S.setStartup({ hidden: true });
  ok('"start hidden in the tray" replaces that entry by one with --hidden (never two entries)', st.enabled && st.hidden && entries().length === 1 && entries()[0][1].slice(-1)[0] === '--hidden', entries());
  st = S.setStartup({ hidden: false });
  ok('...and back: one entry without --hidden', st.enabled && !st.hidden && entries().length === 1 && entries()[0][1].indexOf('--hidden') < 0, entries());
  st = S.setStartup({ enabled: false });
  ok('switching it off removes the entry', !st.enabled && !st.hidden && REG.size === 0, entries());
  st = S.setStartup({ hidden: true });
  ok('"hidden" while it is off registers nothing', !st.enabled && !st.hidden && REG.size === 0, entries());
  S.setStartup({ enabled: true, hidden: true });
  st = S.setStartup({ enabled: false });
  ok('switching off while hidden was on removes that entry too', REG.size === 0 && !st.enabled, entries());

  const before = JSON.stringify(entries()); S.setStartup({ enabled: true });
  const b2 = JSON.stringify(entries());
  S.setStartup(null); S.setStartup('yes'); S.setStartup({ enabled: 'no', hidden: 1 }); S.setStartup(7);
  ok('text, numbers, null and 1-for-true are ignored: the registry does not change', JSON.stringify(entries()) === b2 && b2 !== before, entries());

  S = fresh('const x = 1;'); S.setStartup({ enabled: true }); st = S.setStartup({ hidden: true });
  ok('a main.js that does not know --hidden (the installer was not run): hiddenReady is false and "hidden" is not registered', st.hiddenReady === false && st.hidden === false && entries().length === 1 && entries()[0][1].indexOf('--hidden') < 0, [st, entries()]);
  S = fresh(null); ok('no main.js at all: hiddenReady false, nothing throws', S.startupState().hiddenReady === false);

  S = fresh("'--hidden'"); PACKAGED = true; st = S.setStartup({ enabled: true });
  ok('a packaged app registers itself with no arguments', st.packaged && st.enabled && entries().length === 1 && entries()[0][1].length === 0, entries());
  st = S.setStartup({ hidden: true });
  ok('...and with only --hidden when hidden', st.hidden && entries().length === 1 && JSON.stringify(entries()[0][1]) === '["--hidden"]', entries());

  S = fresh("'--hidden'"); THROW = true; st = S.setStartup({ enabled: true });
  ok('when Windows refuses, saved is false and nothing throws', st.saved === false, st);
  THROW = false;

  S = fresh("'--hidden'"); const own = { sender: { ours: true } }, other = { sender: { ours: false } };
  ok('the two handlers exist', typeof HANDLERS['startup:get'] === 'function' && typeof HANDLERS['startup:set'] === 'function');
  ok('a game panel gets nothing and changes nothing', (await HANDLERS['startup:get'](other)) === null && (await HANDLERS['startup:set'](other, { enabled: true })) === null && REG.size === 0);
  ok('our window reads and changes it', (await HANDLERS['startup:get'](own)).enabled === false && (await HANDLERS['startup:set'](own, { enabled: true })).enabled === true && REG.size === 1);
  ok('the language handlers are still there next to them', typeof HANDLERS['lang:get'] === 'function' && typeof HANDLERS['lang:set'] === 'function');

  // ---- the language of a new user (lang-49): Portuguese, whatever the language of Windows; a saved choice is kept
  ok('a new user gets Portuguese (whatever the language of Windows)', S.defaultLang() === 'pt-BR');
  ok('...and the app starts in it only when nothing was chosen: a saved language is used as it is', /if \(s\.lang !== undefined\) i18n\.setLang\(s\.lang\);/.test(require('fs').readFileSync(require('path').join(__dirname, 'settings.js'), 'utf8')) && /if \(read\(\)\.lang === undefined\) i18n\.setLang\(defaultLang\(\)\)/.test(require('fs').readFileSync(require('path').join(__dirname, 'settings.js'), 'utf8')));
  // ---- minimize to tray (lang-41): kept in settings.json, off at first, any system
  const SF = path.join(__dirname, 'settings.json'); try { fs.unlinkSync(SF); } catch (e) {}
  fs.writeFileSync(SF, JSON.stringify({ lang: 'pt-BR' }));
  S = fresh("const startHidden = process.argv.includes('--hidden');"); S._resetTray();
  ok('minimize to tray: off at first (startupState().toTray false)', S.startupState().toTray === false, S.startupState());
  const regBefore = JSON.stringify(entries());
  st = S.setStartup({ toTray: true, enabled: false });
  ok('switching it on: saved in settings.json (the language kept), the start with the PC NOT touched (the other fields of that call are ignored)', st.toTray === true && st.saved === true && JSON.parse(fs.readFileSync(SF, 'utf8')).minimizeToTray === true && JSON.parse(fs.readFileSync(SF, 'utf8')).lang === 'pt-BR' && JSON.stringify(entries()) === regBefore, [st, entries()]);
  const win = () => { const h = {}; return { h, hidden: 0, restored: 0, min: true, on(ev, fn) { (h[ev] = h[ev] || []).push(fn); }, hide() { this.hidden++; }, restore() { this.restored++; }, isMinimized() { return this.min; }, fire(ev) { (h[ev] || []).forEach(f => f()); } }; };
  const w1 = win(); APPON['browser-window-created']({}, w1);
  ok('every window the app makes is watched (browser-window-created), once', w1.h.minimize && w1.h.minimize.length === 1 && (S.hookWindow(w1), w1.h.minimize.length === 1));
  w1.fire('minimize');
  ok('minimizing it hides it (into the tray)', w1.hidden === 1);
  w1.fire('show');
  ok('...and shown again from the tray it comes back whole, not as a minimized button', w1.restored === 1);
  S.setStartup({ toTray: false }); w1.fire('minimize');
  ok('switched off: minimizing is minimizing again (not hidden)', w1.hidden === 1 && JSON.parse(fs.readFileSync(SF, 'utf8')).minimizeToTray === false);
  platform('linux'); S = fresh('const x = 1;'); S._resetTray();
  st = S.setStartup({ toTray: true });
  ok('it does not need "start with the PC" to be supported (other systems too)', st.toTray === true && st.saved === true && st.supported === false, st);
  S.setStartup({ toTray: 'yes' }); S._resetTray();
  ok('only true / false change it ("yes" changes nothing)', S.startupState().toTray === true);
  try { fs.unlinkSync(SF); } catch (e) {}
  try { fs.unlinkSync(MAIN); } catch (e) {}
  platform(realPlatform); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
