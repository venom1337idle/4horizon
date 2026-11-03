const C = require('./combat');
const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
C.reset();

// ---- counting by type only
C.frame(1, 'hit', 1000); C.frame(1, 'hit', 2000); C.frame(1, 'kill', 2100); C.frame(1, 'field', 2200); C.frame(1, null, 2300); C.frame(1, undefined, 2400); C.frame(1, 'pong', 2500);
let s = C.summary(1);
ok('hits and kills are counted from the type alone; every other type, null and undefined are ignored', s.hits === 2 && s.kills === 1, s);
ok('a panel that has sent nothing has no summary (null), not zeros', C.summary(9) === null);

// ---- the gaps, with their limits to the millisecond
C.reset();
C.frame(1, 'hit', 0); C.frame(1, 'hit', 5000);           // exactly 5000: the same fight
C.frame(1, 'hit', 10001);                                  // 5001 later: not the same fight, no gap
for (let i = 0; i < 12; i++) C.frame(1, 'hit', 20000 + i * 1700);       // 12 hits of one fight: 11 gaps of 1700
s = C.summary(1);
ok('two hits exactly 5000 ms apart are one fight (gap kept), 5001 ms apart are not; 12 hits 1700 ms apart give 11 more gaps: 12 in all', s.gapN === 12 && s.hits === 15, [s.gapN, s.hits]);
ok('...fewer than 10 gaps say nothing yet, 12 give the median: 1700', C.summary(1).gapMs === 1700, C.summary(1));
C.reset(); for (let i = 0; i < 9; i++) C.frame(1, 'hit', i * 1000);
ok('9 hits make only 8 gaps: not enough for a median (null), though the count (8) is shown', C.summary(1).gapMs === null && C.summary(1).gapN === 8, C.summary(1));
C.reset(); C.frame(1, 'hit', 0); C.frame(1, 'kill', 500); C.frame(1, 'hit', 500 + 12000);
ok('a kill followed by a hit exactly 12000 ms later: the time from a kill to the first hit is kept (spawn count 1)', C.summary(1).spawnN === 1 && C.summary(1).gapN === 0, C.summary(1));
C.reset(); C.frame(1, 'hit', 0); C.frame(1, 'kill', 500); C.frame(1, 'hit', 500 + 12001);
ok('...12001 ms later it is not (the player did something else), and the hit after a kill is never counted as a gap', C.summary(1).spawnN === 0 && C.summary(1).gapN === 0);
C.reset(); C.frame(1, 'hit', 0); C.frame(1, 'kill', 1000); C.frame(1, 'hit', 2000); C.frame(1, 'hit', 3700);
ok('hit, kill, hit, hit: the kill splits the fights: one spawn time (1000) and one gap (1700), not a gap across the kill', C.summary(1).spawnN === 1 && C.summary(1).gapN === 1, C.summary(1));

// ---- a simulated hunt: 100 kills of 2 hits, 1700 ms between the hits, 1800 ms from a kill to the first hit
C.reset(); let t = 0;
for (let k = 0; k < 100; k++) { t += 1800; C.frame(1, 'hit', t); t += 1700; C.frame(1, 'hit', t); C.frame(1, 'kill', t + 50); t += 50; }
s = C.summary(1);
ok('100 kills of 2 hits: 200 hits, 100 kills, 1700 ms between hits (99... counted per fight: 100 gaps), 1800 ms from a kill to the first hit (99 counted: the first fight has no kill before it)', s.hits === 200 && s.kills === 100 && s.gapMs === 1700 && s.gapN === 100 && s.spawnMs === 1800 && s.spawnN === 99, s);
// ---- the median is the middle value, not the mean
C.reset(); const gs = [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 4500, 4500, 1000]; let tt = 0; C.frame(1, 'hit', tt); gs.forEach(g => { tt += g; C.frame(1, 'hit', tt); });
ok('the median ignores two slow gaps (4500) among ten of 1000: 1000, where the mean would say 1583', C.summary(1).gapMs === 1000 && C.median(gs) === 1000, C.summary(1));
ok('median of an even list is the middle two averaged; of an empty list null', C.median([1, 2, 3, 4]) === 2.5 && C.median([]) === null && C.median([7]) === 7);
// ---- memory: only the latest 600 gaps are kept
C.reset(); let t2 = 0; for (let i = 0; i < 2000; i++) { t2 += 1000; C.frame(1, 'hit', t2); }
ok('after 2000 hits only the latest 600 gaps are kept (memory stays small) but all 2000 hits are counted', C.summary(1).gapN === 600 && C.summary(1).hits === 2000 && C._state[1].gaps.length === 600);

// ---- one hunt at a time
C.reset(); C.frame(1, 'hit', 0); C.frame(1, 'hit', 1000); C.frame(1, 'kill', 1100);
C.session(1, 5000, 1, 100);
ok('what was counted before the first hunt-session message belongs to that hunt (2 hits, 1 kill kept)', C.summary(1).hits === 2 && C.summary(1).kills === 1 && C.summary(1).startedAt === 5000 && C.summary(1).size === 1);
C.frame(1, 'hit', 2000); C.frame(1, 'kill', 2100); C.session(1, 5000, 1, 101);
ok('the same hunt and party: nothing resets; the game\u2019s counter went 100 \u2192 101 (+1) while 1 kill message came after the first counter', C.summary(1).hits === 3 && C.summary(1).counterKills === 1 && C.summary(1).messageKills === 1, C.summary(1));
C.session(1, 6000, 1, 5);
ok('a NEW hunt (another start time) starts the counts again: 0 hits, 0 kills, counters from 5', C.summary(1).hits === 0 && C.summary(1).kills === 0 && C.summary(1).startedAt === 6000 && C.summary(1).counterKills === 0, C.summary(1));
C.frame(1, 'hit', 100); C.session(1, 6000, 2, 5);
ok('a change of party size (1 \u2192 2) starts again too', C.summary(1).hits === 0 && C.summary(1).size === 2);
C.reset(); C.frame(1, 'hit', 100); C.frame(1, 'kill', 200); C.session(1, 6000, 2, 9); C.frame(1, 'kill', 300); C.frame(1, 'kill', 400); C.session(1, 6000, 2, 12);
ok('kill messages and the game\u2019s counter are compared over the same stretch: counter +3 (9 \u2192 12), kill messages since that first sight: 2 (the one before it is not counted against it)', C.summary(1).counterKills === 3 && C.summary(1).messageKills === 2, C.summary(1));
C.reset(); C.session(1, 1, 1, NaN); C.session(1, 1, 1, undefined); C.session(1, undefined, undefined, 5); C.session(1, null, null, null);
ok('a counter that is NaN, undefined or null is ignored; an unknown start time and size are allowed and nothing throws', (() => { try { C.summary(1); return true; } catch (e) { return false; } })());

// ---- panels are independent
C.reset(); C.frame(1, 'hit', 0); C.frame(2, 'kill', 0); C.frame(2, 'kill', 10); C.session(2, 7, 1, 3);
ok('panel 1 and panel 2 do not mix: 1 hit / 0 kills and 0 hits / 2 kills', C.summary(1).hits === 1 && C.summary(1).kills === 0 && C.summary(2).hits === 0 && C.summary(2).kills === 2);
C.session(2, 8, 1, 3);
ok('a new hunt on panel 2 does not touch panel 1', C.summary(1).hits === 1 && C.summary(2).kills === 0);

// ---- the sampling of field names: the first 3 hit and the first 3 kill messages of a panel
C.reset();
const smp = []; for (let i = 0; i < 6; i++) smp.push(C.sample(1, 'hit'));
ok('the first 3 hit messages of a panel are sampled, the 4th to the 6th are not', eq(smp, [true, true, true, false, false, false]), smp);
ok('kills have their own 3; other types are never sampled; panel 2 has its own 3', C.sample(1, 'kill') === true && C.sample(1, 'field') === false && C.sample(1, undefined) === false && C.sample(2, 'hit') === true);
C.reset(); ok('reset() starts the sampling again', C.sample(1, 'hit') === true);
C.reset(5); C.frame(5, 'hit', 0); C.reset(5);
ok('reset(panel) forgets one panel only', C.summary(5) === null);

// ---- nothing else is exposed that could hold a message
ok('the summary has only numbers (no text from the game)', (() => { C.reset(); C.frame(1, 'hit', 0); C.session(1, 5, 1, 2); return Object.values(C.summary(1)).every(v => v === null || typeof v === 'number'); })());
out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
