// notify.js
// Desktop notifications for 4horizon. It runs in the main process, so it works while the window is hidden in the tray.
// It only looks at the numbers ws-reader.js already reads from the game (it sends nothing anywhere).
//
// Settings live in notify-settings.json (created on first run, next to this file).
// Changes to that file are picked up within a few seconds, no restart needed.

const fs = require('fs');
const path = require('path');
const { app, Notification, BrowserWindow, shell } = require('electron');

const SETTINGS_FILE = path.join(__dirname, 'notify-settings.json');

const DEFAULTS = {
  enabled: true,
  startupNotice: true,
  events: {
    shiny: true,          // a shiny was captured
    goodCatch: true,      // a capture with a high IV or a high quality
    rareDrop: true,       // an item worth a lot dropped
    suppliesLow: true,    // balls or potions will run out soon
    stopped: true,        // an account stopped hunting, got no kills, or went silent
    huntUnlocked: true    // the trainer level opened a new hunt
  },
  goodCatch: { minIV: 175, minQuality: 1.7 },        // IV out of 192, quality multiplier (1.7 = Lendaria and above)
  rareDrop: { minValue: 10000 },                     // NPC price of ONE item
  suppliesLow: { minRunwayHours: 1, minSampleMinutes: 10 },
  stopped: { noKillsSeconds: 180, silentSeconds: 120 },
  cooldownSeconds: 60,                               // the same kind of alert for the same account at most this often
  accountNames: {}                                   // optional, for example { "1": "Main", "2": "Alt" }
};

function merge(base, extra) {
  const out = Object.assign({}, base);
  for (const k in (extra || {})) {
    const v = extra[k];
    out[k] = (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') ? merge(base[k], v) : v;
  }
  return out;
}

// ---------- settings, re-read when the file changes ----------
let settings = DEFAULTS, loadedAt = 0, mtime = 0, warnedBadFile = false;
function cfg() {
  const now = Date.now();
  if (now - loadedAt < 5000) return settings;
  loadedAt = now;
  try {
    const st = fs.statSync(SETTINGS_FILE);
    if (st.mtimeMs !== mtime) {
      mtime = st.mtimeMs;
      const user = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8').replace(/^\uFEFF/, ''));
      settings = merge(DEFAULTS, user);
      warnedBadFile = false;
    }
  } catch (e) {
    if (e.code === 'ENOENT') {
      try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULTS, null, 2)); } catch (x) {}
      settings = DEFAULTS;
    } else if (!warnedBadFile) {
      warnedBadFile = true;
      console.log('notify-settings.json is not valid (' + e.message + '). Keeping the last good settings.');
    }
  }
  return settings;
}

function writeSetting(mutator) {
  let user = {};
  try { user = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { user = JSON.parse(JSON.stringify(DEFAULTS)); }
  mutator(user);
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(user, null, 2));
  loadedAt = 0;
  cfg();
}

// ---------- hunts that each trainer level opens (from hunt-data.js, built by build-hunts.mjs) ----------
let hunts = null;
function huntList() {
  if (hunts) return hunts;
  hunts = [];
  try {
    const t = fs.readFileSync(path.join(__dirname, 'hunt-data.js'), 'utf8').replace(/^\s*window\.HUNT_DATA\s*=\s*/, '').replace(/;\s*$/, '');
    hunts = JSON.parse(t).hunts.map(h => ({ name: h.name, unlock: h.unlock }));
  } catch (e) {
    console.log('notify: hunt-data.js could not be read (' + e.message + '). "New hunt unlocked" alerts are off.');
  }
  return hunts;
}

// ---------- showing a notification ----------
const open = new Set();         // keeps a reference until it closes, otherwise a click can be lost
const lastSent = {};
const num = n => Math.round(n).toLocaleString('en-US');

function show(account, kind, title, body, opts) {
  opts = opts || {};
  const c = cfg();
  if (!opts.force) {
    if (!c.enabled) return false;
    if (!opts.always && !c.events[kind]) return false;
  }
  const key = account + ':' + (opts.key || kind);
  const now = Date.now();
  if (!opts.noCooldown && lastSent[key] && now - lastSent[key] < c.cooldownSeconds * 1000) return false;
  lastSent[key] = now;
  console.log('notification [' + kind + '] ' + title + ' | ' + body);
  try {
    if (!Notification.isSupported()) return false;
    const n = new Notification({ title: title, body: body });
    open.add(n);
    n.on('close', () => open.delete(n));
    n.on('click', () => {
      const w = BrowserWindow.getAllWindows()[0];
      if (w) { w.show(); w.focus(); }
    });
    n.show();
  } catch (e) {
    console.log('notify: could not show a notification (' + e.message + ')');
    return false;
  }
  return true;
}

// ---------- what we remember about each account ----------
const st = {};
function S(account) {
  return st[account] || (st[account] = {
    name: null, level: null, startedAt: null, qty: {}, dropsReady: false,
    kills: null, killsAt: 0, active: null, lastMsg: 0, silentSent: false, noKillSent: false,
    lowSent: {}, catchSeq: 0, elapsedMs: 0, pendingStop: 0
  });
}
const labelOf = (account, s) => (cfg().accountNames[account] || s.name || ('Account ' + account));
const span = secs => secs >= 90 ? Math.round(secs / 60) + ' min' : Math.round(secs) + ' s';

function checkSupplies(account, s, who, c) {
  const hours = (s.elapsedMs || 0) / 3600000;
  const enough = hours * 60 >= c.suppliesLow.minSampleMinutes;
  const things = [
    { key: 'balls', label: 'balls', stock: s.autoBalls !== undefined ? s.autoBalls : s.balls, used: s.ballsUsed },
    { key: 'potions', label: 'potions', stock: s.potions, used: s.healsUsed }
  ];
  for (const it of things) {
    if (it.stock === undefined || it.stock === null) continue;
    const rate = (enough && it.used > 0) ? it.used / hours : null;       // used per hour, this session
    const runway = rate ? it.stock / rate : null;                          // hours left at that pace
    const out = it.stock <= 0 && it.used > 0;
    const low = out || (runway !== null && runway < c.suppliesLow.minRunwayHours);
    if (!low) {
      if (it.stock > 0 && (runway === null || runway > c.suppliesLow.minRunwayHours * 1.5)) s.lowSent[it.key] = false;   // re-arm
      continue;
    }
    if (s.lowSent[it.key]) continue;
    s.lowSent[it.key] = true;
    const left = out ? 'none left' : num(it.stock) + ' left, about ' + (runway < 1 ? Math.max(1, Math.round(runway * 60)) + ' min' : runway.toFixed(1) + ' h') + ' at the current pace';
    show(account, 'suppliesLow', 'Running low on ' + it.label, who + ': ' + left, { noCooldown: true, key: 'low-' + it.key });
  }
}

function handleOne(account, d) {
  const c = cfg();
  const s = S(account);
  const now = Date.now();
  if (d.name) s.name = d.name;
  const who = labelOf(account, s);

  // a new trainer level may open hunts
  if (typeof d.level === 'number') {
    if (s.level !== null && d.level > s.level) {
      const opened = huntList().filter(h => h.unlock > s.level && h.unlock <= d.level).map(h => h.name);
      if (opened.length) {
        show(account, 'huntUnlocked', who + ' reached level ' + d.level,
          'New hunt' + (opened.length > 1 ? 's' : '') + ': ' + opened.slice(0, 4).join(', ') + (opened.length > 4 ? ' and ' + (opened.length - 4) + ' more' : ''),
          { noCooldown: true, key: 'level' });
      }
    }
    s.level = d.level;
  }

  // a capture
  if (d.catchEvent && d.catchSeq !== undefined && d.catchSeq !== s.catchSeq) {
    s.catchSeq = d.catchSeq;
    const e = d.catchEvent;
    const line = e.name + ' \u00b7 IV ' + e.iv + '/' + (e.max || 192) + ' \u00b7 ' + e.rarity;
    if (e.shiny) show(account, 'shiny', 'Shiny captured!', who + ': ' + line, { noCooldown: true, key: 'shiny' });
    else if (e.iv >= c.goodCatch.minIV || e.quality >= c.goodCatch.minQuality) show(account, 'goodCatch', 'Great catch', who + ': ' + line, { noCooldown: true, key: 'catch' });
  }

  // the hunt session (arrives every couple of seconds while hunting)
  if (d.startedAt !== undefined) {
    if (s.startedAt !== null && d.startedAt !== s.startedAt) {       // a new hunt: forget the old one
      s.qty = {}; s.dropsReady = false; s.kills = null; s.noKillSent = false; s.active = null; s.lowSent = {}; s.pendingStop = 0;
    }
    s.startedAt = d.startedAt;
    s.lastMsg = now;
    s.silentSent = false;

    if (Array.isArray(d.drops)) {
      for (const it of d.drops) {
        const prev = s.qty[it.name] || 0;
        const unit = (typeof it.value === 'number' && it.qty > 0) ? it.value / it.qty : null;
        if (s.dropsReady && it.qty > prev && unit !== null && unit >= c.rareDrop.minValue) {
          show(account, 'rareDrop', 'Rare drop: ' + it.name, who + ' got ' + (it.qty - prev) + ' \u00d7 ' + it.name + ' (worth $' + num(unit) + ' each)', { noCooldown: true, key: 'drop' });
        }
        s.qty[it.name] = it.qty;
      }
      s.dropsReady = true;
    }

    const kills = d.partyKills !== undefined ? d.partyKills : d.defeated;
    if (s.killsAt === 0) s.killsAt = now;
    if (kills !== undefined && kills !== s.kills) { s.kills = kills; s.killsAt = now; s.noKillSent = false; }

    if (d.active === false && s.active === true) s.pendingStop = now;      // confirmed in watch(), after a short wait
    if (typeof d.active === 'boolean') s.active = d.active;
    if (d.active === true) s.pendingStop = 0;
    if (d.elapsedMs !== undefined) s.elapsedMs = d.elapsedMs;
    if (d.ballsUsed !== undefined) s.ballsUsed = d.ballsUsed;
    if (d.healsUsed !== undefined) s.healsUsed = d.healsUsed;
  }

  // supplies in stock
  if (d.autoBalls !== undefined) s.autoBalls = d.autoBalls;
  if (d.balls !== undefined) s.balls = d.balls;
  if (d.potions !== undefined) s.potions = d.potions;
  if (d.autoBalls !== undefined || d.balls !== undefined || d.potions !== undefined || d.startedAt !== undefined) checkSupplies(account, s, who, c);
}

// every few seconds: has an account gone quiet, or stopped getting kills?
function watch() {
  const c = cfg();
  const now = Date.now();
  for (const a in st) {
    const s = st[a];
    const who = labelOf(a, s);
    if (s.pendingStop && s.active === false && now - s.pendingStop >= 20000) {
      s.pendingStop = 0;
      show(a, 'stopped', 'Stopped hunting', who + ' is no longer hunting.', { noCooldown: true, key: 'stop' });
    }
    if (s.active !== true) continue;                                   // the game itself says it is not hunting: nothing more to watch
    const quiet = (now - s.lastMsg) / 1000;
    if (quiet > c.stopped.silentSeconds) {
      if (!s.silentSent) {
        s.silentSent = true;
        show(a, 'stopped', 'No data from the game', who + ': nothing received for ' + span(quiet) + '. The panel may be disconnected or logged out.', { noCooldown: true, key: 'silent' });
      }
      continue;
    }
    const still = (now - s.killsAt) / 1000;
    if (still > c.stopped.noKillsSeconds && !s.noKillSent) {
      s.noKillSent = true;
      show(a, 'stopped', 'No kills', who + ': no kills for ' + span(still) + ' while hunting.', { noCooldown: true, key: 'nokills' });
    }
  }
}

let timer = null;
function handle(account, data) {
  try {
    if (!timer) { timer = setInterval(watch, 15000); if (timer.unref) timer.unref(); }
    if (data) handleOne(account, data);
  } catch (e) {
    console.log('notify error: ' + e.message);
  }
}

// ---------- used by the tray menu ----------
const isEnabled = () => !!cfg().enabled;
const setEnabled = v => { try { writeSetting(u => { u.enabled = !!v; }); } catch (e) { console.log('notify: could not save the setting (' + e.message + ')'); } };
const test = () => show(0, 'test', 'Notifications are working', '4horizon will alert you here, even when the window is hidden.', { force: true, noCooldown: true });
function openSettings() { cfg(); shell.openPath(SETTINGS_FILE).catch(() => {}); }

app.whenReady().then(() => {
  if (cfg().startupNotice) show(0, 'startup', '4horizon is running', 'Notifications are on. Right-click the tray icon to turn them off.', { always: true, noCooldown: true });
});

module.exports = { handle, isEnabled, setEnabled, test, openSettings, _watch: watch, _state: st, _show: show };
