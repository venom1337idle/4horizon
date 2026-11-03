// economy.js: economy mode (the leaf button of the top bar) and the measurements that say whether it works.
//
// Economy mode is turned on and off by hand only. While it is on, the window stops drawing: the four game screens and the Summary are hidden behind a calm
// screen (index.html), the dashboard stops redrawing (dashboard.html) and the game panels are muted (here). The games keep running: nothing of them is paused.
//
// To tell whether it works, once a minute this module notes (on and off, for the last 24 hours, kept on the disk so a restart does not lose it):
//   - CPU and memory of each process of the app (Electron's own figures: the app, the window, each game panel, the graphics process, the rest);
//   - for each game page: how late a 1-second timer of the page runs (a page the browser slows down runs it late), and whether the page counts as hidden;
//   - for each account: the game messages that arrived, and the kills and XP of the hunt session (the counters the window already has), with the hunt.
// analyse() turns that into the section ECONOMY MODE of the Diagnostics report: does it save resources, are the screens really not drawn, and does each
// account still hunt at the same pace on the same hunt. Nothing of the game is changed or pressed; the timer runs in a world of its own, apart from the game's code.

let electron = null;
try { electron = require('electron'); } catch (e) {}
const fs = require('fs');
const path = require('path');

const EVERY_MS = 60000;                  // one sample a minute
const KEEP_MS = 24 * 3600 * 1000;        // the last 24 hours
const SAVE_EVERY_MS = 5 * 60000;         // written to the disk at most every 5 minutes (and when the mode changes, and when the app quits)
const GAP_MS = 150000;                   // two samples further apart than this (the app was closed, the PC slept) are not compared
const PAGE_MS = 4000;                    // a page that does not answer in 4 s is noted as "did not answer"
const WORLD = 1047;                      // the isolated world the timer runs in (the game's code cannot see it)
const MIN_COMPARE_MIN = 20;              // minutes in EACH mode on the same hunt before kills/h are compared
const SLOW_RATIO = 0.85;                 // kills/h in economy mode under 85% of the normal pace: slower
const LATE_MS = 5000;                    // a 1-second timer more than 5 s late: the browser is slowing the page down

const now = () => deps.now();
const deps = {
  now: () => Date.now(),
  metrics: () => (electron && electron.app && electron.app.getAppMetrics ? electron.app.getAppMetrics() : []),
  guests: () => { try { return require('./accounts')._guests || {}; } catch (e) { return {}; } },
  window: () => { try { const BW = electron && electron.BrowserWindow; const ws = BW ? BW.getAllWindows().filter(w => !w.isDestroyed()) : []; return ws[0] || null; } catch (e) { return null; } },
  frames: () => { try { return require('./diag')._state.frames || {}; } catch (e) { return {}; } },
  file: () => { try { return path.join(electron.app.getPath('userData'), 'economy-log.json'); } catch (e) { return null; } }
};

let state = { on: false, since: now() };
let log = { v: 1, samples: [], events: [] };     // samples: one a minute; events: { t, on } every change of the mode (and a start of the app: { t, start: true })
let changed = false;                             // the mode changed since the last sample: that minute is mixed and is not counted for either mode
let first = true;                                // the first CPU figure after the start covers an unknown time: not counted
let timer = null, lastSave = 0, loaded = false, saveError = null;

// ---------------------------------------------------------------------------------------------------------------
// the timer that runs in each game page (in its own world). It answers how late its 1-second ticks were since the last question, and whether the page counts as hidden.
// ---------------------------------------------------------------------------------------------------------------
const PROBE = '(function(){var w=window,p=w.__4hEcoProbe,t=performance.now();' +
  'if(!p){p=w.__4hEcoProbe={n:0,sum:0,max:0,last:t};setInterval(function(){var x=performance.now(),l=x-p.last-1000;p.last=x;if(l<0)l=0;p.n++;p.sum+=l;if(l>p.max)p.max=l;},1000);return {fresh:true,vis:document.visibilityState};}' +
  'var gap=t-p.last-1000,r={n:p.n,avg:p.n?p.sum/p.n:0,max:Math.max(p.max,gap>0?gap:0),vis:document.visibilityState};p.n=0;p.sum=0;p.max=0;return r;})()';
const withTimeout = (pr, ms) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
function runProbe(wc) {
  if (wc.executeJavaScriptInIsolatedWorld) return wc.executeJavaScriptInIsolatedWorld(WORLD, [{ code: PROBE }]);
  return wc.executeJavaScript(PROBE);
}
const r1 = v => Math.round(v * 10) / 10;
const fin = v => typeof v === 'number' && isFinite(v);

async function sample() {
  const t = now(), guests = deps.guests() || {}, win = deps.window();
  const s = { t: t, eco: changed ? null : state.on, cpu: {}, mem: {}, page: {}, acc: {}, msg: {} };
  if (first) s.warm = true;
  first = false; changed = false;
  // CPU and memory of each process, by what it is
  const who = {};
  [1, 2, 3, 4].forEach(n => { try { const g = guests[n]; if (g && !g.isDestroyed()) who[g.getOSProcessId()] = 'p' + n; } catch (e) {} });
  try { if (win && win.webContents) who[win.webContents.getOSProcessId()] = 'win'; } catch (e) {}
  try {
    (deps.metrics() || []).forEach(m => {
      const k = who[m.pid] || (m.type === 'Browser' ? 'main' : m.type === 'GPU' ? 'gpu' : 'other');
      const c = m.cpu && fin(m.cpu.percentCPUUsage) ? m.cpu.percentCPUUsage : 0, mb = m.memory && fin(m.memory.workingSetSize) ? m.memory.workingSetSize / 1024 : 0;
      s.cpu[k] = r1((s.cpu[k] || 0) + c); s.mem[k] = Math.round((s.mem[k] || 0) + mb);
    });
  } catch (e) {}
  // each game page: its timer and whether it counts as hidden
  await Promise.all([1, 2, 3, 4].map(async n => {
    const g = guests[n];
    if (!g || (g.isDestroyed && g.isDestroyed())) return;
    try {
      const r = await withTimeout(runProbe(g), PAGE_MS);
      if (r && r.fresh) s.page[n] = { fresh: true, vis: r.vis === 'hidden' ? 'hidden' : 'visible' };
      else if (r) s.page[n] = { n: r.n | 0, avg: Math.round(fin(r.avg) ? r.avg : 0), max: Math.round(fin(r.max) ? r.max : 0), vis: r.vis === 'hidden' ? 'hidden' : 'visible' };
    } catch (e) { s.page[n] = { err: true }; }
  }));
  // each account: the counters of its hunt session, as the window has them
  try {
    const a = win && win.webContents ? await withTimeout(win.webContents.executeJavaScript('window.__4hEcoSample ? window.__4hEcoSample() : null'), PAGE_MS) : null;
    if (a && typeof a === 'object') [1, 2, 3, 4].forEach(n => {
      const x = a[n];
      if (x && x.sid !== undefined && x.sid !== null && fin(x.k)) s.acc[n] = { sid: String(x.sid).slice(0, 40), hunt: String(x.hunt || '').slice(0, 60), k: x.k, x: fin(x.x) ? x.x : 0 };
    });
  } catch (e) {}
  // the game messages that arrived, as counted by the diagnostics
  try { const f = deps.frames(); [1, 2, 3, 4].forEach(n => { if (f[n] && fin(f[n].total)) s.msg[n] = f[n].total; }); } catch (e) {}
  log.samples.push(s);
  prune();
  if (now() - lastSave >= SAVE_EVERY_MS) save();
  return s;
}
function prune() {
  const old = now() - KEEP_MS;
  while (log.samples.length && log.samples[0].t < old) log.samples.shift();
  if (log.samples.length > 2000) log.samples.splice(0, log.samples.length - 2000);
  while (log.events.length && log.events[0].t < old) log.events.shift();
  if (log.events.length > 500) log.events.splice(0, log.events.length - 500);
}
function load() {
  loaded = true;
  const f = deps.file(); if (!f) return;
  try {
    const o = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (o && Array.isArray(o.samples)) log.samples = o.samples.filter(s => s && fin(s.t) && typeof s.cpu === 'object' && s.cpu).slice(-2000);
    if (o && Array.isArray(o.events)) log.events = o.events.filter(e => e && fin(e.t)).slice(-500);
    // what was running when the app stopped: the samples after a restart begin a new stretch (the gap is not compared, the first CPU figure is not counted)
    if (log.events.length && log.events[log.events.length - 1].on === true) log.events.push({ t: (log.samples.length ? log.samples[log.samples.length - 1].t : now()), on: false, stop: true });
  } catch (e) {}
  prune();
}
function save() {
  lastSave = now();
  const f = deps.file(); if (!f) return;
  try { fs.writeFileSync(f, JSON.stringify(log)); saveError = null; } catch (e) { saveError = String(e && e.code || e && e.message || e).slice(0, 60); }
}

// the mode: the window asks for it; the game panels are muted while it is on (so their sound is not worked out either)
function set(on) {
  on = on === true;
  if (on !== state.on) { state = { on: on, since: now() }; changed = true; log.events.push({ t: state.since, on: on }); prune(); save(); }
  const guests = deps.guests() || {};
  [1, 2, 3, 4].forEach(n => { try { const g = guests[n]; if (g && !g.isDestroyed() && g.setAudioMuted) g.setAudioMuted(on); } catch (e) {} });
  return { on: state.on, since: state.since };
}

// ---------------------------------------------------------------------------------------------------------------
// what the samples say. A plain function of the log, so it can be tested with made-up hours.
// ---------------------------------------------------------------------------------------------------------------
function analyse(lg, at, cur) {
  const S = (lg && lg.samples) || [], out = { now: cur || null, samples: S.length, time: { on: 0, off: 0 }, res: {}, acc: {} };
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const sum = o => Object.keys(o || {}).reduce((x, k) => x + (fin(o[k]) ? o[k] : 0), 0);
  const panels = o => [1, 2, 3, 4].reduce((x, n) => x + (fin((o || {})['p' + n]) ? o['p' + n] : 0), 0);
  const modeName = e => (e ? 'on' : 'off');
  // resources: the average of the samples of each mode (the first after a start, and the minutes in which the mode changed, are left out)
  ['off', 'on'].forEach(m => {
    const ss = S.filter((s, i) => !s.warm && s.eco !== null && s.eco !== undefined && modeName(s.eco) === m && i > 0 && s.t - S[i - 1].t <= GAP_MS);
    out.res[m] = { n: ss.length, cpu: r1(avg(ss.map(s => sum(s.cpu))) || 0), cpuPanels: r1(avg(ss.map(s => panels(s.cpu))) || 0), cpuGpu: r1(avg(ss.map(s => s.cpu.gpu || 0)) || 0),
      cpuWin: r1(avg(ss.map(s => s.cpu.win || 0)) || 0), mem: Math.round(avg(ss.map(s => sum(s.mem))) || 0) };
  });
  // per account: the minutes between two samples go to the mode of the second one
  for (let n = 1; n <= 4; n++) {
    const A = { hunts: {}, msg: { on: { d: 0, min: 0 }, off: { d: 0, min: 0 } }, timer: { on: { max: 0, sum: 0, n: 0 }, off: { max: 0, sum: 0, n: 0 } }, vis: { on: {}, off: {} }, noAnswer: { on: 0, off: 0 }, seen: false };
    for (let i = 1; i < S.length; i++) {
      const a = S[i - 1], b = S[i], dt = (b.t - a.t) / 60000;
      if (b.eco === null || b.eco === undefined || dt <= 0 || b.t - a.t > GAP_MS) continue;
      const m = modeName(b.eco);
      if (n === 1) out.time[m] += dt;
      const pa = (b.page || {})[n];
      if (pa) {
        A.seen = true;
        if (pa.err) A.noAnswer[m]++;
        else { A.vis[m][pa.vis] = (A.vis[m][pa.vis] || 0) + 1; if (!pa.fresh) { const T = A.timer[m]; T.max = Math.max(T.max, pa.max || 0); T.sum += pa.avg || 0; T.n++; } }
      }
      const ma = (a.msg || {})[n], mb = (b.msg || {})[n];
      if (fin(ma) && fin(mb) && mb >= ma) { A.msg[m].d += mb - ma; A.msg[m].min += dt; }
      const ca = (a.acc || {})[n], cb = (b.acc || {})[n];
      if (ca && cb && ca.sid === cb.sid && cb.k >= ca.k) {
        A.seen = true;
        const h = A.hunts[cb.hunt] || (A.hunts[cb.hunt] = { on: { k: 0, x: 0, min: 0 }, off: { k: 0, x: 0, min: 0 } });
        h[m].k += cb.k - ca.k; h[m].x += Math.max(0, cb.x - ca.x); h[m].min += dt;
      }
    }
    if (!A.seen) continue;
    // the hunt with the most time in BOTH modes is the one compared
    const names = Object.keys(A.hunts), both = names.filter(h => A.hunts[h].on.min >= MIN_COMPARE_MIN && A.hunts[h].off.min >= MIN_COMPARE_MIN)
      .sort((x, y) => Math.min(A.hunts[y].on.min, A.hunts[y].off.min) - Math.min(A.hunts[x].on.min, A.hunts[x].off.min));
    const rate = (h, m, f) => h[m].min > 0 ? h[m][f] / h[m].min * 60 : 0;
    const R = { n: n, msgPerMin: { on: A.msg.on.min ? r1(A.msg.on.d / A.msg.on.min) : null, off: A.msg.off.min ? r1(A.msg.off.d / A.msg.off.min) : null },
      timer: { on: A.timer.on.n ? { avg: Math.round(A.timer.on.sum / A.timer.on.n), max: A.timer.on.max } : null, off: A.timer.off.n ? { avg: Math.round(A.timer.off.sum / A.timer.off.n), max: A.timer.off.max } : null },
      hiddenOn: (A.vis.on.hidden || 0) + (A.vis.on.visible || 0) ? (A.vis.on.hidden || 0) / ((A.vis.on.hidden || 0) + (A.vis.on.visible || 0)) : null,
      noAnswerOn: A.noAnswer.on };
    if (both.length) {
      const h = A.hunts[both[0]];
      R.hunt = both[0];
      R.on = { min: Math.round(h.on.min), kph: Math.round(rate(h, 'on', 'k')), xph: Math.round(rate(h, 'on', 'x')) };
      R.off = { min: Math.round(h.off.min), kph: Math.round(rate(h, 'off', 'k')), xph: Math.round(rate(h, 'off', 'x')) };
      R.ratio = R.off.kph > 0 ? Math.round(R.on.kph / R.off.kph * 100) / 100 : null;
    } else {
      // not enough on one hunt: the most time there is in each mode (on any one hunt), to say how much more is needed
      R.most = { on: Math.round(Math.max(0, ...names.map(h => A.hunts[h].on.min))), off: Math.round(Math.max(0, ...names.map(h => A.hunts[h].off.min))) };
    }
    // the verdict of the account
    const slowTimers = R.timer.on && R.timer.on.max > LATE_MS, fewMsgs = R.msgPerMin.on !== null && R.msgPerMin.off ? R.msgPerMin.on < R.msgPerMin.off * 0.5 : false;
    if (R.ratio !== null && R.ratio !== undefined) R.verdict = R.on.kph === 0 && R.on.min >= 10 ? 'stalled' : R.ratio < SLOW_RATIO ? 'slower' : 'normal';
    else if (R.off && R.off.kph === 0) R.verdict = 'no kills';
    else R.verdict = 'not enough';
    R.slowTimers = !!slowTimers; R.fewMsgs = !!fewMsgs;
    out.acc[n] = R;
  }
  out.time.on = Math.round(out.time.on); out.time.off = Math.round(out.time.off);
  out.events = ((lg && lg.events) || []).filter(e => !e.stop).length;
  out.minCompare = MIN_COMPARE_MIN; out.lateMs = LATE_MS; out.slowRatio = SLOW_RATIO;
  return out;
}

function info() {
  try {
    const a = analyse(log, now(), { on: state.on, sinceSec: Math.round((now() - state.since) / 1000) });
    a.saveError = saveError;
    return a;
  } catch (e) { return { error: String(e && e.message || e).slice(0, 120) }; }
}

function start() {
  if (timer) return;
  if (!loaded) load();
  log.events.push({ t: now(), start: true }); prune();
  timer = setInterval(() => { sample().catch(() => {}); }, EVERY_MS);
  if (timer.unref) timer.unref();
}

function init() {
  if (!electron || !electron.ipcMain || !electron.ipcMain.handle) return;
  let settings = null; try { settings = require('./settings'); } catch (e) {}
  const ours = e => !!(settings && settings.fromOurWindow && settings.fromOurWindow(e));       // only the app's own window, never a game panel
  electron.ipcMain.handle('economy:set', (e, on) => (ours(e) ? set(on === true) : null));
  try { electron.app.on('before-quit', () => { try { save(); } catch (x) {} }); } catch (e) {}
  start();
}

module.exports = { init, set, sample, analyse, info, save, load, PROBE,
  _deps: deps, _log: () => log, _state: () => state,
  _reset: () => { state = { on: false, since: now() }; log = { v: 1, samples: [], events: [] }; changed = false; first = true; lastSave = 0; loaded = false; saveError = null; if (timer) { clearInterval(timer); timer = null; } } };
