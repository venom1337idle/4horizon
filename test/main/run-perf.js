// run-perf.js: perf.js (1.0.7): CPU and memory over the last 24 hours in the Diagnostics report, and the warning when 4horizon uses a lot of CPU.
// Made-up hours of samples (one a minute, as economy.js takes them) and a made-up clock: nothing waits for real time.
const fs = require('fs'), path = require('path'), os = require('os');
process.env.HG_USERDATA = fs.mkdtempSync(path.join(os.tmpdir(), '4h-perf-'));
const electron = require('electron');
const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const P = require('./perf');
const i18n = require('./i18n'); try { require('./i18n-pt'); } catch (e) {}
const T0 = Date.UTC(2026, 10, 8, 12, 0, 0), MIN = 60000;
// one sample: CPU per process in Electron's figures (already a share of the whole PC: Electron divides by the processors itself), memory in MB, 4 logical processors
const mk = (m, cpu, extra) => Object.assign({ t: T0 + m * MIN, eco: false, cpu: Object.assign({}, cpu), mem: { main: 100, win: 200, gpu: 100, p1: 150 }, cores: 4 }, extra || {});
const CALM = { main: 0.5, win: 1, gpu: 0.5, p1: 2 };                 // 4 % of the PC
const BUSY = { main: 1, win: 2, gpu: 1, p1: 5, p2: 50 };             // 59 % of the PC, mostly panel 2
const seq = (from, n, cpu, extra) => Array.from({ length: n }, (_, i) => mk(from + i, cpu, extra));

(async () => {
  // ---- 1. the CPU of the whole PC, from the times of each logical processor
  const cpuAt = (u, s, idle) => [0, 1].map(() => ({ times: { user: u, nice: 0, sys: s, idle: idle, irq: 0 } }));
  ok('whole PC: busy time / all time between two readings (300 of 2,000 ms = 15%)', P.busyBetween(P.totals(cpuAt(100, 50, 850)), P.totals(cpuAt(200, 100, 1700))) === 15);
  ok('...nothing to compare (the first reading, no time passed, odd input): no figure, no throw', P.busyBetween(null, P.totals(cpuAt(1, 1, 1))) === null && P.busyBetween(P.totals(cpuAt(1, 1, 1)), P.totals(cpuAt(1, 1, 1))) === null && P.totals('x').n === 0 && P.totals([null, {}, { times: { user: 'a' } }]).n === 3);
  let reading = 0; P._deps.cpus = () => cpuAt(100 * (reading + 1), 50 * (reading + 1), 850 * (reading++ + 1)); P._reset();
  const a1 = P.pcSample(), a2 = P.pcSample();
  ok('economy.js gets, per sample, the number of logical processors, and the whole PC\u2019s CPU from the second sample on', a1.sys === null && a1.cores === 2 && a2.sys === 15 && a2.cores === 2, [a1, a2]);
  P._deps.cpus = () => { throw new Error('no cpus'); };
  ok('...if Windows does not answer: no figures, no throw', (() => { const r = P.pcSample(); return r.sys === null && r.cores === null; })());

  // ---- 2. what the samples say
  ok('no samples yet: the report says nothing was measured, nothing breaks', (() => { const h = P.history([], T0, 4); return h.samples === 0 && !h.now; })());
  let threw = null; try { [undefined, null, 'x', [null, 5, { t: 'x' }, { t: 1, cpu: 'x' }, { t: 1, cpu: [] }]].forEach(v => P.history(v, T0, 4)); } catch (e) { threw = e.message; }
  ok('odd samples (from an old or damaged file) never throw', threw === null, threw);
  const calmHour = seq(0, 60, CALM);
  let h = P.history(calmHour, T0 + 60 * MIN, 4);
  ok('Electron\u2019s figures are already shares of the whole PC: the processes are added up (4%)', h.now.pc === 4 && h.avg.pc === 4 && h.cores === 4, h.now);
  ok('...and NOT divided by the number of processors again (12 processors, 24% in Electron\u2019s figures = 24% of the PC, as in Task Manager)', P.history(seq(0, 3, { p1: 14, gpu: 10 }, { cores: 12 }), T0 + 3 * MIN, 12).now.pc === 24);
  ok('..."now" lists the processes that used the most, biggest first (panel 1 2%, window 1%...)', h.now.by[0].k === 'p1' && h.now.by[0].pc === 2 && h.now.by[1].k === 'win', h.now.by);
  ok('...and the memory of all processes together (550 MB)', h.now.mem === 550 && h.avg.mem === 550, h.now.mem);
  ok('the first sample after a start ("warm": its CPU figure covers an unknown time) is not counted', P.history([mk(0, BUSY, { warm: true })].concat(seq(1, 5, CALM)), T0 + 6 * MIN, 4).peak.pc === 4);
  const withPeak = calmHour.slice(); withPeak[30] = mk(30, BUSY);
  h = P.history(withPeak, T0 + 60 * MIN, 4);
  ok('the highest minute: 59% of the PC, 30 minutes ago, mostly panel 2', h.peak.pc === 59 && h.peak.ageMin === 30 && h.peak.top === 'p2', h.peak);
  ok('one busy minute is not a stretch of high CPU', h.highCount === 0, h.high);
  h = P.history(seq(0, 20, CALM).concat(seq(20, 6, BUSY), seq(26, 20, CALM)), T0 + 46 * MIN, 4);
  ok('6 busy minutes in a row: one stretch of high CPU, 6 min, average 59%, mostly panel 2, started 26 min ago', h.highCount === 1 && h.high[0].min === 6 && h.high[0].avgPc === 59 && h.high[0].top === 'p2' && h.high[0].startAgoMin === 26, h.high);
  ok('4 busy minutes in a row: not long enough (5 are needed)', P.history(seq(0, 10, CALM).concat(seq(10, 4, BUSY), seq(14, 10, CALM)), T0 + 24 * MIN, 4).highCount === 0);
  ok('busy minutes on both sides of a gap (the PC slept 10 min) do not make one stretch', P.history(seq(0, 3, BUSY).concat(seq(13, 3, BUSY)), T0 + 16 * MIN, 4).highCount === 0);
  const many = []; for (let k = 0; k < 8; k++) { many.push(...seq(k * 20, 6, BUSY), ...seq(k * 20 + 6, 14, CALM)); }
  h = P.history(many, T0 + 160 * MIN, 4);
  ok('8 stretches: all are counted, the last 5 are listed, newest first', h.highCount === 8 && h.high.length === 5 && h.high[0].startAgoMin < h.high[1].startAgoMin, [h.highCount, h.high.map(e => e.startAgoMin)]);
  ok('the last 2 hours in 10-minute steps, newest first (12 steps)', h.timeline.length === 12 && h.timeline.every(v => v === null || typeof v === 'number'), h.timeline);
  ok('...a step with no sample is empty, not 0', P.history(seq(0, 5, CALM), T0 + 60 * MIN, 4).timeline[0] === null);
  const grow = Array.from({ length: 180 }, (_, i) => mk(i, CALM, { mem: { main: 100, win: 400 + i * 2 } }));
  h = P.history(grow, T0 + 180 * MIN, 4);
  ok('with 2 hours or more: the memory of the first hour against the last hour (it grows here: 559 MB \u2192 799 MB, working sets: no private memory in these samples)', h.memory && h.memory.from === 559 && h.memory.to === 799 && h.memory.kind === 'shared', h.memory);
  const growP = Array.from({ length: 180 }, (_, i) => mk(i, CALM, { mem: { main: 900 }, memp: { main: 300 + i } }));
  h = P.history(growP, T0 + 180 * MIN, 4);
  ok('...with private memory in both hours, that one is compared (329.5 \u2192 449.5 MB)', h.memory.kind === 'private' && h.memory.from === 330 && h.memory.to === 450 && h.now.priv === 479 && h.avg.priv === 390, [h.memory, h.now.priv, h.avg.priv]);
  ok('...an odd private-memory part in a sample is ignored (no figure, no throw)', P.history(seq(0, 3, CALM, { memp: 'x' }), T0 + 3 * MIN, 4).now.priv === null && P.history(seq(0, 3, CALM, { memp: { a: 'x' } }), T0 + 3 * MIN, 4).now.priv === null);
  ok('...with less than 2 hours, no comparison (too short to tell)', !P.history(calmHour, T0 + 60 * MIN, 4).memory);
  ok('the whole PC\u2019s CPU: averaged when the samples have it, left out when they do not (samples from before 1.0.7)', P.history(seq(0, 5, CALM, { sys: 30 }), T0 + 5 * MIN, 4).avg.sys === 30 && P.history(seq(0, 5, CALM), T0 + 5 * MIN, 4).avg.sys === null);
  ok('samples without the number of processors (from before 1.0.7): the report shows this PC\u2019s, the figures stay the same', (() => { const x = P.history(seq(0, 3, CALM, { cores: undefined }), T0 + 3 * MIN, 8); return x.cores === 8 && x.now.pc === 4; })());

  // ---- 3. the warning
  const sent = []; P._deps.notify = (title, body) => { sent.push({ title, body }); return true; };
  P._deps.t = (k, p) => i18n.t(k, p); i18n.setLang('en');
  const feed = list => list.forEach(s => P.onSample(s));
  P._reset(); feed(seq(0, 4, BUSY));
  ok('4 minutes at 59%: no warning yet', sent.length === 0);
  feed([mk(4, BUSY)]);
  ok('the 5th minute: one warning', sent.length === 1, sent);
  ok('...its text says how much, how long and what (English)', sent[0].title === '4horizon is using a lot of CPU' && sent[0].body === 'About 59% of your processor for 5 minutes, mostly game panel 2. Economy mode (the leaf button) or Light mode (Settings) can lower it; Diagnostics has the details.', sent[0]);
  feed(seq(5, 30, BUSY));
  ok('it stays high for 30 more minutes: no second warning', sent.length === 1);
  feed(seq(35, 3, { p2: 40 }));                                      // 40%: under "high", but not "calm"
  feed(seq(38, 6, BUSY));
  ok('down to 40% and up again: still no second warning (it must go under 30% first)', sent.length === 1);
  feed(seq(44, 2, CALM)); feed(seq(46, 6, BUSY));
  ok('under 30%, then high again within the hour: no second warning (at most one an hour)', sent.length === 1);
  feed(seq(52, 20, CALM)); feed(seq(72, 5, BUSY));
  ok('calm, then high again more than an hour after the first: a second warning', sent.length === 2, sent.length);
  P._reset(); sent.length = 0;
  feed(seq(0, 3, BUSY)); feed(seq(10, 3, BUSY));
  ok('3 busy minutes, a gap (the PC slept), 3 busy minutes: no warning (not 5 in a row)', sent.length === 0);
  P._reset(); feed(seq(0, 3, BUSY)); feed([mk(3, BUSY, { warm: true })]); feed(seq(4, 3, BUSY));
  ok('a restart in between (a "warm" sample) starts the count again', sent.length === 0);
  P._reset(); feed(seq(0, 6, { gpu: 60 }));
  ok('mostly the graphics process: the text says so', /mostly the graphics process\./.test(sent[0] && sent[0].body), sent[0]);
  i18n.setLang('pt-BR'); P._reset(); sent.length = 0; feed(seq(0, 5, BUSY));
  ok('in Portuguese', sent[0] && sent[0].title === 'O 4horizon está usando muito processador' && /^Cerca de 59% do seu processador por 5 minutos, principalmente o painel do jogo 2\. O modo economia/.test(sent[0].body), sent[0]);
  i18n.setLang('en');
  P._reset(); P._deps.notify = () => false; feed(seq(0, 5, BUSY));
  ok('notifications off or quiet hours (nothing shown): the warning is still noted, as "not shown"', P.info().alerts.length === 1 && P.info().alerts[0].shown === false, P.info().alerts);
  P._reset(); P._deps.notify = () => { throw new Error('no notifications'); };
  threw = null; try { feed(seq(0, 5, BUSY)); } catch (e) { threw = e.message; }
  ok('a notification that fails never breaks the sampling', threw === null && P.info().alerts.length === 1, threw);
  threw = null; try { [undefined, null, {}, { t: 'x' }, { t: 1, cpu: 'x' }].forEach(s => P.onSample(s)); } catch (e) { threw = e.message; }
  ok('odd samples never throw', threw === null, threw);
  const N = require('./notify');
  ok('notify.js has the warning of the app itself (alert), next to the game events', typeof N.alert === 'function');
  N.setEnabled(false);
  ok('...and it follows the main switch: with Windows notifications off, nothing is shown', N.alert('highCpu', 'x', 'y') === false);
  N.setEnabled(true);

  // ---- 4. economy.js: the two new figures in each sample, and the warning is asked after each sample
  const E = require('./economy');
  let clock = T0; reading = 0; P._deps.cpus = () => cpuAt(100 * (reading + 1), 50 * (reading + 1), 850 * (reading++ + 1));
  Object.assign(E._deps, { now: () => clock, guests: () => ({}), window: () => null, frames: () => ({}), file: () => path.join(electron._USERDATA, 'economy-log.json'),
    metrics: () => [{ pid: 1, type: 'Browser', cpu: { percentCPUUsage: 10 }, memory: { workingSetSize: 102400, privateBytes: 40960 } }, { pid: 2, type: 'GPU', cpu: { percentCPUUsage: 6 }, memory: { workingSetSize: 51200 } }] });
  E._reset(); P._reset(); P._deps.notify = () => true;
  const s1 = await E.sample(); clock += MIN; const s2 = await E.sample();
  ok('each sample of economy.js now has the number of logical processors, and the whole PC\u2019s CPU from the second one on', s1.cores === 2 && s1.sys === undefined && s2.cores === 2 && s2.sys === 15, [s1, s2]);
  ok('...the whole PC\u2019s CPU is kept apart from the processes of the app (economy mode\u2019s own figures do not change)', s2.cpu.main === 10 && s2.cpu.gpu === 6 && !('sys' in s2.cpu), s2.cpu);
  ok('...and the private memory of the processes that have one (main 40 MB), next to the working sets (economy mode\u2019s figure stays the working set)', s2.memp && s2.memp.main === 40 && !('gpu' in s2.memp) && s2.mem.main === 100 && s2.mem.gpu === 50, [s2.memp, s2.mem]);
  ok('...and perf.js saw the samples (they reach the warning)', P._alert.last === s2);
  P._deps.samples = () => E._log().samples; P._deps.now = () => clock;
  ok('the report reads the same samples (2, the first one "warm")', P.info().history.samples === 1 && P.info().history.now.pc === 16, P.info().history);

  // ---- 5. in the Diagnostics report
  const core = require('./diag-core');
  P._reset(); const hist = P.history(seq(0, 20, CALM, { sys: 31 }).concat(seq(20, 6, BUSY, { sys: 75 }), seq(26, 20, CALM, { sys: 31 })), T0 + 46 * MIN, 4);
  const info = { history: hist, alerts: [{ ageMin: 21, pc: 59, min: 5, top: 'p2', shown: true }, { ageMin: 2, pc: 61, min: 5, top: 'gpu', shown: false }], thresholds: { highPc: 50, highMin: 5 } };
  const L = core._perfSection(info), txt = L.join('\n');
  ok('the section CPU AND MEMORY: title with the number of processors', /^CPU AND MEMORY \(.*4 logical processors\)$/.test(L[0]), L[0]);
  ok('...now: 4horizon 4% (whole PC 31%), memory (said to count shared memory: these samples have no private memory), and the processes', /\n  Now \(the sample of 60 s ago\): 4horizon 4% \(whole PC 31%\) \u00b7 memory 550 MB \(shared memory counted in each process: Task Manager shows less\) \u00b7 panel 1 2%, window 1%/.test(txt), L[1]);
  ok('...a "Now" sample older than usual (looked at right after a start, or the PC slept) says so', /Now \(the sample of 5 min ago, OLDER THAN USUAL/.test(core._perfSection({ history: P.history(seq(0, 5, CALM), T0 + 9 * MIN, 4) }).join('\n')));
  ok('slightly negative CPU figures from Electron (a first reading) count as 0, they do not lower the sum', P.history(seq(0, 3, { main: -0.5, p1: 10 }), T0 + 3 * MIN, 4).now.pc === 10 && P.history(seq(0, 3, { main: -0.5, p1: 10 }), T0 + 3 * MIN, 4).now.by.length === 1);
  const LP = core._perfSection({ history: P.history(seq(0, 5, CALM, { memp: { main: 80, win: 120, gpu: 40, p1: 90 } }), T0 + 5 * MIN, 4), alerts: [], thresholds: {} }).join('\n');
  ok('...with private memory in the samples: that one first, the working sets after it', /Now \(the sample of 60 s ago\): 4horizon 4% \u00b7 memory 330 MB private \(550 MB with shared memory counted in each process\)/.test(LP) && /average 330 MB private/.test(LP), LP.split('\n')[1]);
  ok('...the last 46 min: average, highest (59%, mostly panel 2)', /\n  Last 46 min \(46 samples\): average \d+% \(whole PC \d+%\) \u00b7 highest 59% 26 min ago, mostly panel 2/.test(txt), L[2]);
  ok('...the stretch of high CPU', /\n  High CPU \(50% or more for 5 minutes or more\): 1 time: 26 min ago for 6 min, average 59%, highest 59%, mostly panel 2/.test(txt), L[3]);
  ok('...the warnings, shown or not', /\n  Warnings: 21 min ago \(59% for 5 min, mostly panel 2; shown\); 2 min ago \(61% for 5 min, mostly graphics; NOT shown/.test(txt), L[4]);
  ok('...the last 2 hours, newest first, "-" where there was no sample', /\n  Last 2 hours, 10-minute averages, newest first: 4 \u00b7 4 \u00b7 \d+ \u00b7 \d+ \u00b7 4 \u00b7 - \u00b7 - /.test(txt), L[5]);
  ok('nothing measured yet / could not be worked out: one line that says so', /nothing measured yet/.test(core._perfSection({ history: { samples: 0 } })[1]) && /could not be worked out: boom/.test(core._perfSection({ error: 'boom' })[1]) && /nothing measured yet/.test(core._perfSection(undefined)[1]));
  P._deps.samples = () => seq(0, 10, CALM); P._deps.now = () => T0 + 10 * MIN;
  const diag = require('./diag'), c = diag.collect();
  ok('the report data has a "perf" part, and perf.js is one of the parts and watched files', c.perf && c.perf.history && c.perf.history.samples === 10 && c.features.some(f => f.file === 'perf.js' && f.ok) && c.files.some(f => f.name === 'perf.js'), c.perf && c.perf.history);
  const rep = core.analyse({ main: c, dash: null, ui: null, hideNames: true }).report;
  ok('the report text has the section, before ECONOMY MODE', rep.indexOf('\nCPU AND MEMORY (') > 0 && rep.indexOf('\nCPU AND MEMORY (') < rep.indexOf('\nECONOMY MODE'), rep.indexOf('CPU AND MEMORY'));
  ok('an old main process without the "perf" part: no section, nothing breaks', core.analyse({ main: Object.assign({}, c, { perf: undefined }), dash: null, ui: null, hideNames: true }).report.indexOf('CPU AND MEMORY') < 0);

  try { fs.rmSync(electron._USERDATA, { recursive: true, force: true }); } catch (e) {}
  out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { out('FAILED ' + (e && e.stack || e)); process.exit(1); });
