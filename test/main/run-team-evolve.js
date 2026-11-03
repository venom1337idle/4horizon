// run-team-evolve.js: a Pokémon of the team evolves (Horsea becomes Seadra): the team list follows
const team = require('./team');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const NAMES = { 25: 'Pikachu', 62: 'Poliwrath', 116: 'Horsea', 117: 'Seadra', 230: 'Kingdra', 133: 'Eevee', 134: 'Vaporeon' };
const nameOf = id => NAMES[id] || '#' + id;
let sent = []; const send = (a, d) => sent.push([a, d]); const last = a => { for (let i = sent.length - 1; i >= 0; i--) if (sent[i][0] === a) return sent[i][1]; return null; };
const rec = (id, speciesId, level, slot, extra) => Object.assign({ id: String(id), speciesId, nickname: null, level, xp: 100, shiny: false, hp: 50, maxHp: 80, teamSlot: slot }, extra || {});
const roster = (...pk) => ({ type: 'ready', character: { name: 'trainer3', activePokemonId: '2002' }, pokemon: pk });
const upd = (p) => ({ type: 'pokemon-update', pokemon: p });
const fresh = (acc, ...pk) => { team.handle(acc, 'ready', roster(...pk), send, nameOf); };
const names = a => last(a).teamList.map(x => x.name + ':' + x.speciesId).join();

fresh(3, rec(2002, 62, 153, 1), rec(2003, 116, 76, 2), rec(1001, 25, 40, null));
ok('the team at login: Poliwrath and Horsea', names(3) === 'Poliwrath:62,Horsea:116', names(3));
let n0 = sent.length;
team.handle(3, 'pokemon-update', upd({ id: '2003', speciesId: 117, level: 76, teamSlot: 2, transformedAt: 1730000000000 }), send, nameOf);
ok('Horsea evolves (the update says species 117): the team list now has Seadra, at the same slot', names(3) === 'Poliwrath:62,Seadra:117' && sent.length === n0 + 1, [names(3), sent.length - n0]);
ok('...with its level, xp and hp kept, and the same fields as before (nothing added to what is sent)', JSON.stringify(Object.keys(last(3).teamList[1])) === JSON.stringify(['id', 'speciesId', 'name', 'level', 'xp', 'hp', 'maxHp', 'slot', 'shiny']) && last(3).teamList[1].level === 76 && last(3).teamList[1].xp === 100 && last(3).teamList[1].slot === 2, last(3).teamList[1]);
ok('...the other member (Poliwrath) is untouched', last(3).teamList[0].name === 'Poliwrath' && last(3).teamList[0].speciesId === 62 && last(3).teamList[0].level === 153);
n0 = sent.length;
team.handle(3, 'pokemon-update', upd({ id: '2003', speciesId: 117, level: 76, teamSlot: 2 }), send, nameOf);
ok('the same update again says nothing (no change, no flicker)', sent.length === n0);
team.handle(3, 'pokemon-update', upd({ id: '2003', speciesId: 117, level: 77, hp: 60, teamSlot: 2 }), send, nameOf);
ok('a level up of Seadra changes the level only: Seadra, level 77, hp 60', last(3).teamList[1].name === 'Seadra' && last(3).teamList[1].level === 77 && last(3).teamList[1].hp === 60 && last(3).teamList[1].speciesId === 117, last(3).teamList[1]);
n0 = sent.length;
team.handle(3, 'pokemon-update', upd({ id: '2003', level: 78, teamSlot: 2 }), send, nameOf);
ok('an update that does not say the species leaves it as it is (still Seadra)', names(3) === 'Poliwrath:62,Seadra:117' && last(3).teamList[1].level === 78);
team.handle(3, 'pokemon-update', upd({ id: '2003', speciesId: 230, level: 78, teamSlot: 2 }), send, nameOf);
ok('it can evolve again (Seadra becomes Kingdra)', names(3) === 'Poliwrath:62,Kingdra:230', names(3));
team.handle(3, 'pokemon-update', upd({ id: '2003', speciesId: null, teamSlot: 2 }), send, nameOf); team.handle(3, 'pokemon-update', upd({ id: '2003', speciesId: '117', teamSlot: 2 }), send, nameOf); team.handle(3, 'pokemon-update', upd({ id: '2003', speciesId: NaN, teamSlot: 2 }), send, nameOf);
ok('a species that is not a number (null, text, NaN) is ignored', names(3) === 'Poliwrath:62,Kingdra:230', names(3));
// a nickname of its own
fresh(2, rec(1, 133, 30, 1, { nickname: 'Fofinho' }), rec(2, 116, 20, 2));
team.handle(2, 'pokemon-update', upd({ id: '1', speciesId: 134, level: 31, teamSlot: 1 }), send, nameOf);
ok('with a nickname of its own the NAME stays when it evolves (Fofinho), the species follows (134)', last(2).teamList[0].name === 'Fofinho' && last(2).teamList[0].speciesId === 134, last(2).teamList[0]);
team.handle(2, 'pokemon-update', upd({ id: '1', nickname: null, teamSlot: 1 }), send, nameOf);
ok('if the nickname is taken away the name is the species name again (Vaporeon)', last(2).teamList[0].name === 'Vaporeon', last(2).teamList[0]);
team.handle(2, 'pokemon-update', upd({ id: '2', nickname: 'Cavalo', speciesId: 116, teamSlot: 2 }), send, nameOf); team.handle(2, 'pokemon-update', upd({ id: '2', speciesId: 117, teamSlot: 2 }), send, nameOf);
ok('a nickname given and then an evolution: the nickname stays (Cavalo, species 117)', last(2).teamList[1].name === 'Cavalo' && last(2).teamList[1].speciesId === 117, last(2).teamList[1]);
// others
fresh(4, rec(5, 116, 10, 1), rec(6, 116, 10, null));
n0 = sent.length;
team.handle(4, 'pokemon-update', upd({ id: '6', speciesId: 117, level: 36, teamSlot: null }), send, nameOf);
ok('a Pokémon that is not in the team evolving changes nothing for the team (no message)', sent.length === n0 && names(4) === 'Horsea:116', names(4));
team.handle(4, 'pokemon-update', upd({ id: '6', speciesId: 117, level: 36, teamSlot: 2 }), send, nameOf);
ok('one that joins the team already evolved joins as Seadra', names(4) === 'Horsea:116,Seadra:117', names(4));
team.handle(4, 'pokemon-update', upd({ id: '5', speciesId: 117, teamSlot: 1 }), send, nameOf);
team.handle(4, 'ready', roster(rec(5, 117, 10, 1), rec(6, 117, 36, 2)), send, nameOf);
ok('the roster sent again (a new login) after the evolutions has the same species, and a nickname flag that starts again', names(4) === 'Seadra:117,Seadra:117', names(4));
ok('accounts are apart: evolving on account 3 did not touch account 2 or 4', names(2).indexOf('Kingdra') < 0 && names(4).indexOf('Kingdra') < 0);
let threw = false; try { [null, undefined, 5, 'x', {}, { pokemon: null }, { pokemon: { speciesId: 117 } }, { pokemon: { id: null, speciesId: 117 } }].forEach(m => team.handle(3, 'pokemon-update', m, send, nameOf)); } catch (e) { threw = true; }
ok('odd updates (no Pokémon, no id) never throw', !threw);
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
