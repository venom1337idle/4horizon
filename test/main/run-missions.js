// run-missions.js: the notifications of a battle pass mission, a daily mission and an egg ready to hatch (missions.js), the reader that feeds it
// (through the installer, with fake frames shaped like the game's, from ws-schema.json), and the MISSIONS AND EGGS section of the report
const Module = require('module'), fs = require('fs'), cp = require('child_process');
const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x).slice(0, 600))); c ? pass++ : fail++; };
const M = require('./missions');
const shown = [];
const fakeNotify = { event: (account, kind, title, body, key) => { shown.push({ account, kind, title, body, key }); return true; }, label: n => ['', 'trainer1', 'trainer2', 'trainer3', 'trainer4'][n] || 'Account ' + n };
const NAMES = { 81: 'Magnemite', 61: 'Poliwhirl', 300: 'Skitty', 4: 'Charmander' };
const nameOf = id => NAMES[id] || '#' + id;
let clock = Date.UTC(2026, 10, 2, 12, 0, 0);
const reset = () => { M._reset(); M._setNotify(fakeNotify); M._setNow(() => clock); shown.length = 0; };

// ---- the battle pass (shaped as in ws-schema.json)
const bp = (p1, p2, p3, wk) => ({ type: 'battle-pass', premium: false, state: { date: '2026-11-02', day: 6, week: 2, pp: 90, ppToday: 0, sets: [{ day: 6, origin: 'daily', missions: [
  { kind: 'defeat-type', type: 'electric', speciesId: 0, progress: p1, target: 500, points: 40 }, { kind: 'capture', type: '', speciesId: 0, progress: p2, target: 10, points: 30 }, { kind: 'market-buy', type: '', speciesId: 0, progress: p3, target: 1, points: 30 }] }],
  weekly: { kind: 'evolve', progress: wk, target: 5, points: 200 } } });
reset();
M.handle(2, 'battle-pass', bp(500, 3, 0, 1), nameOf);
ok('battle pass: what is already done when the app first sees it (at the login) is not announced', shown.length === 0, shown);
M.handle(2, 'battle-pass', bp(500, 9, 0, 1), nameOf);
ok('...progress that does not reach the target: nothing', shown.length === 0, shown);
M.handle(2, 'battle-pass', bp(500, 10, 0, 1), nameOf);
ok('a mission that reaches its target: one notification, "trainer2: battle pass mission completed", with the target and the PP', shown.length === 1 && shown[0].kind === 'battlePass' && shown[0].account === 2 && shown[0].title === 'trainer2: battle pass mission completed' && shown[0].body === 'Done: mission of the day (10/10) · +30 PP. Claim it in the Passe window.', shown);
M.handle(2, 'battle-pass', bp(500, 10, 0, 1), nameOf); M.handle(2, 'battle-pass', bp(500, 12, 0, 1), nameOf);
ok('...and only once, however often the game sends it again', shown.length === 1, shown);
M.handle(2, 'battle-pass', bp(500, 12, 1, 5), nameOf);
ok('two at once (a mission of the day and the challenge of the week): two notifications, each with its own key', shown.length === 3 && shown[1].body.indexOf('mission of the day (1/1)') >= 0 && shown[2].body === 'Done: challenge of the week (5/5) · +200 PP. Claim it in the Passe window.' && shown[1].key !== shown[2].key, shown.slice(1));
const bp2 = JSON.parse(JSON.stringify(bp(0, 0, 0, 5))); bp2.state.sets[0].day = 7; bp2.state.sets[0].missions[0].target = 300;
M.handle(2, 'battle-pass', bp2, nameOf); bp2.state.sets[0].missions[0].progress = 300; M.handle(2, 'battle-pass', bp2, nameOf);
ok('the next day (new missions): each new mission is announced when it is done', shown.length === 4 && /\(300\/300\)/.test(shown[3].body), shown.slice(3));
M.handle(3, 'battle-pass', bp(500, 10, 1, 5), nameOf);
ok('each account keeps its own: account 3 seen for the first time, with everything done, announces nothing', shown.length === 4);

// ---- the daily missions (inside "ready" and "character")
const dq = (g1, g2, claimed) => ({ type: 'character', character: { name: 'trainer2', dailyQuests: { date: '2026-11-02', chestClaimed: false, quests: [
  { tier: 'easy', claimed: !!claimed, goals: [{ kind: 'defeat', speciesId: 81, progress: g1, target: 150 }, { kind: 'defeat', speciesId: 61, progress: g2, target: 150 }] },
  { tier: 'medium', claimed: false, goals: [{ kind: 'defeat', speciesId: 300, progress: 0, target: 250 }] },
  { tier: 'hard', claimed: false, goals: [{ kind: 'market-buy', progress: 1, target: 1 }] }] } } });
reset();
M.handle(2, 'ready', dq(0, 0), nameOf);
ok('daily missions: the first time (in "ready", at the login) nothing is announced, also not the hard one that is already done', shown.length === 0, shown);
M.handle(2, 'character', dq(140, 0), nameOf);
ok('...progress on a goal that does not reach its target: nothing', shown.length === 0, shown);
M.handle(2, 'character', dq(150, 0), nameOf);
ok('one goal of two done (Magnemite 150/150, the screenshot\u2019s case): "trainer2: daily mission goal done", which goal, and how far the mission is', shown.length === 1 && shown[0].kind === 'dailyQuest' && shown[0].title === 'trainer2: daily mission goal done' && shown[0].body === 'Done: Magnemite 150/150. The easy mission: 1 of 2 goals done.', shown);
M.handle(2, 'character', dq(150, 140), nameOf);
ok('...the other goal moving on: nothing more', shown.length === 1);
M.handle(2, 'character', dq(150, 150), nameOf);
ok('the last goal done: ONE notification, "trainer2: daily mission completed", that goal, and where to claim it', shown.length === 2 && shown[1].title === 'trainer2: daily mission completed' && shown[1].body === 'Done: Poliwhirl 150/150. The easy mission is complete: claim it in the Missões window.', shown.slice(1));
M.handle(2, 'character', dq(150, 150), nameOf); M.handle(2, 'character', dq(150, 150, true), nameOf);
ok('...once only (and claiming it later says nothing)', shown.length === 2);
const odd = dq(0, 0); odd.character.dailyQuests.quests[0].tier = 'lendária';
reset(); M.handle(1, 'character', odd, nameOf); odd.character.dailyQuests.quests[0].goals.forEach(g => { g.progress = 150; }); M.handle(1, 'character', odd, nameOf);
ok('two goals of one mission done in the same update: one notification listing both (not two "complete"); a tier with an unknown name is written as the game says it', shown.length === 1 && shown[0].body === 'Done: Magnemite 150/150, Poliwhirl 150/150. The lendária mission is complete: claim it in the Missões window.', shown);
const mk = dq(0, 0); mk.character.dailyQuests.quests[2].goals = [{ kind: 'market-buy', progress: 0, target: 1 }, { kind: 'pvp-fight', progress: 0, target: 1 }];
reset(); M.handle(1, 'character', mk, nameOf); mk.character.dailyQuests.quests[2].goals[0].progress = 1; M.handle(1, 'character', mk, nameOf); mk.character.dailyQuests.quests[2].goals[1].progress = 1; M.handle(1, 'character', mk, nameOf);
ok('goals without a Pokémon: "Market 1/1", "PvP 1/1"', shown.length === 2 && shown[0].body === 'Done: Market 1/1. The hard mission: 1 of 2 goals done.' && shown[1].body === 'Done: PvP 1/1. The hard mission is complete: claim it in the Missões window.', shown);
reset(); M.handle(1, 'character', { type: 'character', character: { name: 'x', level: 3 } }, nameOf);
ok('a "character" message without daily missions (most of them) changes nothing', shown.length === 0 && M.info().messages.dailyQuests === 0);

// ---- the eggs
reset();
const H = 3600e3;
M.handle(4, 'breeding', { type: 'breeding', slots: 2, eggs: [{ id: '11', speciesId: 4, shiny: false, status: 'incubating', startedAt: clock - H, readyAt: clock + 30 * 60e3, remainingMs: 30 * 60e3 }, { id: '12', speciesId: 81, shiny: true, status: 'incubating', readyAt: clock - 60e3, remainingMs: 0 }] }, nameOf);
ok('eggs: one ready already when the app first sees it is not announced (it was ready before)', shown.length === 0, shown);
clock += 25 * 60e3; M.tick();
ok('...the other one, 25 minutes later: not yet (ready in 30)', shown.length === 0);
clock += 6 * 60e3; M.tick();
ok('...after 30 minutes: "trainer4: an egg is ready to hatch", which Pokémon', shown.length === 1 && shown[0].kind === 'eggReady' && shown[0].title === 'trainer4: an egg is ready to hatch' && shown[0].body === 'Charmander is ready in the incubator.', shown);
M.tick(); clock += 60e3; M.tick();
ok('...once only', shown.length === 1);
M.handle(4, 'breeding', { type: 'breeding', slots: 2, eggs: [{ id: '13', speciesId: 81, shiny: true, status: 'incubating', remainingMs: 5 * 60e3 }] }, nameOf);
clock += 5 * 60e3 + 1000; M.tick();
ok('a new egg with only "remainingMs": ready when that time has passed; a shiny one has its star', shown.length === 2 && shown[1].body === '✦ Magnemite is ready in the incubator.', shown.slice(1));
M.handle(4, 'breeding', { type: 'breeding', slots: 2, eggs: [{ id: '14', speciesId: 4, status: 'hatched', readyAt: clock - 1000 }, { id: '15', speciesId: 4, status: 'ready', readyAt: clock + 9e9 }] }, nameOf);
ok('an egg the game says is ready is announced at once; one already hatched never', shown.length === 3 && shown[2].body === 'Charmander is ready in the incubator.', shown.slice(2));
const sec = Math.round((clock + 10 * 60e3) / 1000);
M.handle(1, 'breeding', { type: 'breeding', eggs: [{ id: '20', speciesId: 4, readyAt: sec }] }, nameOf); clock += 11 * 60e3; M.tick();
ok('a "readyAt" in seconds (not milliseconds) is understood too', shown.length === 4 && shown[3].account === 1, shown.slice(3));

// ---- the hunt timer (lang-43): character.travelReadyAt goes to the window, once per change
reset(); const sentW = []; M._setWindow((a, d) => sentW.push([a, d]));
M.handle(1, 'ready', { character: { name: 'trainer1', travelReadyAt: clock + 4000 } }, nameOf);
M.handle(1, 'character', { character: { name: 'trainer1', travelReadyAt: clock + 4000, level: 200 } }, nameOf);
ok('hunt timer: the time the account may travel again is sent to the window ({ huntReadyAt }), and the same one is not sent twice', JSON.stringify(sentW) === JSON.stringify([[1, { huntReadyAt: clock + 4000 }]]), sentW);
M.handle(1, 'character', { character: { travelReadyAt: Math.round((clock + 9000) / 1000) } }, nameOf);
M.handle(1, 'character', { character: { travelReadyAt: null } }, nameOf);
M.handle(1, 'character', { character: { level: 3 } }, nameOf); M.handle(1, 'battle-pass', { character: { travelReadyAt: 5 } }, nameOf);
ok('...a time in seconds is turned into milliseconds; "no timer" (null) is sent as 0; a message without the field, or of another kind, sends nothing', JSON.stringify(sentW.slice(1)) === JSON.stringify([[1, { huntReadyAt: Math.round((clock + 9000) / 1000) * 1000 }], [1, { huntReadyAt: 0 }]]), sentW);
M._setWindow(() => {});
M.handle(1, 'battle-pass', bp(0, 0, 0, 0), nameOf); M.handle(1, 'character', { character: { travelReadyAt: clock + 2 * 3600e3 } }, nameOf);
const D0 = require('./diag-core'), rep0 = D0.analyse({ main: { meta: {}, missions: M.info() }, dash: { accounts: [{ n: 1, name: 'trainer1', nameKnown: true }] }, ui: {} }).report;
M.handle(1, 'hunt-session', { session: { active: false, huntId: 'rock-60', entryPenaltyUntil: clock + 45000 } }, nameOf);
ok('report (lang-46): both timers of each account, to see which one is the Hunts countdown: entry penalty (from the hunt session) and travel', /timers: entry penalty ends in 45 s, travel ends in 2 h/.test(D0.analyse({ main: { meta: {}, missions: M.info() }, ui: {} }).report), D0.analyse({ main: { meta: {}, missions: M.info() }, ui: {} }).report.match(/timers:[^\n]*/));
M.handle(1, 'character', { character: { travelReadyAt: clock + 40000 } }, nameOf); M.handle(1, 'hunt-session', { session: { entryPenaltyUntil: null } }, nameOf);
ok('..."ends in 40 s", "none"; a hunt session without the field changes nothing; it is not announced and not sent to the window', /timers: entry penalty none, travel ends in 40 s/.test(D0.analyse({ main: { meta: {}, missions: M.info() }, ui: {} }).report) && (M.handle(1, 'hunt-session', { session: { kills: 3 } }, nameOf), /entry penalty none/.test(D0.analyse({ main: { meta: {}, missions: M.info() }, ui: {} }).report)) && shown.length === 0);

// ---- odd data
reset(); let threw = false;
try { [null, {}, { state: null }, { state: { sets: 'x', weekly: 5 } }, { character: { dailyQuests: { quests: [null, 5, { goals: 'x' }] } } }, { eggs: [null, 'x', { id: null }, { id: 'a', readyAt: 'soon' }] }].forEach(m => { M.handle(1, 'battle-pass', m, nameOf); M.handle(1, 'character', m, nameOf); M.handle(1, 'breeding', m, nameOf); }); M.tick(); } catch (e) { threw = String(e); }
ok('messages that make no sense break nothing and announce nothing', !threw && shown.length === 0, threw);

// ---- what the Diagnostics get
reset(); M.handle(2, 'battle-pass', bp(500, 3, 0, 1), nameOf); M.handle(2, 'battle-pass', bp(500, 10, 0, 1), nameOf); M.handle(2, 'ready', dq(150, 0), nameOf);
M.handle(2, 'breeding', { eggs: [{ id: '1', speciesId: 4, readyAt: clock + 45 * 60e3 }] }, nameOf);
const inf = M.info();
ok('the report data: messages per kind, notifications shown, and per account what is done (counts only, no names)', inf.messages.battlePass === 2 && inf.messages.dailyQuests === 1 && inf.messages.breeding === 1 && inf.sent.battlePass === 1 &&
  JSON.stringify(inf.accounts[0].bp) === JSON.stringify({ missions: 4, done: 2, ageSec: 0 }) && inf.accounts[0].dq.done === 1 && inf.accounts[0].dq.quests === 3 && JSON.stringify(inf.accounts[0].eggs.readyInMin) === '[45]' && !/Magnemite|Charmander|trainer\d/.test(JSON.stringify(inf)), inf);
const D = require('./diag-core');
const rep = D.analyse({ main: { meta: { app: '4horizon', version: '1', build: 'x' }, missions: inf }, dash: { accounts: [{ n: 2, name: 'trainer2', nameKnown: true }] }, ui: {} }).report;
const s1 = rep.slice(rep.indexOf('MISSIONS AND EGGS'), rep.indexOf('\n\n', rep.indexOf('MISSIONS AND EGGS')));
ok('report: MISSIONS AND EGGS with the counts, and one line per account', /^MISSIONS AND EGGS \(/.test(s1) && /messages from the game since the start: battle pass 2 · daily missions 1 · eggs 1 · notifications shown: battle pass 1, daily 0, eggs 0/.test(s1) &&
  /\n  Account 2 \(trainer2\): battle pass 2\/4 done \(last sent [^)]*\) · daily 1\/3 done, 0 claimed \(last sent [^)]*\) · eggs 1, next ready in 45 min/.test(s1), s1);
const rep2 = D.analyse({ main: { meta: {}, missions: { messages: { battlePass: 1, dailyQuests: 0, breeding: 0 }, sent: {}, accounts: [{ n: 1, bp: { missions: 3, done: 0, ageSec: 4000 }, dq: null, eggs: { count: 0, readyInMin: [], ready: 0 } }] } }, ui: {} }).report;
ok('...a battle pass sent only once per account so far is pointed out (it may only come at the login); accounts without data say so; no "undefined"', /has sent the battle pass only once per account so far/.test(rep2) && /daily missions: not sent yet/.test(rep2) && !/undefined|NaN/.test(rep2.slice(rep2.indexOf('MISSIONS'))), rep2.slice(rep2.indexOf('MISSIONS'), rep2.indexOf('MISSIONS') + 500));
ok('an older app without missions.js: no section', D.analyse({ main: { meta: {} }, ui: {} }).report.indexOf('MISSIONS AND EGGS') < 0);

// ---- Portuguese
const i18n = require('./i18n'); require('./i18n-pt'); i18n.setLang('pt-BR'); reset();
M.handle(2, 'battle-pass', bp(0, 0, 0, 0), nameOf); M.handle(2, 'battle-pass', bp(500, 0, 0, 0), nameOf); M.handle(2, 'ready', dq(0, 0), nameOf); M.handle(2, 'character', dq(150, 150), nameOf);
M.handle(2, 'breeding', { eggs: [{ id: '9', speciesId: 4, remainingMs: 1000 }] }, nameOf); clock += 2000; M.tick();
ok('in Portuguese: "missão do passe concluída", "missão diária concluída", "A missão fácil está completa", "um ovo está pronto para chocar"', shown.length === 3 && shown[0].title === 'trainer2: missão do passe concluída' && shown[0].body === 'Pronto: missão do dia (500/500) · +40 PP. Resgate na janela do Passe.' &&
  shown[1].title === 'trainer2: missão diária concluída' && shown[1].body === 'Concluído: Magnemite 150/150, Poliwhirl 150/150. A missão fácil está completa: resgate na janela de Missões.' && shown[2].title === 'trainer2: um ovo está pronto para chocar' && shown[2].body === 'Charmander está pronto na incubadora.', shown);
i18n.setLang('en');

// ---- notify.js: the three switches, on at first, in the settings the window reads
const nsrc = fs.readFileSync('notify.js', 'utf8');
ok('notify.js: the three switches (battlePass, dailyQuest, eggReady) are in its defaults, on, and missions.js can send through it (event, label)', /battlePass: true,/.test(nsrc) && /dailyQuest: true,/.test(nsrc) && /eggReady: true\s/.test(nsrc) && /module\.exports = \{ event, label,/.test(nsrc));

// ---- the reader of the project (frames shaped as the game sends them; nothing is patched any more)
const w = fs.readFileSync('ws-reader.js', 'utf8');
ok('the reader loads missions.js, looks into "battle-pass" too, and hands the five kinds to it (the hunt session too)', /let missions; try \{ missions = require\('\.\/missions'\);/.test(w) && /'battle-pass'/.test(w) && /m\[1\] === 'breeding' \|\| m\[1\] === 'hunt-session'\) missions\.handle\(account, m\[1\], msg, nameOf\)/.test(w));
const real = console.log; console.log = () => {};
Object.keys(require.cache).forEach(k => { if (/ws-reader\.js|missions\.js/.test(k)) delete require.cache[k]; });
const R = require('./ws-reader'), M2 = require('./missions');
M2._reset(); M2._setNotify(fakeNotify); M2._setNow(() => clock); shown.length = 0;
let h; R.attachReader({ debugger: { attach() {}, isAttached: () => true, sendCommand: async () => {}, on(e, f) { if (e === 'message') h = f; } }, isDestroyed: () => false, once() {}, on() {}, executeJavaScript: async () => '' }, 2, () => {});
const feed = o => h({}, 'Network.webSocketFrameReceived', { response: { payloadData: JSON.stringify(o) } });
feed(bp(0, 0, 0, 0)); feed(bp(0, 10, 0, 0)); feed(dq(0, 0)); feed(dq(150, 150));
console.log = real;
ok('through the real reader: a battle pass mission and a daily mission done are announced', shown.length === 2 && shown[0].kind === 'battlePass' && shown[1].kind === 'dailyQuest', shown);
out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
