// run-economy.js: economy.js (economy mode in the main process and its measurements) and the ECONOMY MODE section of the Diagnostics report
const fs = require('fs'), os = require('os'), path = require('path');
const E = require('./economy');
const H = require('./diag-core');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x).slice(0, 700))); c ? pass++ : fail++; };

// ---- made-up hours: one sample a minute
const T0 = Date.UTC(2026, 10, 1, 10, 0, 0);
function hours(parts, opt) {
  opt = opt || {};
  const samples = []; let t = T0, k = { 1: 0, 2: 0 }, x = { 1: 0, 2: 0 }, msg = { 1: 0, 2: 0 };
  parts.forEach(p => {
    for (let i = 0; i < p.min; i++) {
      t += p.gapMs && i === 0 ? p.gapMs : 60000;
      const s = { t: t, eco: p.eco, cpu: { main: 2, win: p.eco ? 0.5 : 3, gpu: p.eco ? 1 : 6, p1: p.eco ? 3 : 10, p2: p.eco ? 3 : 10, other: 0.5 }, mem: { main: 150, win: 200, gpu: 300, p1: 700, p2: 700 }, page: {}, acc: {}, msg: {} };
      [1, 2].forEach(n => {
        const kpm = (p.kpm || {})[n] !== undefined ? p.kpm[n] : 13;
        k[n] += kpm; x[n] += kpm * 3000; msg[n] += (p.mpm || {})[n] !== undefined ? p.mpm[n] : 40;
        s.acc[n] = { sid: (p.sid || {})[n] || 'S' + n, hunt: (p.hunt || {})[n] || 'Crateras', k: k[n], x: x[n] };
        s.msg[n] = msg[n];
        s.page[n] = p.err ? { err: true } : { n: 60, avg: (p.late || 0) / 2, max: p.late || 300, vis: p.eco && !p.visible ? 'hidden' : 'visible' };
      });
      if (p.warmFirst && i === 0) s.warm = true;
      samples.push(s);
    }
  });
  return { v: 1, samples: samples, events: opt.events || [{ t: T0, on: true }] };
}
const report = (econ, extra) => H.analyse(Object.assign({ main: { meta: { app: '4horizon', version: '1.0.0', build: 'x' }, economy: econ }, dash: { accounts: [{ n: 1, name: 'trainer1', nameKnown: true }, { n: 2, name: 'trainer2', nameKnown: true }] }, ui: {} }, extra || {})).report;
const sec = r => { const i = r.indexOf('ECONOMY MODE'); return i < 0 ? '' : r.slice(i, r.indexOf('\n\n', i)); };

// ---------------------------------------------------------------------------------------------------- analyse: the verdicts
let a = E.analyse(hours([{ eco: false, min: 60 }, { eco: true, min: 60 }]), null, { on: true, sinceSec: 3600 });
ok('the same hunt, the same pace in both modes: "normal" for each account, kills/h 780 in both, XP/h 2,340,000', a.acc[1].verdict === 'normal' && a.acc[2].verdict === 'normal' && a.acc[1].hunt === 'Crateras' && a.acc[1].on.kph === 780 && a.acc[1].off.kph === 780 && a.acc[1].on.xph === 2340000, a.acc[1]);
ok('...time measured: 59 min off (the first sample has nothing before it), 60 min on', a.time.off === 59 && a.time.on === 60, a.time);
ok('...resources: CPU 31.5% off, 10% on (game panels 20 → 6, graphics 6 → 1, window 3 → 0.5); memory the same', a.res.off.cpu === 31.5 && a.res.on.cpu === 10 && a.res.off.cpuPanels === 20 && a.res.on.cpuPanels === 6 && a.res.on.cpuGpu === 1 && a.res.on.cpuWin === 0.5 && a.res.off.mem === 2050, a.res);
ok('...the pages counted as hidden in economy mode, the timer on time, the game messages the same', a.acc[1].hiddenOn === 1 && !a.acc[1].slowTimers && !a.acc[1].fewMsgs && a.acc[1].msgPerMin.on === 40 && a.acc[1].msgPerMin.off === 40, a.acc[1]);
let r = sec(report(Object.assign(a, { events: 1 })));
ok('report: what it is, now on for 1h, the time measured and how often it was turned on or off', /^ECONOMY MODE \(turned on and off by hand; once a minute/.test(r) && /\n  Now: ON for 1h 00m · measured: on 1h 00m, off 59 min · turned on or off 1 times/.test(r), r);
ok('report: "Saving: YES, CPU −68%", memory, and the figures of each mode (game panels, graphics, window)', /\n  Saving: YES, CPU −68% · memory 2 GB → 2 GB\n    off: CPU 31.5% \(game panels 20%, graphics 6%, window 3%\) · memory 2 GB · 59 samples\n    on : CPU 10% \(game panels 6%, graphics 1%, window 0.5%\) · memory 2 GB · 60 samples/.test(r), r);
ok('report: "Game screens not drawn: yes" with the accounts', /\n  Game screens not drawn: yes \(the game pages count as hidden in economy mode: Account 1 \(trainer\d\), Account 2 \(trainer2\)\)/.test(r), r);
ok('report: each account "hunting normally" with the hunt, kills/h and XP/h off → on, then messages and the timer', /\n  Account 1 \(trainer\d\): hunting normally · Crateras: kills\/h 780 off \(59 min\) → 780 on \(1h 00m\), XP\/h 2,340,000 → 2,340,000\n      game messages\/min 40 off → 40 on · 1-second timer in economy mode: 0 s late on average, at most 0.3 s/.test(r), r.slice(r.indexOf('  Account 1')));

a = E.analyse(hours([{ eco: false, min: 40 }, { eco: true, min: 40, kpm: { 2: 5 }, late: 58000, mpm: { 2: 12 } }]));
ok('account 2 at 5 kills/min instead of 13 in economy mode: "slower" (0.38), its timer 58 s late and fewer messages are flagged; account 1 normal', a.acc[2].verdict === 'slower' && a.acc[2].ratio === 0.38 && a.acc[2].slowTimers && a.acc[2].fewMsgs && a.acc[1].verdict === 'normal' && a.acc[1].slowTimers, [a.acc[1], a.acc[2]]);
r = sec(report(a));
ok('report: "SLOWER in economy mode", "(SLOWED DOWN BY THE BROWSER)", "(FEWER)"', /\n  Account 2 \(trainer2\): SLOWER in economy mode · Crateras: kills\/h 780 off \(39 min\) → 300 on \(40 min\)/.test(r) && /game messages\/min 40 off → 12 on \(FEWER\) · 1-second timer in economy mode: 29 s late on average, at most 58 s \(SLOWED DOWN BY THE BROWSER\)/.test(r), r);
ok('...account 1, as slowed but hunting normally, says it calmly: "(slowed by the browser; the hunt was not affected)"', /\n  Account 1 \(trainer\d\): hunting normally[^\n]*\n[^\n]*at most 58 s \(slowed by the browser; the hunt was not affected\)\n/.test(r), r.slice(r.indexOf('  Account 1')));
a = E.analyse(hours([{ eco: false, min: 30 }, { eco: true, min: 30, kpm: { 1: 0 } }]));
ok('no kills at all in economy mode for 30 min: "stalled" → "NOT HUNTING in economy mode (no kills)"', a.acc[1].verdict === 'stalled' && /Account 1 \(trainer\d\): NOT HUNTING in economy mode \(no kills\)/.test(sec(report(a))), a.acc[1]);
a = E.analyse(hours([{ eco: false, min: 30 }, { eco: true, min: 30, kpm: { 1: 12 } }]));
ok('12 kills/min instead of 13 (92%): still "normal" (a few percent is the usual wobble)', a.acc[1].verdict === 'normal' && a.acc[1].ratio === 0.92, a.acc[1]);
a = E.analyse(hours([{ eco: false, min: 12 }, { eco: true, min: 15 }]));
ok('only 11 min off and 15 on: "not enough", with the most time so far in each mode', a.acc[1].verdict === 'not enough' && a.acc[1].most.on === 15 && a.acc[1].most.off === 11 && !a.acc[1].hunt, a.acc[1]);
r = sec(report(a));
ok('report: "not enough time on one hunt to compare (it needs 20 min in each mode on the same hunt; the most so far: on 15 min, off 11 min)" and "Saving: not known yet" under 10 samples... here 11 and 15: known', /not enough time on one hunt to compare \(it needs 20 min in each mode on the same hunt; the most so far: on 15 min, off 11 min\)/.test(r) && /Saving: YES/.test(r), r);
a = E.analyse(hours([{ eco: false, min: 5 }, { eco: true, min: 30 }]));
ok('...with 4 minutes off: "Saving: not known yet (it needs 10 minutes in each mode; so far on 30, off 4)"', /\n  Saving: not known yet \(it needs 10 minutes in each mode; so far on 30, off 4\)/.test(sec(report(a))), sec(report(a)));
a = E.analyse(hours([{ eco: false, min: 40, hunt: { 1: 'Crateras' } }, { eco: true, min: 40, hunt: { 1: 'Vulcão' }, sid: { 1: 'S9' } }]));
ok('a different hunt in each mode: not compared ("not enough"; the minute across the new session is not counted: 39), account 2 on one hunt is compared', a.acc[1].verdict === 'not enough' && a.acc[1].most.on === 39 && a.acc[2].verdict === 'normal', [a.acc[1], a.acc[2]]);
a = E.analyse(hours([{ eco: false, min: 30 }, { eco: true, min: 30, gapMs: 3 * 3600e3 }]));
ok('a 3-hour gap (the app was closed): the minute across it is not counted (29 off, 29 on)', a.time.off === 29 && a.time.on === 29 && a.acc[1].on.min === 29, [a.time, a.acc[1].on]);
const mixed = hours([{ eco: false, min: 30 }, { eco: null, min: 1 }, { eco: true, min: 30, warmFirst: true }]);
a = E.analyse(mixed);
ok('the minute in which the mode changed counts for neither; a "warm" sample (the first after a start) is left out of CPU only', a.time.off === 29 && a.time.on === 30 && a.res.on.n === 29 && a.res.off.n === 29, [a.time, a.res.on.n, a.res.off.n]);
const lg = hours([{ eco: false, min: 30 }, { eco: true, min: 30 }]); const base = lg.samples[44].acc[1].k; lg.samples.slice(45).forEach(x => { x.acc[1].k -= base - 3; });
a = E.analyse(lg);
ok('a counter that starts again from nearly 0 (a new session with the same start time) is not counted as kills; the minute across it is skipped: the pace stays right', a.acc[1].verdict === 'normal' && a.acc[1].on.kph === 780 && a.acc[1].on.min === 29, a.acc[1]);
a = E.analyse(hours([{ eco: false, min: 30 }, { eco: true, min: 30, visible: true }]));
r = sec(report(a));
ok('pages still counted as visible in economy mode: "Game screens not drawn: NO for Account 1 (trainer1) (hidden in 0% of the samples), ...: the browser kept drawing it"', /\n  Game screens not drawn: NO for Account 1 \(trainer\d\) \(hidden in 0% of the samples\), Account 2 \(trainer2\) \(hidden in 0% of the samples\): the browser kept drawing it/.test(r), r);
a = E.analyse(hours([{ eco: false, min: 30 }, { eco: true, min: 30, err: true }]));
ok('pages that did not answer are counted ("the page did not answer 30 times in economy mode")', a.acc[1].noAnswerOn === 30 && /the page did not answer 30 times in economy mode/.test(sec(report(a))), a.acc[1]);
a = E.analyse(hours([{ eco: false, min: 30 }, { eco: true, min: 30 }]));
const more = JSON.parse(JSON.stringify(a)); more.res.on.cpu = 50;
ok('economy mode with MORE CPU than without: "Saving: NO, economy mode used MORE CPU (+59%)"', /Saving: NO, economy mode used MORE CPU \(\+59%\)/.test(sec(report(more))), sec(report(more)));
more.res.on.cpu = 30;
ok('...and nearly the same: "Saving: LITTLE (CPU −5%)"', /Saving: LITTLE \(CPU −5%\)/.test(sec(report(more))), sec(report(more)));
r = sec(report(E.analyse({ samples: [], events: [] }, null, { on: false, sinceSec: 5 })));
ok('nothing measured yet: says so plainly, no "undefined" or "NaN"', /Now: off · measured: on 0 min, off 0 min/.test(r) && /Saving: not known yet/.test(r) && /Game screens not drawn: not known yet/.test(r) && /Accounts: nothing measured yet/.test(r) && !/undefined|NaN/.test(r), r);
r = report(E.analyse(hours([{ eco: false, min: 30 }, { eco: true, min: 30 }])), { hideNames: true });
ok('"Hide character names": "Account 1" with no name in the section', /Account 1: hunting normally/.test(sec(r)) && !/trainer\d/.test(sec(r)), sec(r));
ok('an older app without economy.js: no section, no error', report(undefined).indexOf('ECONOMY MODE') < 0);
r = sec(report({ error: 'boom' }));
ok('an error while working it out is shown, not hidden', /could not be worked out: boom/.test(r), r);
r = sec(report(Object.assign(E.analyse({ samples: [], events: [] }, null, { on: true, sinceSec: 7300 }), { saveError: 'EACCES' })));
ok('saving the measurements failed: said in the "Now" line', /Now: ON for 2h 02m · .* · SAVING THE MEASUREMENTS FAILED \(EACCES\)/.test(r), r);

// ---------------------------------------------------------------------------------------------------- sample(), set(), the file
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eco-'));
  let clock = T0;
  const calls = [];
  const guest = (n, opt) => ({ isDestroyed: () => false, getOSProcessId: () => 100 + n, muted: null, setAudioMuted(v) { this.muted = v; },
    executeJavaScriptInIsolatedWorld: (world, scripts) => { calls.push({ n: n, world: world, code: scripts[0].code }); return opt && opt.hang ? new Promise(() => {}) : Promise.resolve(opt && opt.fresh ? { fresh: true, vis: 'visible' } : { n: 60, avg: 120.4, max: 900.6, vis: opt && opt.vis || 'hidden' }); } });
  const guests = { 1: guest(1), 2: guest(2, { hang: true }), 3: guest(3, { fresh: true }) };
  const win = { isDestroyed: () => false, webContents: { getOSProcessId: () => 50, executeJavaScript: code => Promise.resolve(code.indexOf('__4hEcoSample') >= 0 ? { 1: { sid: '1700', hunt: 'Crateras', k: 120, x: 5000 }, 2: { sid: 7, hunt: 'X', k: 'bad' }, 3: null } : null) } };
  Object.assign(E._deps, { now: () => clock, guests: () => guests, window: () => win, frames: () => ({ 1: { total: 500 }, 3: { total: 'x' } }), file: () => path.join(tmp, 'economy-log.json'),
    metrics: () => [{ pid: 1, type: 'Browser', cpu: { percentCPUUsage: 2.04 }, memory: { workingSetSize: 150 * 1024 } }, { pid: 50, type: 'Tab', cpu: { percentCPUUsage: 3 }, memory: { workingSetSize: 300 * 1024 } },
      { pid: 101, type: 'Tab', cpu: { percentCPUUsage: 9.5 }, memory: { workingSetSize: 700 * 1024 } }, { pid: 102, type: 'Tab', cpu: { percentCPUUsage: 1 }, memory: { workingSetSize: 650 * 1024 } },
      { pid: 77, type: 'GPU', cpu: { percentCPUUsage: 6 }, memory: { workingSetSize: 400 * 1024 } }, { pid: 88, type: 'Utility', cpu: { percentCPUUsage: 0.5 }, memory: { workingSetSize: 50 * 1024 } }, { pid: 89, type: 'Utility', cpu: {}, memory: {} }] });
  E._reset();
  let s = await E.sample();
  ok('a sample: CPU and memory by what each process is (the app, the window, each game panel by its process, graphics, the rest)', JSON.stringify(s.cpu) === JSON.stringify({ main: 2, win: 3, p1: 9.5, p2: 1, gpu: 6, other: 0.5 }) && s.mem.p1 === 700 && s.mem.win === 300 && s.mem.other === 50, s);
  ok('...the first one after the start is marked "warm" (its CPU figure covers an unknown time)', s.warm === true);
  ok('...each game page: the timer ran in an isolated world (1047), not in the game\u2019s own code; numbers rounded; a page that hangs is "did not answer" after 4 s; a fresh page has no timer figures yet', calls.every(c => c.world === 1047 && c.code === E.PROBE) && JSON.stringify(s.page[1]) === JSON.stringify({ n: 60, avg: 120, max: 901, vis: 'hidden' }) && s.page[2].err === true && JSON.stringify(s.page[3]) === JSON.stringify({ fresh: true, vis: 'visible' }) && !s.page[4], s.page);
  ok('...each account: the counters the window has (only good ones: a "bad" kill count is left out); the messages counted', JSON.stringify(s.acc) === JSON.stringify({ 1: { sid: '1700', hunt: 'Crateras', k: 120, x: 5000 } }) && JSON.stringify(s.msg) === JSON.stringify({ 1: 500 }), [s.acc, s.msg]);
  ok('...the mode of the minute: off', s.eco === false);
  guests[2] = guest(2);                                   // (from here on the second page answers: a page that hangs costs 4 s a sample)
  clock += 60000; s = await E.sample();
  ok('the next sample is not "warm"', !s.warm);
  const st = E.set(true);
  ok('turning it on: on, since now, the game panels muted, the change noted and saved to the disk at once', st.on === true && st.since === clock && guests[1].muted === true && guests[3].muted === true && E._log().events.some(e => e.on === true) && JSON.parse(fs.readFileSync(path.join(tmp, 'economy-log.json'), 'utf8')).events.some(e => e.on === true), st);
  clock += 60000; s = await E.sample();
  ok('...the minute in which it changed counts for neither mode (eco: null)', s.eco === null);
  clock += 60000; s = await E.sample();
  ok('...the next one counts as on', s.eco === true);
  E.set(true);
  clock += 60000; s = await E.sample();
  ok('turning it on again while on changes nothing (the minute still counts as on)', s.eco === true && E._log().events.filter(e => e.on === true).length === 1);
  E.set(false);
  ok('turning it off: the game panels are not muted any more', guests[1].muted === false && E._state().on === false);
  E.set('yes');
  ok('only true turns it on ("yes" does not)', E._state().on === false);
  // saved at most every 5 minutes while sampling
  const f = path.join(tmp, 'economy-log.json');
  const n0 = JSON.parse(fs.readFileSync(f, 'utf8')).samples.length;
  clock += 60000; await E.sample(); const n1 = JSON.parse(fs.readFileSync(f, 'utf8')).samples.length;
  clock += 5 * 60000; await E.sample(); const n2 = JSON.parse(fs.readFileSync(f, 'utf8')).samples.length;
  ok('the samples are written to the disk at most every 5 minutes (not after one minute, yes after five)', n1 === n0 && n2 === E._log().samples.length, [n0, n1, n2]);
  // 24 hours only
  for (let i = 0; i < 30; i++) { clock += 3600e3; await E.sample(); }
  ok('only the last 24 hours are kept', E._log().samples.every(x => x.t >= clock - 24 * 3600e3) && E._log().samples.length <= 25, E._log().samples.length);
  // a restart while it was on
  E.set(true); clock += 60000; await E.sample(); E.save();
  E._reset(); E.load();
  const ev = E._log().events;
  ok('after a restart the saved samples are read back; a mode that was on when the app stopped is closed with a "stop" (the app starts with it off)', E._log().samples.length > 0 && ev[ev.length - 1].stop === true && ev[ev.length - 1].on === false && E._state().on === false, ev.slice(-2));
  ok('...and that "stop" is not counted as a change in the report', E.info().events === ev.filter(e => !e.stop).length);
  fs.writeFileSync(f, '{not json'); E._reset(); E.load();
  ok('a damaged file is ignored (nothing breaks, nothing kept)', E._log().samples.length === 0);
  fs.writeFileSync(f, JSON.stringify({ samples: [{ t: clock, cpu: {} }, { t: 'x', cpu: {} }, null, { t: clock }], events: [{ t: clock, on: true }, { t: 'bad' }] })); E._reset(); E.load();
  ok('...and from a file with some bad entries only the good ones are kept', E._log().samples.length === 1 && E._log().events.length === 2 && E._log().events[1].stop === true, E._log());
  // a disk that refuses
  E._deps.file = () => path.join(tmp, 'no-such-folder', 'x.json');
  E._reset(); E.set(true);
  ok('when the file cannot be written the report says so (save error)', /ENOENT/.test(E.info().saveError || ''), E.info().saveError);
  // the probe itself, in a real page
  const { chromium } = require('./pw');
  const b = await chromium.launch(), p = await b.newPage();
  await p.setContent('<p>game</p>');
  let pr = await p.evaluate(E.PROBE);
  ok('the probe in a real page: the first question starts the timer ("fresh") and says the page is visible', pr.fresh === true && pr.vis === 'visible', pr);
  await p.waitForTimeout(3300);
  pr = await p.evaluate(E.PROBE);
  ok('...three seconds later: about 3 ticks, nearly on time', pr.n >= 2 && pr.n <= 4 && pr.max < 400 && pr.avg < 200 && pr.vis === 'visible', pr);
  await p.evaluate(() => { const t = performance.now(); while (performance.now() - t < 3000) {} });       // the page is busy for 3 s, as a slowed-down page would be
  await p.waitForTimeout(1500);
  pr = await p.evaluate(E.PROBE);
  ok('...a page busy for 3 seconds: the timer was about 2 s late, and it is seen', pr.max >= 1800 && pr.max < 4000, pr);
  await p.evaluate(() => { const t = performance.now(); while (performance.now() - t < 2500) {} });
  pr = await p.evaluate(E.PROBE);
  ok('...even a delay that is still going on when it is asked (no tick since) is counted', pr.max >= 1400, pr);
  ok('...the probe leaves one object on the page and nothing else (in the app it lives in an isolated world the game cannot see)', await p.evaluate(() => Object.keys(window).filter(k => /4h/i.test(k)).join()) === '__4hEcoProbe');
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
