// donate-guard.js: the "+ Doar" button of the diamond shop of the game cannot be pressed in the app.
//
// For safety the donation is not made from inside the app. In the shop of diamonds ("Loja de Diamantes") of every game panel three things are blocked: the button "+ Doar" of the box "Seus diamantes",
// the tab "Diamantes" (the page of the donation) and, if that page is open anyway (the game can remember the last tab), its button "Doar R$ ... com Pix" / "com Cartão".
// The text below tells how the button "+ Doar" is dealt with; the tab and the pay button are hidden, disabled and stopped in the same way, without a note:
//   - the button "+ Doar" (or "Donate") is hidden, disabled and made unreachable by the keyboard, AND every press of it (mouse, touch, Enter, Space, also one made by a script)
//     is stopped before the game sees it, so it does nothing even if the game draws it again in another way;
//   - in its place there is a note: "Visit the official webpage to donate", with the word "webpage" as a link to https://pokehorizonidle.com/ that opens in the default browser
//     (the link asks for a new window, which external.js sends to the browser). The note follows the language of the app.
// Only that one button is touched: another "Doar" of the game (a guild, for example) is not in the box of the diamonds and works as before.
// How: a small script is put in each game page (when it loads) and watches the page. Nothing is clicked in the game. The script uses no style sheet and no markup text (so a strict
// content policy of the page cannot stop it) and tells this module, with a line in the console of the page, when it saw the button and when it stopped a press (for the report).

let electron = null, i18n = null;
try { electron = require('electron'); } catch (e) {}
try { i18n = require('./i18n'); } catch (e) {}

const OFFICIAL = 'https://pokehorizonidle.com/';
const hooked = new WeakSet();
const live = new Set();                  // the game panels that are hooked and not gone
const states = new WeakMap();            // per web contents: { loads, at, error, seenAt, blocked, blockedAt }
let started = false, langHooked = false;
let clock = () => Date.now();

// the words of the note, in the language of the app (the link is the second part)
function texts(lang) {
  const pt = /^pt/i.test(String(lang || ''));
  return pt ? { before: 'Visite a ', link: 'página', after: ' oficial para doar' } : { before: 'Visit the official ', link: 'webpage', after: ' to donate' };
}
function config() {
  let lang = 'en';
  try { if (i18n && i18n.getLang) lang = i18n.getLang(); } catch (e) {}
  return Object.assign({ url: OFFICIAL }, texts(lang));
}

// ---------------------------------------------------------------------------------------------------------------
// This function is sent to the game page as text and runs THERE. It can be run again (a page that loads again, a new language): it then only updates the note.
// ---------------------------------------------------------------------------------------------------------------
function guardInPage(cfg) {
  const NOTE = 'data-4h-note', MARK = 'data-4h-blocked', KIND = 'data-4h-kind';
  if (window.__4hDonate) { window.__4hDonate.set(cfg); return 'updated'; }
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const plain = s => norm(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const WORD = /^[+\s]*(doar|donate|donar|doacao|donation)[\s!.]*$/;                       // "+ Doar"
  const PAY = /^(doar|donate|donar)\s*(r\$|us\$|\$|\u20ac)/;                               // "Doar R$ 33,25 com Pix": the button that makes the donation (real money, anywhere)
  const TAB = /^(diamantes|diamonds)$/;                                                    // the tab "Diamantes" of the shop: the page of the donation
  const CLICKABLE = 'button,[role="button"],[role="tab"],a,[onclick],input[type="button"],input[type="submit"]';
  // something the game draws as a button but is not a <button> (a box with a click handler) still has the hand cursor
  // (the hand cursor is inherited by everything inside the box, so the whole box is the biggest element with the hand cursor and the very same text)
  const pointerAncestor = el => {
    let found = null, x = el;
    for (let i = 0; x && x !== document.body && x !== document.documentElement && i < 6; i++, x = x.parentElement) {
      let cur = '';
      try { cur = getComputedStyle(x).cursor; } catch (e) {}
      if (cur === 'pointer') { if (!found) found = x; else if (plain(x.textContent) === plain(found.textContent)) found = x; else break; }
      else if (found) break;
    }
    return found;
  };
  const clickableOf = el => ((el && el.closest) ? (el.closest(CLICKABLE) || pointerAncestor(el)) : null);
  const textOf = c => plain(c.value || c.textContent || (c.getAttribute && c.getAttribute('aria-label')) || '');
  // the window of the diamond shop begins with its title
  function shopTitle(c) {
    let a = c;
    for (let i = 0; a && a !== document.body && a !== document.documentElement && i < 18; i++, a = a.parentElement) {
      const t = plain(a.textContent);
      if (t.indexOf('loja de diamantes') === 0 || t.indexOf('diamond shop') === 0 || t.indexOf('tienda de diamantes') === 0) return true;
    }
    return false;
  }
  // the box "Seus diamantes" / "Your diamonds" with the number and the button
  function diamondBox(c) {
    let a = c;
    for (let i = 0; a && a !== document.body && a !== document.documentElement && i <= 6; i++, a = a.parentElement) {
      const t = plain(a.textContent);
      if (t.length <= 200 && /(seus|teus|your|tus)\s+(diamantes|diamonds)/.test(t)) return true;
    }
    return false;
  }
  // the row of tabs of the shop (Boosts, VIP, Outfits, ...)
  function shopTabs(c) {
    let a = c;
    for (let i = 0; a && a !== document.body && a !== document.documentElement && i <= 7; i++, a = a.parentElement) {
      const t = plain(a.textContent);
      if (t.length <= 160 && /boosts/.test(t) && /outfits/.test(t)) return true;
    }
    return false;
  }
  // what this button is: 'donate' (+ Doar of the box), 'tab' (the tab Diamantes), 'pay' (Doar R$ ... com Pix), or nothing
  function kindOf(c) {
    const t = textOf(c);
    if (!t || t.length > 48) return null;
    if (PAY.test(t)) return 'pay';
    if (t.length <= 24 && WORD.test(t) && (diamondBox(c) || shopTitle(c))) return 'donate';
    if (TAB.test(t) && (shopTitle(c) || shopTabs(c))) return 'tab';
    return null;
  }
  let C = cfg, blocked = 0, lastLine = 0;
  const seen = { donate: false, tab: false, pay: false };
  const say = line => { try { console.log(line); } catch (e) {} };
  // every press of them is stopped at the top of the page, before the game sees it
  const stop = (e, count) => {
    e.stopImmediatePropagation(); e.preventDefault();
    if (count) { blocked++; const now = Date.now(); if (now - lastLine > 500) { lastLine = now; say('4h-donate:blocked'); } }
  };
  const guarded = el => { const c = clickableOf(el); return c ? kindOf(c) : null; };
  ['click', 'auxclick', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach(type => {
    window.addEventListener(type, e => { if (guarded(e.target)) stop(e, type === 'click' || type === 'auxclick' || type === 'touchend'); }, true);
  });
  ['keydown', 'keyup', 'keypress'].forEach(type => {
    window.addEventListener(type, e => {
      const enter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter', space = e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space';
      if ((enter || space) && guarded(e.target)) stop(e, type === 'keydown');
    }, true);
  });
  // the note: "Visit the official [webpage] to donate"
  function fill(s) {
    s.textContent = '';
    s.appendChild(document.createTextNode(C.before));
    const a = document.createElement('a');
    a.href = C.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = C.link;
    a.style.cssText = 'color:#7fd6ff;font-weight:700;text-decoration:underline;cursor:pointer;';
    s.appendChild(a);
    s.appendChild(document.createTextNode(C.after));
  }
  function ensureNote(b) {
    const prev = b.previousElementSibling;
    if (prev && prev.hasAttribute(NOTE)) return;
    const s = document.createElement('span');
    s.setAttribute(NOTE, '1');
    s.style.cssText = 'display:inline-block;max-width:190px;margin:0 6px;font-size:12px;line-height:1.3;font-weight:500;text-align:left;color:rgba(255,255,255,.85);';
    fill(s);
    if (b.parentNode) b.parentNode.insertBefore(s, b);
  }
  // the buttons that could be one of them: from the pieces of text of the page (a label can be in pieces: "Doar R$ ", the price, " com Pix")
  function candidates() {
    const out = new Set(), w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const raw = n.nodeValue;
      if (!raw || raw.length > 60) continue;
      const t = plain(raw);
      if (!t || !(WORD.test(t) || PAY.test(t) || TAB.test(t))) continue;
      const c = clickableOf(n.parentElement);
      if (c) out.add(c);
    }
    return Array.from(out);
  }
  function sweep() {
    const found = { donate: [], tab: [], pay: [] };
    candidates().forEach(c => { const k = kindOf(c); if (k) found[k].push(c); });
    Object.keys(found).forEach(k => found[k].forEach(b => {
      if (b.getAttribute(MARK) !== '1') {
        b.setAttribute(MARK, '1'); b.setAttribute('aria-hidden', 'true'); b.setAttribute('tabindex', '-1');
        try { b.disabled = true; } catch (e) {}
        try { b.inert = true; } catch (e) {}
      }
      b.setAttribute(KIND, k);
      b.style.setProperty('display', 'none', 'important');
      if (k === 'donate') ensureNote(b);
    }));
    Array.prototype.forEach.call(document.querySelectorAll('[' + NOTE + ']'), n => {      // a note whose button is gone (the shop was closed or drawn again)
      const nx = n.nextElementSibling;
      if (!(nx && nx.getAttribute(MARK) === '1')) n.remove();
    });
    Object.keys(found).forEach(k => { if (found[k].length && !seen[k]) { seen[k] = true; say(k === 'donate' ? '4h-donate:seen' : '4h-donate:' + k); } else if (!found[k].length) seen[k] = false; });
  }
  let timer = 0;
  const later = () => { if (timer) return; timer = setTimeout(() => { timer = 0; try { sweep(); } catch (e) {} }, 200); };
  try { new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  window.__4hDonate = { set: c => { C = c; Array.prototype.forEach.call(document.querySelectorAll('[' + NOTE + ']'), fill); }, sweep: sweep, stats: () => ({ blocked: blocked, seen: seen.donate, tab: seen.tab, pay: seen.pay }) };
  sweep();
  return 'installed';
}
const scriptFor = cfg => '(' + guardInPage.toString() + ')(' + JSON.stringify(cfg) + ')';

// ---------------------------------------------------------------------------------------------------------------
function stateOf(wc) { let s = states.get(wc); if (!s) { s = { loads: 0, at: 0, error: '', seenAt: 0, blocked: 0, blockedAt: 0 }; states.set(wc, s); } return s; }
async function inject(wc) {
  if (!wc) return;
  try { if (typeof wc.isDestroyed === 'function' && wc.isDestroyed()) return; } catch (e) {}
  const s = stateOf(wc);
  try { await wc.executeJavaScript(scriptFor(config())); s.loads++; s.at = clock(); s.error = ''; }
  catch (e) { s.error = String((e && e.message) || e).slice(0, 80); }
}
// the lines the page writes in its console (only these two exact lines count; anything else is the game's own)
function onConsole(wc, a, c) {                       // (event, level, message, line, source) in the older form; the event itself carries the message in the newer one
  try {
    const msg = typeof c === 'string' ? c : (a && typeof a.message === 'string' ? a.message : '');
    const s = stateOf(wc);
    if (msg === '4h-donate:seen') s.seenAt = clock();
    else if (msg === '4h-donate:tab') s.tabAt = clock();
    else if (msg === '4h-donate:pay') s.payAt = clock();
    else if (msg === '4h-donate:blocked') { s.blocked = Math.min(s.blocked + 1, 9999); s.blockedAt = clock(); }
  } catch (e) {}
}
function hook(wc) {
  if (!wc || hooked.has(wc)) return;
  let type = '';
  try { type = typeof wc.getType === 'function' ? wc.getType() : ''; } catch (e) {}
  if (type !== 'webview') return;                                       // only the game panels
  hooked.add(wc); live.add(wc);
  try { wc.on('dom-ready', () => inject(wc)); } catch (e) {}
  try { wc.on('did-finish-load', () => inject(wc)); } catch (e) {}
  // (lang-67) one parameter: Electron warns about a listener that takes the old separate arguments; an older Electron still gives them in arguments[2]
  try { wc.on('console-message', function (ev) { onConsole(wc, ev, arguments[2]); }); } catch (e) {}
  try { wc.on('destroyed', () => live.delete(wc)); } catch (e) {}
  try { if (typeof wc.isLoading === 'function' && !wc.isLoading() && typeof wc.getURL === 'function' && wc.getURL()) inject(wc); } catch (e) {}       // a panel that was already loaded
}
function init() {
  if (started || !electron) return;
  started = true;
  try { if (electron.app && electron.app.on) electron.app.on('web-contents-created', (ev, wc) => hook(wc)); } catch (e) {}
  try { if (electron.webContents && electron.webContents.getAllWebContents) electron.webContents.getAllWebContents().forEach(hook); } catch (e) {}
  try { if (i18n && i18n.onChange && !langHooked) { langHooked = true; i18n.onChange(() => { live.forEach(wc => inject(wc)); }); } } catch (e) {}      // a new language: the note is written again (listened to once)
}
// for the report of the Diagnostics
function info() {
  const out = [];
  try {
    const g = require('./accounts')._guests || {};
    const t = clock();
    for (let n = 1; n <= 4; n++) {
      const wc = g[n];
      if (!wc) continue;
      const s = states.get(wc) || { loads: 0, at: 0, error: '', seenAt: 0, tabAt: 0, payAt: 0, blocked: 0, blockedAt: 0 };
      const age = v => (v ? Math.max(0, Math.round((t - v) / 1000)) : null);
      out.push({ n: n, loads: s.loads, ageSec: age(s.at), error: s.error, seenAgeSec: age(s.seenAt), tabAgeSec: age(s.tabAt), payAgeSec: age(s.payAt), blocked: s.blocked });
    }
  } catch (e) {}
  return { panels: out };
}

module.exports = { init, info, hook, inject, scriptFor, guardInPage, texts, config, OFFICIAL, _reset: () => { started = false; live.clear(); }, _setClock: f => { clock = f || (() => Date.now()); } };
