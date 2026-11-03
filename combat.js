// Counts the "hit" and "kill" messages of each game panel, without reading them: how many hits a kill takes, how much time passes between two hits of the same
// fight, and how much from a kill to the first hit of the next one. Only the TYPE of a message and the moment it arrived are used.
//
// The numbers belong to ONE hunt: they start again when a new hunt starts (its start time changes) and when the party size changes. Next to the kills counted from the
// "kill" messages there is the change of the game's own kill counter over the same time, so that "one kill message = one kill" can be checked instead of assumed.

const FIGHT_GAP_MAX_MS = 5000;      // two hits further apart than this are not the same fight
const SPAWN_MAX_MS = 12000;         // a kill and the next hit further apart than this: something else happened in between (a pause, a change of hunt)
const KEEP = 600;                   // gaps kept per panel: the median is taken of the latest ones
const MIN_FOR_MEDIAN = 10;          // fewer gaps than this say nothing yet
const SAMPLES_PER_TYPE = 3;         // how many hit / kill messages per panel are looked into for their field names

const state = {};                   // panel -> counts of the current hunt
const sampled = {};                 // panel -> { hit: n, kill: n }

function fresh(startedAt, size) {
  return {
    startedAt: startedAt === undefined ? null : startedAt, size: size === undefined ? null : size,
    hits: 0, kills: 0, killsAtCounter: null, firstCounter: null, lastCounter: null,
    lastType: null, lastT: 0, gaps: [], spawns: [], since: Date.now()
  };
}
const of = account => state[account] || (state[account] = fresh(null, null));
function median(list) {
  if (!list.length) return null;
  const s = list.slice().sort((a, b) => a - b), m = s.length;
  return m % 2 ? s[(m - 1) / 2] : (s[m / 2 - 1] + s[m / 2]) / 2;
}
function keep(list, v) { list.push(v); if (list.length > KEEP) list.shift(); }

// called for every message of a panel, with its type (null when it has none)
function frame(account, type, now) {
  if (type !== 'hit' && type !== 'kill') return;
  const t = now === undefined ? Date.now() : now, s = of(account);
  if (type === 'hit') {
    s.hits++;
    if (s.lastType === 'hit' && t - s.lastT <= FIGHT_GAP_MAX_MS) keep(s.gaps, t - s.lastT);
    else if (s.lastType === 'kill' && t - s.lastT <= SPAWN_MAX_MS) keep(s.spawns, t - s.lastT);
    s.lastType = 'hit';
  } else {
    s.kills++;
    s.lastType = 'kill';
  }
  s.lastT = t;
}

// called with every hunt-session message: the start time of the hunt, the party size and the game's kill counter (shared by the party)
function session(account, startedAt, size, counter) {
  let s = state[account];
  const sa = startedAt === undefined ? null : startedAt, sz = size === undefined ? null : size;
  if (!s) s = state[account] = fresh(sa, sz);
  else if (s.startedAt === null && s.size === null) { s.startedAt = sa; s.size = sz; }       // what was counted before the hunt was known belongs to it
  else if (s.startedAt !== sa || s.size !== sz) s = state[account] = fresh(sa, sz);           // another hunt, or another party: start again
  if (typeof counter === 'number' && isFinite(counter)) {
    if (s.firstCounter === null) { s.firstCounter = counter; s.killsAtCounter = s.kills; }
    s.lastCounter = counter;
  }
}

function summary(account) {
  const s = state[account];
  if (!s) return null;
  const g = s.gaps.length >= MIN_FOR_MEDIAN ? median(s.gaps) : null, sp = s.spawns.length >= MIN_FOR_MEDIAN ? median(s.spawns) : null;
  return {
    hits: s.hits, kills: s.kills,
    counterKills: s.firstCounter === null ? null : s.lastCounter - s.firstCounter,         // the game's own count over the same time as...
    messageKills: s.firstCounter === null ? null : s.kills - s.killsAtCounter,             // ...the kill messages seen
    gapMs: g === null ? null : Math.round(g), gapN: s.gaps.length,
    spawnMs: sp === null ? null : Math.round(sp), spawnN: s.spawns.length,
    startedAt: s.startedAt, size: s.size, since: s.since
  };
}

// true for the first few hit / kill messages of a panel: the caller reads their field names once, not for every message
function sample(account, type) {
  const c = sampled[account] || (sampled[account] = { hit: 0, kill: 0 });
  if (c[type] === undefined || c[type] >= SAMPLES_PER_TYPE) return false;
  c[type]++;
  return true;
}

function reset(account) { if (account === undefined) { Object.keys(state).forEach(k => delete state[k]); Object.keys(sampled).forEach(k => delete sampled[k]); } else { delete state[account]; delete sampled[account]; } }

module.exports = { frame, session, summary, sample, reset, median, FIGHT_GAP_MAX_MS, SPAWN_MAX_MS, MIN_FOR_MEDIAN, _state: state };
