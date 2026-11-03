// shinyballs.js: how many balls were thrown at SHINY Pokémon (the number the Pokédex shows for each species), counted from the messages the game already sends.
// It only READS. Nothing is ever asked of the game.
//
// Two sources:
//   1. every throw. The game sends the list of wild Pokémon waiting to be caught ("pending": each one has an id and says whether it is shiny) and, for each ball thrown, a
//      "catch-result" with the id of the wild one, the ball used and whether it worked. A throw at a shiny wild one is counted, by kind of ball. These numbers are for the time
//      since the app was started (what the app has seen).
//   2. the Pokédex. When the Capturas tab of a species is opened, the game sends "dex-stats": for each kind of ball, how many were thrown at normal and at shiny ones, all time.
//      The latest answer for each species is kept (it is only known for the species that were opened).
// (The "shinyBalls" number the reader used to send is something else: the stock of the ball that is set for shiny auto-catch.)

const MAX_PENDING = 120;             // wild Pokémon remembered per account (the oldest are forgotten)
const MAX_BALL_KINDS = 8;
const state = {};                    // account -> counts

function acc(a) {
  return state[a] || (state[a] = { pend: new Map(), throws: 0, matched: 0, shinyThrown: 0, shinyCaught: 0, byBall: {}, dex: {}, last: '' });
}

const num = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0);

function summary(account) {
  const st = state[account];
  if (!st) return null;
  let dexBalls = 0, dexShinySpecies = 0, dexOpened = 0;
  Object.keys(st.dex).forEach(k => { dexOpened++; dexBalls += st.dex[k].shinyBalls; if (st.dex[k].shinyBalls > 0) dexShinySpecies++; });
  return { shinyThrown: st.shinyThrown, shinyCaught: st.shinyCaught, throws: st.throws, throwsMatched: st.matched, shinyThrownBy: Object.assign({}, st.byBall), dexShinyBalls: dexBalls, dexShinySpecies: dexShinySpecies, dexOpened: dexOpened };
}

function publish(account, st, send, force) {
  const s = summary(account);
  const key = [s.shinyThrown, s.shinyCaught, s.dexShinyBalls, s.dexShinySpecies, s.dexOpened].join('|');
  if (key === st.last && !force) return;
  st.last = key;
  if (typeof send === 'function') send(account, Object.assign({ live: true }, s));
}

// account: 1 to 4; type: the kind of message; msg: the message already parsed; send(account, data): how the reader gives data to the window
function handle(account, type, msg, send) {
  if (!msg || typeof msg !== 'object') return;
  const st = acc(account);
  if (type === 'pending') {
    const list = Array.isArray(msg.list) ? msg.list : [];
    list.forEach(w => { if (w && typeof w.id === 'string') st.pend.set(w.id, w.shiny === true); });
    while (st.pend.size > MAX_PENDING) st.pend.delete(st.pend.keys().next().value);
    publish(account, st, send, false);                                  // the first one makes the window show 0 instead of a dash
    return;
  }
  if (type === 'catch-result') {
    st.throws++;
    const known = typeof msg.pendingId === 'string' && st.pend.has(msg.pendingId);
    const caughtShiny = msg.success === true && !!msg.pokemon && msg.pokemon.shiny === true;
    if (known || caughtShiny) st.matched++;                             // the kind of the wild one was known: the count does not depend on a guess
    if (caughtShiny || (known && st.pend.get(msg.pendingId) === true)) {
      st.shinyThrown++;
      const ball = typeof msg.ballId === 'string' ? msg.ballId.slice(0, 40) : '?';
      if (st.byBall[ball] !== undefined || Object.keys(st.byBall).length < MAX_BALL_KINDS) st.byBall[ball] = (st.byBall[ball] || 0) + 1;
      if (msg.success === true) st.shinyCaught++;
    }
    if (msg.success === true && typeof msg.pendingId === 'string') st.pend.delete(msg.pendingId);       // the wild one is gone
    publish(account, st, send, st.throws % 25 === 0);                   // the numbers of the check are sent every 25 throws as well
    return;
  }
  if (type === 'dex-stats') {
    if (!Number.isInteger(msg.speciesId)) return;
    let shinyBalls = 0, normalBalls = 0;
    (Array.isArray(msg.balls) ? msg.balls : []).forEach(b => { if (b && typeof b === 'object') { shinyBalls += num(b.shiny); normalBalls += num(b.normal); } });
    st.dex[msg.speciesId] = { shinyBalls: shinyBalls, normalBalls: normalBalls, shinyCaps: num(msg.shiny), caps: num(msg.normal) };
    publish(account, st, send, false);
  }
}

function reset() { Object.keys(state).forEach(k => { delete state[k]; }); }

module.exports = { handle, summary, reset, MAX_PENDING };
