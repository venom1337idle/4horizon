// backup.js: Settings › "Settings backup": save the settings to a file, or load them from one (another PC, a fresh install) (lang-67).
//
// In the file: the notifications, popup tidy, the language, "minimize to tray", and what the window sends (the number of game panels, the layout,
// the zoom, the Summary's settings, the sort of the captures). NEVER in it: saved logins or passwords, the history, Today's highlights, the hunts
// kept for the comparison, the economy measurements, "start with the PC" (it belongs to one computer).
// Loading checks it is a 4horizon settings file, and every value goes through the same checks as in Settings (nothing else is taken).

let electron = null;
try { electron = require('electron'); } catch (e) {}
const fs = require('fs'), path = require('path');

const KIND = '4horizon-settings', FORMAT = 1, MAX_BYTES = 1e6;
const ours = e => { try { return !!(e && e.sender && electron.BrowserWindow.fromWebContents(e.sender)); } catch (x) { return false; } };
const plainObject = o => !!o && typeof o === 'object' && !Array.isArray(o);

// what the main process keeps
function mainPart() {
  const out = {};
  try { out.notifications = require('./notify').getConfig(); } catch (e) {}
  try { out.tidy = require('./tidy').settings(); } catch (e) {}
  try { const s = require('./settings').read() || {}; out.app = { lang: s.lang, minimizeToTray: s.minimizeToTray === true }; } catch (e) {}
  return out;
}

// the file: what the main process keeps + what the window sent (only plain data, kept small)
function build(windowPart, version) {
  const w = plainObject(windowPart) ? windowPart : {};
  return Object.assign({ app4horizon: KIND, format: FORMAT, version: String(version || ''), exportedAt: new Date().toISOString() }, mainPart(),
    { window: plainObject(w.window) ? w.window : {}, summary: plainObject(w.summary) ? w.summary : {} });
}

// applying a file: each part through its own checks; returns what the window applies itself
function apply(o) {
  if (!plainObject(o) || o.app4horizon !== KIND) return { ok: false, reason: 'not a 4horizon settings file' };
  if (Number(o.format) > FORMAT) return { ok: false, reason: 'made by a newer 4horizon' };
  const done = [];
  if (plainObject(o.notifications)) { try { require('./notify').setConfig(o.notifications); done.push('notifications'); } catch (e) {} }
  if (plainObject(o.tidy)) {
    try {
      const T = require('./tidy'), cur = T.settings(), next = Object.assign({}, cur);
      Object.keys(T.DEFAULTS).forEach(k => { if (k in o.tidy && typeof o.tidy[k] === typeof T.DEFAULTS[k]) next[k] = typeof T.DEFAULTS[k] === 'number' ? Math.max(0, Math.min(3600, Math.round(o.tidy[k]))) : o.tidy[k]; });
      let file; try { file = require('./datadir').file('tidy-settings.json'); } catch (e) { file = path.join(__dirname, 'tidy-settings.json'); }
      fs.writeFileSync(file, JSON.stringify(next, null, 2)); done.push('popup tidy');
    } catch (e) {}
  }
  let lang = null;
  if (plainObject(o.app)) {
    try {
      const S = require('./settings'), s = S.read() || {};
      if (typeof o.app.lang === 'string') { const i18n = require('./i18n'); lang = i18n.normalize(o.app.lang); s.lang = lang; try { i18n.setLang(lang); } catch (e) {} }
      if (typeof o.app.minimizeToTray === 'boolean') s.minimizeToTray = o.app.minimizeToTray;
      S.write(s); done.push('app');
    } catch (e) {}
  }
  return { ok: true, done: done, lang: lang, window: plainObject(o.window) ? o.window : {}, summary: plainObject(o.summary) ? o.summary : {} };
}

function init() {
  if (!electron || !electron.ipcMain) return;
  const { ipcMain, dialog, app } = electron;
  ipcMain.handle('settings:export', async (e, windowPart) => {
    if (!ours(e)) return null;
    const r = await dialog.showSaveDialog({ defaultPath: '4horizon-settings.json', filters: [{ name: '4horizon settings', extensions: ['json'] }] });
    if (!r || r.canceled || !r.filePath) return { ok: false, canceled: true };
    fs.writeFileSync(r.filePath, JSON.stringify(build(windowPart, app && app.getVersion ? app.getVersion() : ''), null, 2), 'utf8');
    return { ok: true, file: path.basename(r.filePath) };
  });
  ipcMain.handle('settings:import', async e => {
    if (!ours(e)) return null;
    const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: '4horizon settings', extensions: ['json'] }] });
    if (!r || r.canceled || !r.filePaths || !r.filePaths[0]) return { ok: false, canceled: true };
    let o;
    try { if (fs.statSync(r.filePaths[0]).size > MAX_BYTES) return { ok: false, reason: 'the file is too big' }; o = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); }
    catch (x) { return { ok: false, reason: 'the file could not be read' }; }
    return apply(o);
  });
}

module.exports = { init, build, apply, KIND };
