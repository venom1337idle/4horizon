// perf.js: how much CPU and memory 4horizon uses, over time (1.0.7).
//
// economy.js already notes, once a minute and for the last 24 hours, the CPU and memory of each process of the app (the main process, the window,
// each game panel, the graphics process, the rest). This module adds to each sample the CPU of the whole PC and the number of logical processors,
// and works out from the samples:
//   - for the Diagnostics report (section CPU AND MEMORY): now, the average, the highest minute, every stretch of high CPU, whether the memory grows,
//     and the last 2 hours in 10-minute steps; each time with the process that used the most;
//   - a warning (a Windows notification) when 4horizon uses HIGH_PC % or more of the whole PC for HIGH_MIN minutes in a row. It follows the switches of
//     the notifications (off when they are off, held back in quiet hours), comes at most once an hour, and only again after the CPU went back under CALM_PC %.
//
// Electron gives the CPU of a process already as a share of the whole PC (it divides by the number of logical processors itself), the figure
// Windows' Task Manager shows: the processes are simply added up. The number of processors is only noted for the report. It never throws.

'use strict';
const os = require('os');

const HIGH_PC = 50;                   // % of the whole PC used by 4horizon ...
const HIGH_MIN = 5;                   // ... in this many samples (minutes) in a row: high
const CALM_PC = 30;                   // under this, the warning is armed again
const COOLDOWN_MS = 60 * 60000;       // at most one warning an hour
const GAP_MS = 150000;                // two samples further apart (the app was closed, the PC slept) do not make one stretch
const TIMELINE_MIN = 120, STEP_MIN = 10;
const MAX_ALERTS = 10, MAX_EPISODES = 5, MAX_BY = 6;

const fin = v => typeof v === 'number' && isFinite(v);
const r1 = v => Math.round(v * 10) / 10;
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

const deps = {
  now: () => Date.now(),
  cpus: () => os.cpus(),
  samples: () => { try { return require('./economy')._log().samples; } catch (e) { return []; } },
  t: (k, p) => { try { return require('./i18n').t(k, p); } catch (e) { return String(k).replace(/\{(\w+)\}/g, (m, x) => (p && p[x] !== undefined ? p[x] : m)); } },
  notify: (title, body) => { try { return require('./notify').alert('highCpu', title, body); } catch (e) { return false; } }
};

// ---------------------------------------------------------------------------------------------------------------
// the CPU of the whole PC: from the times Windows counts for each logical processor, between two samples
// ---------------------------------------------------------------------------------------------------------------
function totals(cpus) {
  let busy = 0, all = 0;
  (Array.isArray(cpus) ? cpus : []).forEach(c => {
    const t = c && c.times; if (!t) return;
    const parts = ['user', 'nice', 'sys', 'idle', 'irq'].map(k => (fin(t[k]) ? t[k] : 0));
    all += parts.reduce((x, y) => x + y, 0); busy += parts[0] + parts[1] + parts[2] + parts[4];
  });
  return { busy, all, n: Array.isArray(cpus) ? cpus.length : 0 };
}
// the share of the whole PC that was busy between two readings (0..100), or null
function busyBetween(a, b) {
  if (!a || !b) return null;
  const dAll = b.all - a.all, dBusy = b.busy - a.busy;
  if (!(dAll > 0) || dBusy < 0) return null;
  return r1(Math.min(100, Math.max(0, dBusy / dAll * 100)));
}
let lastCpus = null;
// economy.js asks this for each sample: { sys: whole PC %, or null the first time; cores: logical processors }
function pcSample() {
  let cur = null;
  try { cur = totals(deps.cpus()); } catch (e) { cur = null; }
  const out = { sys: busyBetween(lastCpus, cur), cores: cur && cur.n > 0 ? cur.n : null };
  lastCpus = cur;
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// what the samples say. A plain function of the samples, so it can be tested with made-up hours.
// ---------------------------------------------------------------------------------------------------------------
const cpuOf = v => (fin(v) && v > 0 ? v : 0);                  // (Electron can give a process a slightly negative figure, e.g. on its first reading: counted as 0)
const appCpu = s => Object.keys(s.cpu || {}).reduce((x, k) => x + cpuOf(s.cpu[k]), 0);
const appMem = s => Object.keys(s.mem || {}).reduce((x, k) => x + (fin(s.mem[k]) ? s.mem[k] : 0), 0);
// the private memory (1.0.7, Windows): each process's own memory, nothing counted twice; closer to Task Manager than the working sets (null: not in this sample)
const appPriv = s => (s.memp && typeof s.memp === 'object' && !Array.isArray(s.memp) && Object.keys(s.memp).some(k => fin(s.memp[k])) ? Object.keys(s.memp).reduce((x, k) => x + (fin(s.memp[k]) ? s.memp[k] : 0), 0) : null);
function topOf(list) {                                          // the process that used the most CPU over these samples
  const by = {};
  list.forEach(s => Object.keys(s.cpu || {}).forEach(k => { by[k] = (by[k] || 0) + cpuOf(s.cpu[k]); }));
  const ks = Object.keys(by).sort((a, b) => by[b] - by[a]);
  return ks.length && by[ks[0]] > 0 ? ks[0] : null;
}

function history(samples, at, coresFallback) {
  const S = (Array.isArray(samples) ? samples : []).filter(s => s && fin(s.t) && s.cpu && typeof s.cpu === 'object' && !Array.isArray(s.cpu)).sort((a, b) => a.t - b.t);
  const good = S.filter(s => !s.warm);
  const lastCores = good.length && fin(good[good.length - 1].cores) && good[good.length - 1].cores > 0 ? good[good.length - 1].cores : null;
  const cores = lastCores || (fin(coresFallback) && coresFallback > 0 ? coresFallback : 1);
  const pcOf = s => appCpu(s);                                  // (already a share of the whole PC: see the top of this file)
  const out = { cores: cores, samples: good.length, spanMin: good.length ? Math.round((at - good[0].t) / 60000) : 0, highPc: HIGH_PC, highMin: HIGH_MIN };
  if (!good.length) return out;
  const last = good[good.length - 1];
  out.now = { ageSec: Math.max(0, Math.round((at - last.t) / 1000)), pc: r1(pcOf(last)), sys: fin(last.sys) ? r1(last.sys) : null, mem: Math.round(appMem(last)), priv: appPriv(last) === null ? null : Math.round(appPriv(last)),
    by: Object.keys(last.cpu).filter(k => cpuOf(last.cpu[k]) > 0).sort((a, b) => last.cpu[b] - last.cpu[a]).slice(0, MAX_BY).map(k => ({ k: k, pc: r1(last.cpu[k]) })) };
  const syss = good.map(s => s.sys).filter(fin);
  const privs = good.map(appPriv).filter(fin);
  out.avg = { pc: r1(avg(good.map(pcOf))), sys: syss.length ? r1(avg(syss)) : null, mem: Math.round(avg(good.map(appMem))), priv: privs.length ? Math.round(avg(privs)) : null };
  let peak = good[0]; good.forEach(s => { if (pcOf(s) > pcOf(peak)) peak = s; });
  out.peak = { ageMin: Math.round((at - peak.t) / 60000), pc: r1(pcOf(peak)), sys: fin(peak.sys) ? r1(peak.sys) : null, top: topOf([peak]) };
  // the memory: the first hour against the last hour (only with 2 hours or more of samples)
  if (last.t - good[0].t >= 2 * 3600e3) {
    const first = good.filter(s => s.t < good[0].t + 3600e3), lastH = good.filter(s => s.t > last.t - 3600e3);
    const both = first.concat(lastH).every(s => appPriv(s) !== null);          // private memory in both hours: that one; otherwise the working sets (samples from before 1.0.7)
    const m = both ? appPriv : appMem;
    out.memory = { from: Math.round(avg(first.map(m))), to: Math.round(avg(lastH.map(m))), kind: both ? 'private' : 'shared' };
  }
  // the last 2 hours, 10 minutes a step, newest first (null: no sample in that step)
  out.timeline = [];
  for (let b = 0; b < TIMELINE_MIN / STEP_MIN; b++) {
    const hi = at - b * STEP_MIN * 60000, lo = hi - STEP_MIN * 60000, inB = good.filter(s => s.t <= hi && s.t > lo);
    out.timeline.push(inB.length ? r1(avg(inB.map(pcOf))) : null);
  }
  // stretches of high CPU: HIGH_MIN samples in a row or more, without a gap
  const eps = []; let run = [];
  const close = () => { if (run.length >= HIGH_MIN) eps.push({ startAgoMin: Math.round((at - run[0].t) / 60000), min: Math.round((run[run.length - 1].t - run[0].t) / 60000) + 1, avgPc: r1(avg(run.map(pcOf))), peakPc: r1(Math.max(...run.map(pcOf))), top: topOf(run) }); run = []; };
  good.forEach((s, i) => {
    if (i > 0 && s.t - good[i - 1].t > GAP_MS) close();
    if (pcOf(s) >= HIGH_PC) run.push(s); else close();
  });
  close();
  out.highCount = eps.length;
  out.high = eps.slice(-MAX_EPISODES).reverse();
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// the warning
// ---------------------------------------------------------------------------------------------------------------
const alert = { streak: [], last: null, armed: true, lastAt: 0, list: [] };
const t = (k, p) => deps.t(k, p);                              // (the texts below call this plain "t", so the check of the Portuguese texts finds them)
function whoText(k) {
  if (/^p[1-4]$/.test(k || '')) return t('game panel {n}', { n: k.slice(1) });
  return ({ gpu: t('the graphics process'), win: t('the window'), main: t('4horizon itself') })[k] || t('other parts of 4horizon');
}
// economy.js calls this after each sample
function onSample(s) {
  if (!s || !fin(s.t) || !s.cpu || typeof s.cpu !== 'object') return false;
  if (s.warm) { alert.streak = []; alert.last = s; return false; }
  if (alert.last && s.t - alert.last.t > GAP_MS) alert.streak = [];
  alert.last = s;
  const pc = appCpu(s);                                         // (already a share of the whole PC)
  if (pc >= HIGH_PC) alert.streak.push({ s: s, pc: pc });
  else { alert.streak = []; if (pc < CALM_PC) alert.armed = true; }
  if (alert.streak.length < HIGH_MIN || !alert.armed || (alert.lastAt && s.t - alert.lastAt < COOLDOWN_MS)) return false;
  const st = alert.streak, p = Math.round(avg(st.map(x => x.pc))), m = st.length, top = topOf(st.map(x => x.s));
  const title = t('4horizon is using a lot of CPU');
  const body = t('About {p}% of your processor for {m} minutes, mostly {who}. Economy mode (the leaf button) can lower it; Diagnostics has the details.', { p: p, m: m, who: whoText(top) });
  let shown = false;
  try { shown = deps.notify(title, body) === true; } catch (e) { shown = false; }
  alert.armed = false; alert.lastAt = s.t;
  alert.list.push({ t: s.t, pc: p, min: m, top: top, shown: shown });
  if (alert.list.length > MAX_ALERTS) alert.list.shift();
  return true;
}

// for the report
function info() {
  try {
    const at = deps.now();
    let cf = null; try { cf = os.cpus().length; } catch (e) {}
    return {
      history: history(deps.samples(), at, cf),
      alerts: alert.list.map(a => ({ ageMin: Math.round((at - a.t) / 60000), pc: a.pc, min: a.min, top: a.top, shown: a.shown })),
      thresholds: { highPc: HIGH_PC, highMin: HIGH_MIN, calmPc: CALM_PC, cooldownMin: COOLDOWN_MS / 60000 }
    };
  } catch (e) { return { error: String((e && e.message) || e).slice(0, 120) }; }
}

module.exports = { pcSample, history, onSample, info, totals, busyBetween, HIGH_PC, HIGH_MIN, CALM_PC, COOLDOWN_MS,
  _deps: deps, _alert: alert, _reset: () => { lastCpus = null; alert.streak = []; alert.last = null; alert.armed = true; alert.lastAt = 0; alert.list = []; } };
