// game-exports.mjs: finds what the build scripts need in the game's data module (tools/game-data.mjs) by WHAT it is, not by its short name.
// The game's code is minified: its exports are called I, H, j, aa... and those names change with every game update (2026-11-03: the species
// went from "j" to "p", the drops from "aa" to "K", the moves from "am" to "ax"). Each piece is recognised by its content or its behaviour instead.
// If something cannot be found, the build stops with a message saying what is missing (it never builds a half-wrong list).

const has = (o, keys) => o && typeof o === 'object' && keys.every(k => k in o);
const arrays = (M, keys) => Object.keys(M).filter(k => Array.isArray(M[k]) && M[k].length && has(M[k][0], keys)).sort((a, b) => M[b].length - M[a].length);
const fns = M => Object.keys(M).filter(k => typeof M[k] === 'function');
const tryCall = (f, x) => { try { return f(x); } catch (e) { return undefined; } };

export async function loadGame(path = './game-data.mjs') {
  const M = await import(path);
  const need = (what, list) => { if (!list.length) throw new Error('game-data.mjs: could not find ' + what + ' (the game changed more than expected: see tools/README.md)'); return list[0]; };
  const names = {};

  names.items = need('the items (id, name, kind, npcPrice)', arrays(M, ['id', 'name', 'kind', 'npcPrice', 'buyPrice']));
  names.hunts = need('the hunts (id, name, species, level)', arrays(M, ['id', 'name', 'type', 'species', 'level']));
  names.species = need('the species (id, name, types, base, learnset)', arrays(M, ['id', 'name', 'types', 'base', 'learnset']));
  names.moves = need('the moves (id, name, type, category, power)', arrays(M, ['id', 'name', 'type', 'category', 'power']));
  // (the settings: starters, wild, combat, and the XP of a kill in either form: killXpByHuntLevel before 2026-11-03, killXpCurve since)
  names.cfg = need('the game settings (starters, wild, combat, killXpCurve or killXpByHuntLevel)', Object.keys(M).filter(k => has(M[k], ['starters', 'wild', 'combat']) && ('killXpCurve' in M[k] || 'killXpByHuntLevel' in M[k])));
  const items = M[names.items], hunts = M[names.hunts], species = M[names.species], moves = M[names.moves], cfg = M[names.cfg];
  const step = Math.max(1, Math.floor(species.length / 12)), sample = species.filter((s, i) => i % step === 0).slice(0, 12);          // (12 species spread over the list, however long it is)

  // a species by its id: gives back that species
  names.speciesById = need('the function that gives a species by its id', fns(M).filter(k => sample.every(s => { const r = tryCall(M[k], s.id); return r && r.id === s.id && r.name === s.name; })));
  // the region of a species: a short lower-case name ("kanto", "johto"...), a few different ones over the species
  names.regionOf = need('the function that gives the region of a species', fns(M).filter(k => { const r = sample.map(s => tryCall(M[k], s.id)); return r.every(x => typeof x === 'string' && /^[a-z]{3,12}$/.test(x)) && new Set(r).size > 1 && new Set(r).size <= 12; }));
  // the drops of a species: a list of { item, chance, min, max }
  names.drops = need('the function that gives the drops of a species', fns(M).filter(k => sample.filter(s => { const r = tryCall(M[k], s.id); return Array.isArray(r) && (r.length === 0 || has(r[0], ['item', 'chance', 'min', 'max'])); }).length === sample.length && sample.some(s => (tryCall(M[k], s.id) || []).length > 0)));
  // the trainer level that unlocks a hunt: 1 for the hunts of the starters, otherwise its level (at least 1)
  const starterHunts = hunts.filter(h => h.species.some(id => cfg.starters.includes(id)));
  names.unlockOf = need('the function that gives the unlock level of a hunt', fns(M).filter(k => {
    const all = hunts.map(h => tryCall(M[k], h));
    if (!all.every(v => typeof v === 'number')) return false;
    const others = hunts.filter(h => starterHunts.indexOf(h) < 0), plain = others.filter(h => M[k](h) === Math.max(1, h.level)).length;          // (the starters' hunts are the exception by design)
    return starterHunts.length > 0 && starterHunts.every(h => M[k](h) === 1) && plain >= others.length * 0.9;
  }));

  return { items, hunts, species, moves, cfg, speciesById: M[names.speciesById], regionOf: M[names.regionOf], drops: M[names.drops], unlockOf: M[names.unlockOf], names };
}
