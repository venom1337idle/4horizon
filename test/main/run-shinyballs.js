// run-shinyballs.js: the balls thrown at shinies, counted from the pending list, the throws and the Pokédex answers
const S = require('./shinyballs');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const pend = (...ws) => ({ type: 'pending', list: ws.map(w => ({ id: id(w[0]), shiny: !!w[1], speciesId: 123, level: 100, slot: 1, x: 1, y: 2, expiresAt: 9, investedValue: 0 })) });
const throwAt = (n, ball, success, shiny) => ({ type: 'catch-result', pendingId: id(n), ballId: ball, success: !!success, speciesId: 123, auto: true, investedValue: 5, pokemon: success ? { id: '77', shiny: !!shiny } : null });
const rig = () => { S.reset(); const sent = []; return { sent, send: (a, d) => sent.push([a, d]), h(a, type, m) { S.handle(a, type, m, this.send); } }; };

let r = rig();
r.h(2, 'pending', pend([1, true]));
ok('the first pending list makes the window show 0 (not a dash): one send, with 0 balls at shinies', r.sent.length === 1 && r.sent[0][0] === 2 && r.sent[0][1].shinyThrown === 0 && r.sent[0][1].live === true, r.sent);
r.h(2, 'pending', pend([1, true]));
ok('the same list again sends nothing (nothing changed)', r.sent.length === 1);
// a shiny: two balls that fail, one that works
r.h(2, 'catch-result', throwAt(1, 'ultra-ball', false)); r.h(2, 'catch-result', throwAt(1, 'ultra-ball', false)); r.h(2, 'catch-result', throwAt(1, 'luxury-ball', true, true));
let s = S.summary(2);
ok('3 throws at a shiny (2 failed, 1 caught): 3 balls at shinies, 1 shiny caught, by kind of ball: 2 ultra, 1 luxury', s.shinyThrown === 3 && s.shinyCaught === 1 && s.shinyThrownBy['ultra-ball'] === 2 && s.shinyThrownBy['luxury-ball'] === 1, s);
ok('...and all 3 throws were matched with a wild Pokémon whose kind is known', s.throws === 3 && s.throwsMatched === 3, s);
ok('the window is told every time the count changes (3 more sends), with the 3 balls at the end', r.sent.length === 4 && r.sent[3][1].shinyThrown === 3, r.sent.map(x => x[1].shinyThrown));
// normal wild ones
r.h(2, 'pending', pend([2, false]));
r.h(2, 'catch-result', throwAt(2, 'great-ball', false)); r.h(2, 'catch-result', throwAt(2, 'great-ball', true, false));
s = S.summary(2);
ok('throws at a normal wild Pokémon are not counted as shiny (still 3), but they are matched (5 throws, 5 matched)', s.shinyThrown === 3 && s.throws === 5 && s.throwsMatched === 5, s);
// a throw at a wild one the reader never saw
r.h(2, 'catch-result', throwAt(99, 'ultra-ball', false));
s = S.summary(2);
ok('a failed throw at a wild Pokémon the reader never saw: not counted as shiny (it cannot know), and says so in the check (6 throws, 5 matched)', s.shinyThrown === 3 && s.throws === 6 && s.throwsMatched === 5, s);
r.h(2, 'catch-result', throwAt(98, 'ultra-ball', true, true));
s = S.summary(2);
ok('...but a throw that CAUGHT a shiny is counted even if its wild one was never seen (the catch itself says it is shiny)', s.shinyThrown === 4 && s.shinyCaught === 2 && s.throwsMatched === 6, s);
ok('the caught wild Pokémon is forgotten after the catch (a later throw with that id is not matched)', (() => { const n0 = S.summary(2).throwsMatched; r.h(2, 'catch-result', throwAt(1, 'ultra-ball', false)); return S.summary(2).throwsMatched === n0 && S.summary(2).shinyThrown === 4; })());

// memory
r = rig();
r.h(1, 'pending', pend([1, true]));
for (let i = 0; i < S.MAX_PENDING + 5; i++) r.h(1, 'pending', pend([1000 + i, false]));
r.h(1, 'catch-result', throwAt(1, 'ultra-ball', false));
ok('the reader remembers at most ' + S.MAX_PENDING + ' wild Pokémon: the oldest one is forgotten, so a throw at it is not counted (and is not matched)', S.summary(1).shinyThrown === 0 && S.summary(1).throwsMatched === 0, S.summary(1));
r.h(1, 'catch-result', throwAt(1000 + S.MAX_PENDING + 4, 'ultra-ball', false));
ok('...the newest one is still known (matched)', S.summary(1).throwsMatched === 1);
r = rig(); r.h(1, 'pending', pend([1, true]));
for (let i = 0; i < 12; i++) r.h(1, 'catch-result', throwAt(1, 'ball-' + i, false));
ok('at most 8 kinds of ball are listed (a bug cannot grow the list), the total is still right', Object.keys(S.summary(1).shinyThrownBy).length === 8 && S.summary(1).shinyThrown === 12, S.summary(1).shinyThrownBy);

// the Pokédex
r = rig();
r.h(4, 'dex-stats', { type: 'dex-stats', speciesId: 123, normal: 112, shiny: 0, balls: [{ itemId: 'poke-ball', normal: 20000, shiny: 0 }, { itemId: 'ultra-ball', normal: 5473, shiny: 0 }, { itemId: 'luxury-ball', normal: 0, shiny: 21 }] });
s = S.summary(4);
ok('Pokédex answer for a species (21 Luxury Balls at its shiny): 21 balls at shinies, 1 species opened, 1 with shiny balls', s.dexShinyBalls === 21 && s.dexOpened === 1 && s.dexShinySpecies === 1, s);
r.h(4, 'dex-stats', { type: 'dex-stats', speciesId: 5, normal: 3, shiny: 1, balls: [{ itemId: 'ultra-ball', normal: 10, shiny: 4 }, { itemId: 'luxury-ball', normal: 0, shiny: 6 }] });
r.h(4, 'dex-stats', { type: 'dex-stats', speciesId: 7, normal: 9, shiny: 0, balls: [{ itemId: 'poke-ball', normal: 50, shiny: 0 }] });
s = S.summary(4);
ok('three species opened (21 + 10 + 0): 31 balls at shinies in the Pokédex, 2 of the 3 species have some', s.dexShinyBalls === 31 && s.dexOpened === 3 && s.dexShinySpecies === 2, s);
r.h(4, 'dex-stats', { type: 'dex-stats', speciesId: 123, normal: 113, shiny: 1, balls: [{ itemId: 'luxury-ball', normal: 0, shiny: 30 }] });
ok('opening a species again replaces its numbers (30, not 21 + 30): 40 in all', S.summary(4).dexShinyBalls === 40 && S.summary(4).dexOpened === 3, S.summary(4));
const nSent = r.sent.length;
r.h(4, 'dex-stats', { type: 'dex-stats', speciesId: 123, normal: 113, shiny: 1, balls: [{ itemId: 'luxury-ball', normal: 0, shiny: 30 }] });
ok('the same answer again sends nothing', r.sent.length === nSent);
r = rig();
r.h(4, 'dex-stats', { type: 'dex-stats', speciesId: 'x', balls: [{ shiny: 5 }] }); r.h(4, 'dex-stats', { type: 'dex-stats' }); r.h(4, 'dex-stats', { type: 'dex-stats', speciesId: 9, balls: 'none' });
r.h(4, 'dex-stats', { type: 'dex-stats', speciesId: 10, balls: [null, 7, { shiny: -3 }, { shiny: NaN }, { shiny: 'a' }, { shiny: 2 }] });
ok('a Pokédex answer without a species number is ignored; broken or negative numbers count as 0 (only the good 2 counts)', S.summary(4).dexOpened === 2 && S.summary(4).dexShinyBalls === 2, S.summary(4));

// odd messages and accounts
r = rig();
let threw = false;
try { [null, undefined, 5, 'x', {}, { list: 'no' }, { list: [null, 4, { id: 5 }, { shiny: true }] }].forEach(m => { S.handle(1, 'pending', m, r.send); S.handle(1, 'catch-result', m, r.send); S.handle(1, 'dex-stats', m, r.send); }); S.handle(1, 'unknown-kind', {}, r.send); S.handle(1, 'pending', pend([1, true]), null); } catch (e) { threw = true; }
ok('odd messages (null, numbers, lists of the wrong kind, ids that are not text, no send function) never throw', !threw);
r = rig(); r.h(2, 'pending', pend([1, true])); r.h(3, 'pending', pend([1, false]));
r.h(2, 'catch-result', throwAt(1, 'ultra-ball', false)); r.h(3, 'catch-result', throwAt(1, 'ultra-ball', false));
ok('accounts are kept apart: the same wild id is shiny for account 2 and normal for account 3 (1 and 0)', S.summary(2).shinyThrown === 1 && S.summary(3).shinyThrown === 0, [S.summary(2), S.summary(3)]);
ok('an account that sent nothing has no summary', S.summary(4) === null);
r = rig(); r.h(1, 'pending', pend([1, false]));
const before = r.sent.length; for (let i = 0; i < 24; i++) r.h(1, 'catch-result', throwAt(1, 'ultra-ball', false));
ok('throws at normal wild ones send nothing for 24 throws, and the 25th sends the numbers of the check', r.sent.length === before && (r.h(1, 'catch-result', throwAt(1, 'ultra-ball', false)), r.sent.length === before + 1 && r.sent[r.sent.length - 1][1].throws === 25), r.sent.length);
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
