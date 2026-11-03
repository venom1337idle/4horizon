// lockdown.js: the game panels (and the app's own window) get only what they need (lang-48).
//
// 1) Permissions. Electron grants every permission a page asks for unless told otherwise: camera, microphone, location, notifications, USB or serial devices...
//    Here every request and every check is refused, except writing to the clipboard (the "copy" buttons of the game, and "Copy report" of the Diagnostics)
//    and full screen. Each refusal is counted per panel and named in the Diagnostics report, so that a game feature that needs something shows up there.
// 2) The panels themselves. Before a <webview> starts (will-attach-webview), its settings are forced: no preload script, no Node, isolated and sandboxed,
//    web security on. A panel that would open anything else than the game, or in another storage than the four accounts, is not created.
// 3) WebRTC (lang-51). A game page could learn the computer's network addresses through WebRTC (the "STUN" look-ups that show in the console). Every game
//    panel gets the policy "disable_non_proxied_udp": no direct UDP connections, so no address is discovered that way. If the game ever needs WebRTC for
//    something, the Diagnostics show how many panels have the policy, so the cause can be found.
// It changes nothing in the game and sends nothing to it.

let electron = null;
try { electron = require('electron'); } catch (e) {}

const GAME_ORIGIN = 'https://pokehorizonidle.com';
const PARTITION = /^persist:conta[1-4]$/;
const ALLOWED = new Set(['clipboard-sanitized-write', 'fullscreen']);
const MAX_LIST = 30;

const stats = { attached: 0, fixed: 0, refusedPanels: [], denied: {}, allowed: {}, last: [], hooked: { windows: 0, sessions: 0 }, webrtc: { set: 0, failed: 0 } };
const WEBRTC_POLICY = 'disable_non_proxied_udp';
let now = () => Date.now();

const originOf = url => { try { return new URL(String(url)).origin; } catch (e) { return ''; } };
const hostOf = url => { try { return new URL(String(url)).hostname.slice(0, 60); } catch (e) { return String(url || '').slice(0, 20) ? '(not an address)' : '(none)'; } };

function note(kind, panel, permission) {
  const k = String(permission || '?').slice(0, 40);
  const box = kind === 'denied' ? stats.denied : stats.allowed;
  const key = panel + ':' + k;
  box[key] = (box[key] || 0) + 1;
  if (kind === 'denied') { stats.last.push({ at: now(), panel: panel, permission: k }); if (stats.last.length > MAX_LIST) stats.last.shift(); }
}

// ---------------------------------------------------------------------------------------------------------------- 1) permissions
// n: the panel of that storage (1 to 4), 0 for the app's own window
const requestHandler = n => (wc, permission, callback) => { const ok = ALLOWED.has(permission); note(ok ? 'allowed' : 'denied', n, permission); try { callback(ok); } catch (e) {} };
const checkHandler = n => (wc, permission) => { const ok = ALLOWED.has(permission); if (!ok) note('denied', n, permission + ' (check)'); return ok; };
function lockSession(ses, n) {
  if (!ses || ses.__4hLocked) return;
  ses.__4hLocked = true;
  try { ses.setPermissionRequestHandler(requestHandler(n)); } catch (e) {}
  try { ses.setPermissionCheckHandler(checkHandler(n)); } catch (e) {}
  try { if (ses.setDevicePermissionHandler) ses.setDevicePermissionHandler(() => false); } catch (e) {}           // USB, HID, serial: never
  try { ses.on('select-hid-device', (ev, d, cb) => { ev.preventDefault(); note('denied', n, 'hid device'); try { cb(); } catch (e) {} }); } catch (e) {}
  try { ses.on('select-serial-port', (ev, l, wc, cb) => { ev.preventDefault(); note('denied', n, 'serial port'); try { cb(''); } catch (e) {} }); } catch (e) {}
  try { ses.on('select-usb-device', (ev, d, cb) => { ev.preventDefault(); note('denied', n, 'usb device'); try { cb(); } catch (e) {} }); } catch (e) {}
  stats.hooked.sessions++;
}

// ---------------------------------------------------------------------------------------------------------------- 2) the panels
function guardWebview(event, webPreferences, params) {
  stats.attached++;
  const okSrc = originOf(params && params.src) === GAME_ORIGIN, okPart = PARTITION.test(String(params && params.partition || ''));
  if (!okSrc || !okPart) {
    try { event.preventDefault(); } catch (e) {}
    stats.refusedPanels.push({ at: now(), host: hostOf(params && params.src), partition: okPart ? 'account' : String(params && params.partition || '(none)').slice(0, 30) });
    if (stats.refusedPanels.length > MAX_LIST) stats.refusedPanels.shift();
    return false;
  }
  // forced, whatever the page asked for
  delete webPreferences.preload; delete webPreferences.preloadURL;
  webPreferences.nodeIntegration = false; webPreferences.nodeIntegrationInSubFrames = false; webPreferences.nodeIntegrationInWorker = false;
  webPreferences.contextIsolation = true; webPreferences.sandbox = true; webPreferences.webSecurity = true;
  webPreferences.allowRunningInsecureContent = false; webPreferences.experimentalFeatures = false; webPreferences.enableBlinkFeatures = '';
  stats.fixed++;
  return true;
}
function hookContents(wc) {
  if (!wc || wc.__4hLocked) return;
  wc.__4hLocked = true;
  let type = 'window'; try { type = wc.getType ? wc.getType() : 'window'; } catch (e) {}
  if (type === 'webview') {                                                            // a game panel: no WebRTC address discovery
    try { wc.setWebRTCIPHandlingPolicy(WEBRTC_POLICY); stats.webrtc.set++; } catch (e) { stats.webrtc.failed++; }
    return;
  }
  if (type !== 'window') return;                                                       // only a window can hold panels
  try { wc.on('will-attach-webview', guardWebview); stats.hooked.windows++; } catch (e) {}
}

function init() {
  if (!electron || !electron.app) return;
  const app = electron.app;
  try { app.on('web-contents-created', (e, wc) => hookContents(wc)); } catch (e) {}
  const lockAll = () => {
    try { lockSession(electron.session.defaultSession, 0); } catch (e) {}
    for (let n = 1; n <= 4; n++) { try { lockSession(electron.session.fromPartition('persist:conta' + n), n); } catch (e) {} }
    try { electron.webContents.getAllWebContents().forEach(hookContents); } catch (e) {}      // a window made before this ran
  };
  try { if (app.isReady && app.isReady()) lockAll(); else app.whenReady().then(lockAll); } catch (e) {}
}

// for the report of the Diagnostics (counts and permission names only)
function info() {
  const sum = box => { const out = {}; Object.keys(box).forEach(k => { const i = k.indexOf(':'), p = Number(k.slice(0, i)), name = k.slice(i + 1); (out[name] = out[name] || { total: 0, panels: {} }).total += box[k]; out[name].panels[p] = (out[name].panels[p] || 0) + box[k]; }); return out; };
  return { sessions: stats.hooked.sessions, windows: stats.hooked.windows, webrtc: { policy: WEBRTC_POLICY, set: stats.webrtc.set, failed: stats.webrtc.failed }, panels: { attached: stats.attached, fixed: stats.fixed, refused: stats.refusedPanels.map(x => ({ ageSec: Math.round((now() - x.at) / 1000), host: x.host, partition: x.partition })) },
    denied: sum(stats.denied), allowed: sum(stats.allowed), lastDenied: stats.last.slice(-5).map(x => ({ ageSec: Math.round((now() - x.at) / 1000), panel: x.panel, permission: x.permission })) };
}

module.exports = { init, info, ALLOWED, GAME_ORIGIN, _guard: guardWebview, _request: requestHandler, _check: checkHandler, _lockSession: lockSession, _hookContents: hookContents,
  _setNow: f => { now = f; }, _reset: () => { stats.attached = stats.fixed = 0; stats.refusedPanels = []; stats.denied = {}; stats.allowed = {}; stats.last = []; stats.hooked = { windows: 0, sessions: 0 }; stats.webrtc = { set: 0, failed: 0 }; } };
