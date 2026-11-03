// Feeds the REAL reader with captures the way the game sends them, and looks at what it reports to the dashboard.
const file = process.argv[2] || './ws-reader.js';
const { attachReader } = require(file);
const sent = [];
let h; attachReader({ debugger: { attach() {}, sendCommand: async () => {}, on(e, f) { h = f; } }, isDestroyed: () => false, once() {}, on() {}, executeJavaScript: async () => '' }, 4, (a, d) => sent.push(d));
const feed = o => h({}, 'Network.webSocketFrameReceived', { response: { payloadData: JSON.stringify(o) } });
const session = (startedAt, kills) => ({ type: 'hunt-session', session: { huntId: 'bug-60', startedAt, active: true, kills, xp: 0, captures: 0, lootValue: 0, captureValue: 0, ballCost: 0, potionCost: 0, elapsedMs: 1000, loot: {}, balls: {}, potions: {} } });
const catchMsg = (iv, quality, shiny) => { const g = Math.floor(iv / 6), r = iv - g * 6; return { type: 'catch-result', success: true, pokemon: { speciesId: 63, growth: { hp: g + r, atk: g, def: g, spa: g, spd: g, spe: g }, quality, shiny: !!shiny } }; };
const last = () => { for (let i = sent.length - 1; i >= 0; i--) if (sent[i].bestIV !== undefined || sent[i].catchesSeen !== undefined) return sent[i]; return {}; };
let pass = 0, fail = 0; const expect = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };

feed({ type: 'character', character: { name: 'trainer4', level: 100, activePokemonId: 1, autoCatch: {} } });
feed(session(1, 0));
// a hunt like trainer4's: a 151 early on, then 200 ordinary captures (the reader keeps 60)
const plan = [];
for (let i = 0; i < 10; i++) plan.push([60 + i, 1.0, false]);
plan.push([151, 1.18, false]);                               // the one in the screenshot
plan.push([90, 1.5, true]);                                  // an early shiny
plan.push([100, 2.44, false]);                               // the best quality of the hunt
for (let i = 0; i < 200; i++) plan.push([70 + (i % 40), 1.05, false]);   // 70..109, never above 109
plan.forEach(([iv, q, s]) => feed(catchMsg(iv, q, s)));
const s = last();
console.log('   after ' + plan.length + ' captures the dashboard is told: bestIV ' + (s.bestIV && s.bestIV.iv) + ', bestQ \u00d7' + (s.bestQ && s.bestQ.quality) + ', shiny ' + s.shinyCaptured + ', seen ' + s.catchesSeen);
expect('best IV of the whole hunt is 151 (it was caught 200+ captures ago)', s.bestIV && s.bestIV.iv === 151, s.bestIV);
expect('best quality of the whole hunt is \u00d72.44', s.bestQ && s.bestQ.quality === 2.44, s.bestQ);
expect('best score (IV x quality) of the whole hunt is the 100 \u00d7 2.44 = 244', s.bestS && s.bestS.score === 244, s.bestS);
expect('the shiny caught early is still counted (1)', s.shinyCaptured === 1, s.shinyCaptured);
expect('every capture of the hunt is counted (213), not just 60', s.catchesSeen === plan.length, s.catchesSeen);
expect('the list of recent captures is still the last 12, newest first', s.recentCatches.length === 12 && s.lastCaught.iv === 70 + 199 % 40, s.recentCatches.length);

// a new hunt starts from zero
feed(session(2, 0));
feed(catchMsg(80, 1.1, false));
const n = last();
expect('a new hunt forgets the old bests: best IV is now 80, shiny 0, seen 1', n.bestIV.iv === 80 && n.shinyCaptured === 0 && n.catchesSeen === 1, n);
feed(catchMsg(120, 1.0, true)); feed(catchMsg(60, 1.0, false));
const m = last();
expect('...and builds up again: best 120, one shiny, 3 seen', m.bestIV.iv === 120 && m.shinyCaptured === 1 && m.catchesSeen === 3, m);
feed({ type: 'catch-result', success: false });
expect('a failed catch changes nothing', last().catchesSeen === 3);
console.log('\n' + pass + ' passed, ' + fail + ' failed');
