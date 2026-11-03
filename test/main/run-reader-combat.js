const Module = require('module'); const path = require('path');
const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const real = console.log; console.log = () => {};
function loadReader(breakCombat) {
  Object.keys(require.cache).forEach(k => { if (/ws-reader\.js|combat\.js/.test(k)) delete require.cache[k]; });
  const orig = Module._load;
  if (breakCombat) Module._load = function (req) { if (req === './combat') throw new Error('combat.js is missing'); return orig.apply(this, arguments); };
  const R = require('./ws-reader'); Module._load = orig; return R;
}
function rig(R, account) {
  const sent = []; let h;
  R.attachReader({ debugger: { attach() {}, isAttached: () => true, sendCommand: async () => {}, on(e, f) { if (e === 'message') h = f; } }, isDestroyed: () => false, once() {}, on() {}, executeJavaScript: async () => '' }, account, (a, d) => sent.push(d));
  return { sent, feed: o => h({}, 'Network.webSocketFrameReceived', { response: { payloadData: typeof o === 'string' ? o : JSON.stringify(o) } }) };
}
const session = (kills, startedAt, extra) => ({ type: 'hunt-session', session: Object.assign({ huntId: 'grass-10', startedAt: startedAt, kills: kills, elapsedMs: 3600000, xp: 1, active: true, captures: 0, loot: {}, balls: {}, potions: {} }, extra || {}) });
const D = require('./diag'); let C = require('./combat');
C.reset();
let R = loadReader(false), r = rig(R, 3); C = require('./combat');

// a hunt: 60 kills of 2 hits each
r.feed(session(0, 111));
for (let k = 1; k <= 60; k++) { r.feed('{"type":"hit","x":1}'); r.feed('{"type":"hit","x":2}'); r.feed('{"type":"kill","pokemon":1}'); r.feed(session(k, 111)); }
let last = r.sent[r.sent.length - 1];
console.log = real;
ok('the data sent to the dashboard carries "combat": 120 hits, 60 kills, and the game\u2019s counter agrees (+60 against 60 kill messages)', last.combat && last.combat.hits === 120 && last.combat.kills === 60 && last.combat.counterKills === 60 && last.combat.messageKills === 60, last.combat);
ok('...with the hunt\u2019s start time and the party size, so that the dashboard can tell which hunt it belongs to', last.combat.startedAt === 111 && last.combat.size === 1, last.combat);
ok('hit and kill messages by themselves produce NO data for the dashboard (only the converted kinds do): the number of sends equals the number of hunt-session messages (61)', r.sent.length === 61, r.sent.length);
console.log = () => {};
r.feed(session(61, 222)); r.feed('{"type":"hit","x":1}');
last = r.sent[r.sent.length - 1]; console.log = real;
ok('a new hunt (another start time) starts the counts again: 0 hits, 0 kills, the new start time, the game\u2019s counter from 0', last.combat.hits === 0 && last.combat.kills === 0 && last.combat.startedAt === 222 && last.combat.counterKills === 0, last.combat);
console.log = () => {};
r.feed(session(62, 222)); last = r.sent[r.sent.length - 1]; console.log = real;
ok('...and the next summary shows only the new hunt: 1 hit, 0 kills, start time 222', last.combat.hits === 1 && last.combat.kills === 0 && last.combat.startedAt === 222, last.combat);

// the field names, read from the first 3 messages only
console.log = () => {}; R = loadReader(false); C = require('./combat'); C.reset(); r = rig(R, 4);
const parses = []; const origParse = JSON.parse; JSON.parse = function () { parses.push(1); return origParse.apply(this, arguments); };
const uuid = i => '3f2b7c1' + (i % 10) + '-aaaa-4bbb-8ccc-0123456789a' + (i % 10);
for (let i = 0; i < 1000; i++) r.feed('{"type":"hit","' + uuid(i) + '":{"ally":"12","damage":5},"turn":' + i + '}');
for (let i = 0; i < 1000; i++) r.feed('{"type":"kill","pokemon":' + i + ',"trainer":7}');
JSON.parse = origParse; console.log = real;
ok('2000 hit and kill messages cost at most 6 parses (3 of each): the rest are only counted by their type', parses.length <= 6 && parses.length >= 2, parses.length);
const f = D.collect().fields;
ok('their field names are in the diagnostics: hit has "turn" and "{id}" (the uuid keys collapse into one name, none of the uuids is listed), kill has "pokemon" and "trainer"', f.hit && f.hit.indexOf('turn') >= 0 && f.hit.indexOf('{id}') >= 0 && !f.hit.some(x => /^3f2b7c1/.test(x)) && f.kill && f.kill.indexOf('pokemon') >= 0 && f.kill.indexOf('trainer') >= 0, [f.hit, f.kill]);
ok('...nested names too (hit.{id}.ally, hit.{id}.damage), still names only', f.hit.indexOf('{id}.ally') >= 0 && f.hit.indexOf('{id}.damage') >= 0, f.hit);
ok('the counts of that panel are right too: 1000 hits, 1000 kills', C.summary(4).hits === 1000 && C.summary(4).kills === 1000, C.summary(4));

// a message that is broken: counted, never throws
console.log = () => {}; let threw = null;
try { R = loadReader(false); C = require('./combat'); C.reset(); r = rig(R, 2); r.feed('{"type":"hit", this is not json'); r.feed('{"type":"hit"'); r.feed('{"type":"kill"}'); r.feed('{"type":"hit","a":1}'); r.feed(null); r.feed('[]'); r.feed('{"type":"HIT"}'); } catch (e) { threw = e.message; }
console.log = real;
ok('broken, truncated and odd messages are counted by their type when they have one (3 hits, 1 kill) and never throw', !threw && C.summary(2).hits === 3 && C.summary(2).kills === 1, [threw, C.summary(2)]);

// without combat.js
console.log = () => {}; let threw2 = null, lastNo = null;
try { C.reset(); R = loadReader(true); r = rig(R, 3); r.feed(session(0, 1)); r.feed('{"type":"hit"}'); r.feed('{"type":"kill"}'); r.feed(session(1, 1)); lastNo = r.sent[r.sent.length - 1]; } catch (e) { threw2 = e.message; }
console.log = real;
ok('if combat.js cannot be loaded the reader still starts and works: no error, the data is sent, "combat" is null (the dashboard ignores it)', !threw2 && lastNo && lastNo.live === true && lastNo.combat === null && lastNo.defeated !== undefined, [threw2, lastNo && lastNo.combat]);
out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
