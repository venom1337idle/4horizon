// tidy.js
// Tidies each game panel right after it loads or you log in:
//   - closes the "ANÚNCIO OFICIAL" announcement popup
//   - closes the Hunt Analyzer window
//   - collapses the chat (only if it is open)
// These are only clicks on close / collapse buttons, the same ones you would click. Nothing in the game itself is played.
//
// It only acts in the first minutes after the page loads or a login happens (see onlyFirstSeconds), so it never closes a window that
// you open yourself later, and you can open the Hunt Analyzer again by hand whenever you like.
//
// Settings: tidy-settings.json (created on first run) (lang-50: in the user-data folder, see datadir.js; an older one in the app folder is moved there once). Changes apply the next time a panel loads (Reload all).
// What it did, or why it could not, is printed in the console window as lines starting with "tidy".

const fs = require('fs');
const path = require('path');

let SETTINGS_FILE; try { SETTINGS_FILE = require('./datadir').file('tidy-settings.json'); } catch (e) { SETTINGS_FILE = path.join(__dirname, 'tidy-settings.json'); }
const DEFAULTS = {
  enabled: true,
  closeAnnouncements: true,
  closeHuntAnalyzer: true,
  hideChat: true,
  announcementWords: ['anuncio oficial', 'official announcement'],   // a popup whose heading contains one of these (accents and capitals ignored)
  onlyFirstSeconds: 180
};

function settings() {
  let user = null;
  try { user = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8').replace(/^\uFEFF/, '')); }
  catch (e) {
    if (e.code === 'ENOENT') { try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULTS, null, 2)); } catch (x) {} }
    else console.log('tidy: tidy-settings.json is not valid (' + e.message + '). Using the defaults.');
  }
  const s = Object.assign({}, DEFAULTS, user && typeof user === 'object' ? user : {});
  s.announcementWords = (Array.isArray(s.announcementWords) ? s.announcementWords : DEFAULTS.announcementWords).map(String).slice(0, 20);
  s.onlyFirstSeconds = Math.max(10, Math.min(3600, Number(s.onlyFirstSeconds) || DEFAULTS.onlyFirstSeconds));
  return s;
}

// ---------------------------------------------------------------------------------------------------------------
// This function is sent to the game page as text and runs THERE. It is a plain function so it can be tested on its own.
// ---------------------------------------------------------------------------------------------------------------
function tidyInPage(cfg) {
  if (window.__hgTidy && window.__hgTidy.stop) window.__hgTidy.stop();          // a newer copy replaces the old one
  const T = window.__hgTidy = { log: [] };
  const say = msg => { T.log.push(msg); try { console.log('[hg-tidy] ' + msg); } catch (e) {} };

  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const plain = s => norm(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');       // lower case, no accents
  // lang-59: really on screen. Since the game's update of 2026-11-03 a closed Hunt Analyzer stays in the page, its box faded or slid out of view:
  // the element itself looks shown, so every box around it is checked too, and that it is on the screen
  const visible = el => {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false;
    try { if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false; } catch (e) {}
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    }
    if (el.closest && el.closest('[aria-hidden="true"], [inert]')) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const classOf = el => (typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '');
  const describe = el => {                                                      // structure only: never the text of the page (it may hold chat messages)
    const r = el.getBoundingClientRect();
    return el.tagName.toLowerCase() + (classOf(el) ? '.' + classOf(el).split(/\s+/).slice(0, 3).join('.') : '') +
      '[' + Math.round(r.width) + 'x' + Math.round(r.height) + ']' + (norm(el.textContent).length <= 2 ? '"' + norm(el.textContent) + '"' : '');
  };

  // the visible elements that directly contain a short piece of text accepted by `test`
  function findText(test) {
    const out = [];
    const root = document.body || document.documentElement;
    if (!root) return out;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const s = n.nodeValue;
      if (!s || s.length > 80 || !s.trim()) continue;
      if (test(plain(s)) && n.parentElement && visible(n.parentElement)) { out.push(n.parentElement); if (out.length > 20) break; }
    }
    return out;
  }

  // ---- close buttons ----
  const X_TEXT = /^(?:[x\u00d7\u2715\u2716\u2717\u2718\u2a2f\u2573\u2613]|close|fechar|dismiss)$/i;
  const CLOSE_META = /close|fechar|dismiss|btn-x|x-btn|modal-x|icon-x/i;
  const clickableOf = el => el.closest('button,[role="button"],a,[onclick]') || el;

  // the buttons in the top-right corner of `box` that look like "close", best first
  function closeCandidates(box) {
    const rect = box.getBoundingClientRect();
    const strong = [], weak = [];
    Array.prototype.slice.call(box.querySelectorAll('*'), 0, 700).forEach(el => {
      if (!visible(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width > 90 || r.height > 90 || r.width < 8 || r.height < 8) return;
      const t = norm(el.textContent);
      const meta = [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-testid'), classOf(el)].join(' ');
      if (X_TEXT.test(t) || CLOSE_META.test(meta)) { strong.push({ el: clickableOf(el), r: r }); return; }
      const tag = el.tagName.toLowerCase();
      if ((tag === 'button' || el.getAttribute('role') === 'button') && t.length <= 1 && (!t || !/[a-z0-9]/i.test(t)) && el.querySelector('svg,img,i,span')) weak.push({ el: el, r: r });
    });
    const dist = c => Math.hypot(rect.right - c.r.right, c.r.top - rect.top);
    const inCorner = c => c.r.top <= rect.top + 90 && c.r.right >= rect.right - 120 && c.r.left < rect.right;
    const pool = (strong.some(inCorner) ? strong : weak).filter(inCorner);
    return pool.sort((a, b) => dist(a) - dist(b));
  }

  // from a heading, go up to the dialog around it (the smallest block that has a close button in its corner)
  function dialogAround(el) {
    let a = el;
    for (let i = 0; a && a !== document.body && i < 10; i++, a = a.parentElement) {
      const r = a.getBoundingClientRect();
      if (r.width > innerWidth * 0.92 && r.height > innerHeight * 0.92) break;       // the dark backdrop or the page itself
      if (r.width < 120 || r.height < 80) continue;
      const c = closeCandidates(a);
      if (c.length) return { box: a, button: c[0].el };
    }
    return null;
  }

  function press(el) {                                                          // a real-looking click, for pages that listen to mouse events
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
      try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
    });
  }

  // ---- when it is allowed to act ----
  let windowEnd = Date.now() + cfg.onlyFirstSeconds * 1000;
  let hadLoginForm = false;
  let tries, doneAnalyzer, doneChat, handled;
  const reset = () => { tries = {}; doneAnalyzer = false; doneChat = false; handled = new WeakMap(); };
  reset();
  const loginShown = () => Array.prototype.some.call(document.querySelectorAll('input[type="password"]'), visible);

  // ---- 1. the announcement ----
  const words = (cfg.announcementWords || []).map(plain).filter(Boolean);
  function tidyAnnouncements() {
    if (!words.length) return;
    findText(s => words.some(w => s.indexOf(w) >= 0)).forEach(h => {
      const n = (handled.get(h) || 0);
      if (n >= 4) return;
      const dlg = dialogAround(h);
      handled.set(h, n + 1);
      if (!dlg) {
        if (n === 0) { say('announcement "' + norm(h.textContent).slice(0, 40) + '" found, but no close button in its top-right corner (looked at ' + describe(h.parentElement || h) + '). Pressing Escape instead.'); }
        try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true })); } catch (e) {}
        return;
      }
      press(dlg.button);
      say('closed the announcement "' + norm(h.textContent).slice(0, 40) + '"' + (n ? ' (try ' + (n + 1) + ')' : ''));
    });
  }

  // ---- 2. the Hunt Analyzer ----
  function tidyAnalyzer() {
    if (doneAnalyzer) return;
    const titles = findText(s => s === 'hunt analyzer');
    if (!titles.length) { if (tries.analyzerSeen) { doneAnalyzer = true; say('the Hunt Analyzer is closed'); } return; }
    tries.analyzerSeen = true;
    tries.analyzer = (tries.analyzer || 0) + 1;
    if (tries.analyzer > 4) { if (tries.analyzer === 5) say('the Hunt Analyzer would not close after 4 tries'); return; }
    const dlg = dialogAround(titles[0]);
    // lang-61/62: since the game's update of 2026-11-03 its corner button may not close it: from the 1st try the
    // Análise icon of the game's toolbar is pressed, which switches the analyzer off (it may be hidden in a narrow toolbar: pressing still works)
    if (!dlg || tries.analyzer === 1 || tries.analyzer >= 3) {          // (1st try: the Análise icon; 2nd: the corner button, in case the icon did not do it; then the icon again)
      const lim = Math.max(220, innerHeight * 0.3), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n, icon = null;
      while ((n = w.nextNode())) { const t = String(n.nodeValue || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); if (t === 'analise' && n.parentElement && !n.parentElement.closest('script,style,template') && n.parentElement.getBoundingClientRect().top < lim) { icon = n.parentElement; break; } }
      if (icon) { press(icon.closest('button,[role="button"],a,[onclick]') || icon); say('switched the Hunt Analyzer off with the Análise icon of the toolbar (try ' + tries.analyzer + ')'); return; }
      if (!dlg) { if (tries.analyzer === 1) say('found the Hunt Analyzer, but no close button in its top-right corner (looked at ' + describe(titles[0].parentElement || titles[0]) + ')'); return; }
    }
    press(dlg.button);
    say('closed the Hunt Analyzer' + (tries.analyzer > 1 ? ' (try ' + tries.analyzer + ')' : ''));
  }

  // ---- 3. the chat ----
  const CARET = /^[\u25be\u25b4\u25bc\u25b2\u2304\u2303\u02c5\u02c4v^\u2212\-]$/i;
  function tidyChat() {
    if (doneChat) return;
    const input = Array.prototype.slice.call(document.querySelectorAll('input[placeholder],textarea[placeholder]'))
      .filter(i => visible(i) && /falar|say something|type a message|chat/i.test(i.getAttribute('placeholder') || ''))[0];
    if (!input) { if (tries.chatClicked) { doneChat = true; say('the chat is collapsed'); } return; }     // not open: nothing to do
    tries.chat = (tries.chat || 0) + 1;
    if (tries.chat > 4) { if (tries.chat === 5) say('the chat would not collapse after 4 tries'); return; }
    let box = input.parentElement, tab = null;
    for (let i = 0; box && i < 8; i++, box = box.parentElement) {
      const txt = plain(box.textContent);
      if (txt.indexOf('geral') >= 0 && (txt.indexOf('duvidas') >= 0 || txt.indexOf('comercio') >= 0)) {
        const t = Array.prototype.slice.call(box.querySelectorAll('*')).filter(e => visible(e) && plain(e.textContent) === 'geral' && e.children.length < 3)[0];
        if (t) { tab = t; break; }
      }
    }
    if (!tab) { if (tries.chat === 1) say('the chat is open, but its tab row was not found'); return; }
    const row = tab.getBoundingClientRect(), mid = row.top + row.height / 2;
    const cands = Array.prototype.slice.call(box.querySelectorAll('*')).filter(e => {
      if (!visible(e)) return false;
      const r = e.getBoundingClientRect();
      if (r.width > 60 || r.height > 60 || r.width < 8 || r.height < 8) return false;
      if (Math.abs(r.top + r.height / 2 - mid) > 26 || r.left < row.right) return false;
      const t = norm(e.textContent);
      const meta = [e.getAttribute('aria-label'), e.getAttribute('title'), classOf(e)].join(' ');
      const isButton = e.tagName === 'BUTTON' || e.getAttribute('role') === 'button';
      return CARET.test(t) || /collapse|minimi|toggle|recolher|ocultar|hide/i.test(meta) || (isButton && !/[a-z0-9]/i.test(t) && !!e.querySelector('svg,img,i,span'));
    }).map(e => ({ el: clickableOf(e), r: e.getBoundingClientRect() })).sort((a, b) => b.r.right - a.r.right);
    if (!cands.length) { if (tries.chat === 1) say('the chat is open, but no collapse button was found in its tab row (looked at ' + describe(box) + ')'); return; }
    tries.chatClicked = true;
    press(cands[0].el);
    say('collapsed the chat' + (tries.chat > 1 ? ' (try ' + tries.chat + ')' : ''));
  }

  // ---- the loop ----
  function tick() {
    const login = loginShown();
    if (hadLoginForm && !login) { windowEnd = Date.now() + cfg.onlyFirstSeconds * 1000; reset(); say('login detected: tidying the next ' + cfg.onlyFirstSeconds + ' seconds'); }
    hadLoginForm = login;
    if (login || Date.now() > windowEnd) return;
    if (cfg.closeAnnouncements) tidyAnnouncements();
    if (cfg.closeHuntAnalyzer) tidyAnalyzer();
    if (cfg.hideChat) tidyChat();
  }
  const timer = setInterval(tick, 1000);
  T.stop = () => clearInterval(timer);
  T.tick = tick;
  T.cfg = cfg;
  T.expire = () => { windowEnd = 0; };
  say('watching for ' + cfg.onlyFirstSeconds + ' seconds');
  tick();
  return 'installed';
}

// ---------------------------------------------------------------------------------------------------------------
// the part that runs in the app
// ---------------------------------------------------------------------------------------------------------------
function attach(n, wc) {
  try {
    wc.on('console-message', function (ev) {                                  // the page reports what it did; show it in the console window
      const msg = (ev && typeof ev.message === 'string') ? ev.message : arguments[2];   // newer Electron: one object (one parameter, so no warning); older: separate arguments
      if (typeof msg === 'string' && msg.indexOf('[hg-tidy]') === 0) console.log('tidy (panel ' + n + '): ' + msg.slice(9).trim());
    });
    wc.on('dom-ready', () => {
      const cfg = settings();
      if (!cfg.enabled || !(cfg.closeAnnouncements || cfg.closeHuntAnalyzer || cfg.hideChat)) return;
      try { Promise.resolve(wc.executeJavaScript('(' + tidyInPage.toString() + ')(' + JSON.stringify(cfg) + ')', true)).catch(() => {}); } catch (e) {}
    });
  } catch (e) {
    console.log('tidy: could not attach to panel ' + n + ' (' + e.message + ')');
  }
}

module.exports = { attach, tidyInPage, settings, DEFAULTS };
