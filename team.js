// team.js
// Keeps the TEAM of each account (up to 6 Pokemon) from the game's own messages, and tells the dashboard when it changes.
//
// Where the data comes from:
//   - "ready" (sent once at login): the whole roster. Every Pokemon is a record with the fields id, speciesId, level, xp, hp, maxHp,
//     shiny, nickname and teamSlot. teamSlot is empty (null) for a Pokemon that is not in the team, a number for one that is.
//   - "pokemon-update": one Pokemon changed (hp, xp, level, or it joined / left the team).
//   - "character": says which one is the active (leading) Pokemon.
// Only what the game sends is used. Nothing is asked of the game.

const MAX_TEAM = 6;
const accounts = {};
const state = a => accounts[a] || (accounts[a] = { members: {}, nick: {}, activeId: null, last: '' });      // nick: which members have a nickname of their own (then the name does not follow the species)

// every record that looks like a Pokemon (it has an id, a speciesId and a teamSlot field) anywhere inside a message
function findPokemon(root) {
  const found = [];
  const stack = [root];
  let budget = 40000;
  while (stack.length && budget-- > 0) {
    const v = stack.pop();
    if (Array.isArray(v)) {
      if (v.length && v[0] && typeof v[0] === 'object' && 'speciesId' in v[0] && 'teamSlot' in v[0]) { v.forEach(x => { if (x && typeof x === 'object') found.push(x); }); continue; }
      for (let i = 0; i < v.length; i++) if (v[i] && typeof v[i] === 'object') stack.push(v[i]);
    } else if (v && typeof v === 'object') {
      for (const k in v) if (v[k] && typeof v[k] === 'object') stack.push(v[k]);
    }
  }
  return found;
}

function member(p, nameOf) {
  return {
    id: String(p.id), speciesId: p.speciesId,
    name: p.nickname ? String(p.nickname) : nameOf(p.speciesId),
    level: p.level, xp: p.xp, hp: p.hp, maxHp: p.maxHp || p.hp,
    slot: p.teamSlot, shiny: !!p.shiny
  };
}

function emit(account, send) {
  const st = state(account);
  const list = Object.keys(st.members).map(k => st.members[k]).sort((a, b) => Number(a.slot) - Number(b.slot)).slice(0, MAX_TEAM);
  const key = JSON.stringify([list, st.activeId]);
  if (key === st.last) return;                                   // nothing changed: say nothing
  st.last = key;
  send(account, { teamList: list, teamActiveId: st.activeId, live: true });
}

function handle(account, type, msg, send, nameOf) {
  if (!msg || typeof msg !== 'object') return;
  const st = state(account);
  const nm = typeof nameOf === 'function' ? nameOf : (id => '#' + id);

  if (type === 'character') {
    const c = msg.character;
    if (c && c.activePokemonId != null && String(c.activePokemonId) !== st.activeId) { st.activeId = String(c.activePokemonId); emit(account, send); }
    return;
  }

  if (type === 'ready') {
    const all = findPokemon(msg);
    if (!all.length) return;                                     // no roster in this message: keep what we have
    st.members = {}; st.nick = {};
    all.forEach(p => { if (p.id != null && p.teamSlot !== null && p.teamSlot !== undefined) { st.members[String(p.id)] = member(p, nm); st.nick[String(p.id)] = !!p.nickname; } });
    const c = msg.character;
    if (c && c.activePokemonId != null) st.activeId = String(c.activePokemonId);
    emit(account, send);
    return;
  }

  if (type === 'pokemon-update') {
    const p = msg.pokemon;
    if (!p || p.id == null) return;
    const id = String(p.id);
    if (p.teamSlot === null) {                                   // it is not in the team (any more)
      if (st.members[id]) { delete st.members[id]; delete st.nick[id]; emit(account, send); }
      return;
    }
    if (st.members[id]) {                                        // a member: take the fields that came with this update
      const m = st.members[id];
      ['level', 'xp', 'hp'].forEach(k => { if (p[k] !== undefined) m[k] = p[k]; });
      if (p.maxHp) m.maxHp = p.maxHp;
      if (p.teamSlot !== undefined) m.slot = p.teamSlot;
      if (p.nickname !== undefined) { m.name = p.nickname ? String(p.nickname) : nm(m.speciesId); st.nick[id] = !!p.nickname; }
      // it evolved: every update carries the species, and the new one replaces the old (its name follows, unless it has a nickname of its own)
      if (Number.isInteger(p.speciesId) && p.speciesId > 0 && p.speciesId !== m.speciesId) { m.speciesId = p.speciesId; if (!st.nick[id]) m.name = nm(p.speciesId); }
      emit(account, send);
    } else if (p.teamSlot !== undefined && p.speciesId !== undefined) {   // it joined the team
      st.members[id] = member(p, nm); st.nick[id] = !!p.nickname;
      emit(account, send);
    }
  }
}

module.exports = { handle, MAX_TEAM, _state: accounts, _findPokemon: findPokemon };
