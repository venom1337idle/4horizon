// settings.js: the settings the main process needs to know (for now only the language), kept in settings.json in the user data folder.
// The window asks for the language with bridge.langGet() and changes it with bridge.langSet(); the notifications, the tray menu and the dialogs of the main process
// use it through i18n.js. Only the app's own window may ask: a game panel (a webview) cannot.

const fs = require('fs');
const path = require('path');
const i18n = require('./i18n');
try { require('./i18n-pt'); } catch (e) { /* without the Portuguese texts everything simply stays English */ }

let electron = null;
try { electron = require('electron'); } catch (e) { electron = null; }

const fromOurWindow = e => !!(e && e.sender && electron && electron.BrowserWindow && electron.BrowserWindow.fromWebContents(e.sender));
const fileOf = () => path.join(electron.app.getPath('userData'), 'settings.json');

function read() {
  try {
    const j = JSON.parse(fs.readFileSync(fileOf(), 'utf8'));
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
  } catch (e) { return {}; }
}
function write(o) {
  try {
    const f = fileOf(), tmp = f + '.tmp';
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(o, null, 1));
    fs.renameSync(tmp, f);                      // a write that is cut short never leaves half a file
    return true;
  } catch (e) { return false; }
}
// the first time (nothing saved yet): the language of the computer if it is Portuguese, English otherwise
// the language of a NEW user (nothing chosen yet): Portuguese, the language of the game (lang-49). A language chosen in Settings is kept as it is.
function defaultLang() { return 'pt-BR'; }

// ---------- start with the PC ----------
// Windows keeps this in its own list of startup apps (the registry), so nothing is saved by the app: it asks Windows. A copy that is run from the project folder
// (npm start) is electron.exe with the folder as its argument, so that is what is registered; a packaged app registers itself. "--hidden" makes main.js keep the
// window in the tray at the start (the line of main.js that does it is added by install-diagnostics.js).
const startupSupported = () => process.platform === 'win32' || process.platform === 'darwin';
function startupOpts(hidden) {
  const packaged = !!(electron && electron.app && electron.app.isPackaged);
  const args = (packaged ? [] : [path.resolve(electron.app.getAppPath())]).concat(hidden ? ['--hidden'] : []);
  return { path: process.execPath, args: args };
}
function mainKnowsHidden() { try { return fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8').indexOf("'--hidden'") >= 0; } catch (e) { return false; } }
// ---------- minimize to tray (lang-41): minimizing the window hides it in the tray, as closing it does. Kept in settings.json, off at first. ----------
let toTray = null;
const toTrayOn = () => { if (toTray === null) toTray = read().minimizeToTray === true; return toTray; };
function hookWindow(w) {
  if (!w || w.__4hTray || !w.on) return;
  w.__4hTray = true;
  w.on('minimize', () => { if (toTrayOn()) { try { w.hide(); } catch (e) {} } });
  w.on('show', () => { try { if (w.isMinimized && w.isMinimized()) w.restore(); } catch (e) {} });       // brought back from the tray: shown whole, not as a button in the taskbar
}

function startupState() {
  const out = { supported: startupSupported(), enabled: false, hidden: false, hiddenReady: mainKnowsHidden(), packaged: !!(electron && electron.app && electron.app.isPackaged), toTray: toTrayOn() };
  if (!out.supported || !electron || !electron.app || !electron.app.getLoginItemSettings) return out;
  try {
    const shown = electron.app.getLoginItemSettings(startupOpts(false)).openAtLogin === true, hid = electron.app.getLoginItemSettings(startupOpts(true)).openAtLogin === true;
    out.enabled = shown || hid; out.hidden = hid;
  } catch (e) { out.error = String(e && e.message || e); }
  return out;
}
// p: { enabled: true / false, hidden: true / false }; anything else is ignored. "hidden" only counts while it is on, and only when main.js knows it.
function setStartup(p) {
  if (p && typeof p === 'object' && typeof p.toTray === 'boolean') {        // minimize to tray: saved by the app (any system); nothing else is touched
    const s = read(); s.minimizeToTray = p.toTray; const ok = write(s); if (ok) toTray = p.toTray;
    return Object.assign(startupState(), { saved: ok });
  }
  const cur = startupState();
  if (!cur.supported || !electron || !electron.app || !electron.app.setLoginItemSettings) return Object.assign(cur, { saved: false });
  p = p && typeof p === 'object' ? p : {};
  const enabled = typeof p.enabled === 'boolean' ? p.enabled : cur.enabled;
  const hidden = enabled && cur.hiddenReady && (typeof p.hidden === 'boolean' ? p.hidden : cur.hidden);
  let saved = true;
  try {
    [false, true].forEach(h => { const o = startupOpts(h); electron.app.setLoginItemSettings({ openAtLogin: false, path: o.path, args: o.args }); });      // both ways are removed first, so that only one stays
    if (enabled) { const o = startupOpts(hidden); electron.app.setLoginItemSettings({ openAtLogin: true, path: o.path, args: o.args }); }
  } catch (e) { saved = false; }
  return Object.assign(startupState(), { saved: saved });
}

let started = false;
function init() {
  if (started) return;
  started = true;
  const s = read();
  if (s.lang !== undefined) i18n.setLang(s.lang);
  else {
    // nothing saved yet: English until the app is ready (the language of the computer is only reliable then), then the language of the computer, unless it was chosen in between
    i18n.setLang('en');
    try { electron.app.whenReady().then(() => { if (read().lang === undefined) i18n.setLang(defaultLang()); }); } catch (e) {}
  }
  try {
    electron.app.on('browser-window-created', (e, w) => hookWindow(w));
    electron.app.whenReady().then(() => { try { electron.BrowserWindow.getAllWindows().forEach(hookWindow); } catch (e) {} });
  } catch (e) {}
  if (!electron || !electron.ipcMain) return;
  electron.ipcMain.handle('startup:get', e => (fromOurWindow(e) ? startupState() : null));
  electron.ipcMain.handle('startup:set', (e, p) => (fromOurWindow(e) ? setStartup(p) : null));
  // (1.0.7: the two questions about GPU acceleration, gpu:get and gpu:set, are answered by gpu.js, started by diag.js right after this)
  electron.ipcMain.handle('lang:get', e => (fromOurWindow(e) ? i18n.getLang() : null));
  electron.ipcMain.handle('lang:set', (e, l) => {
    if (!fromOurWindow(e)) return null;
    const id = i18n.normalize(l);               // anything that is not Portuguese is English
    const s2 = read(); s2.lang = id; write(s2);
    i18n.setLang(id);
    return id;
  });
}

module.exports = { init, read, write, defaultLang, fromOurWindow, startupState, setStartup, hookWindow, _resetTray: () => { toTray = null; } };
