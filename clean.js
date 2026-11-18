// clean.js (lang-73): the clean mini screens. While a game screen is a mini screen (the strip beside an expanded screen, index.html), the boxes the game draws over
// its map are hidden in that page with style rules (insertCSS, like streamer.js hides the e-mails): the player card with the team, the icon bar, the hunt box,
// the chat and the Auto Helper. The game keeps running exactly as before: nothing is pressed, sent or changed, only not drawn. When the screen is expanded
// again (or the strip closes) the rules are taken out and everything is back.
//
// The expanded screen has a clean button too (the eye, beside the arrow): there only the chat, the hunt box and the Auto Helper go; the player card and the icon bar stay.
// The window tells which panels are minis and which one is the clean expanded screen ('clean:set', { minis: [...], big: n }); a game page that loads again gets its rules again.
// The names of the boxes come from Check the game (Diagnostics, "boxes of the screen"): a game update can rename them, then that box shows again in the minis until the
// rule is updated, and Check the game says NOT FOUND for it. Nothing here is ever applied to the normal grid.
// It never throws: the minis simply show the whole game if anything here fails.

'use strict';
let electron = null;
try { electron = require('electron'); } catch (e) { electron = null; }

// the boxes, by the names the game gives them (2026-11-17), all inside its .hud layer; the whole box goes, not only its title
const BOXES = {
  card: '.hud section.trainer-card, .hud .trainer-card.frame',                      // the player card: name, level, VIP, EXP, the team (EQUIPE)
  bar: '.hud .toolbar-wrap, .hud nav.toolbar',                                        // the icon bar: Perfil, Wiki, Rank, Pokédex ... (one row, or two rows when narrow)
  hunt: '.hud .hunt-pill',                                                            // the hunt box top right: the hunt's name and level, the speed, ABATES
  chat: '.hud .chat-panel, .hud .chat-wrap, .hud .chat, .hud .chat-toggle, .hud .chat-bubble',          // the chat (open, or collapsed to its tabs or a bubble): the names are a first guess, Check the game confirms them
  helper: '.hud section.capture, .hud .capture.frame'                                 // the Auto Helper box bottom right
};
const rules = keys => keys.map(k => BOXES[k]).join(',\n') + ' { display: none !important; }';
const CSS = rules(Object.keys(BOXES));                                   // a mini: every box
// the clean expanded screen: the player card and the icon bar stay; the icon bar takes the room of the hunt box (the game keeps equal margins on both sides of it:
// here it runs to the right edge instead, so more icons fit before it scrolls). Written from what Check the game measured; the game's own rules are not known.
const WIDEN = '.hud .toolbar-wrap { right: 14px !important; width: auto !important; max-width: none !important; margin-right: 0 !important; transform: none !important; }\n' +
  '.hud .toolbar-wrap nav.toolbar, .hud .toolbar-wrap .toolbar { width: 100% !important; max-width: none !important; }';
const CSS_BIG = rules(['hunt', 'chat', 'helper']) + '\n' + WIDEN;

const want = new Set();                    // the panels that are minis now (their numbers)
let big = null;                            // the expanded screen with its clean button on (its number), or null
const keys = new WeakMap();                // the inserted rules of each game page: { key, kind: 'mini' | 'big' } (to take them out again)
const hooked = new WeakSet();
const state = { sets: 0, applied: 0, removed: 0, error: '' };
let started = false;

function guestOf(n) { try { return (require('./accounts')._guests || {})[n] || null; } catch (e) { return null; } }

async function apply(n) {
  const wc = guestOf(n); if (!wc) return false;
  try { if (wc.isDestroyed && wc.isDestroyed()) return false; } catch (e) { return false; }
  hook(wc, n);
  const cur = keys.get(wc), kind = want.has(n) ? 'mini' : (big === n ? 'big' : null);
  if ((cur ? cur.kind : null) === kind) return false;
  try {
    if (cur) { keys.delete(wc); await wc.removeInsertedCSS(cur.key); state.removed++; }
    if (kind) { const key = await wc.insertCSS(kind === 'mini' ? CSS : CSS_BIG); keys.set(wc, { key: key, kind: kind }); state.applied++; }
    return true;
  } catch (e) { state.error = String(e && e.message || e).slice(0, 60); keys.delete(wc); }
  return false;
}
function hook(wc, n) {
  if (hooked.has(wc)) return;
  hooked.add(wc);
  try { wc.on('dom-ready', () => { keys.delete(wc); apply(n); }); } catch (e) {}          // a new page (reload, login): its old rules are gone, they are put in again if it is still a mini
}
// the window says which panels are minis now, and which one is the clean expanded screen ({ minis, big }; a plain list means minis only, as the first window did)
const okN = n => Number.isInteger(n) && n >= 1 && n <= 4;
function set(v) {
  const list = Array.isArray(v) ? v : (v && typeof v === 'object' && Array.isArray(v.minis)) ? v.minis : [];
  const next = list.map(Number).filter(okN), nb = (v && typeof v === 'object' && !Array.isArray(v) && okN(Number(v.big))) ? Number(v.big) : null;
  const before = Array.from(want).concat(big ? [big] : []);
  want.clear(); next.forEach(n => want.add(n)); big = (nb !== null && !want.has(nb)) ? nb : null; state.sets++;
  const touched = new Set(before.concat(next, big ? [big] : []));
  touched.forEach(n => { apply(n); });
  return { minis: Array.from(want).sort(), big: big };
}
function init() {
  if (started || !electron || !electron.ipcMain || !electron.ipcMain.handle) return;
  started = true;
  let S = null; try { S = require('./settings'); } catch (e) { S = null; }
  const ours = e => !!(S && S.fromOurWindow && S.fromOurWindow(e));          // only the app's own window, never a game panel
  electron.ipcMain.handle('clean:set', (e, list) => (ours(e) ? set(list) : null));
}
function info() {
  const panels = [];
  for (let n = 1; n <= 4; n++) { const wc = guestOf(n); if (wc) { const k = keys.get(wc); panels.push({ n: n, mini: want.has(n), big: big === n, clean: !!k, kind: k ? k.kind : null }); } }
  return { minis: Array.from(want).sort(), big: big, panels: panels, sets: state.sets, applied: state.applied, removed: state.removed, error: state.error || null, boxes: Object.keys(BOXES) };
}

module.exports = { init, set, info, apply, CSS, CSS_BIG, BOXES, _reset: () => { want.clear(); big = null; state.sets = 0; state.applied = 0; state.removed = 0; state.error = ''; } };
