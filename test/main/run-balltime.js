// run-balltime.js: what the reader sends for the "time left" of the auto-catch ball (lang-70): the balls used in the hunt by kind, and whether auto-catch is on
const fs = require('fs'), cp = require('child_process');
const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const real = console.log; console.log = () => {};
function loadReader() {
  Object.keys(require.cache).forEach(k => { if (/ws-reader\.js|supplies\.js/.test(k)) delete require.cache[k]; });
  return require('./ws-reader');
}
function rig(R, account) {
  const sent = []; let h;
  R.attachReader({ debugger: { attach() {}, isAttached: () => true, sendCommand: async () => {}, on(e, f) { if (e === 'message') h = f; } }, isDestroyed: () => false, once() {}, on() {}, executeJavaScript: async () => '' }, account, (a, d) => sent.push(d));
  return { sent, feed: o => h({}, 'Network.webSocketFrameReceived', { response: { payloadData: typeof o === 'string' ? o : JSON.stringify(o) } }) };
}
const lastWith = (sent, k) => { for (let i = sent.length - 1; i >= 0; i--) if (sent[i][k] !== undefined) return sent[i]; return null; };
const session = balls => ({ type: 'hunt-session', session: { huntId: 'grass-60', startedAt: 1, active: true, kills: 10, xp: 1, captures: 2, lootValue: 0, captureValue: 0, ballCost: 0, potionCost: 0, elapsedMs: 7200000, loot: {}, balls: balls, potions: {} } });
const character = ac => ({ type: 'character', character: { name: 'trainer1', level: 100, gold: 1, diamonds: 2, vipUntil: 0, autoCatch: ac } });

const r = rig(loadReader(), 1);
r.feed(session({ 'ultra-ball': 500, 'luxury-ball': 3 }));
let m = lastWith(r.sent, 'ballsByType');
console.log = real;
ok('a hunt session: the balls used are sent by kind (ultra 500, luxury 3), next to the total that was sent before (503)', m && JSON.stringify(m.ballsByType) === '{"ultra-ball":500,"luxury-ball":3}' && m.ballsUsed === 503, m);
console.log = () => {};
r.feed(session({ 'ultra-ball': 'many', 'great-ball': -4, 'poke-ball': 7, ['x'.repeat(60)]: 1 }));
m = lastWith(r.sent, 'ballsByType'); console.log = real;
ok('odd amounts (text, below 0) are left out, very long names are cut to 40 letters', m && m.ballsByType['poke-ball'] === 7 && !('ultra-ball' in m.ballsByType) && !('great-ball' in m.ballsByType) && Object.keys(m.ballsByType).some(k => k.length === 40), m && m.ballsByType);
const many = {}; for (let i = 0; i < 50; i++) many['k' + i + '-ball'] = i;
console.log = () => {}; r.feed(session(many)); m = lastWith(r.sent, 'ballsByType'); console.log = real;
ok('at most 30 kinds are sent (a bug cannot grow it)', m && Object.keys(m.ballsByType).length === 30, m && Object.keys(m.ballsByType).length);
const n0 = r.sent.length;
console.log = () => {}; r.feed(session(undefined)); console.log = real;
const last = r.sent.slice(n0).reverse().find(d => d.ballsUsed !== undefined);
ok('a session without the list of balls sends no "ballsByType" (the window keeps what it had) and breaks nothing', last && last.ballsByType === undefined && last.ballsUsed === 0, last);

console.log = () => {};
r.feed(character({ enabled: true, ballId: 'ultra-ball', shinyBallId: 'luxury-ball' }));
const on = lastWith(r.sent, 'autoCatchOn');
r.feed(character({ enabled: false, ballId: 'ultra-ball' }));
const off = lastWith(r.sent, 'autoCatchOn');
const n1 = r.sent.length; r.feed(character({ ballId: 'great-ball' })); const unknown = r.sent.slice(n1).find(d => d.name === 'trainer1');
console.log = real;
ok('the character: "autoCatchOn" true when the game says auto-catch is on, false when it is off', on && on.autoCatchOn === true && on.autoBall === 'ultra-ball' && off && off.autoCatchOn === false, [on, off]);
ok('...and nothing (undefined) when the game does not say, so the card does not claim it is off', unknown && unknown.autoCatchOn === undefined && unknown.autoBall === 'great-ball', unknown);
ok('the reader still parses', (() => { try { return cp.spawnSync(process.execPath, ['--check', 'ws-reader.js']).status === 0; } catch (e) { return false; } })());
out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
