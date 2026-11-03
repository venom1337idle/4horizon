// diag.js
// Everything the Diagnostics window needs from the main process: which files and features are installed, which game messages arrived (their
// TYPES and the NAMES of their fields, never their values), the state of the panels and settings, and the latest errors and log lines.
//
// What it never does: read or return passwords, e-mails or any saved login (only "3 saved, 2 with a password"); return gold, items or any other
// value from the game; or keep a path that contains your Windows user name (it is shown as "~"). It only reads. It never throws.

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const electron = require('electron');
const { app, ipcMain } = electron;

const BUILD = 'lang-58';          // changes with each update of the app: the Diagnostics window shows it, so what is RUNNING can be told from what is on the disk
const T0 = Date.now();
const APP_DIR = __dirname;
const MAX_ERRORS = 40, MAX_LOGS = 150, MAX_TYPES = 80, MAX_FIELDS = 120;

const errors = [];
const logs = [];
const frames = {};            // account -> { total, first, last, bytes, types: { type: { n, last } } }
const fields = {};            // message type -> Set of field names ("pokemon", "pokemon.level", "list[].id" ...)

const push = (list, max, item) => { list.push(item); if (list.length > max) list.shift(); };
const ageSec = t => (t ? Math.max(0, Math.round((Date.now() - t) / 1000)) : null);

// ---------------------------------------------------------------------------------------------------------------
//  Keeping personal things out of everything that is recorded
// ---------------------------------------------------------------------------------------------------------------
function scrub(text) {
  let s = String(text === undefined || text === null ? '' : text);
  try {
    const home = os.homedir();
    if (home && home.length > 3) s = s.split(home).join('~').split(home.replace(/\\/g, '/')).join('~');
  } catch (e) {}
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/g, '<email>');          // e-mail addresses
  s = s.replace(/\b[A-Za-z0-9_-]{32,}\b/g, '<token>');                                       // long keys / tokens
  s = s.replace(/([?&])[^\s"'&#]+=[^\s"'&#]*/g, '$1\u2026');                                  // the query part of a web address
  return s;
}
const urlShort = u => { try { const x = new URL(u); return x.origin + x.pathname; } catch (e) { return scrub(u).slice(0, 120); } };
const asText = a => (typeof a === 'string' ? a : (a && a.stack) ? a.stack : (() => { try { return JSON.stringify(a); } catch (e) { return String(a); } })());

// ---------------------------------------------------------------------------------------------------------------
//  Recording
// ---------------------------------------------------------------------------------------------------------------
function error(source, e) {
  try { push(errors, MAX_ERRORS, { t: Date.now(), src: String(source).slice(0, 40), msg: scrub(asText(e && (e.stack || e.message) ? (e.stack || e.message) : e)).split('\n').slice(0, 4).join(' | ').slice(0, 500) }); } catch (x) {}
}

// a game message arrived (its type only)
function frame(account, type, bytes) {
  try {
    const f = frames[account] || (frames[account] = { total: 0, first: Date.now(), last: 0, bytes: 0, types: {} });
    f.total++; f.last = Date.now(); f.bytes += bytes || 0;
    let k = type ? String(type) : '(not json)';
    if (!f.types[k] && Object.keys(f.types).length >= MAX_TYPES) k = '(other)';
    const t = f.types[k] || (f.types[k] = { n: 0, last: 0 });
    t.n++; t.last = f.last;
  } catch (e) {}
}

// the NAMES of the fields of a message (up to two levels deep). Values are never looked at.
function fieldsOf(account, type, msg) {
  try {
    const cap = type === 'ready' ? 500 : MAX_FIELDS;
    const set = fields[type] || (fields[type] = new Set());
    if (set.size >= cap) return;
    const walk = (o, prefix, depth) => {
      if (!o || typeof o !== 'object') return;
      const isArr = Array.isArray(o);
      const src = isArr ? (o.length && o[0] && typeof o[0] === 'object' && !Array.isArray(o[0]) ? o[0] : null) : o;
      if (!src) return;
      const keys = Object.keys(src);
      const idLike = keys.filter(k => /^\d+$/.test(k) || /^[a-z0-9]+(-[a-z0-9]+)+$/.test(k)).length;
      if (prefix && keys.length > 25 && idLike >= keys.length * 0.5) { set.add(prefix + (isArr ? '[]' : '') + '.{' + keys.length + ' keys}'); return; }     // a map of ids (items, species...): not listed one by one
      for (const k of keys.slice(0, 60)) {
        if (set.size >= cap) return;
        const kn = (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(k) || /^\d{6,}$/.test(k)) ? '{id}' : k;          // an id as a key: one name for all of them
        const p = prefix ? prefix + (isArr ? '[].' : '.') + kn : kn;
        set.add(p);
        if (depth < 2) walk(src[k], p, depth + 1);
      }
    };
    walk(msg, '', 0);
  } catch (e) {}
  try { sampleEggs(account, type, msg); } catch (e) {}
}

// ---------------------------------------------------------------------------------------------------------------
//  Eggs: what an incubating egg looks like (the KINDS of values, not the values)
// ---------------------------------------------------------------------------------------------------------------
// The first egg that is seen is described field by field: a number as "13 digits" (so a date can be told from a countdown), true / false as they are, a short
// label (an item or a species id) as it is, a longer text only by its length. Nothing else of the game is kept.
const eggShapes = {};                                     // panel -> { path, t, count, items: [ { field: description } ] }
function describeValue(v) {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return isFinite(v) ? 'number(' + (Number.isInteger(v) ? 'whole' : 'decimal') + ', ' + String(Math.abs(Math.trunc(v))).length + ' digits' + (v < 0 ? ', negative' : '') + ')' : 'number';
  if (typeof v === 'string') return /^[a-z0-9][a-z0-9_-]{0,23}$/i.test(v) ? 'text "' + v + '"' : 'text(' + Math.min(v.length, 999) + ' characters)';
  if (Array.isArray(v)) return 'list(' + v.length + ')' + (v.length && typeof v[0] !== 'object' ? ' of ' + describeValue(v[0]) : '');
  if (typeof v === 'object') return 'object{' + Object.keys(v).slice(0, 12).join(',') + '}';
  return typeof v;
}
function sampleEggs(account, type, msg) {
  if (!msg || typeof msg !== 'object') return;
  const found = [];                                       // [path, list-or-map of eggs]
  if (type === 'breeding') found.push(['eggs', msg.eggs]);
  else if (type === 'ready') Object.keys(msg).forEach(k => { if (/egg|incubat/i.test(k)) found.push([k, msg[k]]); });
  found.forEach(f => {
    const path = f[0], v = f[1];
    const list = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).map(k => v[k]) : []);
    if (!list.length) return;
    const items = list.slice(0, 3).map(e => {
      if (!e || typeof e !== 'object' || Array.isArray(e)) return { '(value)': describeValue(e) };
      const o = {}; Object.keys(e).slice(0, 40).forEach(k => { o[String(k).slice(0, 40)] = describeValue(e[k]); }); return o;
    });
    eggShapes[account] = { path: type + '.' + path, t: Date.now(), count: list.length, items: items };
  });
}

function hookConsole() {
  ['log', 'info', 'warn', 'error'].forEach(level => {
    const orig = console[level];
    if (typeof orig !== 'function' || orig.__diag) return;
    const wrapped = function () {
      try { push(logs, MAX_LOGS, { t: Date.now(), level: level, text: scrub(Array.prototype.map.call(arguments, asText).join(' ')).slice(0, 400) }); } catch (e) {}
      return orig.apply(console, arguments);
    };
    wrapped.__diag = true;
    console[level] = wrapped;
  });
}

// ---------------------------------------------------------------------------------------------------------------
//  Looking at a login page: its SHAPE only
// ---------------------------------------------------------------------------------------------------------------
// This function is sent to the game page as text and runs THERE, so it must not use anything from this file. It reads the shape of the page: the kinds
// of boxes and their names, and the words on the buttons. It never reads what is typed in a box.
function describePage() {
  var clip = function (s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n); };
  var vis = function (el) { try { return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'; } catch (e) { return false; } };
  var path = function (u) { try { var x = new URL(u, location.href); return x.origin + x.pathname; } catch (e) { return ''; } };
  var out = { url: path(location.href), title: clip(document.title, 60), ready: document.readyState, forms: 0, inputs: [], buttons: [], links: [], frames: [], shadowRoots: 0, canvas: 0, headings: [], text: '' };
  var roots = [{ root: document, where: 'page' }];
  var all = document.querySelectorAll('*');
  for (var i = 0; i < all.length && out.shadowRoots < 20; i++) { if (all[i].shadowRoot) { out.shadowRoots++; roots.push({ root: all[i].shadowRoot, where: 'shadow' }); } }
  var frames = document.querySelectorAll('iframe');
  for (var f = 0; f < frames.length && f < 10; f++) {
    var doc = null;
    try { doc = frames[f].contentDocument; } catch (e) { doc = null; }
    out.frames.push({ src: path(frames[f].src || ''), sameOrigin: !!doc, visible: vis(frames[f]) });
    if (doc) roots.push({ root: doc, where: 'frame' });
  }
  var pw = 0, tx = 0;
  roots.slice(0, 30).forEach(function (r) {
    var root = r.root;
    out.forms += root.querySelectorAll('form').length;
    Array.prototype.slice.call(root.querySelectorAll('input, textarea, select')).slice(0, 40).forEach(function (el) {
      if (out.inputs.length >= 40) return;
      var v = vis(el), type = (el.getAttribute('type') || '').toLowerCase();
      if (v && type === 'password') pw++;
      if (v && (type === '' || type === 'text' || type === 'email')) tx++;
      out.inputs.push({ tag: el.tagName.toLowerCase(), type: type, name: clip(el.getAttribute('name'), 30), id: clip(el.id, 30), placeholder: clip(el.getAttribute('placeholder'), 40),
        autocomplete: clip(el.getAttribute('autocomplete'), 20), label: clip(el.getAttribute('aria-label'), 40), visible: v, disabled: !!el.disabled, where: r.where, inForm: !!el.closest('form') });
    });
    Array.prototype.slice.call(root.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]')).slice(0, 40).forEach(function (el) {
      if (out.buttons.length >= 30) return;
      out.buttons.push({ text: clip(el.textContent || el.value, 40), type: (el.getAttribute('type') || '').toLowerCase(), visible: vis(el), disabled: !!el.disabled, where: r.where });
    });
    Array.prototype.slice.call(root.querySelectorAll('a')).filter(vis).slice(0, 15).forEach(function (el) { if (out.links.length < 15) out.links.push(clip(el.textContent, 30)); });
    Array.prototype.slice.call(root.querySelectorAll('h1, h2, h3')).filter(vis).slice(0, 8).forEach(function (el) { if (out.headings.length < 8) out.headings.push(clip(el.textContent, 50)); });
    out.canvas += root.querySelectorAll('canvas').length;
  });
  out.passwordBoxes = pw; out.textBoxes = tx;
  // A sample of the words on the page, taken text by text. Not innerText: that also carries what is inside a text area or a drop-down, which could be typed by a person.
  var text = '';
  try {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node, steps = 0;
    while ((node = walker.nextNode()) && text.length < 220 && steps++ < 3000) {
      var par = node.parentElement;
      if (!par) continue;
      var tag = par.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'INPUT') continue;
      if (par.isContentEditable || !vis(par)) continue;
      text += ' ' + node.nodeValue;
    }
  } catch (e) {}
  out.text = clip(text, 160);
  return out;
}

// What comes back from a web page is not trusted: only the expected fields are kept, as short plain text, numbers or true / false.
const str = (v, n) => scrub(String(v === undefined || v === null ? '' : v)).replace(/[\r\n]+/g, ' ').slice(0, n);
const num = v => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1e6, Math.round(v))) : 0);
const list = (v, max, f) => (Array.isArray(v) ? v.slice(0, max).map(f) : []);
function cleanPage(d) {
  if (!d || typeof d !== 'object') return null;
  return {
    url: str(d.url, 120), title: str(d.title, 60), ready: str(d.ready, 12), forms: num(d.forms), shadowRoots: num(d.shadowRoots), canvas: num(d.canvas), passwordBoxes: num(d.passwordBoxes), textBoxes: num(d.textBoxes),
    inputs: list(d.inputs, 40, x => ({ tag: str(x && x.tag, 10), type: str(x && x.type, 12), name: str(x && x.name, 30), id: str(x && x.id, 30), placeholder: str(x && x.placeholder, 40), autocomplete: str(x && x.autocomplete, 20),
      label: str(x && x.label, 40), visible: !!(x && x.visible), disabled: !!(x && x.disabled), where: str(x && x.where, 8), inForm: !!(x && x.inForm) })),
    buttons: list(d.buttons, 30, x => ({ text: str(x && x.text, 40), type: str(x && x.type, 12), visible: !!(x && x.visible), disabled: !!(x && x.disabled), where: str(x && x.where, 8) })),
    links: list(d.links, 15, x => str(x, 30)), headings: list(d.headings, 8, x => str(x, 50)),
    frames: list(d.frames, 10, x => ({ src: str(x && x.src, 120), sameOrigin: !!(x && x.sameOrigin), visible: !!(x && x.visible) })),
    text: str(d.text, 160)
  };
}

// Is the panel's connection to the game open? (the debugger tells when a WebSocket is created and when it is closed: signing out closes it at once)
const sockets = {};                                       // panel -> { open: { requestId: true }, ever: true, t: when it last changed }
function socket(account, requestId, url, event) {
  try {
    const s = sockets[account] || (sockets[account] = { open: {}, ever: false, t: 0 });
    if (event === 'created') {
      if (!/pokehorizonidle\.com/.test(String(url || ''))) return;           // only the game's own connection counts
      s.open[String(requestId)] = true; s.ever = true; s.t = Date.now();
    } else if (event === 'closed') {
      if (s.open[String(requestId)]) { delete s.open[String(requestId)]; s.t = Date.now(); }
    }
  } catch (e) {}
}
// true: open · false: it was open and is now closed (signed out or disconnected) · null: not known
const socketOpen = n => { const s = sockets[n]; return !s || !s.ever ? null : Object.keys(s.open).length > 0; };

const snapshots = {};                                     // panel -> the last three looks at its page: { t, silentSec, data, error }
// seconds since this panel last sent a game message (null: it never did since the app started)
const silentFor = n => { const f = frames[n]; return f && f.last ? Math.round((Date.now() - f.last) / 1000) : null; };
async function probe(n, wc, opts) {
  opts = opts || {};
  const silent = silentFor(n);
  const talking = silent !== null && silent < 20;
  if (!opts.force && talking) return { n: n, signedIn: true };                              // not asked to look at a panel that is still talking
  let data = null, err = null;
  try {
    if (!wc || (wc.isDestroyed && wc.isDestroyed())) throw new Error('panel not ready');
    data = await wc.executeJavaScript('(' + describePage.toString() + ')()', true);
  } catch (e) { err = e && e.message ? e.message : String(e); }
  const rec = { t: Date.now(), silentSec: silent, data: cleanPage(data), error: err };
  const l = snapshots[n] || (snapshots[n] = []);
  l.push(rec); if (l.length > 3) l.shift();
  return { n: n, signedIn: talking, error: !!err };
}

// ---------------------------------------------------------------------------------------------------------------
//  Is the app still running the files it was started with?
// ---------------------------------------------------------------------------------------------------------------
// Closing the window only hides the app in the tray, so an update copied over the old files does nothing until the app is quit from the tray and started
// again. These are the files whose version matters. Their fingerprints are taken when the app starts, and compared later.
const WATCHED = ['main.js', 'preload.js', 'ws-reader.js', 'accounts.js', 'diag.js', 'diag-core.js', 'team.js', 'tidy.js', 'notify.js', 'history.js', 'schema.js', 'live.js',
                 'index.html', 'dashboard.html', 'history-ui.js', 'analyzer.js', 'external.js', 'donate-guard.js', 'gamenav.js', 'supplies.js', 'theme.js', 'theme.css', 'hunt-data.js', 'combat.js', 'i18n.js', 'i18n-pt.js', 'settings.js', 'economy.js', 'missions.js', 'lockdown.js', 'datadir.js', 'vault.js', 'updates.js'];
const fingerprint = name => { try { const full = path.join(APP_DIR, name); if (!fs.existsSync(full)) return null; return crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex').slice(0, 16); } catch (e) { return null; } };
let startPrints = null;
function takePrints() { startPrints = {}; WATCHED.forEach(n => { startPrints[n] = fingerprint(n); }); }
// the watched files that are not what they were when the app started (a file that appeared or vanished counts too)
function staleFiles() { if (!startPrints) return []; return WATCHED.filter(n => fingerprint(n) !== startPrints[n]); }
let offering = false;
// called when the app is started a second time: if files changed since this copy started, offer to restart it so that the update is really used
function offerRestart(win) {
  try {
    const stale = staleFiles();
    if (!stale.length || offering || !electron.dialog) return false;
    offering = true;
    const T = (() => { try { return require('./i18n').t; } catch (e) { return s => s; } })();
    const opts = {
      type: 'question', buttons: [T('Restart now'), T('Not now')], defaultId: 0, cancelId: 1, title: T('4horizon was updated'),
      message: T('Some files changed after 4horizon started:') + '\n' + stale.slice(0, 8).join(', ') + (stale.length > 8 ? ', ...' : '') + '\n\n' + T('This window is still running the OLD version. Restart it now?')
    };
    const alive = win && !(win.isDestroyed && win.isDestroyed());
    Promise.resolve(alive ? electron.dialog.showMessageBox(win, opts) : electron.dialog.showMessageBox(opts)).then(r => {
      offering = false;
      if (r && r.response === 0) { try { app.relaunch(); } catch (e) { error('relaunch', e); } app.quit(); }
    }).catch(e => { offering = false; error('offerRestart', e); });
    return true;
  } catch (e) { offering = false; error('offerRestart', e); return false; }
}

// ---------------------------------------------------------------------------------------------------------------
//  Looking at the installation
// ---------------------------------------------------------------------------------------------------------------
// [file, what it is, text that must be inside it]. An empty text only asks that the file exists.
const FEATURES = [
  ['ws-reader.js', 'best catch and shinies for the whole hunt', 'shinyTotal'],
  ['ws-reader.js', 'team tracker in the reader', 'team.handle('],
  ['ws-reader.js', 'notifications in the reader', 'notifier.'],
  ['ws-reader.js', 'history in the reader', 'history.'],
  ['ws-reader.js', 'saved logins in the reader', 'savedAccounts.'],
  ['ws-reader.js', 'popup tidy in the reader', 'tidy.'],
  ['ws-reader.js', 'party and breeding messages', "'breeding'"],
  ['ws-reader.js', 'diagnostics in the reader', 'diag.frame('],
  ['ws-reader.js', 'reader listens again after a page change', 'reader attached again'],
  ['ws-reader.js', 'reader knows when the game connection closes', 'diag.socket('],
  ['ws-reader.js', 'reader passes the trainer EXP along', 'trainerXp'],
  ['ws-reader.js', 'reader counts hits and kills', 'combat.frame'],
  ['ws-reader.js', 'reader counts the balls thrown at shinies', "require('./shinyballs')"],
  ['shinyballs.js', 'balls at shinies module', ''],
  ['ws-reader.js', 'reader sends the kinds of balls and potions', "require('./supplies')"],
  ['supplies.js', 'kinds of balls and potions module', ''],
  ['preload.js', 'language bridge', 'langSet'],
  ['preload.js', 'notification settings bridge', 'notifySet'],
  ['preload.js', 'start with the PC bridge', 'startupSet'],
  ['preload.js', 'analyzer button bridge', 'analyzerToggle'],
  ['preload.js', 'Centro, Market and Mochila buttons bridge', 'navGo'],
  ['preload.js', 'Back to last hunt button bridge', 'navHunt'],
  ['preload.js', 'economy mode bridge', 'economySet'],
  ['economy.js', 'economy mode and its measurements', 'economy:set'],
  ['ws-reader.js', 'reader tells when a mission is done or an egg is ready', "require('./missions')"],
  ['missions.js', 'battle pass, daily mission and egg notifications', 'function handle'],
  ['lockdown.js', 'game panels locked down (permissions refused, panel settings forced)', 'will-attach-webview'],
  ['datadir.js', 'your own files kept in the user-data folder', 'function file'],
  ['vault.js', 'password encryption (new and old Electron)', 'decryptStringAsync'],
  ['updates.js', 'checks GitHub for a newer release (the Update button)', 'releases/latest'],
  ['preload.js', 'update button bridge', 'updateGet'],
  ['index.html', 'economy mode button', 'id="btnEco"'],
  ['gamenav.js', 'Centro, Market, Mochila, Hunts and Back to last hunt buttons', 'nav:hunt'],
  ['external.js', 'links open in the default browser', 'setWindowOpenHandler'],
  ['donate-guard.js', 'the + Doar button, the Diamantes tab and the pay button of the diamond shop are blocked', 'guardInPage'],
  ['analyzer.js', 'analyzer button (opens or closes the game\'s Hunt Analyzer)', 'analyzer:toggle'],
  ['notify.js', 'notification settings (Settings window)', "'notify:set'"],
  ['main.js', 'tray menu in the chosen language', "i18n.t('Show / Hide')"],
  ['i18n.js', 'language module', 'function dom'],
  ['i18n-pt.js', 'Portuguese texts', "I18N.add('pt-BR'"],
  ['settings.js', 'settings module (language, start with the PC)', 'startup:set'],
  ['index.html', 'settings window', 'id="btnSettings"'],
  ['combat.js', 'hit and kill counting module', 'function summary'],
  ['dashboard.html', 'trainer EXP bar', 'function trainerBar'],
  ['accounts.js', 'login says why a page has no login form', 'login-form-not-found'],
  ['accounts.js', 'login opens the login window of the start page', 'openLoginInPage'],
  ['main.js', 'one copy at a time', 'requestSingleInstanceLock'],
  ['main.js', 'window icon', 'icon.ico'],
  ['main.js', 'tray icon', 'tray.png'],
  ['main.js', 'diagnostics in the main process', "require('./diag')"],
  ['main.js', 'offers a restart when the app was updated while running', 'offerRestart'],
  ['preload.js', 'saved logins bridge', 'accountsGet'],
  ['preload.js', 'history bridge', 'getHistory'],
  ['preload.js', 'diagnostics bridge', 'diagGet'],
  ['preload.js', 'login page look (bridge)', 'diagProbe'],
  ['index.html', 'diagnostics window', 'id="diagModal"'],
  ['index.html', 'colour per account', 'HG_ACCOUNT'],
  ['dashboard.html', 'team box', 'function teamBox'],
  ['dashboard.html', 'XP bars from the game curve', 'function xpProgress'],
  ['dashboard.html', 'diagnostics answer', 'diag-request'],
  ['theme.js', 'tier colours of the game', 'HG_TIER'],
  ['diag-core.js', 'diagnostics checks', 'HGDiag'],
  ['team.js', 'team module', ''], ['notify.js', 'notification module', ''], ['history.js', 'history module', ''], ['accounts.js', 'saved logins module', ''],
  ['tidy.js', 'popup tidy module', ''], ['schema.js', 'schema logger module', ''], ['hunt-data.js', 'hunt and Pok\u00e9mon names (hunt-data.js)', ''], ['game-data.json', 'game names and prices', '']
];

const readText = (file, max) => { try { const st = fs.statSync(file); if (!st.isFile() || st.size > (max || 4e6)) return null; return fs.readFileSync(file, 'utf8'); } catch (e) { return null; } };
const readJson = file => { const t = readText(file, 8e6); if (t === null) return null; try { return JSON.parse(t.replace(/^\uFEFF/, '')); } catch (e) { return null; } };

// lang-50: only the app's own files are listed (the parts it watches, the files named in its self-check, its pictures); any other file of the folder is
// only counted, so that a report pasted somewhere does not show what else someone keeps there
const OWN_EXTRA = ['package.json', 'game-data.json', 'icon.ico', 'icon.png', 'tray.png', 'tray@2x.png', 'logo.png', 'brand.png', 'gem.png', 'install-diagnostics.js'];
function listFiles() {
  const out = [];
  let names = [];
  try { names = fs.readdirSync(APP_DIR); } catch (e) { return out; }
  const own = new Set(WATCHED.concat(OWN_EXTRA, (typeof FEATURES !== 'undefined' ? FEATURES : []).map(f => f[0])));
  let others = 0;
  names.sort().forEach(name => {
    if (!own.has(name)) { try { if (fs.statSync(path.join(APP_DIR, name)).isFile()) others++; } catch (e) {} return; }
    try {
      const full = path.join(APP_DIR, name), st = fs.statSync(full);
      if (!st.isFile()) return;
      let sha8 = null;
      if (/\.(js|mjs|html|css)$/i.test(name) && st.size <= 3e6) sha8 = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex').slice(0, 8);
      out.push({ name: name, size: st.size, ageDays: Math.round((Date.now() - st.mtimeMs) / 86400000 * 10) / 10, sha8: sha8 });
    } catch (e) {}
  });
  if (others) out.push({ others: others });
  return out;
}

function checkFeatures() {
  const cache = {};
  return FEATURES.map(f => {
    const file = f[0];
    const full = path.join(APP_DIR, file);
    const exists = fs.existsSync(full);
    let ok = exists;
    if (exists && f[2]) {
      if (cache[file] === undefined) cache[file] = readText(full, 6e6);
      ok = cache[file] !== null && cache[file].indexOf(f[2]) >= 0;
    }
    return { file: file, label: f[1], ok: ok, missingFile: !exists };
  });
}

// only true / false / numbers are taken from a settings file: never a text that somebody typed
function primitives(o, depth) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
  const out = {};
  Object.keys(o).forEach(k => {
    const v = o[k];
    if (typeof v === 'boolean' || (typeof v === 'number' && isFinite(v))) out[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v) && depth < 2) { const sub = primitives(v, depth + 1); if (Object.keys(sub).length) out[k] = sub; }      // a block with nothing but typed text is left out entirely
  });
  return out;
}

function userDataFile(name) { try { return path.join(app.getPath('userData'), name); } catch (e) { return null; } }

function settings() {
  const s = {};
  const dataFile = n => { try { return require('./datadir').file(n); } catch (e) { return path.join(APP_DIR, n); } };          // (lang-50: the user-data folder)
  s.notify = primitives(readJson(dataFile('notify-settings.json')), 0);
  try { const nf = readJson(dataFile('notify-settings.json')); if (nf && typeof nf === 'object' && !Array.isArray(nf)) s.notify.catchMode = (nf.goodCatch && String(nf.goodCatch.mode).toLowerCase() === 'and') ? 'and' : 'or'; } catch (e) {}       // only one of two fixed words, never what somebody typed
  s.tidy = primitives(readJson(dataFile('tidy-settings.json')), 0);
  // saved logins: how many, never what
  const a = readJson(userDataFile('accounts.json'));
  const rows = a && a.rows && typeof a.rows === 'object' ? a.rows : {};
  const panelsFlags = {}; [1, 2, 3, 4].forEach(n => { const r = rows[n] || rows[String(n)]; panelsFlags[n] = { user: !!(r && r.user), pass: !!(r && r.pass) }; });
  s.accounts = { panels: panelsFlags, file: !!a, saved: Object.keys(rows).filter(k => rows[k] && rows[k].user).length, withPassword: Object.keys(rows).filter(k => rows[k] && rows[k].pass).length, autoLogin: !!(a && a.autoLogin) };
  try { const v = require('./vault').info(); s.accounts.encryption = v.available; s.accounts.vault = { api: v.api, decrypted: v.decrypted, migrated: v.migrated, failed: v.failed }; } catch (e) { s.accounts.encryption = null; }          // (lang-52: no call to the old safeStorage functions)
  // history: how many days, never the numbers
  const h = readJson(dataFile('history.json'));
  s.history = { file: !!h, days: h && typeof h === 'object' ? Object.keys(h).length : 0 };
  try { const st = require('./settings').startupState(); s.startup = { supported: st.supported, enabled: st.enabled, hidden: st.hidden, hiddenReady: st.hiddenReady, packaged: st.packaged }; } catch (e) { s.startup = null; }       // start with the PC: only true / false
  const sp = readJson(userDataFile('species.json'));
  s.species = { names: sp && typeof sp === 'object' ? Object.keys(sp).length : 0 };
  return s;
}

function guestList() {
  const out = [];
  try {
    const all = electron.webContents && electron.webContents.getAllWebContents ? electron.webContents.getAllWebContents() : [];
    all.forEach(wc => {
      try {
        if (!wc.getType || wc.getType() !== 'webview') return;
        let n = null;
        for (let i = 1; i <= 4; i++) { try { if (wc.session === electron.session.fromPartition('persist:conta' + i)) n = i; } catch (e) {} }
        out.push({ n: n, wc: wc });
      } catch (e) {}
    });
  } catch (e) {}
  return out;
}
function panels() {
  return guestList().map(g => ({ n: g.n, url: urlShort(g.wc.getURL()), loading: !!g.wc.isLoading(), crashed: !!(g.wc.isCrashed && g.wc.isCrashed()) })).sort((a, b) => (a.n || 9) - (b.n || 9));
}

function meta() {
  const v = process.versions || {};
  const m = { app: null, version: null, build: BUILD, electron: v.electron || null, chrome: v.chrome || null, node: v.node || null, platform: process.platform, arch: process.arch,
              os: null, locale: null, tzOffsetMin: new Date().getTimezoneOffset(), uptimeSec: Math.round((Date.now() - T0) / 1000), rssMB: null, packaged: null };
  try { m.app = app.getName(); } catch (e) {}
  try { m.version = app.getVersion(); } catch (e) {}
  try { m.os = os.type() + ' ' + os.release(); } catch (e) {}
  try { m.locale = app.getLocale(); } catch (e) {}
  try { m.rssMB = Math.round(process.memoryUsage().rss / 1048576); } catch (e) {}
  try { m.packaged = !!app.isPackaged; } catch (e) {}
  return m;
}

function collect() {
  const out = { v: 1, meta: meta(), staleFiles: [], files: [], features: [], accounts: {}, fields: {}, panels: [], settings: {}, errors: [], logs: [] };
  try { out.files = listFiles(); } catch (e) { error('diag.files', e); }
  try { out.staleFiles = staleFiles(); } catch (e) { error('diag.stale', e); }
  try { out.features = checkFeatures(); } catch (e) { error('diag.features', e); }
  try {
    Object.keys(sockets).forEach(n => { if (!frames[n]) frames[n] = { total: 0, first: 0, last: 0, bytes: 0, types: {} }; });
    Object.keys(frames).forEach(n => {
      const f = frames[n];
      out.accounts[n] = { frames: f.total, firstAgeSec: ageSec(f.first), lastAgeSec: ageSec(f.last), kb: Math.round(f.bytes / 1024),
        socket: socketOpen(n), socketAgeSec: sockets[n] ? ageSec(sockets[n].t) : null,
        types: Object.keys(f.types).map(t => ({ type: t, n: f.types[t].n, lastAgeSec: ageSec(f.types[t].last) })).sort((a, b) => b.n - a.n) };
    });
  } catch (e) { error('diag.accounts', e); }
  try { Object.keys(fields).forEach(t => { out.fields[t] = Array.from(fields[t]).sort(); }); } catch (e) {}
  try { out.panels = panels(); } catch (e) {}
  try { out.settings = settings(); } catch (e) { error('diag.settings', e); }
  out.loginPages = [];
  Object.keys(snapshots).forEach(n => { const l = snapshots[n]; const last = l[l.length - 1]; if (last) out.loginPages.push({ n: Number(n), ageSec: ageSec(last.t), silentSec: last.silentSec, sendingData: last.silentSec !== null && last.silentSec < 20, error: last.error ? scrub(last.error).slice(0, 200) : null, page: last.data }); });
  out.eggs = Object.keys(eggShapes).map(n => ({ n: Number(n), ageSec: ageSec(eggShapes[n].t), path: eggShapes[n].path, count: eggShapes[n].count, items: eggShapes[n].items }));
  try { out.donate = require('./donate-guard').info(); } catch (e) { out.donate = undefined; }          // what the guard of the + Doar button did in each panel
  try { out.external = require('./external').info(); } catch (e) { out.external = undefined; }        // the sites of the links that were opened in the default browser
  try { out.analyzer = require('./analyzer').lastInfo(); } catch (e) { out.analyzer = undefined; }
  try { out.nav = require('./gamenav').lastInfo(); } catch (e) { out.nav = undefined; }        // the buttons Centro, Market and Mochila of the top bar
  try { out.datadir = require('./datadir').info(); } catch (e) { out.datadir = undefined; }          // where your own files are (the folder without your user name), and what was moved
  try { out.updates = require('./updates').info(); } catch (e) { out.updates = undefined; }          // this version, the latest release, when it was checked
  try { out.lockdown = require('./lockdown').info(); } catch (e) { out.lockdown = undefined; }          // what the panels asked for and were refused (permission names and counts)
  try { out.missions = require('./missions').info(); } catch (e) { out.missions = undefined; }          // battle pass, daily missions and eggs: how often the game sent them, what is watched (counts only)
  try { out.economy = require('./economy').info(); } catch (e) { out.economy = undefined; }          // economy mode: is it on, and what the samples of the last 24 hours say
  try { out.supplies = require('./supplies').info(); } catch (e) { out.supplies = undefined; }        // the items that end with "-ball" and were not counted as balls        // the button of the top bar that opens or closes the Hunt Analyzer of the game
  out.errors = errors.map(x => ({ ageSec: ageSec(x.t), src: x.src, msg: x.msg }));
  out.logs = logs.map(x => ({ ageSec: ageSec(x.t), level: x.level, text: x.text }));
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
//  Start
// ---------------------------------------------------------------------------------------------------------------
let started = false;
function init() {
  if (started) return;
  started = true;
  try { takePrints(); } catch (e) {}
  try { require('./lockdown').init(); } catch (e) { error('lockdown', e); }          // first: the game panels get no permission and no other settings than the safe ones
  try { require('./settings').init(); } catch (e) { error('settings', e); }          // the language, and the answers to the window about it
  try { require('./external').init(); } catch (e) { error('external', e); }
  try { require('./donate-guard').init(); } catch (e) { error('donate-guard', e); }      // the buttons that make a donation (+ Doar, the Diamantes tab, the pay button) cannot be pressed, and a note with a link takes the place of + Doar          // links that a game page opens in a new window go to the default browser
  try { require('./analyzer').init(); } catch (e) { error('analyzer', e); }          // the Analyzer button of the top bar
  try { require('./gamenav').init(); } catch (e) { error('gamenav', e); }            // the buttons Centro, Market and Mochila of the top bar
  try { require('./economy').init(); } catch (e) { error('economy', e); }
  try { require('./updates').init(); } catch (e) { error('updates', e); }            // lang-58: is a newer release out (the Update button of the top bar)            // economy mode (the leaf button) and its measurements, once a minute
  try { hookConsole(); } catch (e) {}
  try { process.on('unhandledRejection', r => error('unhandled-rejection', r)); } catch (e) {}
  try { process.on('uncaughtExceptionMonitor', e => error('uncaught', e)); } catch (e) {}     // only watches: the normal error window still appears
  try {
    app.on('web-contents-created', (ev, wc) => {
      try {
        wc.on('render-process-gone', (e, d) => error('render-process-gone', d && d.reason));
        wc.on('did-fail-load', (e, code, desc, url, isMain) => { if (isMain && code !== -3) error('load-failed', code + ' ' + desc + ' ' + urlShort(url)); });
      } catch (x) {}
    });
  } catch (e) {}
  const fromOurWindow = e => { try { return !!(e && e.sender && electron.BrowserWindow && electron.BrowserWindow.fromWebContents(e.sender)); } catch (x) { return false; } };
  try {
    ipcMain.handle('diag:get', e => (fromOurWindow(e) ? collect() : null));
    ipcMain.handle('diag:probe-login', async e => {
      if (!fromOurWindow(e)) return null;
      const out = [];
      for (const g of guestList()) { if (g.n) { try { out.push(await probe(g.n, g.wc, { force: true })); } catch (x) {} } }      // every panel: a panel that still sends data may be showing the login page too
      return out;
    });
    ipcMain.handle('diag:copy', (e, text) => {
      if (!fromOurWindow(e) || !electron.clipboard) return false;
      electron.clipboard.writeText(String(text === undefined ? '' : text).slice(0, 300000));
      return true;
    });
    ipcMain.handle('diag:save', async (e, text) => {
      if (!fromOurWindow(e) || !electron.dialog) return null;
      const r = await electron.dialog.showSaveDialog({ defaultPath: '4horizon-diagnostics.txt', filters: [{ name: 'Text', extensions: ['txt'] }] });
      if (!r || r.canceled || !r.filePath) return null;
      fs.writeFileSync(r.filePath, String(text === undefined ? '' : text).slice(0, 300000), 'utf8');
      return r.filePath;
    });
  } catch (e) { error('diag.ipc', e); }
}

module.exports = { init, frame, fields: fieldsOf, describeValue, error, collect, scrub, probe, lastFrameAge: silentFor, socket, socketOpen, staleFiles, offerRestart, BUILD, describePage, _state: { errors, logs, frames, fields, snapshots, eggShapes } };
