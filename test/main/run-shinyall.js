// run-shinyall.js (lang-71): the shinies of all time (the game's Perfil: "Shiny (capturas/gastas) 5/512") and the shinies met per day.
//  1. shinyall.js: the Perfil answer is kept per character, what the reader counts after it is added, it is saved and read again, odd input changes nothing
//  2. the reader, fed with fake game messages: Perfil (profile-stats), throws at shinies, the window gets shinyAll; a hunt session passes shinyKills
//  3. history.js: the shinies met are added up per day (only from two messages that both have the counter)
const fs = require('fs'), path = require('path'), os = require('os');
process.env.HG_USERDATA = fs.mkdtempSync(path.join(os.tmpdir(), '4h-shinyall-'));
const electron = require('electron');
const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const real = console.log; console.log = () => {};
const SA = require('./shinyall');
try { fs.unlinkSync(SA.FILE); } catch (e) {}
SA._reset();

// ---- 1. the module
ok('a character whose Perfil was never opened: nothing (null), and throws are not added to anything', SA.view(1, 'trainer1') === null && SA.add(1, 'trainer1', 3, 1) === false);
ok('the Perfil answer is kept (5 captured, 512 balls)', SA.profile(1, 'trainer1', { type: 'profile-stats', shinyCaught: 5, shinyBalls: 512, rank: 3, trainers: 1520 }) === true && JSON.stringify([SA.view(1, 'trainer1').caught, SA.view(1, 'trainer1').balls]) === '[5,512]');
SA.add(1, 'trainer1', 3, 0); SA.add(1, 'trainer1', 1, 1);
let v = SA.view(1, 'trainer1');
ok('throws at shinies counted after it are added: 4 balls and 1 capture more = 6 / 516 (and how much was counted since)', v.caught === 6 && v.balls === 516 && v.sinceBalls === 4 && v.sinceCaught === 1, v);
ok('...another character is apart', SA.view(2, 'trainer2') === null);
SA.save(); SA._reset();
v = SA.view(1, 'trainer1');
ok('saved in the user-data folder and read again after a restart: still 6 / 516', fs.existsSync(SA.FILE) && path.dirname(SA.FILE) === electron._USERDATA && v && v.caught === 6 && v.balls === 516, [SA.FILE, v]);
SA.profile(1, 'trainer1', { shinyCaught: 7, shinyBalls: 530 });
v = SA.view(1, 'trainer1');
ok('Perfil opened again: the game\u2019s numbers count (7 / 530), what was counted since starts again from 0', v.caught === 7 && v.balls === 530 && v.sinceBalls === 0 && v.sinceCaught === 0, v);
const before = JSON.stringify(SA.view(1, 'trainer1'));
[{ shinyCaught: 'many', shinyBalls: 5 }, { shinyCaught: -1, shinyBalls: 5 }, { shinyCaught: 5 }, null, 'x', { shinyCaught: Infinity, shinyBalls: 1 }].forEach(m => SA.profile(1, 'trainer1', m));
SA.add(1, 'trainer1', -5, 'x'); SA.add(1, 'trainer1', NaN, NaN);
ok('odd answers (a word, below 0, a missing number, not an object, infinity) and odd counts change nothing', JSON.stringify(SA.view(1, 'trainer1')) === before, SA.view(1, 'trainer1'));
ok('odd names are refused (empty, not text, too long)', SA.profile(1, '', { shinyCaught: 1, shinyBalls: 1 }) === false && SA.profile(1, 5, { shinyCaught: 1, shinyBalls: 1 }) === false && SA.profile(1, 'x'.repeat(41), { shinyCaught: 1, shinyBalls: 1 }) === false);
fs.writeFileSync(SA.FILE, '{ broken'); SA._reset();
ok('a broken file: nothing known, nothing thrown', SA.view(1, 'trainer1') === null);
SA.profile(1, 'trainer1', { shinyCaught: 5, shinyBalls: 512 });
const I = SA.info();
ok('the report knows per ACCOUNT (never names) whether Perfil was opened, how long ago, and what was counted since', I.accounts.length === 1 && I.accounts[0].n === 1 && I.accounts[0].known === true && I.accounts[0].sinceBalls === 0 && !JSON.stringify(I).includes('trainer1'), I);

// ---- 2. the reader
function loadReader() { Object.keys(require.cache).forEach(k => { if (/ws-reader\.js|shinyballs\.js/.test(k)) delete require.cache[k]; }); return require('./ws-reader'); }
function rig(R, account) {
  const sent = []; let h;
  R.attachReader({ debugger: { attach() {}, isAttached: () => true, sendCommand: async () => {}, on(e, f) { if (e === 'message') h = f; } }, isDestroyed: () => false, once() {}, on() {}, executeJavaScript: async () => '' }, account, (a, d) => sent.push(d));
  return { sent, feed: o => h({}, 'Network.webSocketFrameReceived', { response: { payloadData: typeof o === 'string' ? o : JSON.stringify(o) } }) };
}
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const pending = (n, shiny) => ({ type: 'pending', list: [{ id: id(n), shiny: shiny, speciesId: 123, level: 100, slot: 1, x: 1, y: 2, expiresAt: 5, investedValue: 0 }] });
const thr = (n, ball, success, shiny) => ({ type: 'catch-result', pendingId: id(n), ballId: ball, success: success, speciesId: 123, auto: true, investedValue: 3, pokemon: success ? { id: '5', speciesId: 123, shiny: shiny, level: 100, quality: 1.2, growth: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 } } : null });
const lastWith = (sent, k) => { for (let i = sent.length - 1; i >= 0; i--) if (sent[i][k] !== undefined) return sent[i]; return null; };
SA._reset(); try { fs.unlinkSync(SA.FILE); } catch (e) {}
const r = rig(loadReader(), 3);
r.feed({ type: 'character', character: { name: 'trainer3', level: 100, gold: 1, diamonds: 2, vipUntil: 0, autoCatch: {} } });
const n0 = r.sent.length;
r.feed(pending(1, true)); r.feed(thr(1, 'ultra-ball', false));
ok('before Perfil was opened the reader sends no shinies of all time', !r.sent.slice(n0).some(d => d.shinyAll), r.sent.slice(n0));
r.feed({ type: 'profile-stats', rank: 3, shinyBalls: 512, shinyCaught: 5, trainers: 1520 });
let m = lastWith(r.sent, 'shinyAll');
ok('Perfil is opened in the game: the window gets 5 / 512 at once', m && m.shinyAll.caught === 5 && m.shinyAll.balls === 512, m);
r.feed(pending(2, true)); r.feed(thr(2, 'luxury-ball', false)); r.feed(thr(2, 'luxury-ball', true, true));
m = lastWith(r.sent, 'shinyAll');
ok('two throws at a shiny, the second catches it: 6 / 514', m && m.shinyAll.caught === 6 && m.shinyAll.balls === 514, m && m.shinyAll);
r.feed(pending(3, false)); r.feed(thr(3, 'ultra-ball', true, false));
ok('a throw at a normal Pokémon changes nothing (still 6 / 514)', JSON.stringify([lastWith(r.sent, 'shinyAll').shinyAll.caught, lastWith(r.sent, 'shinyAll').shinyAll.balls]) === '[6,514]');
const r2 = rig(loadReader(), 4);
r2.feed({ type: 'character', character: { name: 'trainer3', level: 100, gold: 1, diamonds: 2, vipUntil: 0, autoCatch: {} } });
ok('a restart of the reader (or the app): the character\u2019s numbers are sent as soon as its name is known (6 / 514)', lastWith(r2.sent, 'shinyAll') && lastWith(r2.sent, 'shinyAll').shinyAll.balls === 514, r2.sent.map(d => Object.keys(d).join()));
r.feed({ type: 'hunt-session', session: { huntId: 'grass-60', startedAt: 1, active: true, kills: 10, xp: 1, captures: 2, lootValue: 0, captureValue: 0, ballCost: 0, potionCost: 0, elapsedMs: 600000, loot: {}, balls: {}, potions: {}, shinyKills: 7 } });
ok('a hunt session passes on the shinies met in it (shinyKills 7)', lastWith(r.sent, 'shinyKills') && lastWith(r.sent, 'shinyKills').shinyKills === 7);
const nk = r.sent.length; r.feed({ type: 'hunt-session', session: { huntId: 'grass-60', startedAt: 1, active: true, kills: 10, xp: 1, captures: 2, elapsedMs: 600000, loot: {}, balls: {}, potions: {}, shinyKills: 'x' } });
ok('...and nothing when the game sends no number there', r.sent.slice(nk).every(d => d.shinyKills === undefined));
r.feed({ type: 'profile-stats', shinyCaught: 'x' });
ok('an odd Perfil answer changes nothing and breaks nothing', lastWith(r.sent, 'shinyAll').shinyAll.balls === 514);

// ---- 3. the history: shinies met per day
const HI = require('./history');
const day = HI._dayKey(Date.now());
const sess = (ms, sk) => Object.assign({ name: 'trainerH', startedAt: 77, partySize: 1, partyKills: 0, xpGained: 0, captures: 0, lootSell: 0, captureSell: 0, suppliesCost: 0, elapsedMs: ms }, sk === undefined ? {} : { shinyKills: sk });
HI.handle(1, sess(1000));                  // the first message of a character: not counted (and this one has no shinyKills: an older game)
HI.handle(1, sess(61000, 3));               // the first one with the counter: the side before has none, so nothing is counted for the shinies
let row = HI._db().days[day] && HI._db().days[day].trainerH;
ok('the first message with the new counter does not count a whole hunt at once (the one before had no counter)', row && row.shinyKills === undefined, row);
HI.handle(1, sess(121000, 5));
row = HI._db().days[day].trainerH;
ok('then the shinies met are added up per day: 3 → 5 = 2', row.shinyKills === 2, row);
HI.handle(1, sess(181000, 5)); HI.handle(1, sess(241000, 9));
ok('...5 → 5 → 9: 6 in all', HI._db().days[day].trainerH.shinyKills === 6, HI._db().days[day].trainerH);
HI.handle(1, Object.assign(sess(10000, 1), { startedAt: 78 }));
HI.handle(1, Object.assign(sess(70000, 2), { startedAt: 78 }));
ok('a new hunt starts from 0: its 1 at the start counts, then +1 = 8', HI._db().days[day].trainerH.shinyKills === 8, HI._db().days[day].trainerH);
console.log = real;
const rep = require('./diag-core').analyse({ main: { meta: {}, shinyAll: { accounts: [{ n: 1, known: true, ageSec: 120, sinceBalls: 4, sinceCaught: 1 }, { n: 2, known: false }], chars: 1 } }, ui: {} }).report;
ok('the Diagnostics report has a SHINIES OF ALL TIME section: per account, from Perfil how long ago and what was counted since, or that Perfil was not opened yet', /SHINIES OF ALL TIME/.test(rep) && /from Perfil 2 min ago, counted since: 4 balls at shinies, 1 shinies captured/.test(rep) && /Perfil not opened yet on this account/.test(rep), rep.slice(rep.indexOf('SHINIES OF ALL TIME'), rep.indexOf('SHINIES OF ALL TIME') + 400));
out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
