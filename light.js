// light.js (lang-70): Settings › "Light mode", for slower PCs. Kept in settings.json ("lightMode": true), off at first.
//
// What it does in the game panels: it asks each game page for "reduced motion", the standard setting of the browser that a person with motion sickness turns on
// (Windows: Settings › Accessibility › Visual effects › Animation effects). The game's own stylesheet already answers it: its looping decorations (VIP shine, glows,
// bubbles, pulsing buttons...) stop. Nothing of the game is clicked, paused or slowed down; the hunts, the numbers and the captures are the same. The game's
// script does not read it at all (checked in the game's code of 2026-11-08), so only the look changes.
// How: the reader is already attached to each game panel (ws-reader.js, the debugger, to read the game's messages); this sends one command through it:
// Emulation.setEmulatedMedia { prefers-reduced-motion: reduce }. It lasts for the page and the next pages of the panel; it is sent again after a new page,
// and after the reader attached again. With Light mode off nothing is ever sent (when it is turned off, the setting is cleared once).
// In the window (index.html and dashboard.html) Light mode also redraws the Summary every 5 s instead of every second, and stops the app's own decorative animations.

let electron = null;
try { electron = require('electron'); } catch (e) {}

const live = new Set();                  // the game panels that are hooked and not gone
const hooked = new WeakSet();
const states = new WeakMap();            // per web contents: { sent, value, at, error }
let on = null, started = false;
let clock = () => Date.now();
let later = (f, ms) => setTimeout(f, ms);

function settings() { try { return require('./settings'); } catch (e) { return null; } }
function isOn() {
  if (on === null) { const S = settings(); try { on = !!(S && S.read().lightMode === true); } catch (e) { on = false; } }
  return on;
}
function stateOf(wc) { let s = states.get(wc); if (!s) { s = { sent: 0, value: '', at: 0, error: '' }; states.set(wc, s); } return s; }

// one game panel: reduced motion on (Light mode) or back to the page's own (only when it had been set)
async function apply(wc) {
  if (!wc) return false;
  try { if (typeof wc.isDestroyed === 'function' && wc.isDestroyed()) return false; } catch (e) { return false; }
  const s = stateOf(wc), want = isOn() ? 'reduce' : '';
  if (!want && !s.value) return false;                                   // off and never set: nothing is sent at all
  try {
    if (!wc.debugger || !wc.debugger.isAttached()) { s.error = 'the reader is not attached yet'; return false; }
    await wc.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: want }] });
    s.sent++; s.value = want; s.at = clock(); s.error = '';
    return true;
  } catch (e) { s.error = String((e && e.message) || e).slice(0, 80); return false; }
}
function hook(wc) {
  if (!wc || hooked.has(wc)) return;
  let type = '';
  try { type = typeof wc.getType === 'function' ? wc.getType() : ''; } catch (e) {}
  if (type !== 'webview') return;                                       // only the game panels
  hooked.add(wc); live.add(wc);
  const soon = ms => later(() => { apply(wc).catch(() => {}); }, ms);
  try { wc.on('dom-ready', () => soon(300)); } catch (e) {}               // (a new page; the reader attaches at about the same time)
  try { wc.on('did-finish-load', () => soon(300)); } catch (e) {}
  try { if (wc.debugger && wc.debugger.on) wc.debugger.on('detach', () => soon(2500)); } catch (e) {}      // the reader attaches again after 1 s (ws-reader.js)
  try { wc.on('destroyed', () => live.delete(wc)); } catch (e) {}
  soon(300);
}
// Settings: on or off, for every panel at once (no restart)
function set(v) {
  const S = settings(); let saved = false;
  try { const s = S.read(); s.lightMode = v === true; saved = S.write(s); } catch (e) { saved = false; }
  if (saved) on = v === true;
  live.forEach(wc => { apply(wc).catch(() => {}); });
  return { on: isOn(), saved: saved };
}
function init() {
  if (started || !electron) return;
  started = true;
  try { if (electron.app && electron.app.on) electron.app.on('web-contents-created', (ev, wc) => hook(wc)); } catch (e) {}
  try { if (electron.webContents && electron.webContents.getAllWebContents) electron.webContents.getAllWebContents().forEach(hook); } catch (e) {}
  if (!electron.ipcMain || !electron.ipcMain.handle) return;
  const S = settings(); const ours = e => !!(S && S.fromOurWindow && S.fromOurWindow(e));       // only the app's own window, never a game panel
  electron.ipcMain.handle('light:get', e => (ours(e) ? { on: isOn() } : null));
  electron.ipcMain.handle('light:set', (e, v) => (ours(e) ? set(v === true) : null));
}
// for the report of the Diagnostics
function info() {
  const out = { on: isOn(), panels: [] };
  try {
    const g = require('./accounts')._guests || {};
    const t = clock();
    for (let n = 1; n <= 4; n++) {
      const wc = g[n]; if (!wc) continue;
      const s = states.get(wc) || { sent: 0, value: '', at: 0, error: '' };
      out.panels.push({ n: n, reduced: s.value === 'reduce', sent: s.sent, ageSec: s.at ? Math.max(0, Math.round((t - s.at) / 1000)) : null, error: s.error });
    }
  } catch (e) {}
  return out;
}

module.exports = { init, info, hook, apply, set, isOn, _reset: () => { started = false; on = null; live.clear(); }, _setOn: v => { on = v === true; }, _setClock: f => { clock = f || (() => Date.now()); }, _setLater: f => { later = f || ((g, ms) => setTimeout(g, ms)); } };
