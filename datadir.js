// datadir.js: where the app keeps the user's own files (lang-50): history.json, notify-settings.json, tidy-settings.json, ws-schema.json.
//
// They live in Electron's user-data folder (on Windows %APPDATA%\<the app's name>, the folder that already holds the saved logins), NOT in the app folder:
// the app folder can then be replaced by an update, or shared (GitHub), without carrying anyone's history or settings along.
// file(name) gives the path of such a file. The first time, a file of that name that is still in the app folder (from an older version) is moved there:
// it is copied, the copy is checked, and only then is the old one removed. If a file of that name is already in the user-data folder, the old one is
// left alone (and the Diagnostics say so). If the user-data folder cannot be found (outside Electron, in the tests), the app folder is used as before.

const fs = require('fs');
const path = require('path');
let electron = null;
try { electron = require('electron'); } catch (e) {}

const APP_DIR = __dirname;
const NAMES = ['history.json', 'notify-settings.json', 'tidy-settings.json', 'ws-schema.json'];
const moves = {};                 // name -> { moved: true } | { leftOld: true } | { error: '...' }
let dirCache = null;

function dir() {
  if (dirCache) return dirCache;
  let d = null;
  try { d = electron && electron.app && electron.app.getPath ? electron.app.getPath('userData') : null; } catch (e) { d = null; }
  if (d) { try { fs.mkdirSync(d, { recursive: true }); } catch (e) { d = null; } }
  dirCache = d || APP_DIR;
  return dirCache;
}

function file(name) {
  const base = path.basename(String(name));
  const to = path.join(dir(), base);
  if (dir() === APP_DIR || moves[base]) return to;
  const from = path.join(APP_DIR, base);
  try {
    if (!fs.existsSync(from)) moves[base] = { none: true };
    else if (fs.existsSync(to)) moves[base] = { leftOld: true };                         // both: the one in the user-data folder is the one used
    else {
      fs.copyFileSync(from, to);
      if (fs.statSync(to).size !== fs.statSync(from).size) throw new Error('the copy is not complete');
      fs.unlinkSync(from);
      moves[base] = { moved: true };
      try { console.log(base + ' was moved to the user-data folder (it is no longer in the app folder).'); } catch (e) {}
    }
  } catch (e) {
    moves[base] = { error: String(e && (e.code || e.message) || e).slice(0, 60) };
    try { if (fs.existsSync(from) && !fs.existsSync(to)) return from; } catch (x) {}      // could not move it: keep using it where it is
  }
  return to;
}

// for the report of the Diagnostics: where the folder is (the user's own name is not shown), which files are in it, and what was moved
function info() {
  const d = dir(), out = { folder: '', inAppFolder: d === APP_DIR, files: [], moves: {} };
  try { const home = require('os').homedir(); out.folder = home && d.indexOf(home) === 0 ? '~' + d.slice(home.length) : d; } catch (e) { out.folder = d; }
  if (/\\|\//.test(out.folder)) out.folder = out.folder.replace(/[\\/]+Users[\\/]+[^\\/]+/i, '\\Users\\~');
  NAMES.forEach(n => {
    try { const p = path.join(d, n); if (fs.existsSync(p)) out.files.push({ name: n, kb: Math.round(fs.statSync(p).size / 102.4) / 10 }); } catch (e) {}
    if (moves[n]) out.moves[n] = Object.keys(moves[n])[0] + (moves[n].error ? ': ' + moves[n].error : '');
    try { if (d !== APP_DIR && fs.existsSync(path.join(APP_DIR, n))) out.moves[n] = (out.moves[n] ? out.moves[n] + ', ' : '') + 'an old copy is still in the app folder'; } catch (e) {}
  });
  return out;
}

module.exports = { file, dir, info, NAMES, APP_DIR, _reset: () => { dirCache = null; Object.keys(moves).forEach(k => delete moves[k]); }, _setElectron: e => { electron = e; } };
