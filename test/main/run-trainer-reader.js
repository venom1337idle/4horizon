const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const real = console.log; console.log = () => {};
const { attachReader } = require('./ws-reader');
const sent = []; let h;
attachReader({ debugger: { attach() {}, isAttached: () => true, sendCommand: async () => {}, on(e, f) { if (e === 'message') h = f; } }, isDestroyed: () => false, once() {}, on() {}, executeJavaScript: async () => '' }, 3, (a, d) => sent.push(d));
const feed = o => h({}, 'Network.webSocketFrameReceived', { response: { payloadData: JSON.stringify(o) } });
// the character message as the game sends it (the field list is from the real report): the trainer's level and xp are both there
feed({ type: 'character', character: { id: 'c1', name: 'trainer3', level: 148, xp: 12345678, gold: 956725, goldCents: 0, diamonds: 20, vipUntil: 4102444800000, activePokemonId: 2002, autoCatch: { enabled: true, ballId: 'ultra-ball', shinyBallId: 'luxury-ball', shiny: true, names: [] }, autoPotion: { enabled: true } } });
const c = sent.find(d => d.name === 'trainer3');
console.log = real;
ok('the character message gives the dashboard the trainer\u2019s xp as "trainerXp", next to the level', c && c.trainerXp === 12345678 && c.level === 148, c);
ok('...and what it gave before is unchanged (name, level, money, diamonds, VIP)', c.name === 'trainer3' && c.money === 956725 && c.diamonds === 20 && c.vip === true, c);
feed({ type: 'character', character: { name: 'trainer3', level: 149, gold: 1 } });
const c2 = sent.filter(d => d.name === 'trainer3').pop();
ok('a character message without xp gives "trainerXp" as undefined, not a made-up number', c2.level === 149 && c2.trainerXp === undefined, c2);
out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
