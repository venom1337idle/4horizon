const team = require('./team');
let pass = 0, fail = 0; const expect = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const NAMES = { 7: 'Squirtle', 61: 'Poliwhirl', 62: 'Poliwrath', 102: 'Exeggcute', 25: 'Pikachu', 94: 'Gengar' };
const nameOf = id => NAMES[id] || '#' + id;
// the record exactly as the game sends it (fields from the DevTools screenshot of a catch-result)
const rec = (id, speciesId, level, xp, hp, maxHp, teamSlot, extra) => Object.assign({ id: String(id), speciesId, nickname: null, level, xp, shiny: false, quality: 1.05, baseSpeciesId: null, breedingBox: false,
  caughtBall: 'ultra-ball', growth: { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 }, gymId: null, hp, locked: false, maxHp, power: 600, stats: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 }, teamSlot, transformedAt: null }, extra || {});
let sent = []; const send = (a, d) => sent.push([a, d]);
const last = a => { for (let i = sent.length - 1; i >= 0; i--) if (sent[i][0] === a) return sent[i][1]; return null; };

// the roster at login: three in the team, many others in the box. The array sits under a key the code does not know.
const ready = { type: 'ready', character: { name: 'trainer3', activePokemonId: '2002' },
  somewhere: { deeper: { pokemon: [ rec(1001, 25, 40, 5, 100, 100, null), rec(2003, 7, 84, 900, 369, 492, 1), rec(2002, 62, 120, 4100, 2032, 3156, 2), rec(2004, 102, 1, 0, 24, 24, 3), rec(1002, 94, 55, 70, 300, 300, null) ] } },
  items: { 'ultra-ball': 5 } };
team.handle(3, 'ready', ready, send, nameOf);
let m = last(3);
expect('the roster at login gives the team: 3 Pokémon, in slot order (Squirtle, Poliwrath, Exeggcute)', m && m.teamList.map(x => x.name).join() === 'Squirtle,Poliwrath,Exeggcute', m && m.teamList.map(x => x.name));
expect('Pokémon that are not in the team (teamSlot empty) are left out', !m.teamList.some(x => x.name === 'Pikachu' || x.name === 'Gengar'));
expect('the active one is the one the game says (2002 = Poliwrath)', m.teamActiveId === '2002', m.teamActiveId);
expect('each member carries what the dashboard needs: id, species, level, xp, hp, max hp, slot', JSON.stringify(m.teamList[1]) === JSON.stringify({ id: '2002', speciesId: 62, name: 'Poliwrath', level: 120, xp: 4100, hp: 2032, maxHp: 3156, slot: 2, shiny: false }), m.teamList[1]);
const n0 = sent.length;

team.handle(3, 'ready', ready, send, nameOf);
expect('the same roster again says nothing (no change, no message)', sent.length === n0);

// the leader fights: hp and xp change
team.handle(3, 'pokemon-update', { type: 'pokemon-update', pokemon: { id: '2002', speciesId: 62, level: 120, xp: 4350, hp: 1900, maxHp: 3156, teamSlot: 2 } }, send, nameOf);
m = last(3); const poli = m.teamList.find(x => x.id === '2002');
expect('an update changes that member only (hp 1900, xp 4350)', poli.hp === 1900 && poli.xp === 4350 && m.teamList.find(x => x.id === '2003').hp === 369, poli);
team.handle(3, 'pokemon-update', { type: 'pokemon-update', pokemon: { id: '2002', speciesId: 62, level: 121, xp: 12, hp: 3200, maxHp: 3200, teamSlot: 2 } }, send, nameOf);
expect('a level-up is taken (Lv 121, new max hp)', last(3).teamList.find(x => x.id === '2002').level === 121 && last(3).teamList.find(x => x.id === '2002').maxHp === 3200);
const n1 = sent.length;
team.handle(3, 'pokemon-update', { type: 'pokemon-update', pokemon: { id: '2002', speciesId: 62, level: 121, xp: 12, hp: 3200, maxHp: 3200, teamSlot: 2 } }, send, nameOf);
expect('an update that changes nothing says nothing', sent.length === n1);

// someone not in the team is updated: ignored
team.handle(3, 'pokemon-update', { type: 'pokemon-update', pokemon: { id: '1001', speciesId: 25, level: 41, xp: 9, hp: 100, maxHp: 100, teamSlot: null } }, send, nameOf);
expect('an update for a Pokémon outside the team is ignored', sent.length === n1);

// a new member joins, one leaves, slots change
team.handle(3, 'pokemon-update', { type: 'pokemon-update', pokemon: rec(1002, 94, 55, 70, 300, 300, 4) }, send, nameOf);
expect('a Pokémon joining the team appears (Gengar, slot 4, last)', last(3).teamList.map(x => x.name).join() === 'Squirtle,Poliwrath,Exeggcute,Gengar', last(3).teamList.map(x => x.name));
team.handle(3, 'pokemon-update', { type: 'pokemon-update', pokemon: rec(2004, 102, 1, 0, 24, 24, null) }, send, nameOf);
expect('one leaving (teamSlot becomes empty) disappears (Exeggcute)', last(3).teamList.map(x => x.name).join() === 'Squirtle,Poliwrath,Gengar', last(3).teamList.map(x => x.name));
team.handle(3, 'pokemon-update', { type: 'pokemon-update', pokemon: { id: '2003', speciesId: 7, level: 84, xp: 900, hp: 369, maxHp: 492, teamSlot: 3 } }, send, nameOf);
expect('moving to another slot re-orders the list (Poliwrath 2, Squirtle 3, Gengar 4)', last(3).teamList.map(x => x.name).join() === 'Poliwrath,Squirtle,Gengar', last(3).teamList.map(x => x.name + x.slot));
team.handle(3, 'character', { type: 'character', character: { name: 'trainer3', activePokemonId: '1002' } }, send, nameOf);
expect('a new active Pokémon (Gengar) is passed on', last(3).teamActiveId === '1002');
team.handle(3, 'pokemon-update', { type: 'pokemon-update', pokemon: Object.assign(rec(1002, 94, 55, 70, 300, 300, 4), { nickname: 'Spooky' }) }, send, nameOf);
expect('a nickname is shown instead of the species name', last(3).teamList.find(x => x.id === '1002').name === 'Spooky');

// limits and safety
const big = { type: 'ready', pokemon: Array.from({ length: 9 }, (_, i) => rec(5000 + i, 25, 10, 0, 50, 50, i + 1)) };
team.handle(9, 'ready', big, send, nameOf);
expect('at most 6 members are kept (a team has 6 places)', last(9).teamList.length === 6 && last(9).teamList[5].slot === 6, last(9).teamList.length);
team.handle(9, 'ready', { type: 'ready', nothing: 'here' }, send, nameOf);
expect('a "ready" without a roster does not erase the team', last(9).teamList.length === 6);
let threw = false; try { [null, undefined, 5, 'x', {}, { pokemon: null }, { pokemon: { id: null } }, { character: null }].forEach(g => ['ready', 'pokemon-update', 'character', 'other'].forEach(t => team.handle(1, t, g, send, nameOf))); team.handle(1, 'ready', ready, send, undefined); } catch (e) { threw = e.message; }
expect('garbage input never throws; a missing name function falls back to "#id"', !threw, threw);
expect('accounts are kept apart: account 3 has Poliwrath, account 1 has its own', last(1) && last(1).teamList.some(x => x.name.startsWith('#') || x.name === 'Poliwrath') && last(3).teamList.length === 3);
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
