// run-reader-shinyballs.js: the balls thrown at shinies, through the reader of the project, fed with fake frames of the game
const Module = require('module'), fs = require('fs'), cp = require('child_process');
const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const wsrc = fs.readFileSync('ws-reader.js', 'utf8');
const real = console.log; console.log = () => {};
function loadReader(breakIt) {
  Object.keys(require.cache).forEach(k => { if (/ws-reader\.js|shinyballs\.js/.test(k)) delete require.cache[k]; });
  const orig = Module._load;
  if (breakIt) Module._load = function (req) { if (req === './shinyballs') throw new Error('shinyballs.js is missing'); return orig.apply(this, arguments); };
  const R = require('./ws-reader'); Module._load = orig; return R;
}
function rig(R, account) {
  const sent = []; let h;
  R.attachReader({ debugger: { attach() {}, isAttached: () => true, sendCommand: async () => {}, on(e, f) { if (e === 'message') h = f; } }, isDestroyed: () => false, once() {}, on() {}, executeJavaScript: async () => '' }, account, (a, d) => sent.push(d));
  return { sent, feed: o => h({}, 'Network.webSocketFrameReceived', { response: { payloadData: typeof o === 'string' ? o : JSON.stringify(o) } }) };
}
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const pending = (n, shiny) => ({ type: 'pending', list: [{ id: id(n), shiny: shiny, speciesId: 123, level: 100, slot: 1, x: 1, y: 2, expiresAt: 5, investedValue: 0 }] });
const thr = (n, ball, success, shiny) => ({ type: 'catch-result', pendingId: id(n), ballId: ball, success: success, speciesId: 123, auto: true, investedValue: 3, pokemon: success ? { id: '5', speciesId: 123, shiny: shiny, level: 100, quality: 1.2, growth: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 } } : null });
const D = require('./diag');
let R = loadReader(false), r = rig(R, 2);
const lastWith = (sent, k) => { for (let i = sent.length - 1; i >= 0; i--) if (sent[i][k] !== undefined) return sent[i]; return null; };

r.feed(pending(1, true));
console.log = real;
ok('the reader loads shinyballs.js (with a fallback) and gives it the messages', /require\('\.\/shinyballs'\)/.test(wsrc) && /shinyballs\.handle\(/.test(wsrc));
ok('the first list of wild Pokémon makes the dashboard get 0 balls at shinies, from this account (live)', lastWith(r.sent, 'shinyThrown') && lastWith(r.sent, 'shinyThrown').shinyThrown === 0 && lastWith(r.sent, 'shinyThrown').live === true, r.sent);
console.log = () => {};
r.feed(thr(1, 'ultra-ball', false)); r.feed(thr(1, 'ultra-ball', false)); r.feed(thr(1, 'luxury-ball', true, true));
console.log = real;
let L = lastWith(r.sent, 'shinyThrown');
ok('3 throws at a shiny (the third caught it): the data sent to the dashboard says 3 balls at shinies, 1 shiny caught, 3 throws all matched', L.shinyThrown === 3 && L.shinyCaught === 1 && L.throws === 3 && L.throwsMatched === 3, L);
ok('...by kind of ball: 2 ultra, 1 luxury', L.shinyThrownBy['ultra-ball'] === 2 && L.shinyThrownBy['luxury-ball'] === 1, L.shinyThrownBy);
ok('the capture itself still reaches the dashboard as before (a catch-result that worked gives its own data)', r.sent.some(d => d.lastCaught || d.catchEvent || d.captures !== undefined || d.bestIV), r.sent.map(d => Object.keys(d).join()).slice(-3));
console.log = () => {};
r.feed({ type: 'dex-stats', speciesId: 123, normal: 112, shiny: 0, balls: [{ itemId: 'poke-ball', normal: 20000, shiny: 0 }, { itemId: 'luxury-ball', normal: 0, shiny: 21 }] });
console.log = real;
L = lastWith(r.sent, 'dexOpened');
ok('a Pokédex answer (21 Luxury Balls at the shiny of a species): the dashboard gets 21 balls at shinies in the Pokédex, 1 species opened', L.dexShinyBalls === 21 && L.dexOpened === 1 && L.dexShinySpecies === 1, L);
ok('the Pokédex answer and the pending list are no longer silently dropped before parsing: their field names are noted for the report', (() => { const f = D.collect().fields; return !!(f['pending'] && f['pending'].length) && !!(f['dex-stats'] && f['dex-stats'].length); })(), Object.keys(D.collect().fields));
ok('the field names of the Pokédex answer are the ones of the real game (speciesId, normal, shiny, balls[].itemId, balls[].normal, balls[].shiny)', (() => { const f = (D.collect().fields['dex-stats'] || []).join(','); return /balls\[\]\.itemId/.test(f) && /balls\[\]\.shiny/.test(f) && /speciesId/.test(f); })(), (D.collect().fields['dex-stats'] || []));
// a second account stays apart
console.log = () => {}; const r3 = rig(R, 3); r3.feed(pending(1, false)); r3.feed(thr(1, 'ultra-ball', false)); console.log = real;
ok('another account (the same wild id, but normal) counts 0 and does not change the first', lastWith(r3.sent, 'shinyThrown').shinyThrown === 0 && lastWith(r.sent, 'shinyThrown').shinyThrown === 3);
// no shinyballs.js
console.log = () => {};
let threw = false, r4;
try { const R4 = loadReader(true); r4 = rig(R4, 2); r4.feed(pending(1, true)); r4.feed(thr(1, 'ultra-ball', true, true)); r4.feed({ type: 'character', character: { name: 'trainer2', level: 5, gold: 1, diamonds: 2, autoCatch: {}, vipUntil: 0 } }); } catch (e) { threw = true; }
console.log = real;
ok('if shinyballs.js cannot be loaded the reader still starts and works: no error, and the other data is still sent', !threw && r4.sent.some(d => d.name === 'trainer2'), threw);
// a module that throws does not stop the reader, and the error is recorded
console.log = () => {};
R = loadReader(false); r = rig(R, 2); const SB = require('./shinyballs'); const realHandle = SB.handle; SB.handle = () => { throw new Error('boom'); };
let threw2 = false; try { r.feed({ type: 'character', character: { name: 'trainer2', level: 5, gold: 1, diamonds: 2, autoCatch: {}, vipUntil: 0 } }); r.feed(pending(1, true)); } catch (e) { threw2 = true; }
SB.handle = realHandle; console.log = real;
ok('if the counting itself fails, the reader goes on and sends its data, and the error is recorded for the report ("shinyballs: ... boom")', !threw2 && r.sent.some(d => d.name === 'trainer2') && (D.collect().errors || []).some(e => /shinyballs/.test(e.src || '') || /shinyballs/.test(e.msg || '')), D.collect().errors);
// the cost: 'pending' messages are parsed (they are small), 'hit' and 'kill' still are not
console.log = () => {}; R = loadReader(false); r = rig(R, 4);
const origParse = JSON.parse; let parses = 0; JSON.parse = function () { parses++; return origParse.apply(this, arguments); };
for (let i = 0; i < 1000; i++) r.feed('{"type":"hit","x":' + i + '}');
JSON.parse = origParse; console.log = real;
ok('1000 hit messages still cost at most 3 parses (the new kinds did not slow the others)', parses <= 3, parses);
out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
