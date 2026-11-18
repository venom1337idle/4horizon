// updates.js: is there a newer 4horizon? (lang-58, lang-72)
//
// Once shortly after the start, then every hour, and when the window comes back (focused again, or shown from the tray: at most once every
// 10 minutes), the app asks GitHub which release of venom1337idle/4horizon is the latest published one
// (https://api.github.com/repos/venom1337idle/4horizon/releases/latest: drafts are never answered). If its version is newer than this one, the window
// shows an "Update" button; pressing it opens that release's page in the browser, where the new installer is downloaded and run, as before.
// lang-73: on Windows the press also opens the installer's own link (the asset "4horizon-Setup-<version>.exe" of that release, only from this repository's
// releases/download/ address), so the browser starts the download at once while the page with the notes is on screen. A Mac or Linux gets the page only
// (there is no installer for them), and so does Windows when the answer has no such installer.
// Nothing is downloaded or installed by the app itself, and nothing is sent but the request (like any web request, GitHub sees the IP address).
// If GitHub cannot be reached, nothing happens: the button simply does not show.
// lang-72: when an answer comes, the window is told at once ('update:changed'), so the button shows about 20 s after the start, not up to 10 min later.

let electron = null;
try { electron = require('electron'); } catch (e) {}
const https = require('https');

const REPO = 'venom1337idle/4horizon';
const API = 'https://api.github.com/repos/' + REPO + '/releases/latest';
const PAGE = 'https://github.com/' + REPO + '/releases/';
const FIRST_MS = 20000, EVERY_MS = 3600e3, AGAIN_MS = 10 * 60e3, TIMEOUT_MS = 10000;          // (AGAIN_MS: the least time between two checks when the window comes back)

const DOWNLOAD = PAGE + 'download/';
const state = { latest: null, url: null, exe: null, checkedAt: 0, error: '', checks: 0 };
let now = () => Date.now();
let platform = () => process.platform;
let fetchLatest = () => new Promise((resolve, reject) => {           // GitHub's answer: { tag_name, html_url, draft, prerelease }
  const req = https.get(API, { headers: { 'User-Agent': '4horizon', Accept: 'application/vnd.github+json' }, timeout: TIMEOUT_MS }, res => {
    let body = ''; res.setEncoding('utf8');
    res.on('data', c => { body += c; if (body.length > 2e6) req.destroy(new Error('answer too long')); });
    res.on('end', () => { if (res.statusCode !== 200) return reject(new Error('GitHub answered ' + res.statusCode)); try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('answer not readable')); } });
  });
  req.on('timeout', () => req.destroy(new Error('no answer in ' + TIMEOUT_MS / 1000 + ' s')));
  req.on('error', reject);
});

const version = () => { try { return String(electron && electron.app && electron.app.getVersion ? electron.app.getVersion() : '') || '0.0.0'; } catch (e) { return '0.0.0'; } };
const parts = v => { const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v || '').trim()); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; };
function newer(a, b) {                                                   // is version a newer than version b?
  const x = parts(a), y = parts(b); if (!x || !y) return false;
  for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] > y[i]; }
  return false;
}
const okUrl = u => typeof u === 'string' && u.startsWith(PAGE) && !/[\s"'<>]/.test(u);
// lang-73: the installer of a release: the asset named exactly "4horizon-Setup-<version>.exe", at this repository's releases/download/ address; else null
function installerOf(r, ver) {
  const list = r && Array.isArray(r.assets) ? r.assets.slice(0, 40) : [];
  const want = '4horizon-Setup-' + ver + '.exe';
  for (const a of list) {
    if (!a || typeof a !== 'object' || a.name !== want) continue;
    const u = a.browser_download_url;
    if (typeof u === 'string' && u.startsWith(DOWNLOAD) && /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(u.slice(DOWNLOAD.length)) && u.endsWith('/' + want)) return u;          // exactly <tag>/<file>, nothing else in the path
  }
  return null;
}

let busy = false;
async function check() {
  state.checks++; busy = true;
  try {
    const r = await fetchLatest();
    if (!r || typeof r !== 'object' || r.draft || r.prerelease || !parts(r.tag_name)) throw new Error('no published release');
    state.latest = parts(r.tag_name).join('.');
    state.url = okUrl(r.html_url) ? r.html_url : PAGE + 'latest';
    state.exe = installerOf(r, state.latest);
    state.error = '';
  } catch (e) { state.error = String(e && e.message || e).slice(0, 80); }
  busy = false;
  state.checkedAt = now();
  tell();
  return info();
}

// lang-72: the window reads the answer as soon as it is there (it asks with update:get, as before)
function tell() {
  try { for (const w of electron.BrowserWindow.getAllWindows()) { if (w && !w.isDestroyed() && w.webContents && !w.webContents.isDestroyed()) w.webContents.send('update:changed'); } } catch (e) {}
}

// lang-72: the window came back: ask again, but not before the first check, not twice at once, and at most once every 10 minutes
// (GitHub answers only 60 questions an hour from one address without a login)
function checkSoon() {
  if (busy || !state.checkedAt || now() - state.checkedAt < AGAIN_MS) return false;
  check(); return true;
}

// what the window shows: this version, whether a newer one is out, and whether pressing Update also starts the installer's download (Windows, with the asset found)
const installerUse = () => (platform() === 'win32' && !!state.exe);
function info() {
  const v = version();
  return { version: v, latest: state.latest, available: !!(state.latest && newer(state.latest, v)), url: state.url, installer: installerUse(), installerFound: !!state.exe,
    checkedSec: state.checkedAt ? Math.round((now() - state.checkedAt) / 1000) : null, error: state.error || null, checks: state.checks };
}

function open() {                                                         // the page of the newer release, in the browser (only this repository's), then the installer's link on Windows
  const i = info();
  if (!i.available) return { ok: false, reason: 'no update' };
  const u = okUrl(i.url) ? i.url : PAGE + 'latest';
  try {
    electron.shell.openExternal(u);
    if (i.installer) { try { electron.shell.openExternal(state.exe); } catch (e) { return { ok: true, installer: false }; } }
    return { ok: true, installer: i.installer };
  } catch (e) { return { ok: false, reason: String(e && e.message || e).slice(0, 60) }; }
}

let timers = [];
function init() {
  if (!electron || !electron.ipcMain || !electron.ipcMain.handle) return;
  const ours = e => { try { return !!(e && e.sender && electron.BrowserWindow.fromWebContents(e.sender)); } catch (x) { return false; } };
  electron.ipcMain.handle('update:get', e => (ours(e) ? info() : null));
  electron.ipcMain.handle('update:open', e => (ours(e) ? open() : null));
  const start = () => { timers.push(setTimeout(check, FIRST_MS)); timers.push(setInterval(check, EVERY_MS)); };
  try { if (electron.app.isReady && electron.app.isReady()) start(); else electron.app.whenReady().then(start); } catch (e) {}
  try { electron.app.on('browser-window-focus', () => checkSoon()); } catch (e) {}          // lang-72: focused again, or shown from the tray
}

module.exports = { init, check, checkSoon, info, open, newer, installerOf, REPO, API, EVERY_MS, AGAIN_MS,
  _setFetch: f => { fetchLatest = f; }, _setNow: f => { now = f; }, _setPlatform: f => { platform = f || (() => process.platform); },
  _reset: () => { state.latest = null; state.url = null; state.exe = null; state.checkedAt = 0; state.error = ''; state.checks = 0; } };
