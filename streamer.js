// streamer.js (lang-71): Settings › "Streamer mode", for people who stream 4horizon (OBS: Window Capture) while they use other apps. Kept in settings.json
// ("streamerMode": true), off at first. Only a real true turns it on (a broken file, a text, a number: off).
//
// 1. The game screens keep moving behind other windows. Chromium stops drawing a window that other windows cover completely (and slows its pages and
//    timers down); OBS would then show a frozen picture. With streamer mode these are switched off when the app starts: main.js calls applyAtStart()
//    before the app is ready (later it has no effect), so a change made in Settings takes effect after a restart. Each window and game panel is also told
//    not to slow down in the background. (A MINIMIZED window cannot be captured at all: that is how Windows works.) It costs about the CPU of a visible window.
// 2. Privacy, at once (no restart): the e-mails are hidden on screen. In 4horizon's Accounts window (index.html, body.streamer), and in the game panels
//    (style rules put in with insertCSS): the e-mail box of the game's login (dots, like a password), its "Did you mean ...?" and the e-mail in the game's settings.
// 3. Economy mode is not available while streamer mode is on (it stops the drawing on purpose): the window does not offer it, and economy.js refuses it.
// It never throws: the app starts the same way if anything here fails.

'use strict';
const fs = require('fs');
const path = require('path');
let electron = null;
try { electron = require('electron'); } catch (e) { electron = null; }

const SWITCHES = ['disable-backgrounding-occluded-windows', 'disable-renderer-backgrounding', 'disable-background-timer-throttling'];
const FEATURES_OFF = 'CalculateNativeWinOcclusion';        // Windows: a window covered by other windows is not taken as hidden
// the e-mail in the game panels: the login box (autocomplete "username"), its suggestion, the e-mail row of the game's settings
const CSS = [
  'input[autocomplete="username"], input[autocomplete="email"], input[type="email"] { -webkit-text-security: disc !important; }',
  '.auth-email-suggest b, .pf-table .pf-row:first-child strong { filter: blur(6px) !important; }'
].join('\n');

const state = { atStart: false, applied: [] };
let on = null, started = false;
const hooked = new WeakSet(), live = new Set(), keys = new WeakMap();      // keys: the inserted style rules of each game panel (to take them out again)

const appOf = a => a || (electron && electron.app) || null;
function wantedIn(dir) {
  try { const s = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')); return !!(s && typeof s === 'object' && !Array.isArray(s) && s.streamerMode === true); } catch (e) { return false; }
}
function settings() { try { return require('./settings'); } catch (e) { return null; } }
function isOn() {
  if (on === null) { try { on = wantedIn(appOf().getPath('userData')); } catch (e) { on = false; } }
  return on;
}

// main.js: first thing, before the app is ready
function applyAtStart(app) {
  app = appOf(app);
  if (!app) return false;
  let want = false; try { want = wantedIn(app.getPath('userData')); } catch (e) { want = false; }
  if (!want) return false;
  try {
    SWITCHES.forEach(s => { app.commandLine.appendSwitch(s); state.applied.push(s); });
    app.commandLine.appendSwitch('disable-features', FEATURES_OFF); state.applied.push('disable-features=' + FEATURES_OFF);
    state.atStart = true;
    console.log('Streamer mode: the game screens keep moving behind other windows');
  } catch (e) { state.atStart = false; }
  return state.atStart;
}

async function privacy(wc) {
  if (!wc) return;
  try { if (wc.isDestroyed && wc.isDestroyed()) return; } catch (e) { return; }
  const k = keys.get(wc);
  if (isOn() && !k) { try { const key = await wc.insertCSS(CSS); keys.set(wc, key); } catch (e) {} }
  else if (!isOn() && k) { try { await wc.removeInsertedCSS(k); } catch (e) {} keys.delete(wc); }
}
function hook(wc) {
  if (!wc || hooked.has(wc)) return;
  hooked.add(wc);
  if (state.atStart) { try { wc.setBackgroundThrottling(false); } catch (e) {} }          // the window and the game panels keep their speed in the background
  let type = ''; try { type = wc.getType ? wc.getType() : ''; } catch (e) {}
  if (type !== 'webview') return;
  live.add(wc);
  try { wc.on('dom-ready', () => { keys.delete(wc); privacy(wc); }); } catch (e) {}          // (a new page: its old rules are gone)
  try { wc.on('destroyed', () => live.delete(wc)); } catch (e) {}
  privacy(wc);
}
function set(v) {
  const S = settings(); let saved = false;
  try { const s = S.read(); s.streamerMode = v === true; saved = S.write(s); } catch (e) { saved = false; }
  if (saved) on = v === true;
  live.forEach(wc => { privacy(wc); });
  return { on: isOn(), saved: saved, atStart: state.atStart, needsRestart: isOn() !== state.atStart };
}
function init() {
  if (started || !electron) return;
  started = true;
  try { if (electron.app && electron.app.on) electron.app.on('web-contents-created', (ev, wc) => hook(wc)); } catch (e) {}
  try { if (electron.webContents && electron.webContents.getAllWebContents) electron.webContents.getAllWebContents().forEach(hook); } catch (e) {}
  if (!electron.ipcMain || !electron.ipcMain.handle) return;
  const S = settings(); const ours = e => !!(S && S.fromOurWindow && S.fromOurWindow(e));          // only the app's own window, never a game panel
  electron.ipcMain.handle('streamer:get', e => (ours(e) ? { on: isOn(), atStart: state.atStart, needsRestart: isOn() !== state.atStart } : null));
  electron.ipcMain.handle('streamer:set', (e, v) => (ours(e) ? set(v === true) : null));
}
// economy mode asks: is streamer mode on (chosen, or running since the start)?
const blocksEconomy = () => isOn() || state.atStart;
function info() {
  const out = { on: isOn(), atStart: state.atStart, needsRestart: isOn() !== state.atStart, switches: state.applied.slice(), panels: [] };
  try { const g = require('./accounts')._guests || {}; for (let n = 1; n <= 4; n++) if (g[n]) out.panels.push({ n: n, hidden: keys.has(g[n]) }); } catch (e) {}
  return out;
}

module.exports = { applyAtStart, init, info, hook, set, isOn, blocksEconomy, wantedIn, CSS, SWITCHES, _state: state, _reset: () => { started = false; on = null; state.atStart = false; state.applied = []; live.clear(); } };
