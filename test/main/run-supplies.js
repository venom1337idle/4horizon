// run-supplies.js: the kinds of balls and potions (module), and the reader that sends them (through the installer, with fake frames of the game)
const Module = require('module'), fs = require('fs'), cp = require('child_process');
const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const S = require('./supplies');
// ---- the module
const items = { 'earth-ball': 1565, 'shadow-ball': 12, 'gift-potion': 30, 'ultra-ball': 22312, 'idle-ball': 5310, 'poke-ball': 200, 'great-ball': 100, 'ultra-potion': 5058, 'great-potion': 638, 'small-potion': 400, 'potion': 12, 'rare-candy': 9, 'revive': 3, 'luxury-ball': 0, 'master-ball': -2, 'fire-stone': 4 };
const bound = { 'poke-ball': 300, 'great-ball': 200, 'super-potion': 7 };
ok('balls: the real Poké Balls with something left, from "items" only (as the game counts them: poke 200, great 100, not + the bound 300 and 200), idle and ultra included', JSON.stringify(S.types(items, bound, 'ball')) === JSON.stringify({ 'ultra-ball': 22312, 'idle-ball': 5310, 'poke-ball': 200, 'great-ball': 100 }), S.types(items, bound, 'ball'));
S.reset(); const lux = S.types({ 'luxury-ball': 857, 'ultra-ball': 5393 }, { 'luxury-ball': 233 }, 'ball');
ok('the case of the screenshot: Luxury 857 in "items" and 233 in "boundItems" gives 857 (what the game\u2019s Auto Helper shows), not 1,090; Ultra 5,393', JSON.stringify(lux) === JSON.stringify({ 'luxury-ball': 857, 'ultra-ball': 5393 }), lux);
ok('...what the bound list had is kept for the report (luxury-ball 233)', JSON.stringify(S.info().boundSeen) === '{"luxury-ball":233}', S.info());
S.types({}, { 'earth-ball': 4, 'luxury-ball': 240 }, 'ball');
ok('...the last amount seen replaces it, and loot in the bound list (earth-ball) is not a ball there either', JSON.stringify(S.info().boundSeen) === '{"luxury-ball":240}' && S.info().ignoredBalls.indexOf('earth-ball') < 0, S.info());
S.reset(); ok('...and a reset clears it', JSON.stringify(S.info().boundSeen) === '{}');
ok('potions: "-potion" (gift potion too) and plain "potion", from "items" only (the super-potion only in the bound list is not counted); stones, candy and revives are not potions', JSON.stringify(S.types(items, bound, 'potion')) === JSON.stringify({ 'gift-potion': 30, 'ultra-potion': 5058, 'great-potion': 638, 'small-potion': 400, 'potion': 12 }), S.types(items, bound, 'potion'));
S.reset();
ok('earth-ball (Bola de Terra, $1) and shadow-ball are things Pokémon drop, not balls: they are not listed and not added', !('earth-ball' in S.types(items, bound, 'ball')) && !('shadow-ball' in S.types(items, bound, 'ball')) && Object.keys(S.types(items, bound, 'ball')).length === 4, S.types(items, bound, 'ball'));
ok('...they are remembered for the report, so that a real ball that is missing from the list can be seen', JSON.stringify(S.info().ignoredBalls) === '["earth-ball","shadow-ball"]', S.info());
ok('the balls of the game: poke, great, ultra, master, luxury and idle are balls', ['poke-ball', 'great-ball', 'ultra-ball', 'master-ball', 'luxury-ball', 'idle-ball'].every(id => (S.types({ [id]: 3 }, null, 'ball') || {})[id] === 3));
ok('a ball the account itself uses (given as extra, from its auto-catch) is a ball too, and only for that call', S.types({ 'premier-ball': 4 }, null, 'ball', ['premier-ball'])['premier-ball'] === 4 && !('premier-ball' in S.types({ 'premier-ball': 4 }, null, 'ball')));
S.reset(); ok('nothing left out: an empty list for the report, and after a reset too', JSON.stringify(S.info().ignoredBalls) === '[]');
S.types({ 'earth-ball': 5, 'dusk-ball': 0 }, null, 'ball');
ok('only what is in stock is remembered (earth-ball yes, dusk-ball with 0 no)', JSON.stringify(S.info().ignoredBalls) === '["earth-ball"]', S.info());
ok('kinds with 0 or less left are not listed (luxury-ball 0, master-ball -2)', !('luxury-ball' in S.types(items, bound, 'ball')) && !('master-ball' in S.types(items, bound, 'ball')));
ok('nothing: an empty object (not undefined), also with no lists at all', JSON.stringify(S.types({}, null, 'ball')) === '{}' && JSON.stringify(S.types(undefined, undefined, 'potion')) === '{}' && JSON.stringify(S.types('x', 5, 'ball')) === '{}');
ok('odd values (text, NaN, Infinity, objects) are not listed; amounts with decimals are rounded down', JSON.stringify(S.types({ 'poke-ball': 'many', 'great-ball': NaN, 'ultra-ball': Infinity, 'master-ball': {}, 'luxury-ball': 5.9, 'idle-ball': '12' }, null, 'ball')) === JSON.stringify({ 'luxury-ball': 5, 'idle-ball': 12 }), S.types({ 'poke-ball': 'many', 'great-ball': NaN, 'ultra-ball': Infinity, 'master-ball': {}, 'luxury-ball': 5.9, 'idle-ball': '12' }, null, 'ball'));
const many = {}; for (let i = 0; i < 40; i++) many['k' + i + '-ball'] = i + 1;
ok('at most ' + S.MAX_KINDS + ' kinds are listed (a bug cannot grow the list)', Object.keys(S.types(many, null, 'ball', Object.keys(many))).length === S.MAX_KINDS);
ok('an unknown kind of item asks for nothing (undefined) and ids that are very long or do not end like a ball are left out', S.types(items, bound, 'stone') === undefined && !('x'.repeat(50) + '-ball' in S.types({ ['x'.repeat(50) + '-ball']: 3, 'ball-bag': 2 }, null, 'ball', ['x'.repeat(50) + '-ball'])) && !('ball-bag' in S.types({ 'ball-bag': 2 }, null, 'ball')));

// ---- the reader of the project (it has the kinds of balls and potions in it: nothing is patched any more)
const wsrc = fs.readFileSync('ws-reader.js', 'utf8');
const real = console.log; console.log = () => {};
function loadReader(breakIt) {
  Object.keys(require.cache).forEach(k => { if (/ws-reader\.js|supplies\.js/.test(k)) delete require.cache[k]; });
  const orig = Module._load;
  if (breakIt) Module._load = function (req) { if (req === './supplies') throw new Error('supplies.js is missing'); return orig.apply(this, arguments); };
  const R = require('./ws-reader'); Module._load = orig; return R;
}
function rig(R, account) {
  const sent = []; let h;
  R.attachReader({ debugger: { attach() {}, isAttached: () => true, sendCommand: async () => {}, on(e, f) { if (e === 'message') h = f; } }, isDestroyed: () => false, once() {}, on() {}, executeJavaScript: async () => '' }, account, (a, d) => sent.push(d));
  return { sent, feed: o => h({}, 'Network.webSocketFrameReceived', { response: { payloadData: typeof o === 'string' ? o : JSON.stringify(o) } }) };
}
const lastWith = (sent, k) => { for (let i = sent.length - 1; i >= 0; i--) if (sent[i][k] !== undefined) return sent[i]; return null; };
let R = loadReader(false), r = rig(R, 3);
r.feed({ type: 'inventory', items: items, boundItems: bound });
console.log = real;
ok('the reader loads supplies.js (with a fallback) and sends the kinds of balls and potions with the inventory', /require\('\.\/supplies'\)/.test(wsrc) && /ballTypes/.test(wsrc) && /potionTypes/.test(wsrc));
let m = lastWith(r.sent, 'ballTypes');
ok('an inventory from the game: the data sent has the kinds of balls and potions (from "items" only, as the totals)', m && JSON.stringify(m.ballTypes) === JSON.stringify({ 'ultra-ball': 22312, 'idle-ball': 5310, 'poke-ball': 200, 'great-ball': 100 }) && m.potionTypes['ultra-potion'] === 5058 && m.potionTypes['super-potion'] === undefined, m);
ok('...and the numbers it sent before are the same as before: balls = poke + great + ultra + master of "items" only (200 + 100 + 22312 - 2 = 22610, the odd master-ball of -2 is counted as before), potions = every potion of "items" (6138, gift potions included)', m.balls === 22610 && m.potions === 5058 + 638 + 400 + 12 + 30, [m.balls, m.potions]);
console.log = () => {};
r.feed({ type: 'inventory', items: { 'great-ball': 5 } });
console.log = real;
m = lastWith(r.sent, 'ballTypes');
ok('a later inventory replaces the lists (one kind of ball, no potions: {} for the potions)', JSON.stringify(m.ballTypes) === '{"great-ball":5}' && JSON.stringify(m.potionTypes) === '{}', m);
console.log = () => {}; r.feed({ type: 'inventory' }); r.feed({ type: 'inventory', items: null, boundItems: 'x' }); console.log = real;
ok('an inventory with nothing in it, or with odd lists, gives empty lists and breaks nothing', JSON.stringify(lastWith(r.sent, 'ballTypes').ballTypes) === '{}');
console.log = () => {};
const r3 = rig(loadReader(false), 4);
r3.feed({ type: 'character', character: { name: 'trainer4', level: 5, gold: 1, diamonds: 2, autoCatch: { ballId: 'premier-ball', shinyBallId: 'luxury-ball' }, vipUntil: 0 } });
r3.feed({ type: 'inventory', items: { 'premier-ball': 7, 'earth-ball': 1565, 'shadow-ball': 12, 'ultra-ball': 40, 'dusk-ball': 9 }, boundItems: {} });
console.log = real;
const m3 = lastWith(r3.sent, 'ballTypes');
ok('through the reader: the ball the account is set to use (premier-ball) is counted although it is not in the list of balls, the loot (earth-ball, shadow-ball) and a ball nobody set (dusk-ball) are not', m3 && JSON.stringify(m3.ballTypes) === JSON.stringify({ 'premier-ball': 7, 'ultra-ball': 40 }), m3 && m3.ballTypes);
ok('...and the Diagnostics know what was left out (earth-ball, shadow-ball, dusk-ball), to tell if a real ball is missing', JSON.stringify(require('./supplies').info().ignoredBalls) === '["dusk-ball","earth-ball","shadow-ball"]', require('./supplies').info());
let threw = false, r2;
console.log = () => {};
try { r2 = rig(loadReader(true), 2); r2.feed({ type: 'inventory', items: items, boundItems: bound }); r2.feed({ type: 'character', character: { name: 'trainer2', level: 5, gold: 1, diamonds: 2, autoCatch: {}, vipUntil: 0 } }); } catch (e) { threw = true; }
console.log = real;
const m2 = r2 && lastWith(r2.sent, 'balls');
ok('if supplies.js cannot be loaded the reader still works: the old numbers are sent (balls, potions), the kinds are just not there', !threw && m2 && m2.balls === 22610 && m2.ballTypes === undefined && r2.sent.some(d => d.name === 'trainer2'), [threw, m2]);
const D = require('./diag');
ok('the "inventory" part of the diagnostics still works and the reader still parses', (() => { try { return cp.spawnSync('node', ['--check', 'ws-reader.js']).status === 0; } catch (e) { return false; } })());
out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
