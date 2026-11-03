// history.js
// Daily totals per account (gold, XP, kills, captures, shinies, time hunted), saved in history.json (lang-50: in the user-data folder, see datadir.js; an older one in the app folder is moved there once).
// It runs in the main process, so it keeps counting while the window is hidden in the tray.
//
// How it counts: the game resets its counters on every hunt change, so we add up the INCREASES between
// two messages instead of reading the totals. Only what the app actually saw is counted:
//   - a gap of more than 10 minutes between two messages (app closed, PC asleep, panel logged out) is skipped
//   - the first time an account is seen, its current session is not counted (we do not know when it started)
// In a party, the game's kill counter is shared by all members, so this account's kills are that counter / party size.

const fs = require('fs');
const path = require('path');
const { app, ipcMain, dialog, BrowserWindow } = require('electron');

let FILE; try { FILE = require('./datadir').file('history.json'); } catch (e) { FILE = path.join(__dirname, 'history.json'); }
const DAY_STARTS_AT_HOUR = 0;          // 0 = a new day starts at midnight, local time. Use 4 for "the day ends at 4 am".
const GAP_MS = 10 * 60 * 1000;
const SAVE_EVERY_MS = 30 * 1000;

const pad = n => (n < 10 ? '0' : '') + n;
function dayKey(ts) {
  const d = new Date(ts - DAY_STARTS_AT_HOUR * 3600000);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// ---------- the saved data ----------
function emptyDb() { return { version: 1, days: {}, last: {} }; }
function loadDb() {
  let raw;
  try { raw = fs.readFileSync(FILE, 'utf8').replace(/^\uFEFF/, ''); }
  catch (e) { return emptyDb(); }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.days !== 'object' || parsed.days === null) throw new Error('unexpected shape');
    if (!parsed.last || typeof parsed.last !== 'object') parsed.last = {};
    return parsed;
  } catch (e) {
    const keep = FILE + '.broken-' + Date.now();
    try { fs.renameSync(FILE, keep); } catch (x) {}
    console.log('history.json could not be read (' + e.message + '). It was kept as ' + path.basename(keep) + ' and a new one was started.');
    return emptyDb();
  }
}
let db = loadDb();
let dirty = false;

function save() {
  if (!dirty) return;
  try {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, (k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));
    fs.renameSync(tmp, FILE);
    dirty = false;
  } catch (e) {
    console.log('history: could not save (' + e.message + ')');
  }
}
const timer = setInterval(save, SAVE_EVERY_MS);
if (timer.unref) timer.unref();
app.on('before-quit', save);                      // the tray's Quit
process.on('exit', save);

// ---------- adding to a day ----------
function add(name, ts, inc) {
  const key = dayKey(ts);
  const day = db.days[key] || (db.days[key] = {});
  const row = day[name] || (day[name] = { kills: 0, xp: 0, captures: 0, shiny: 0, loot: 0, capture: 0, supplies: 0, ms: 0 });
  for (const k in inc) row[k] = (row[k] || 0) + inc[k];
  dirty = true;
}

// ---------- reading the game's messages ----------
const slots = {};                                 // per panel (1..4): which character, party size, last capture seen
const ZERO = { partyKills: 0, xp: 0, captures: 0, loot: 0, capture: 0, supplies: 0, ms: 0 };

function increase(cur, base, size, wallMs, fromZero) {
  const inc = {};
  const shared = cur.partyKills - base.partyKills;
  inc.kills = shared > 0 ? shared / size : 0;                       // this account's share of the shared counter
  ['xp', 'captures', 'loot', 'capture', 'supplies'].forEach(k => {
    const v = cur[k] - base[k];
    inc[k] = v > 0 ? v : 0;                                         // a counter that went down was reset: count nothing
  });
  let ms = cur.ms - base.ms;
  if (!(ms > 0)) ms = 0;
  if (!fromZero) ms = Math.min(ms, wallMs + 2000);                  // time hunted cannot be more than time that passed
  inc.ms = ms;
  return inc;
}

function run(account, d) {
  const s = slots[account] || (slots[account] = { name: null, size: 1, catchSeq: 0 });
  if (d.name) s.name = d.name;
  if (d.partySize !== undefined) s.size = Math.max(1, d.partySize);
  if (!s.name) return;                                              // history is kept per character name
  const now = Date.now();

  if (d.catchEvent && d.catchSeq !== undefined && d.catchSeq !== s.catchSeq) {
    s.catchSeq = d.catchSeq;
    if (d.catchEvent.shiny) add(s.name, now, { shiny: 1 });
  }

  if (d.startedAt === undefined) return;                            // only hunt-session messages carry the counters below
  const cur = {
    startedAt: d.startedAt,
    partyKills: d.partyKills !== undefined ? d.partyKills : (d.defeated || 0),
    xp: d.xpGained || 0, captures: d.captures || 0,
    loot: d.lootSell || 0, capture: d.captureSell || 0, supplies: d.suppliesCost || 0,
    ms: d.elapsedMs || 0
  };
  const size = d.partySize !== undefined ? Math.max(1, d.partySize) : s.size;
  const prev = db.last[s.name];

  let inc = null;
  if (prev && now - prev.t <= GAP_MS) {
    if (prev.startedAt === cur.startedAt) inc = increase(cur, prev, size, now - prev.t, false);
    else if (cur.ms <= GAP_MS) inc = increase(cur, ZERO, size, 0, true);   // a hunt that began while we were watching starts from zero
  }
  if (inc) add(s.name, now, inc);

  db.last[s.name] = Object.assign({ t: now }, cur);
  dirty = true;
}

function handle(account, data) {
  try { if (data) run(account, data); }
  catch (e) { console.log('history error: ' + e.message); }
}

// ---------- the dashboard asks for the data through index.html ----------
// (lang-51) only the app's own window is answered, never a game panel: the same check as every other request to the main process
const fromOurWindow = e => !!(e && e.sender && BrowserWindow.fromWebContents(e.sender));
ipcMain.handle('history:get', e => (fromOurWindow(e) ? { days: db.days, today: dayKey(Date.now()), now: Date.now() } : null));

ipcMain.handle('history:export', async (event, text, name) => {
  if (!fromOurWindow(event)) return { ok: false, error: 'not-allowed' };
  const safe = String(name || 'history.csv').replace(/[^\w.\-]/g, '_');
  const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0];
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), safe),
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(r.filePath, '\uFEFF' + String(text || ''), 'utf8');      // the BOM makes Excel read accents correctly
  return { ok: true, path: r.filePath };
});

module.exports = { handle, _db: () => db, _flush: save, _dayKey: dayKey };
