// external.js: a link that a game page opens in a NEW window opens in the default browser of the computer.
//
// The game opens a new window for the Wiki, for the streams of Twitch and Kick, and for the vote buttons (a link with target="_blank", or window.open). A game panel cannot show a
// new window, and nothing in the app said what to do with the request, so it was dropped and nothing happened. Now every such request is given to the browser of the computer,
// and the panel itself stays where it was (the game is never replaced by the page of a link).
//   - Only web addresses (http and https) are opened. Anything else (javascript:, file:, data:, another program's address) is refused.
//   - A page that asks for many windows at once (a loop, an ad) gets only a few: 3 in 5 seconds.
//   - Which sites were opened is kept for the report of the Diagnostics: the SITE only (never the rest of the address: the vote links carry the name of the trainer).
// The app does not click anything in the game for this: it only answers the request the game makes.

let electron = null;
try { electron = require('electron'); } catch (e) {}

const MAX_URL = 2048;
const MAX_OPENS = 3, WINDOW_MS = 5000;
const MAX_EVENTS = 20;
const hooked = new WeakSet();
const events = [];                       // what happened, oldest first: { at, host, how, ok, n }
const recent = [];                       // the times of the latest windows that were opened
let started = false;
let clock = () => Date.now();

function panelOf(wc) {                    // which game panel (1 to 4) asked, when it is one
  try {
    const g = require('./accounts')._guests || {};
    for (const k of Object.keys(g)) { if (g[k] === wc) return Number(k); }
  } catch (e) {}
  return 0;
}
function note(host, how, ok, wc) {
  const e = { at: clock(), host: String(host || '').slice(0, 60), how: how, ok: !!ok, n: panelOf(wc) };
  events.push(e);
  while (events.length > MAX_EVENTS) events.shift();
  return e;
}
// the address as a web address, or null
function parse(url) {
  try {
    const s = String(url == null ? '' : url);
    if (s.length > MAX_URL) return null;
    const u = new URL(s);
    return ((u.protocol === 'https:' || u.protocol === 'http:') && u.hostname) ? u : null;
  } catch (e) { return null; }
}
const schemeOf = url => { const m = /^\s*([a-z][a-z0-9+.-]*):/i.exec(String(url == null ? '' : url)); return m ? m[1].toLowerCase() + ':' : '?'; };

// the game asks for a new window with this address: it goes to the browser of the computer
function open(url, wc) {
  const u = parse(url);
  if (!u) { note(schemeOf(url), 'refused', false, wc); return false; }
  const t = clock();
  while (recent.length && t - recent[0] > WINDOW_MS) recent.shift();
  if (recent.length >= MAX_OPENS) { note(u.hostname, 'too many at once', false, wc); return false; }
  recent.push(t);
  const e = note(u.hostname, 'opened', true, wc);
  try {
    const p = electron && electron.shell && electron.shell.openExternal(u.href);
    if (p && typeof p.catch === 'function') p.catch(() => { e.ok = false; e.how = 'the browser could not be started'; });
  } catch (x) { e.ok = false; e.how = 'the browser could not be started'; }
  return true;
}

function hook(wc) {
  if (!wc || hooked.has(wc)) return;
  hooked.add(wc);
  try { if (typeof wc.setWindowOpenHandler === 'function') wc.setWindowOpenHandler(d => { open(d && d.url, wc); return { action: 'deny' }; }); } catch (e) {}
  // only WATCHES: when a page itself goes to another site (not a new window), the site is noted for the report; nothing is stopped
  try {
    wc.on('will-navigate', (a, b) => {
      try {
        const url = typeof b === 'string' ? b : (typeof a === 'string' ? a : (a && a.url));
        const u = parse(url), cur = parse(typeof wc.getURL === 'function' ? wc.getURL() : '');
        if (u && cur && u.hostname !== cur.hostname) note(u.hostname, 'the page itself went there', true, wc);
      } catch (x) {}
    });
  } catch (e) {}
}

function init() {
  if (started || !electron) return;
  started = true;
  try { if (electron.app && electron.app.on) electron.app.on('web-contents-created', (ev, wc) => hook(wc)); } catch (e) {}
  try { if (electron.webContents && electron.webContents.getAllWebContents) electron.webContents.getAllWebContents().forEach(hook); } catch (e) {}
}

// for the report of the Diagnostics: the latest events, newest last (the site only)
function info() {
  const t = clock();
  return { events: events.map(e => ({ ageSec: Math.max(0, Math.round((t - e.at) / 1000)), host: e.host, how: e.how, ok: e.ok, n: e.n })) };
}

module.exports = { init, info, open, hook, _reset: () => { events.length = 0; recent.length = 0; started = false; }, _setClock: f => { clock = f || (() => Date.now()); }, MAX_OPENS, WINDOW_MS };
