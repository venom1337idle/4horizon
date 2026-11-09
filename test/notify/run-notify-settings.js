// run-notify-settings.js: what the Settings window can read and change of the notifications
const Module = require('module'), fs = require('fs'), path = require('path');
let SHOWN = [], HANDLERS = {};
const electronStub = { app: { whenReady: () => new Promise(() => {}) }, shell: { openPath: () => Promise.resolve() },
  BrowserWindow: { getAllWindows: () => [], fromWebContents: wc => (wc && wc.ours ? {} : null) },
  ipcMain: { handle: (ch, fn) => { HANDLERS[ch] = fn; } },
  Notification: class { static isSupported() { return true; } constructor(o) { SHOWN.push(o); } on() {} show() {} } };
const origLoad = Module._load; Module._load = function (req, ...a) { return req === 'electron' ? electronStub : origLoad.call(this, req, ...a); };
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const FILE = path.join(__dirname, 'notify-settings.json'), quiet = console.log; 
function fresh(userFile) {
  try { fs.rmSync(FILE, { recursive: true, force: true }); } catch (e) {}
  if (userFile !== undefined) fs.writeFileSync(FILE, typeof userFile === 'string' ? userFile : JSON.stringify(userFile));
  Object.keys(require.cache).filter(k => /notify\.js|i18n|settings\.js/.test(k)).forEach(k => delete require.cache[k]);
  HANDLERS = {}; SHOWN = [];
  console.log = () => {};
  const N = require('./notify'); console.log = quiet; return N;
}
const read = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));
(async () => {
  let N = fresh();
  const d = N.getConfig();
  ok('the defaults: on, sound on, startup notice on, all 9 alerts on (lang-41: battle pass, daily mission, egg)', d.enabled && d.sound && d.startupNotice && Object.keys(d.events).join() === 'shiny,goodCatch,rareDrop,suppliesLow,stopped,huntUnlocked,battlePass,dailyQuest,eggReady' && Object.values(d.events).every(v => v === true), d);
  ok('the defaults of the numbers: IV 175, quality 1.7, drop 10000, supplies 1 h / 10 min, no kills 180 s, silent 120 s', d.goodCatch.minIV === 175 && d.goodCatch.minQuality === 1.7 && d.rareDrop.minValue === 10000 && d.suppliesLow.minRunwayHours === 1 && d.suppliesLow.minSampleMinutes === 10 && d.stopped.noKillsSeconds === 180 && d.stopped.silentSeconds === 120, d);

  // a change is written into the file and keeps what else the person wrote there
  N = fresh({ accountNames: { 3: 'Main' }, rareDrop: { minValue: 5000 } });
  let pokes = 0; require('./i18n').onChange(() => pokes++);
  let r = N.setConfig({ goodCatch: { minIV: 180 }, events: { shiny: false } });
  const f = read();
  ok('the answer is the new settings and says it was saved', r.saved === true && r.goodCatch.minIV === 180 && r.events.shiny === false && r.events.goodCatch === true, r);
  ok('the file has the change, and still has the account names and the person\'s own drop value', f.goodCatch.minIV === 180 && f.events.shiny === false && f.accountNames[3] === 'Main' && f.rareDrop.minValue === 5000, f);
  ok('the other numbers of the same group stay as they were (the file only holds what was changed; the rest comes from the defaults)', N.getConfig().goodCatch.minQuality === 1.7 && f.goodCatch.minQuality === undefined);
  ok('the tray menu is told to be built again (its Notifications tick follows the setting)', pokes === 1, pokes);

  // limits: nothing outside them reaches the file
  r = N.setConfig({ goodCatch: { minIV: 999, minQuality: -3 }, suppliesLow: { minRunwayHours: 0.01, minSampleMinutes: 5000 }, stopped: { noKillsSeconds: 1, silentSeconds: 1e9 }, rareDrop: { minValue: -50 } });
  ok('numbers are held inside their limits (IV 200, quality 0, runway 0.25 h, sample 240 min, 30 s, 7200 s, drop 0)', r.goodCatch.minIV === 200 && r.goodCatch.minQuality === 0 && r.suppliesLow.minRunwayHours === 0.25 && r.suppliesLow.minSampleMinutes === 240 && r.stopped.noKillsSeconds === 30 && r.stopped.silentSeconds === 7200 && r.rareDrop.minValue === 0, r);
  r = N.setConfig({ goodCatch: { minQuality: 1.2345 }, rareDrop: { minValue: 12345.6 } });
  ok('decimals: quality has 2, the others are whole numbers', r.goodCatch.minQuality === 1.23 && r.rareDrop.minValue === 12346, r);
  const before = JSON.stringify(read());
  r = N.setConfig({ goodCatch: { minIV: '190' }, enabled: 'yes', events: { shiny: 1, nothing: true }, sound: null, hacker: { x: 1 }, rareDrop: { minValue: NaN }, stopped: { silentSeconds: Infinity }, accountNames: { 1: 'x' } });
  ok('text, NaN, Infinity, 1 for true, unknown names: all ignored, the file does not change', JSON.stringify(read()) === before && r.saved === true, [r, before]);
  ok('a request that is not an object does nothing and does not throw', (() => { try { N.setConfig(null); N.setConfig('x'); N.setConfig(5); return true; } catch (e) { return false; } })());

  // the effect is immediate, with no restart and no wait for the 5 seconds of the file check
  N = fresh();
  N.setConfig({ goodCatch: { minIV: 185, minQuality: 5 } });
  const hit = iv => { SHOWN = []; console.log = () => {}; N.handle(1, { name: 'trainer2', catchEvent: { name: 'Horsea', iv: iv, max: 192, quality: 1.2, rarity: 'Rara', shiny: false }, catchSeq: iv }); console.log = quiet; return SHOWN.length; };
  ok('a catch with IV 180 no longer notifies after the minimum went to 185, one with IV 186 does', hit(180) === 0 && hit(186) === 1);
  N.setConfig({ events: { goodCatch: false }, enabled: true });
  ok('switching "Great catch" off silences it', hit(190) === 0);
  N.setConfig({ events: { goodCatch: true }, enabled: false });
  ok('switching Notifications off silences every alert (the tray tick and the window are the same setting)', hit(191) === 0 && N.isEnabled() === false);
  N.setConfig({ enabled: true, sound: false });
  SHOWN = []; N.test();
  ok('"play a sound" off: the notification is silent; on: it is not', SHOWN.length === 1 && SHOWN[0].silent === true && (N.setConfig({ sound: true }), SHOWN = [], N.test(), SHOWN[0].silent === false), SHOWN);

  // the tray and the window write the same file
  N.setEnabled(false);
  ok('the tray tick (setEnabled) shows in what the window reads', N.getConfig().enabled === false);

  // the three requests of the window: only the app\'s own window may ask
  N = fresh();
  const own = { sender: { ours: true } }, other = { sender: { ours: false } };
  ok('the three handlers exist', typeof HANDLERS['notify:get'] === 'function' && typeof HANDLERS['notify:set'] === 'function' && typeof HANDLERS['notify:test'] === 'function', Object.keys(HANDLERS));
  ok('a game panel (not our window) gets nothing, changes nothing and cannot trigger a test', (await HANDLERS['notify:get'](other)) === null && (await HANDLERS['notify:set'](other, { enabled: false })) === null && (await HANDLERS['notify:test'](other)) === false && N.isEnabled() === true);
  ok('our window reads, changes and tests', (await HANDLERS['notify:get'](own)).enabled === true && (await HANDLERS['notify:set'](own, { sound: false })).sound === false && (SHOWN = [], (await HANDLERS['notify:test'](own)) === true && SHOWN.length === 1));

  // a file that cannot be written: the answer says so
  N = fresh(); fs.rmSync(FILE, { force: true }); fs.mkdirSync(FILE);
  r = N.setConfig({ sound: false });
  ok('a settings file that cannot be written: saved is false, nothing throws', r.saved === false, r);
  fs.rmSync(FILE, { recursive: true, force: true });
  // a file with a mistake in it: the window can still change a setting (it starts again from the defaults) 
  N = fresh('{ not json'); r = N.setConfig({ events: { huntUnlocked: false } });
  ok('a settings file with a mistake in it: the change is saved over it, from the defaults', r.saved === true && r.events.huntUnlocked === false && read().goodCatch.minIV === 175, r);
  fs.rmSync(FILE, { force: true });

  // ===== quiet hours
  const at = (h, m) => new Date(2026, 9, 29, h, m, 0);
  N = fresh();
  const dq = N.getConfig().quietHours;
  ok('quiet hours default: off, 23:00 to 07:00, shinies are held back too', dq.enabled === false && dq.from === '23:00' && dq.to === '07:00' && dq.allowShiny === false, dq);
  r = N.setConfig({ quietHours: { enabled: true, from: '22:30', to: '06:15', allowShiny: true } });
  ok('quiet hours are saved (on, 22:30 to 06:15, shinies allowed) and the file keeps them', r.quietHours.enabled && r.quietHours.from === '22:30' && r.quietHours.to === '06:15' && r.quietHours.allowShiny && read().quietHours.from === '22:30', r.quietHours);
  const b4 = JSON.stringify(read());
  N.setConfig({ quietHours: { from: '24:00', to: '7:00' } }); N.setConfig({ quietHours: { from: '07:60' } }); N.setConfig({ quietHours: { to: 'abc' } }); N.setConfig({ quietHours: { from: 1230, enabled: 'yes' } }); N.setConfig({ quietHours: 'always' });
  ok('times that are not HH:MM on a 24-hour clock (24:00, 7:00, 07:60, text, numbers) and a non-boolean switch are ignored', JSON.stringify(read()) === b4, read().quietHours);

  const Q = (cfg, h, m) => N.isQuietNow({ quietHours: cfg }, at(h, m));
  const night = { enabled: true, from: '23:00', to: '07:00' }, day = { enabled: true, from: '13:00', to: '15:00' };
  ok('a window that crosses midnight (23:00 to 07:00): 23:00, 00:00, 02:00 and 06:59 are quiet; 07:00, 12:00 and 22:59 are not', [[23, 0], [0, 0], [2, 0], [6, 59]].every(t => Q(night, t[0], t[1]) === true) && [[7, 0], [12, 0], [22, 59]].every(t => Q(night, t[0], t[1]) === false));
  ok('a window inside one day (13:00 to 15:00): 13:00 and 14:59 are quiet; 12:59 and 15:00 are not', Q(day, 13, 0) && Q(day, 14, 59) && !Q(day, 12, 59) && !Q(day, 15, 0));
  ok('the same time twice, a time that cannot be read, or the switch off: never quiet', !Q({ enabled: true, from: '08:00', to: '08:00' }, 8, 0) && !Q({ enabled: true, from: 'bad', to: '07:00' }, 3, 0) && !Q({ enabled: false, from: '23:00', to: '07:00' }, 3, 0) && !N.isQuietNow({}, at(3, 0)) && !N.isQuietNow(null, at(3, 0)));

  // what it does to the alerts: the clock of the app is moved to 02:00 and to 12:00
  const realNow = Date.now;
  N = fresh(); N.setConfig({ quietHours: { enabled: true, from: '23:00', to: '07:00' } });
  const catchAt = (h, shiny, seq) => { Date.now = () => at(h, 0).getTime(); SHOWN = []; console.log = () => {}; N.handle(1, { name: 'trainer2', catchEvent: { name: 'Horsea', iv: 190, max: 192, quality: 1.9, rarity: 'Lendária', shiny: shiny }, catchSeq: seq }); console.log = quiet; return SHOWN.length; };
  ok('at 02:00 a great catch is held back, at 12:00 it is shown', catchAt(2, false, 1) === 0 && catchAt(12, false, 2) === 1);
  ok('at 02:00 a shiny is held back too (shinies are not an exception unless asked)', catchAt(2, true, 3) === 0);
  N.setConfig({ quietHours: { allowShiny: true } });
  ok('with "shinies still notify": a shiny at 02:00 is shown, a great catch is still held back', catchAt(2, true, 4) === 1 && catchAt(2, false, 5) === 0);
  Date.now = () => at(2, 0).getTime(); SHOWN = []; N.test();
  ok('"Send test notification" is shown even in quiet hours (you asked for it)', SHOWN.length === 1);
  SHOWN = []; N._show(0, 'startup', 'x', 'y', { always: true, noCooldown: true });
  ok('the "notifications are on" notice of the start is held back in quiet hours', SHOWN.length === 0);
  N.setConfig({ quietHours: { enabled: false } });
  ok('quiet hours off: everything is shown again at 02:00', catchAt(2, false, 6) === 1);
  Date.now = realNow;
  N = fresh({ quietHours: { enabled: true, from: 'bad', to: '07:00' } });
  ok('a file with an unreadable time: shown as the default time, and nothing is held back', N.getConfig().quietHours.from === '23:00' && (() => { Date.now = () => at(2, 0).getTime(); SHOWN = []; N.test(); const n = SHOWN.length; N._show(1, 'goodCatch', 'a', 'b', { noCooldown: true }); Date.now = realNow; return n === 1 && SHOWN.length === 2; })());
  fs.rmSync(FILE, { force: true });

  // ===== great catch: AND / OR
  N = fresh();
  ok('the mode is OR by default (what the app always did)', N.getConfig().goodCatch.mode === 'or', N.getConfig().goodCatch);
  const G = (mode, iv, q) => N.isGoodCatch({ iv: iv, quality: q }, { minIV: 175, minQuality: 1.7, mode: mode });
  const table = [[190, 1.2, true, false], [160, 1.9, true, false], [190, 1.9, true, true], [160, 1.2, false, false], [175, 1.7, true, true], [174, 1.7, true, false], [175, 1.69, true, false], [174, 1.69, false, false]];
  ok('OR: at least one of the two reaches its number (IV 190 q 1.2, IV 160 q 1.9, both, exactly the numbers); neither does not', table.every(r => G('or', r[0], r[1]) === r[2]), table.filter(r => G('or', r[0], r[1]) !== r[2]));
  ok('AND: only when both do (IV 190 q 1.2 and IV 160 q 1.9 are NOT enough; both, and exactly the numbers, are)', table.every(r => G('and', r[0], r[1]) === r[3]), table.filter(r => G('and', r[0], r[1]) !== r[3]));
  ok('a missing quality is not enough: AND says no, OR still works on the IV', G('and', 190, undefined) === false && G('or', 190, undefined) === true && G('or', 100, undefined) === false);
  ok('with AND, a 0 makes that number count for nothing (IV 0: only the quality decides); with OR, a number above the highest does the same', N.isGoodCatch({ iv: 10, quality: 1.8 }, { minIV: 0, minQuality: 1.7, mode: 'and' }) === true && N.isGoodCatch({ iv: 10, quality: 1.6 }, { minIV: 0, minQuality: 1.7, mode: 'and' }) === false && N.isGoodCatch({ iv: 190, quality: 0.5 }, { minIV: 200, minQuality: 1.7, mode: 'or' }) === false && N.isGoodCatch({ iv: 10, quality: 1.8 }, { minIV: 200, minQuality: 1.7, mode: 'or' }) === true);
  ok('anything but "and" in the file counts as OR; "AND" written by hand in capitals counts as AND', G('xor', 190, 1.2) === true && G(undefined, 190, 1.2) === true && G(7, 190, 1.2) === true && G('AND', 190, 1.2) === false && G('And', 190, 1.9) === true);

  r = N.setConfig({ goodCatch: { mode: 'and' } });
  ok('"and" is saved and read back, and the file has it next to the numbers that were already there', r.goodCatch.mode === 'and' && read().goodCatch.mode === 'and' && r.goodCatch.minIV === 175 && r.saved, r.goodCatch);
  const before3 = JSON.stringify(read());
  N.setConfig({ goodCatch: { mode: 'AND' } }); N.setConfig({ goodCatch: { mode: 'xor' } }); N.setConfig({ goodCatch: { mode: 1 } }); N.setConfig({ goodCatch: { mode: null } }); N.setConfig({ goodCatch: { mode: ['or'] } });
  ok('what is not exactly "and" or "or" (capitals, other words, numbers, null, a list) is ignored: the file does not change', JSON.stringify(read()) === before3 && N.getConfig().goodCatch.mode === 'and', read().goodCatch);
  r = N.setConfig({ goodCatch: { mode: 'or', minIV: 180 } });
  ok('the mode and a number can change in one request', r.goodCatch.mode === 'or' && r.goodCatch.minIV === 180, r.goodCatch);
  fresh({ goodCatch: { mode: 'AND' } }); N = require('./notify'); 
  ok('a file written by hand with "AND": the window reads it as "and"', N.getConfig().goodCatch.mode === 'and', N.getConfig().goodCatch);

  // what it does to the alerts
  N = fresh({ goodCatch: { mode: 'and', minIV: 175, minQuality: 1.7 } });
  const catchN = (iv, q, seq) => { SHOWN = []; console.log = () => {}; N.handle(1, { name: 'trainer2', catchEvent: { name: 'Horsea', iv: iv, max: 192, quality: q, rarity: 'Rara', shiny: false }, catchSeq: seq }); console.log = quiet; return SHOWN.length; };
  ok('AND: a catch with a great IV and an ordinary quality does not notify; one with both does', catchN(190, 1.2, 1) === 0 && catchN(190, 1.9, 2) === 1);
  N.setConfig({ goodCatch: { mode: 'or' } });
  ok('switching to OR: the first of those notifies now (immediately, no restart)', catchN(190, 1.2, 3) === 1 && catchN(160, 1.2, 4) === 0);
  N.setConfig({ goodCatch: { mode: 'and' } }); SHOWN = []; console.log = () => {}; N.handle(1, { name: 'trainer2', catchEvent: { name: 'Gengar', iv: 20, max: 192, quality: 0.8, rarity: 'Fraca', shiny: true }, catchSeq: 5 }); console.log = quiet;
  ok('a shiny notifies in both modes (the mode is only about great catches)', SHOWN.length === 1 && /Shiny/.test(SHOWN[0].title), SHOWN);
  // ---- lang-70: a second rule of Great catch (the example of the request: IV 130 AND quality 1.75, or IV 170 alone)
  N = fresh();
  const g2 = N.getConfig().goodCatch2;
  ok('the 2nd rule: off at first, IV 170 OR quality 5 (so with OR only the IV counts), and the first rule is unchanged', g2 && g2.enabled === false && g2.minIV === 170 && g2.minQuality === 5 && g2.mode === 'or' && N.getConfig().goodCatch.minIV === 175, g2);
  r = N.setConfig({ goodCatch: { minIV: 130, minQuality: 1.75, mode: 'and' } });
  ok('first rule set to IV 130 AND quality 1.75', r.goodCatch.minIV === 130 && r.goodCatch.minQuality === 1.75 && r.goodCatch.mode === 'and' && r.goodCatch2.enabled === false, r.goodCatch);
  let seq2 = 100;
  ok('with the 2nd rule off: IV 135 + quality 1.8 notifies (rule 1), IV 172 + quality 1.0 does not', catchN(135, 1.8, ++seq2) === 1 && catchN(172, 1.0, ++seq2) === 0);
  r = N.setConfig({ goodCatch2: { enabled: true } });
  ok('"Active" ticked: saved in the file as goodCatch2.enabled = true, the numbers of the 2nd rule stay', r.saved && r.goodCatch2.enabled === true && read().goodCatch2.enabled === true && r.goodCatch2.minIV === 170, r.goodCatch2);
  ok('...now IV 172 + quality 1.0 notifies too (rule 2), immediately, as "Great catch"', catchN(172, 1.0, ++seq2) === 1 && /Great catch/.test(SHOWN[0].title), SHOWN);
  ok('...IV 135 + quality 1.8 still notifies (rule 1), and IV 135 + quality 1.2 (neither rule) does not', catchN(135, 1.8, ++seq2) === 1 && catchN(135, 1.2, ++seq2) === 0);
  ok('...a catch that meets both rules notifies once, not twice', catchN(180, 1.9, ++seq2) === 1);
  r = N.setConfig({ goodCatch2: { minIV: 999, minQuality: 1.234, mode: 'and' } });
  ok('the 2nd rule\u2019s numbers are held inside the same limits (IV 200, quality with 2 decimals), and AND is saved', r.goodCatch2.minIV === 200 && r.goodCatch2.minQuality === 1.23 && r.goodCatch2.mode === 'and', r.goodCatch2);
  const before70 = JSON.stringify(read());
  N.setConfig({ goodCatch2: { enabled: 'yes', mode: 'AND', minIV: 'x' } }); N.setConfig({ goodCatch2: 5 });
  ok('...and what makes no sense ("yes", "AND", a word for a number, a number for the rule) changes nothing', JSON.stringify(read()) === before70, read().goodCatch2);
  r = N.setConfig({ goodCatch2: { enabled: false } });
  ok('unticked again: only rule 1 counts (IV 200 AND 1.23 does not matter any more)', r.goodCatch2.enabled === false && catchN(172, 1.0, ++seq2) === 0);
  N = fresh({ goodCatch2: { enabled: 'true', minIV: 150 } });
  ok('a file written by hand with enabled "true" (a word): the 2nd rule stays off', N.getConfig().goodCatch2.enabled === false && catchN(160, 1.0, 1) === 0, N.getConfig().goodCatch2);
  // ---- lang-54: leaving the hunt (the city) is told only after the "No kills" time, not after 20 s
  N = fresh({ stopped: { noKillsSeconds: 500, silentSeconds: 500 } });
  let t = Date.now(); const realNow54 = Date.now; Date.now = () => t;
  const stopsShown = () => SHOWN.filter(n => /Stopped hunting/.test(n.title)).length;
  N.handle(2, { name: 'trainer2', startedAt: 7, active: true, defeated: 5 }); N.handle(2, { startedAt: 7, active: false });
  t += 30000; N._watch();
  ok('left the hunt (went to the city), 30 s later: no alert yet (No kills = 500 s; it was 20 s before)', stopsShown() === 0, SHOWN.map(n => n.title));
  t += 400000; N._watch();
  ok('...430 s later: still none', stopsShown() === 0);
  t += 80000; N._watch();
  ok('...after 500 s away: "Stopped hunting"', stopsShown() === 1 && /trainer2 is no longer hunting/.test(SHOWN.filter(n => /Stopped hunting/.test(n.title))[0].body), SHOWN.map(n => n.title + ' | ' + n.body));
  N.handle(3, { name: 'trainer3', startedAt: 8, active: true, defeated: 5 }); N.handle(3, { startedAt: 8, active: false });
  t += 200000; N.handle(3, { startedAt: 8, active: true, defeated: 6 }); t += 400000; N._watch();
  ok('back to hunting within the time (sold, came back): no alert at all', stopsShown() === 1);
  N = fresh({ stopped: { noKillsSeconds: 30, silentSeconds: 500 } });
  N.handle(1, { name: 'trainer1', startedAt: 9, active: true, defeated: 5 }); N.handle(1, { startedAt: 9, active: false });
  t += 25000; N._watch(); const early = stopsShown(); t += 10000; N._watch();
  ok('with the shortest "No kills" (30 s): told after 30 s, never before', early === 0 && stopsShown() === 1);
  Date.now = realNow54;
  fs.rmSync(FILE, { force: true });
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
