// accounts.js
// "Saved accounts": a name, an e-mail/username and a password for each of the 4 game panels, so that "Log in all" can sign them in.
//
// How the passwords are protected:
//   - they are encrypted with Electron's safeStorage (on Windows that is DPAPI: tied to your Windows user account)
//   - they are stored in accounts.json inside the app's own data folder (not in the project folder, so they cannot end up in a copy
//     of the project, a zip, or a git repository)
//   - they are never written in plain text, never logged, and never sent to the window that draws the buttons: that window can only
//     send a new password in, and ask "is a password saved?"
//   - if encryption is not available on this computer, passwords are NOT saved at all
// What "log in" does: it types the saved e-mail/username and password into the login form of that panel and presses the login
// button, like you would. It does nothing else in the game.

const fs = require('fs');
const path = require('path');
const { app, ipcMain, BrowserWindow, session } = require('electron');

const PANELS = [1, 2, 3, 4];
const STAGGER_MS = 1500;                     // pause between two panels when logging in all
const WATCH_EVERY_MS = 30 * 1000;            // auto re-login: how often the panels are checked
const WATCH_NEED = 2;                        // ...and how many checks in a row must show a login form (so ~1 minute)
const MAX_ATTEMPTS = 3;                      // ...at most this many automatic logins per panel
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;    // ...within this time
const RETRY_MS = 2000;                       // a signed-out panel with no password box may still be drawing its login screen (right after signing out): look again this much later...
const RETRIES = 4;                           // ...up to this many times (so up to about 8 seconds)
const SILENT_AFTER_SEC = 30;                 // a panel that sent no game message for this long is signed out (or not loaded); one that is still talking is signed in

// the Diagnostics module knows when each panel last sent a game message (optional: without it, nothing below changes)
let diag = null;
try { diag = require('./diag'); } catch (e) { diag = null; }
// signed out = the connection to the game was closed (signing out closes it at once), or nothing has come through for a while
const isSilent = n => {
  try {
    if (!diag) return false;
    if (diag.socketOpen && diag.socketOpen(n) === false) return true;
    if (!diag.lastFrameAge) return false;
    const a = diag.lastFrameAge(n);
    return a === null || a >= SILENT_AFTER_SEC;
  } catch (e) { return false; }
};

// ---------------------------------------------------------------------------------------------------------------
// These two functions are sent to the game page as text and run THERE. They are plain functions so they can be tested on their own.
// ---------------------------------------------------------------------------------------------------------------
function loginInPage(user, pass) {
  // visible = it takes up space and is not hidden. (offsetParent is not used: it is null for pop-up dialogs, which are common for logins)
  const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const all = (root, sel) => Array.prototype.slice.call(root.querySelectorAll(sel));
  const textTypes = ['text', 'email', ''];
  const textInputs = root => all(root, 'input').filter(i => visible(i) && !i.disabled && !i.readOnly && textTypes.indexOf((i.getAttribute('type') || '').toLowerCase()) >= 0);
  const passwordsIn = root => all(root, 'input[type="password"]').filter(visible);
  // the part of the page that belongs to one password box: its form, or else the smallest block around it that also holds a text box
  const scopeOf = pw => {
    const form = pw.closest('form');
    if (form) return form;
    let el = pw.parentElement;
    while (el && el !== document.documentElement) { if (textInputs(el).length) return el; el = el.parentElement; }
    return document;
  };

  const pws = passwordsIn(document);
  if (!pws.length) return { ok: false, reason: 'no-login-form' };
  // a login form has ONE password box; two in the same form is a sign-up form (password + confirmation): never touch it
  const pw = pws.filter(el => passwordsIn(scopeOf(el)).length === 1)[0];
  if (!pw) return { ok: false, reason: 'looks-like-register' };
  const scope = scopeOf(pw);
  const fields = textInputs(scope);
  let userField = null;
  fields.forEach(f => { if (f.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING) userField = f; });   // the last one before the password
  if (!userField) userField = fields[0];
  if (!userField) return { ok: false, reason: 'no-username-field' };

  // works with plain inputs and with inputs controlled by a framework
  const setValue = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  // The game checks that you are not a robot with a Cloudflare box that passes by itself in a second or two. While it is still thinking, nothing is typed
  // and nothing is pressed: the caller asks again a moment later. The box itself is never touched.
  const checks = all(document, '.cf-turnstile, [data-sitekey], iframe[src*="challenges.cloudflare.com"]').filter(visible);
  if (checks.length) {
    const answers = all(document, 'input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]');
    if (answers.length && !answers.some(a => String(a.value || '').length > 0)) return { ok: false, reason: 'captcha-pending' };
  }

  setValue(userField, user);
  setValue(pw, pass);

  const avoid = /cadastr|registr|criar|sign\s*up|register|create|esqueci|forgot|recover|cancel|google|discord|facebook|apple|twitch|instagram/i;
  const want = /entrar|login|log\s*in|sign\s*in|acessar|continuar|continue|jogar|play/i;
  const form = pw.closest('form');
  const buttons = all(form || scope, 'button, input[type="submit"], [role="button"]').filter(b => visible(b) && !b.disabled);
  const label = b => (b.textContent || b.value || '').trim();
  const pick = buttons.filter(b => !avoid.test(label(b))).filter(b => (b.getAttribute('type') || '').toLowerCase() === 'submit' || want.test(label(b)))[0] ||
               buttons.filter(b => want.test(label(b)))[0];
  if (pick) { pick.click(); return { ok: true, how: 'button' }; }
  if (buttons.length) return { ok: false, reason: 'no-login-button' };      // there are buttons, but none looks like "log in": do not guess
  if (form && form.requestSubmit) { form.requestSubmit(); return { ok: true, how: 'form' }; }
  pw.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  return { ok: true, how: 'enter' };
}

// A panel that is signed out shows the game's START PAGE, not a login form: the form is in a window that opens when "Entrar" is pressed.
// This presses that one button, and nothing else: only a button or link whose WHOLE text is "Entrar" / "Login" / "Sign in" / "J\u00e1 tenho conta".
// It does nothing if a login box is already open (its own "Entrar" button must not be pressed here), and never touches Criar conta, Jogar agora,
// Google, Discord or Instagram. With dry = true it only says whether there is such a button.
function openLoginInPage(dry) {
  const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const formOpen = Array.prototype.slice.call(document.querySelectorAll('input[type="password"], input[type="email"]')).some(visible);
  if (formOpen) return { clicked: false, found: false, reason: 'form-already-open' };
  const wanted = ['entrar', 'login', 'log in', 'sign in', 'ja tenho conta', 'i already have an account'];
  const avoid = /google|discord|facebook|apple|twitch|instagram|criar|cadastr|registr|sign up|register|create|jogar|play/;
  const found = Array.prototype.slice.call(document.querySelectorAll('a, button, [role="button"]'))
    .filter(el => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true')
    .map(el => ({ el: el, t: norm(el.textContent || el.value || el.getAttribute('aria-label')) }))
    .filter(c => wanted.indexOf(c.t) >= 0 && !avoid.test(c.t));
  if (!found.length) return { clicked: false, found: false, reason: 'no-opener' };
  // the one in the top bar first, then the others; "Entrar" before "J\u00e1 tenho conta"
  const rank = c => wanted.indexOf(c.t) + (c.el.closest('nav, header') ? 0 : 10);
  found.sort((a, b) => rank(a) - rank(b));
  if (dry) return { clicked: false, found: true, text: found[0].t };
  found[0].el.click();
  return { clicked: true, found: true, text: found[0].t };
}

function loginFormShown() {
  return Array.prototype.slice.call(document.querySelectorAll('input[type="password"]'))
    .some(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
}

// ---------------------------------------------------------------------------------------------------------------
// the saved data
// ---------------------------------------------------------------------------------------------------------------
function file() { return path.join(app.getPath('userData'), 'accounts.json'); }
function emptyData() { return { version: 1, autoLogin: false, rows: {} }; }
function load() {
  try {
    const d = JSON.parse(fs.readFileSync(file(), 'utf8'));
    if (d && typeof d.rows === 'object' && d.rows) return Object.assign(emptyData(), d);
  } catch (e) { /* no file yet, or unreadable: start empty */ }
  return emptyData();
}
function save(data) {
  const tmp = file() + '.tmp';
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file());
}
// lang-52: the encryption is in vault.js (the async functions of newer Electron, the old ones otherwise; a password saved the old way is saved again the new way the first time it is used)
const vault = require('./vault');

// ---------------------------------------------------------------------------------------------------------------
// the 4 panels
// ---------------------------------------------------------------------------------------------------------------
const guests = {};                                   // panel number -> its webContents
function registerGuest(n, wc) {
  guests[n] = wc;
  try { wc.once('destroyed', () => { if (guests[n] === wc) delete guests[n]; }); } catch (e) {}
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let staggerMs = STAGGER_MS;
let retryMs = RETRY_MS;
const waits = { open: 3000, captcha: 12000, step: 400 };     // the login window needs a moment to open (waited for at most this long); the Cloudflare check needs a second or two (at most this long)
// asks the page again and again (a yes / no function) until it says yes, or the time is up
async function waitFor(g, fn, maxMs, stepMs) {
  const t0 = Date.now();
  for (;;) {
    let v = false;
    try { v = await evalIn(g, fn); } catch (e) { v = false; }
    if (v) return true;
    if (Date.now() - t0 >= maxMs) return false;
    await sleep(stepMs);
  }
}
const evalIn = (g, fn, arg) => g.executeJavaScript('(' + fn.toString() + ')(' + (arg === undefined ? '' : JSON.stringify(arg)) + ')', true);

async function loginOne(n) {
  const g = guests[n];
  if (!g || (g.isDestroyed && g.isDestroyed())) return { n: n, ok: false, reason: 'panel-not-ready' };
  const row = load().rows[n];
  if (!row || !row.user || !row.pass) return { n: n, ok: false, reason: 'no-saved-login' };
  const d = await vault.decrypt(row.pass), pass = d ? d.text : null;
  if (pass === null) return { n: n, ok: false, reason: 'cannot-decrypt' };
  if (d.migrate) {                                                                     // saved the old way: saved again the new way (only if it was not changed meanwhile)
    try { const data = load(); if (data.rows[n] && data.rows[n].pass === row.pass) { data.rows[n].pass = await vault.encrypt(pass); save(data); vault.migrated(); } } catch (e) {}
  }
  const run = () => g.executeJavaScript('(' + loginInPage.toString() + ')(' + JSON.stringify(row.user) + ',' + JSON.stringify(pass) + ')', true);
  // the login script says "captcha-pending" while the Cloudflare check is still thinking (it has typed nothing): ask again, for a while, then say so
  const runWaiting = async () => {
    let r = await run();
    const t0 = Date.now();
    while (r && r.reason === 'captcha-pending' && Date.now() - t0 < waits.captcha) { await sleep(waits.step); r = await run(); }
    if (r && r.reason === 'captcha-pending') r = { ok: false, reason: 'captcha-not-solved' };
    return r;
  };
  try {
    const silent = isSilent(n);                   // signed out: the connection to the game is closed, or nothing has come through for a while
    let r = await runWaiting();
    let opened = false;
    // No password box on a SIGNED-OUT panel: it shows the start page. Press "Entrar" to open the login window, wait for it, and try again. (A panel that is
    // still sending game data is signed in, and nothing is ever pressed on it.)
    if (r && r.reason === 'no-login-form' && silent) {
      for (let i = 0; i < RETRIES && r && r.reason === 'no-login-form'; i++) {
        let o = null;
        try { o = await evalIn(g, openLoginInPage); } catch (e) {}
        if (o && o.clicked) { opened = true; await waitFor(g, loginFormShown, waits.open, 200); }        // pressed once: wait for the window to appear, do not press again
        else await sleep(retryMs);
        r = await runWaiting();
      }
    }
    if (r && r.reason === 'no-login-form' && silent) {
      // Still nothing. This is NOT "already signed in": the panel says nothing, so it is signed out and its login box is somewhere this code cannot find.
      r = { ok: false, reason: 'login-form-not-found' };
    }
    if (r && r.ok && opened) r.opened = true;
    if (r && (r.reason === 'no-login-form' || r.reason === 'login-form-not-found')) {
      // The login did not happen, whatever the reason. Keep a description of the page (its shape, never what is typed) for the Diagnostics window, and say how
      // long ago this panel last sent a game message: that is the evidence behind "already signed in", so that the answer can be checked.
      try { if (diag && diag.probe) await diag.probe(n, g, { force: true }); } catch (e) {}
      try { if (diag && diag.lastFrameAge) r.lastMsgSec = diag.lastFrameAge(n); } catch (e) {}
    }
    return Object.assign({ n: n }, r || { ok: false, reason: 'no-answer' });
  } catch (e) {
    return { n: n, ok: false, reason: 'script-error' };
  }
}

async function loginMany(which) {
  const list = which === 'all' ? PANELS.slice() : [Number(which)];
  const results = [];
  let attempted = 0;
  for (const n of list) {
    if (attempted > 0 && staggerMs > 0) await sleep(staggerMs);          // do not hit the site with 4 logins at the same instant
    const r = await loginOne(n);
    if (r.reason !== 'no-saved-login' && r.reason !== 'panel-not-ready') attempted++;
    results.push(r);
  }
  return results;
}

// ---------------------------------------------------------------------------------------------------------------
// optional: log in again by itself when the session drops (off unless switched on in the Accounts window)
// ---------------------------------------------------------------------------------------------------------------
const watch = {};                                    // panel -> { seen, attempts: [timestamps], gaveUp }
async function watchOnce() {
  const data = load();
  if (!data.autoLogin) return;
  for (const n of PANELS) {
    const g = guests[n], row = data.rows[n];
    if (!g || !row || !row.user || !row.pass || (g.isDestroyed && g.isDestroyed())) continue;
    const w = watch[n] || (watch[n] = { seen: 0, attempts: [], gaveUp: false });
    let shown = false;
    try { shown = !!(await g.executeJavaScript('(' + loginFormShown.toString() + ')()', true)); } catch (e) { continue; }
    // a signed-out panel shows the start page with its "Entrar" button instead of a form: that counts as needing a login too (only for a panel that is silent)
    if (!shown && isSilent(n)) { try { const o = await evalIn(g, openLoginInPage, true); shown = !!(o && o.found); } catch (e) {} }
    if (!shown) { w.seen = 0; w.gaveUp = false; continue; }
    w.seen++;
    if (w.seen < WATCH_NEED) continue;
    const now = Date.now();
    w.attempts = w.attempts.filter(t => now - t < ATTEMPT_WINDOW_MS);
    if (w.attempts.length >= MAX_ATTEMPTS) {
      if (!w.gaveUp) { w.gaveUp = true; console.log('accounts: panel ' + n + ' keeps showing the login form after ' + MAX_ATTEMPTS + ' automatic logins. Not trying again for a while. Check the saved login.'); }
      continue;
    }
    w.attempts.push(now);
    w.seen = 0;
    const r = await loginOne(n);
    console.log('accounts: automatic login for panel ' + n + ': ' + (r.ok ? 'sent' : r.reason));
  }
}
let watcher = null;
function startWatcher() {
  if (watcher) return;
  watcher = setInterval(() => { watchOnce().catch(() => {}); }, WATCH_EVERY_MS);
  if (watcher.unref) watcher.unref();
}

// ---------------------------------------------------------------------------------------------------------------
// what the window with the buttons may ask for (nothing here ever returns a password)
// ---------------------------------------------------------------------------------------------------------------
const fromOurWindow = e => !!(e && e.sender && BrowserWindow.fromWebContents(e.sender));
const clean = (s, max) => String(s == null ? '' : s).slice(0, max);

async function describe() {
  const data = load();
  return {
    encryption: await vault.available(),
    autoLogin: !!data.autoLogin,
    rows: PANELS.map(n => {
      const r = data.rows[n] || {};
      return { n: n, name: r.name || '', user: r.user || '', hasPassword: !!r.pass };
    }),
    ready: PANELS.filter(n => !!guests[n])
  };
}

ipcMain.handle('accounts:get', async e => (fromOurWindow(e) ? describe() : null));

ipcMain.handle('accounts:save', async (e, payload) => {
  if (!fromOurWindow(e)) return { ok: false, error: 'not-allowed' };
  const data = load();
  const rows = (payload && Array.isArray(payload.rows)) ? payload.rows : [];
  let blocked = false;
  for (const r of rows) {
    const n = Number(r && r.n);
    if (PANELS.indexOf(n) < 0) continue;
    const old = data.rows[n] || {};
    const next = { name: clean(r.name, 40), user: clean(r.user, 200), pass: old.pass || '' };
    if (r.clearAll) { delete data.rows[n]; continue; }
    if (typeof r.password === 'string' && r.password.length) {
      if (!(await vault.available())) { blocked = true; }         // never store a password without encryption
      else { try { next.pass = await vault.encrypt(r.password.slice(0, 500)); } catch (err) { blocked = true; } }
    }
    if (r.clearPassword) next.pass = '';
    if (next.name || next.user || next.pass) data.rows[n] = next; else delete data.rows[n];
  }
  data.autoLogin = !!(payload && payload.autoLogin);
  try { save(data); } catch (err) { return { ok: false, error: 'could-not-save' }; }
  if (data.autoLogin) startWatcher();
  return blocked ? { ok: true, warning: 'no-encryption' } : { ok: true };
});

ipcMain.handle('accounts:clear-cache', async (e, n) => {
  if (!fromOurWindow(e)) return { ok: false };
  n = Number(n);
  if (PANELS.indexOf(n) < 0) return { ok: false };
  try { await session.fromPartition('persist:conta' + n).clearCache(); return { ok: true }; } catch (err) { return { ok: false }; }
});

ipcMain.handle('accounts:login', async (e, which) => {
  if (!fromOurWindow(e)) return { results: [] };
  return { results: await loginMany(which === 'all' ? 'all' : Number(which)) };
});

try { app.whenReady().then(() => { vault.available().catch(() => {}); if (load().autoLogin) startWatcher(); }); } catch (e) {}          // (the encryption is checked once at the start: the Diagnostics know it from then on)

module.exports = {
  registerGuest, loginInPage, openLoginInPage, loginFormShown, loginMany, loginOne, watchOnce,
  _setStagger: ms => { staggerMs = ms; }, _setRetry: ms => { retryMs = ms; }, _setWaits: w => { Object.assign(waits, w); }, _watch: watch, _guests: guests, _describe: describe
};
