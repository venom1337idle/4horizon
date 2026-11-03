const { attachReader } = require('./ws-reader');
const sent = [];
let h; attachReader({ debugger: { attach() {}, sendCommand: async () => {}, on(e, f) { h = f; } }, isDestroyed: () => false, once() {}, on() {}, executeJavaScript: async () => '' }, 3, (a, d) => sent.push(d));
const feed = o => h({}, 'Network.webSocketFrameReceived', { response: { payloadData: JSON.stringify(o) } });
let pass = 0, fail = 0; const expect = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const rec = (id, sp, lv, xp, hp, mx, slot) => ({ id: String(id), speciesId: sp, nickname: null, level: lv, xp, shiny: false, quality: 1.1, hp, maxHp: mx, power: 500, teamSlot: slot, growth: { hp: 10, atk: 10, def: 10, spa: 10, spd: 10, spe: 10 }, stats: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 } });
const lastTeam = () => { for (let i = sent.length - 1; i >= 0; i--) if (sent[i].teamList) return sent[i]; return null; };

feed({ type: 'character', character: { name: 'trainer3', level: 132, activePokemonId: 2002, gold: 968316, autoCatch: {} } });
feed({ type: 'ready', character: { activePokemonId: 2002 }, state: { owned: [rec(2003, 7, 84, 900, 369, 492, 1), rec(2002, 62, 120, 4100, 2032, 3156, 2), rec(2004, 102, 1, 0, 24, 24, 3), rec(9, 25, 30, 1, 80, 80, null)] } });
let t = lastTeam();
expect('through the real reader: the roster message produces the team (3 members, in slot order)', t && t.teamList.length === 3 && t.teamList.map(x => x.slot).join() === '1,2,3', t && t.teamList);
expect('the species names come from the reader\u2019s own name list (an unknown id shows as "#7"; the dashboard knows the real names)', t.teamList.every(x => typeof x.name === 'string' && x.name.length > 0), t.teamList.map(x => x.name));
expect('the active one is the one in the character message', t.teamActiveId === '2002', t.teamActiveId);

// the leader's update: the old fields must still be produced, and the team updated too
feed({ type: 'pokemon-update', pokemon: rec(2002, 62, 120, 4400, 1990, 3156, 2) });
const upd = sent.filter(x => x.pokemon).pop();
expect('the leader\u2019s update still gives what it gave before ("Lv120" and the HP line of the old Team box)', upd && /Lv120$/.test(upd.pokemon) && upd.team && upd.team.hp === 1990 && upd.team.hpMax === 3156, upd);
t = lastTeam();
expect('...and the team has the new hp / xp', t.teamList.find(x => x.id === '2002').hp === 1990 && t.teamList.find(x => x.id === '2002').xp === 4400);
// another member is updated: before this change it was thrown away
feed({ type: 'pokemon-update', pokemon: rec(2003, 7, 84, 950, 300, 492, 1) });
expect('an update of a NON-leader member now reaches the team (Squirtle hp 300, xp 950)', lastTeam().teamList.find(x => x.id === '2003').hp === 300 && lastTeam().teamList.find(x => x.id === '2003').xp === 950);

// the rest of the reader still works
feed({ type: 'hunt-session', session: { huntId: 'ground-10', startedAt: 1, active: true, kills: 34, xp: 97600, captures: 1, lootValue: 100, captureValue: 50, ballCost: 10, potionCost: 0, elapsedMs: 228000, loot: {}, balls: {}, potions: {} } });
feed({ type: 'catch-result', success: true, pokemon: Object.assign(rec(777, 50, 1, 0, 24, 24, null), { quality: 1.2 }) });
const hs = sent.filter(x => x.defeated !== undefined).pop(), cr = sent.filter(x => x.catchesSeen !== undefined).pop();
expect('hunt-session and capture messages are unaffected (34 defeated; 1 capture seen)', hs && hs.defeated === 34 && cr && cr.catchesSeen === 1, [hs && hs.defeated, cr && cr.catchesSeen]);
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
