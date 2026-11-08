import { writeFileSync } from 'fs';
import { loadGame } from './game-exports.mjs';
// (the game's data is found by its content, not by the short names of its exports: see game-exports.mjs)
const g = await loadGame();
const G = { B: g.cfg, I: g.items, H: g.hunts, j: g.species, am: g.moves, a: g.speciesById, s: g.regionOf, aa: g.drops, h: g.unlockOf };
console.log('found in game-data.mjs: ' + Object.entries(g.names).map(([k, v]) => k + '=' + v).join(', '));

const cfg = G.B;
const price = {};
for (const it of G.I) price[it.id] = it.npcPrice || 0;

const QUALITY = [[0.05,0.85],[0.05,0.95],[0.3403846,1.05],[0.20,1.15],[0.10,1.25],
                 [0.10,1.35],[0.10,1.45],[0.05,1.55],[0.0067308,1.75],[0.0028846,1.8]];
const qualityAvg = QUALITY.reduce((s, [p, q]) => s + p * q, 0);

const JACKPOT_FROM = 10000;
const bands = cfg.killXpHuntLevelBands || [];

function xpPerKill(h) {
  // since the game's update of 2026-11-03: a fixed XP per kill for the hunts of Nv. 150 and up (killXpCurve.fixedKillXp, the "EXP por abate" of
  // the Hunts panel); below that the game works it out from its minutes-per-level curve in code that is not in this file, so it is left empty
  // (4horizon itself does not use the XP per kill: it only uses the names, levels, unlock levels and Pokémon of the hunts)
  if (cfg.killXpCurve && Array.isArray(cfg.killXpCurve.fixedKillXp)) { const f = cfg.killXpCurve.fixedKillXp.find(x => x.level === h.level); return f ? f.xp : null; }
  const sp = G.a(h.species[0]);
  const base = cfg.killXpByHuntLevel[h.level] ?? sp.experience * cfg.killXpMultiplier;
  const band = bands.find(b => h.level >= b.minLevel && h.level <= b.maxLevel);
  return base * (band ? band.multiplier : 1) * cfg.regionKillXpMultiplier[G.s(h.species[0])];
}

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const out = [];

for (const h of G.H) {
  if (h.fishing) continue;
  let loot = 0, rare = 0;
  for (const id of h.species) {
    for (const d of G.aa(id)) {
      const p = d.chance / 1e5, qty = (d.min + d.max) / 2, v = price[d.item] || 0;
      if (v >= JACKPOT_FROM) rare += p;
      else loot += p * qty * v;
    }
  }
  const n = h.species.length;
  out.push({
    id: h.id, name: h.name, level: h.level, unlock: G.h(h), type: h.type, site: h.site, site: h.site,
    region: G.s(h.species[0]),
    species: h.species.map(id => G.a(id).name),
    ids: h.species,
    xp: (x => (x === null ? null : round(x)))(xpPerKill(h)), loot: round(loot / n, 2), rare: round(rare / n, 6),
    sells: h.species.map(id => G.a(id).sellValue)
  });
}

// every species: types, base stats (hp, atk, def, spa, spd, spe) and what it learns at which level
const species = {};
for (const s of G.j) {
  species[s.id] = {
    n: s.name, t: s.types,
    b: [s.base.hp, s.base.atk, s.base.def, s.base.spa, s.base.spd, s.base.spe],
    l: s.learnset.map(e => [e.move, e.level, e.cooldownMs])
  };
}

// every damaging move: [type, P(hysical) or S(pecial), power, name]
const moves = {};
for (const m of G.am) {
  if (m.power > 0 && m.category !== 'STATUS') moves[m.id] = [m.type, m.category === 'SPECIAL' ? 'S' : 'P', m.power, m.name];
}

const wanted = ['poke-ball', 'great-ball', 'ultra-ball', 'luxury-ball'];
const balls = G.I.filter(x => wanted.includes(x.id)).map(x => ({
  id: x.id, name: x.name, captureValue: x.captureValue,
  price: x.buyPrice || 0, diamonds: x.id === 'luxury-ball'
}));

writeFileSync('hunt-data.js', 'window.HUNT_DATA = ' + JSON.stringify({
  qualityAvg: round(qualityAvg, 4), jackpotFrom: JACKPOT_FROM, balls: balls, hunts: out,
  species: species, moves: moves,
  cfg: { wild: cfg.wild, combat: cfg.combat, moves: cfg.moves }
}) + ';');

console.log('hunts: ' + out.length + ', species: ' + Object.keys(species).length + ', damaging moves: ' + Object.keys(moves).length);
console.log('Haunter at Lv 89 can use: ' + species[93].l.filter(e => e[1] <= 89 && moves[e[0]]).map(e => moves[e[0]][3]).join(', '));


