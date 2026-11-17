// run-mac.js (lang-73): main.js starts on a Mac too (people run it from the source with npm start; there is no Mac installer): the Windows-only calls are
// skipped (BrowserWindow.setIcon does not exist there and stopped the app at the start: users had to comment out line 50), the app keeps a small menu
// (Cmd+C / Cmd+V and Cmd+Q only work through the menu on a Mac), and a click on the Dock icon brings the hidden window back. On Windows nothing changes.
// main.js is really run here, with a stand-in Electron that has what each system has.
const Module = require('module'), path = require('path'), fs = require('fs'), os = require('os');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 600))); c ? pass++ : fail++; };
process.env.HG_USERDATA = fs.mkdtempSync(path.join(os.tmpdir(), '4h-mac-'));
const base = require('./node_modules/electron');          // the stand-in of the main-process tests (stubs/electron)

function start(platform) {
  const calls = { menu: undefined, setIcon: 0, appId: 0, shown: 0, focused: 0, tray: false, failed: [] }, appOn = {};
  process.removeAllListeners('unhandledRejection'); process.on('unhandledRejection', e => calls.failed.push(String(e && e.message || e)));          // (the start of the app runs in whenReady().then: an error there is a rejection)
  let ready; const readyP = new Promise(r => { ready = r; });
  class FakeWindow {
    constructor(o) { this.opts = o; this.visible = o.show !== false; this.webContents = { on() {}, send() {} }; FakeWindow.last = this; }
    on() {} loadFile() {} isDestroyed() { return false; } isMinimized() { return false; } isVisible() { return this.visible; }
    show() { this.visible = true; calls.shown++; } hide() { this.visible = false; } focus() { calls.focused++; } restore() {}
    isFullScreen() { return false; } setFullScreen() {}
    static getAllWindows() { return []; } static fromWebContents() { return null; }
  }
  if (platform !== 'darwin') FakeWindow.prototype.setIcon = function () { calls.setIcon++; };          // a Mac's BrowserWindow has no setIcon
  const app = Object.assign({}, base.app, {
    on: (ev, f) => { (appOn[ev] = appOn[ev] || []).push(f); }, whenReady: () => readyP, isReady: () => false, requestSingleInstanceLock: () => true,
    commandLine: { appendSwitch() {} }, getAppPath: () => process.cwd(), exit() {}
  });
  app.setAppUserModelId = () => { calls.appId++; };          // (a Mac has it too, it does nothing there: users got past line 2, line 50 stopped them)
  const fake = Object.assign({}, base, {
    app, BrowserWindow: FakeWindow,
    Tray: class { constructor() { calls.tray = true; } setToolTip() {} setContextMenu() {} on() {} },
    Menu: { setApplicationMenu: m => { calls.menu = m; }, buildFromTemplate: t => ({ template: t }) },
    session: { fromPartition: p => ({ p }) }, ipcMain: { handle() {}, on() {}, removeHandler() {} }
  });
  const real = Object.getOwnPropertyDescriptor(process, 'platform'); Object.defineProperty(process, 'platform', { value: platform });
  const orig = Module._load; Module._load = function (req) { return req === 'electron' ? fake : orig.apply(this, arguments); };
  Object.keys(require.cache).filter(k => !/node_modules/.test(k)).forEach(k => delete require.cache[k]);
  let error = null;
  try { require(path.join(process.cwd(), 'main.js')); } catch (e) { error = e; }
  return { calls, appOn, error, ready: async () => { ready(); await new Promise(r => setTimeout(r, 50)); }, done: () => { Module._load = orig; Object.defineProperty(process, 'platform', real); }, win: () => FakeWindow.last };
}

(async () => {
  // ---- a Mac
  let s = start('darwin');
  ok('on a Mac main.js loads without an error (the Windows-only setAppUserModelId is not asked for, it would do nothing there)', !s.error && s.calls.appId === 0, s.error && s.error.stack);
  let threw = null; try { await s.ready(); } catch (e) { threw = e; }
  ok('...and the app starts all the way (the window, then the tray icon), with no error: setIcon is not asked for (a Mac\u2019s window has none: it stopped the app at the start before)', !threw && !!s.win() && s.calls.setIcon === 0 && s.calls.tray && s.calls.failed.length === 0, [threw && threw.stack, s.calls.failed]);
  const items = s.calls.menu && s.calls.menu.template ? s.calls.menu.template.map(x => x.role) : s.calls.menu;
  ok('...it keeps a small menu: the app menu (Cmd+Q) and Edit (Cmd+C, Cmd+V, Cmd+X, Cmd+A), nothing else', JSON.stringify(items) === '["appMenu","editMenu"]', items);
  const w = s.win(); w.hide();
  const act = (s.appOn.activate || [])[0]; if (act) act();
  ok('...closing the window only hides it (as on Windows), and a click on the Dock icon brings it back', typeof act === 'function' && w.isVisible() && s.calls.focused >= 1, [typeof act, w.isVisible()]);
  s.done();
  // ---- Windows: as before
  s = start('win32');
  ok('on Windows main.js loads as before, with its own identity for the taskbar and the notifications (setAppUserModelId)', !s.error && s.calls.appId === 1, s.error && s.error.stack);
  threw = null; try { await s.ready(); } catch (e) { threw = e; }
  ok('...the window gets the green bulb icon (setIcon), the tray icon, and no menu at all (File / Edit / View / Window removed, as since lang-71)', !threw && s.calls.setIcon === 1 && s.calls.tray && s.calls.menu === null && s.calls.failed.length === 0, [threw && threw.message, s.calls]);
  s.done();
  const src = fs.readFileSync('main.js', 'utf8');
  ok('main.js asks for setIcon and setAppUserModelId only where they exist (never bare)', !/^\s*win\.setIcon\(/m.test(src) && !/^app\.setAppUserModelId\(/m.test(src));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
