// supplies.js: the KINDS of balls and potions an account has, from the inventory message of the game, so that the Summary can add up only the kinds the user chooses.
//
// The game sends the inventory as two lists, "items" and "boundItems" (the ones that cannot be traded); a ball or a potion can be in both.
// Only "items" is counted (lang-39): it is what the game's own counters show (the Auto Helper) and what the reader's totals and the auto-catch stock already used.
// Adding "boundItems" counted some balls twice (Luxury: 857 in the game, 1,090 in the Summary). What "boundItems" has is kept for the report of the
// Diagnostics (boundSeen), so it can be checked. Kinds with nothing left are not listed. Only READS, nothing is ever asked of the game.
//
// BALLS: only the Poké Balls of the game, by name (BALLS below) and the ones the account itself uses (auto-catch: the reader passes them as `extra`).
// An id that merely ends with "-ball" is NOT a ball: "earth-ball" (Bola de Terra, $1) and "shadow-ball" are things Pokémon drop. Those that were left out are kept in a short
// list for the report of the Diagnostics (info), so that a real ball that is missing from BALLS can be added.
// POTIONS: the id is "potion" or ends with "-potion" (potion, super-potion, gift-potion, great-potion...).

const BALLS = ['poke-ball', 'great-ball', 'ultra-ball', 'master-ball', 'luxury-ball', 'idle-ball'];
const POTION = /(^|-)potion$/;
const BALLISH = /(^|-)ball$/;
const MAX_KINDS = 16;                 // kinds listed per account (a bug cannot grow the list)
const MAX_IGNORED = 24;
const ignored = new Set();            // ids that end with "-ball", were in stock and were left out (for the report)
const boundSeen = {};                 // balls and potions found in "boundItems" (not counted): the last amount seen of each, for the report

// kind: 'ball' or 'potion'. extra: ids the account uses as balls (optional). Returns an object { 'ultra-ball': 22312, ... }; {} when there is none
function types(items, bound, kind, extra) {
  const isBall = id => BALLS.indexOf(id) >= 0 || (Array.isArray(extra) && extra.indexOf(id) >= 0);
  if (kind !== 'ball' && kind !== 'potion') return undefined;
  const out = {};
  const each = (src, fn) => {
    if (!src || typeof src !== 'object') return;
    Object.keys(src).forEach(id => {
      if (id.length > 40) return;
      const n = Number(src[id]);
      if (!isFinite(n) || n <= 0) return;
      if (kind === 'ball' ? !isBall(id) : !POTION.test(id)) { if (kind === 'ball' && fn === count && BALLISH.test(id) && ignored.size < MAX_IGNORED) ignored.add(id); return; }
      fn(id, Math.floor(n));
    });
  };
  const count = (id, n) => { if (out[id] === undefined && Object.keys(out).length >= MAX_KINDS) return; out[id] = (out[id] || 0) + n; };
  each(items, count);
  each(bound, (id, n) => { if (boundSeen[id] !== undefined || Object.keys(boundSeen).length < MAX_IGNORED) boundSeen[id] = n; });
  return out;
}

// for the report of the Diagnostics
function info() { return { ignoredBalls: Array.from(ignored).sort(), boundSeen: Object.assign({}, boundSeen) }; }
function reset() { ignored.clear(); Object.keys(boundSeen).forEach(k => { delete boundSeen[k]; }); }

module.exports = { types, info, reset, BALLS, MAX_KINDS };
