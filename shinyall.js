// shinyall.js (lang-71): the shinies of each character since its account was created: captured, and balls spent at shinies (the game's Perfil: "Shiny (capturas/gastas) 5/512").
//
// The game sends them in "profile-stats" { shinyCaught, shinyBalls, rank, trainers }, and only when YOU open Perfil in the game: the game page asks for it then.
// 4horizon never asks for it itself (it only reads what the game sends). So:
//   all time = what Perfil said the last time it was opened + what the reader counted since (the shiny throws and captures it sees, shinyballs.js).
// Opening Perfil once per character is enough; after that the numbers stay up to date. Each time Perfil is opened they are set again to the game's own numbers
// (so what was played while 4horizon was closed is corrected then). Kept per character name in shiny-alltime.json in the user-data folder. Never throws.

const fs = require('fs');
const path = require('path');

let FILE; try { FILE = require('./datadir').file('shiny-alltime.json'); } catch (e) { FILE = path.join(__dirname, 'shiny-alltime.json'); }
const SAVE_MS = 20000, MAX_CHARS = 40;
let clock = () => Date.now();
const num = v => (typeof v === 'number' && isFinite(v) && v >= 0 && v < 1e9 ? Math.floor(v) : null);
const okName = n => typeof n === 'string' && n.length > 0 && n.length <= 40;

let db = null, dirty = false, timer = null;
const byAccount = {};                    // account (1-4) -> the name of its character, for the report (which shows accounts, not names)
function load() {
  if (db) return db;
  db = { version: 1, chars: {} };
  try {
    const j = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^\uFEFF/, ''));
    if (j && typeof j.chars === 'object' && j.chars) Object.keys(j.chars).slice(0, MAX_CHARS).forEach(n => {
      const c = j.chars[n];
      if (!okName(n) || !c || num(c.caught) === null || num(c.balls) === null) return;
      db.chars[n] = { caught: num(c.caught), balls: num(c.balls), at: num(c.at) || 0, sinceCaught: num(c.sinceCaught) || 0, sinceBalls: num(c.sinceBalls) || 0 };
    });
  } catch (e) {}
  return db;
}
function save() {
  if (!dirty || !db) return;
  try { const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, FILE); dirty = false; } catch (e) {}
}
function later() { dirty = true; if (!timer) { timer = setTimeout(() => { timer = null; save(); }, SAVE_MS); if (timer.unref) timer.unref(); } }
try { process.on('exit', save); } catch (e) {}

// the game's answer to Perfil: the exact numbers of this character, and what was counted since starts again from 0
function profile(account, name, msg) {
  if (!okName(name) || !msg || typeof msg !== 'object') return false;
  const caught = num(msg.shinyCaught), balls = num(msg.shinyBalls);
  if (caught === null || balls === null) return false;
  load(); byAccount[account] = name;
  const names = Object.keys(db.chars);
  if (!db.chars[name] && names.length >= MAX_CHARS) delete db.chars[names.sort((a, b) => db.chars[a].at - db.chars[b].at)[0]];      // the oldest is forgotten
  db.chars[name] = { caught: caught, balls: balls, at: clock(), sinceCaught: 0, sinceBalls: 0 };
  later(); save();                                                       // (saved at once: it is the game's own number)
  return true;
}
// shiny throws and captures the reader saw (only for a character whose Perfil was opened once: before that there is nothing to add them to)
function add(account, name, balls, caught) {
  if (!okName(name)) return false;
  load(); byAccount[account] = name;
  const c = db.chars[name]; if (!c) return false;
  const b = num(balls) || 0, k = num(caught) || 0;
  if (!b && !k) return false;
  c.sinceBalls += b; c.sinceCaught += k; later();
  return true;
}
// what the window shows: { caught, balls, at, sinceCaught, sinceBalls } or null (Perfil never opened for this character)
function view(account, name) {
  if (!okName(name)) return null;
  load(); byAccount[account] = name;
  const c = db.chars[name]; if (!c) return null;
  return { caught: c.caught + c.sinceCaught, balls: c.balls + c.sinceBalls, at: c.at, sinceCaught: c.sinceCaught, sinceBalls: c.sinceBalls };
}
// for the report of the Diagnostics (accounts, never names)
function info() {
  load();
  const out = [];
  for (let n = 1; n <= 4; n++) {
    const name = byAccount[n]; if (!name) continue;
    const c = db.chars[name];
    out.push(c ? { n: n, known: true, ageSec: Math.max(0, Math.round((clock() - c.at) / 1000)), sinceBalls: c.sinceBalls, sinceCaught: c.sinceCaught } : { n: n, known: false });
  }
  return { accounts: out, chars: Object.keys(db.chars).length };
}

module.exports = { profile, add, view, info, save, FILE, _reset: () => { db = null; dirty = false; Object.keys(byAccount).forEach(k => delete byAccount[k]); if (timer) { clearTimeout(timer); timer = null; } }, _setClock: f => { clock = f || (() => Date.now()); } };
