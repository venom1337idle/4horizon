// notify.js
// Desktop notifications for 4horizon. It runs in the main process, so it works while the window is hidden in the tray.
// It only looks at the numbers ws-reader.js already reads from the game (it sends nothing anywhere).
//
// Settings live in notify-settings.json (created on first run) (lang-50: in the user-data folder, see datadir.js; an older one in the app folder is moved there once).
// Changes to that file are picked up within a few seconds, no restart needed.

const fs = require('fs');
const path = require('path');
const { app, Notification, BrowserWindow, shell, ipcMain } = require('electron');
const i18n = require('./i18n');                     // the language of the app (settings.js keeps it); English is the key of every text
try { require('./i18n-pt'); } catch (e) { /* without the Portuguese texts everything stays English */ }
const t = (en, p) => i18n.t(en, p);

let SETTINGS_FILE; try { SETTINGS_FILE = require('./datadir').file('notify-settings.json'); } catch (e) { SETTINGS_FILE = path.join(__dirname, 'notify-settings.json'); }

const DEFAULTS = {
  enabled: true,
  startupNotice: true,
  sound: true,           // the Windows notification sound
  quietHours: { enabled: false, from: '23:00', to: '07:00', allowShiny: false },   // no alerts between these times (local time; the window may cross midnight)
  events: {
    shiny: true,          // a shiny was captured
    goodCatch: true,      // a capture with a high IV or a high quality
    rareDrop: true,       // an item worth a lot dropped
    suppliesLow: true,    // balls or potions will run out soon
    stopped: true,        // an account stopped hunting, got no kills, or went silent
    huntUnlocked: true,   // the trainer level opened a new hunt
    battlePass: true,     // a battle pass mission (or the challenge of the week) was completed (missions.js)
    dailyQuest: true,     // a daily mission was completed (missions.js)
    eggReady: true        // an egg is ready to hatch (missions.js)
  },
  goodCatch: { minIV: 175, minQuality: 1.7, mode: 'or' },        // IV out of 192, quality multiplier (1.7 = Lendaria and above); mode 'or': one of the two is enough, 'and': both are needed
  goodCatch2: { enabled: false, minIV: 170, minQuality: 5, mode: 'or' },     // lang-70: a second rule (off at first); a catch is great when it meets the first rule OR this one
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
  // 1.0.7: what was just written counts at once. (Before, the file was read again only if its time had changed: two changes close together could get
  // the same time on the disk, and the second one was then not seen, e.g. two boxes of Settings ticked quickly.)
  settings = merge(DEFAULTS, user); warnedBadFile = false;
  try { mtime = fs.statSync(SETTINGS_FILE).mtimeMs; } catch (e) {}
  loadedAt = Date.now();
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

// ---------- quiet hours ----------
const minutesOf = text => { const m = /^(\d\d):(\d\d)$/.exec(String(text)); if (!m) return null; const h = +m[1], mi = +m[2]; return (h > 23 || mi > 59) ? null : h * 60 + mi; };
// is it quiet right now? (from 23:00 to 07:00 crosses midnight; the same time twice, or a time that cannot be read, means no quiet hours)
function isQuietNow(c, when) {
  const q = (c && c.quietHours) || {};
  if (!q.enabled) return false;
  const a = minutesOf(q.from), b = minutesOf(q.to);
  if (a === null || b === null || a === b) return false;
  const d = when || new Date(Date.now()), m = d.getHours() * 60 + d.getMinutes();
  return a < b ? (m >= a && m < b) : (m >= a || m < b);
}

// ---------- showing a notification ----------
const open = new Set();         // keeps a reference until it closes, otherwise a click can be lost
const lastSent = {};
const num = n => i18n.int(n);                       // 1,384 in English, 1.384 in Portuguese

function show(account, kind, title, body, opts) {
  opts = opts || {};
  const c = cfg();
  if (!opts.force) {
    if (!c.enabled) return false;
    if (!opts.always && !c.events[kind]) return false;
    if (isQuietNow(c) && !(kind === 'shiny' && c.quietHours.allowShiny)) { console.log('notification [' + kind + '] held back (quiet hours): ' + title); return false; }
  }
  const key = account + ':' + (opts.key || kind);
  const now = Date.now();
  if (!opts.noCooldown && lastSent[key] && now - lastSent[key] < c.cooldownSeconds * 1000) return false;
  lastSent[key] = now;
  console.log('notification [' + kind + '] ' + title + ' | ' + body);
  try {
    if (!Notification.isSupported()) return false;
    const n = new Notification({ title: title, body: body, silent: c.sound === false });
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
const labelOf = (account, s) => (cfg().accountNames[account] || s.name || t('Account {n}', { n: account }));
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
    const left = out ? t('none left') : t('{n} left, about {time} at the current pace', { n: num(it.stock), time: runway < 1 ? Math.max(1, Math.round(runway * 60)) + ' min' : i18n.num(runway, 1) + ' h' });
    show(account, 'suppliesLow', it.key === 'balls' ? t('Running low on balls') : t('Running low on potions'), who + ': ' + left, { noCooldown: true, key: 'low-' + it.key });
  }
}

// a catch is great by its IV and its quality: 'or' = at least one of the two reaches its number, 'and' = both do (anything but 'and' in the file counts as 'or')
const catchMode = g => (String(g && g.mode).toLowerCase() === 'and' ? 'and' : 'or');
function isGoodCatch(e, g) {
  const ivOk = e.iv >= g.minIV, qualityOk = e.quality >= g.minQuality;          // a number that is missing is not "enough"
  return catchMode(g) === 'and' ? (ivOk && qualityOk) : (ivOk || qualityOk);
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
        show(account, 'huntUnlocked', t('{who} reached level {n}', { who: who, n: d.level }),
          t(opened.length > 1 ? 'New hunts: {list}' : 'New hunt: {list}', { list: opened.slice(0, 4).join(', ') + (opened.length > 4 ? ' ' + t('and {n} more', { n: opened.length - 4 }) : '') }),
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
    if (e.shiny) show(account, 'shiny', t('Shiny captured!'), who + ': ' + line, { noCooldown: true, key: 'shiny' });
    else if (isGoodCatch(e, c.goodCatch) || (c.goodCatch2 && c.goodCatch2.enabled === true && isGoodCatch(e, c.goodCatch2))) show(account, 'goodCatch', t('Great catch'), who + ': ' + line, { noCooldown: true, key: 'catch' });
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
          show(account, 'rareDrop', t('Rare drop: {item}', { item: it.name }), t('{who} got {n} \u00d7 {item} (worth ${value} each)', { who: who, n: it.qty - prev, item: it.name, value: num(unit) }), { noCooldown: true, key: 'drop' });
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
    // left the hunt (the city, another map...): told only if it has not come back within the "No kills" time (lang-54; at least 20 s, so that changing hunt is never told)
    if (s.pendingStop && s.active === false && now - s.pendingStop >= Math.max(20000, c.stopped.noKillsSeconds * 1000)) {
      s.pendingStop = 0;
      show(a, 'stopped', t('Stopped hunting'), t('{who} is no longer hunting.', { who: who }), { noCooldown: true, key: 'stop' });
    }
    if (s.active !== true) continue;                                   // the game itself says it is not hunting: nothing more to watch
    const quiet = (now - s.lastMsg) / 1000;
    if (quiet > c.stopped.silentSeconds) {
      if (!s.silentSent) {
        s.silentSent = true;
        show(a, 'stopped', t('No data from the game'), t('{who}: nothing received for {span}. The panel may be disconnected or logged out.', { who: who, span: span(quiet) }), { noCooldown: true, key: 'silent' });
      }
      continue;
    }
    const still = (now - s.killsAt) / 1000;
    if (still > c.stopped.noKillsSeconds && !s.noKillSent) {
      s.noKillSent = true;
      show(a, 'stopped', t('No kills'), t('{who}: no kills for {span} while hunting.', { who: who, span: span(still) }), { noCooldown: true, key: 'nokills' });
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
const test = () => show(0, 'test', t('Notifications are working'), t('4horizon will alert you here, even when the window is hidden.'), { force: true, noCooldown: true });
function openSettings() { cfg(); shell.openPath(SETTINGS_FILE).catch(() => {}); }

// ---------- the Settings window: reads the settings and changes them (it never writes the file itself, and every value is checked here) ----------
const EVENTS = Object.keys(DEFAULTS.events);
const NUMBERS = {                       // setting: [lowest, highest, decimals]
  'goodCatch.minIV': [0, 200, 0], 'goodCatch.minQuality': [0, 5, 2], 'goodCatch2.minIV': [0, 200, 0], 'goodCatch2.minQuality': [0, 5, 2], 'rareDrop.minValue': [0, 1e9, 0],
  'suppliesLow.minRunwayHours': [0.25, 48, 2], 'suppliesLow.minSampleMinutes': [1, 240, 0],
  'stopped.noKillsSeconds': [30, 7200, 0], 'stopped.silentSeconds': [30, 7200, 0]
};
function publicConfig() {
  const c = cfg(), e = c.events || {};
  const out = { enabled: !!c.enabled, startupNotice: c.startupNotice !== false, sound: c.sound !== false, events: {} };
  EVENTS.forEach(k => { out.events[k] = e[k] !== false; });
  Object.keys(NUMBERS).forEach(key => { const g = key.split('.')[0], f = key.split('.')[1]; (out[g] = out[g] || {})[f] = c[g][f]; });
  out.goodCatch.mode = catchMode(c.goodCatch);
  out.goodCatch2.mode = catchMode(c.goodCatch2); out.goodCatch2.enabled = !!(c.goodCatch2 && c.goodCatch2.enabled === true);
  const q = c.quietHours || {};
  out.quietHours = { enabled: q.enabled === true, from: minutesOf(q.from) === null ? DEFAULTS.quietHours.from : q.from, to: minutesOf(q.to) === null ? DEFAULTS.quietHours.to : q.to, allowShiny: q.allowShiny === true };
  return out;
}
// what is allowed in a change: true / false for the switches, numbers inside their limits for the rest; anything else is ignored
function cleanChange(p) {
  const out = [];
  if (!p || typeof p !== 'object') return out;
  ['enabled', 'startupNotice', 'sound'].forEach(k => { if (typeof p[k] === 'boolean') out.push([[k], p[k]]); });
  if (p.events && typeof p.events === 'object') EVENTS.forEach(k => { if (typeof p.events[k] === 'boolean') out.push([['events', k], p.events[k]]); });
  ['goodCatch', 'goodCatch2'].forEach(g => { if (p[g] && typeof p[g] === 'object' && (p[g].mode === 'and' || p[g].mode === 'or')) out.push([[g, 'mode'], p[g].mode]); });      // exactly 'and' or 'or'
  if (p.goodCatch2 && typeof p.goodCatch2 === 'object' && typeof p.goodCatch2.enabled === 'boolean') out.push([['goodCatch2', 'enabled'], p.goodCatch2.enabled]);
  if (p.quietHours && typeof p.quietHours === 'object') {
    ['enabled', 'allowShiny'].forEach(k => { if (typeof p.quietHours[k] === 'boolean') out.push([['quietHours', k], p.quietHours[k]]); });
    ['from', 'to'].forEach(k => { if (typeof p.quietHours[k] === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(p.quietHours[k])) out.push([['quietHours', k], p.quietHours[k]]); });     // 24-hour HH:MM
  }
  Object.keys(NUMBERS).forEach(key => {
    const g = key.split('.')[0], f = key.split('.')[1], v = p[g] && typeof p[g] === 'object' ? p[g][f] : undefined;
    if (typeof v !== 'number' || !isFinite(v)) return;
    const lim = NUMBERS[key], x = Math.min(lim[1], Math.max(lim[0], v)), m = Math.pow(10, lim[2]);
    out.push([[g, f], Math.round(x * m) / m]);
  });
  return out;
}
function setConfig(p) {
  const changes = cleanChange(p);
  let saved = true;
  if (changes.length) {
    try {
      writeSetting(u => changes.forEach(ch => {
        let o = u; for (let i = 0; i < ch[0].length - 1; i++) { if (!o[ch[0][i]] || typeof o[ch[0][i]] !== 'object') o[ch[0][i]] = {}; o = o[ch[0][i]]; }
        o[ch[0][ch[0].length - 1]] = ch[1];
      }));
      try { i18n.poke(); } catch (e) {}                 // the tray menu is built again (its Notifications tick follows the setting)
    } catch (e) { saved = false; console.log('notify: could not save the settings (' + e.message + ')'); }
  }
  return Object.assign(publicConfig(), { saved: saved });
}
(function registerIpc() {
  if (!ipcMain || !ipcMain.handle) return;
  let settings = null; try { settings = require('./settings'); } catch (e) {}
  const ours = e => !!(settings && settings.fromOurWindow && settings.fromOurWindow(e));      // only the app's own window, never a game panel
  ipcMain.handle('notify:get', e => (ours(e) ? publicConfig() : null));
  ipcMain.handle('notify:set', (e, p) => (ours(e) ? setConfig(p) : null));
  ipcMain.handle('notify:test', e => { if (!ours(e)) return false; test(); return true; });
})();

app.whenReady().then(() => {
  if (cfg().startupNotice) show(0, 'startup', t('4horizon is running'), t('Notifications are on. Right-click the tray icon to turn them off.'), { always: true, noCooldown: true });
});

// for missions.js: an event it saw (each one comes once, so no cooldown; its key keeps two different ones apart), and the name of an account as the alerts write it
function event(account, kind, title, body, key) { return show(account, kind, title, body, { noCooldown: true, key: key || kind }); }
// 1.0.7: a warning of the app itself (perf.js: a lot of CPU for several minutes). It has no box of its own under "Tell me when": it follows the main switch
// (Windows notifications) and quiet hours, and the module that sends it decides how often (perf.js: at most once an hour).
function alert(kind, title, body) { return show(0, kind, title, body, { always: true, noCooldown: true, key: kind }); }
function label(account) { return labelOf(account, S(account)); }

module.exports = { event, label, alert, handle, isEnabled, setEnabled, test, openSettings, getConfig: publicConfig, setConfig, _clean: cleanChange, isQuietNow, isGoodCatch, _watch: watch, _state: st, _show: show };
