// updates.js: is there a newer 4horizon? (lang-58)
//
// Once shortly after the start, then every 6 hours, the app asks GitHub which release of venom1337idle/4horizon is the latest published one
// (https://api.github.com/repos/venom1337idle/4horizon/releases/latest: drafts are never answered). If its version is newer than this one, the window
// shows an "Update" button; pressing it opens that release's page in the browser, where the new installer is downloaded and run, as before.
// Nothing is downloaded or installed by the app itself, and nothing is sent but the request (like any web request, GitHub sees the IP address).
// If GitHub cannot be reached, nothing happens: the button simply does not show.

let electron = null;
try { electron = require('electron'); } catch (e) {}
const https = require('https');

const REPO = 'venom1337idle/4horizon';
const API = 'https://api.github.com/repos/' + REPO + '/releases/latest';
const PAGE = 'https://github.com/' + REPO + '/releases/';
const FIRST_MS = 20000, EVERY_MS = 6 * 3600e3, TIMEOUT_MS = 10000;

const state = { latest: null, url: null, checkedAt: 0, error: '', checks: 0 };
let now = () => Date.now();
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

async function check() {
  state.checks++;
  try {
    const r = await fetchLatest();
    if (!r || typeof r !== 'object' || r.draft || r.prerelease || !parts(r.tag_name)) throw new Error('no published release');
    state.latest = parts(r.tag_name).join('.');
    state.url = okUrl(r.html_url) ? r.html_url : PAGE + 'latest';
    state.error = '';
  } catch (e) { state.error = String(e && e.message || e).slice(0, 80); }
  state.checkedAt = now();
  return info();
}

// what the window shows: this version, and whether a newer one is out
function info() {
  const v = version();
  return { version: v, latest: state.latest, available: !!(state.latest && newer(state.latest, v)), url: state.url, checkedSec: state.checkedAt ? Math.round((now() - state.checkedAt) / 1000) : null, error: state.error || null, checks: state.checks };
}

function open() {                                                         // the page of the newer release, in the browser (only this repository's)
  const i = info();
  if (!i.available) return { ok: false, reason: 'no update' };
  const u = okUrl(i.url) ? i.url : PAGE + 'latest';
  try { electron.shell.openExternal(u); return { ok: true }; } catch (e) { return { ok: false, reason: String(e && e.message || e).slice(0, 60) }; }
}

let timers = [];
function init() {
  if (!electron || !electron.ipcMain || !electron.ipcMain.handle) return;
  const ours = e => { try { return !!(e && e.sender && electron.BrowserWindow.fromWebContents(e.sender)); } catch (x) { return false; } };
  electron.ipcMain.handle('update:get', e => (ours(e) ? info() : null));
  electron.ipcMain.handle('update:open', e => (ours(e) ? open() : null));
  const start = () => { timers.push(setTimeout(check, FIRST_MS)); timers.push(setInterval(check, EVERY_MS)); };
  try { if (electron.app.isReady && electron.app.isReady()) start(); else electron.app.whenReady().then(start); } catch (e) {}
}

module.exports = { init, check, info, open, newer, REPO, API,
  _setFetch: f => { fetchLatest = f; }, _setNow: f => { now = f; }, _reset: () => { state.latest = null; state.url = null; state.checkedAt = 0; state.error = ''; state.checks = 0; } };
