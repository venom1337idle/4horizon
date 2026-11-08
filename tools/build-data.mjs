import { writeFileSync } from 'fs';
import { loadGame } from './game-exports.mjs';
// (the game's data is found by its content, not by the short names of its exports: see game-exports.mjs)
const { items, hunts, species, names } = await loadGame();
console.log('found in game-data.mjs: items ' + names.items + ', hunts ' + names.hunts + ', species ' + names.species);

const out = { items: {}, hunts: {}, species: {} };
for (const it of items)   out.items[it.id]   = { name: it.name, price: it.npcPrice ?? 0, kind: it.kind };
for (const h of hunts)    out.hunts[h.id]    = { name: h.name, level: h.level, species: h.species };
for (const s of species)  out.species[s.id]  = s.name;

writeFileSync('game-data.json', JSON.stringify(out));
console.log('items: ' + Object.keys(out.items).length +
            ', hunts: ' + Object.keys(out.hunts).length +
            ', species: ' + Object.keys(out.species).length);
