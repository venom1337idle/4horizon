// analyzer.js: the "Analyzer" button of the top bar opens or closes the Hunt Analyzer of the game on every account at once.
//
// It does what you would do by hand, in each game panel: when the Hunt Analyzer is on screen it presses the X of that window; when it is not it presses the "Análise" button of the game's menu.
// Nothing else is clicked and nothing of the game is played. If at least one panel shows the analyzer the button CLOSES it everywhere (so the panels end the same); if none shows it the button OPENS it everywhere.
// The button of the menu is found by its words (Análise / Analysis / Analyzer), only in the top part of the page, so a word in the chat further down is not taken for it.
// When it cannot be found, the report of the Diagnostics says which words the top of the page has, so that it can be fixed (these are the words of the game's menu, never a chat).

let electron = null;
try { electron = require('electron'); } catch (e) {}
let accounts = null;
try { accounts = require('./accounts'); } catch (e) {}

const PANELS = [1, 2, 3, 4];
let last = null;                         // what the last press did, for the report
let pageTimeoutMs = 6000;

// ---------------------------------------------------------------------------------------------------------------
// This function is sent to the game page as text and runs THERE. It is a plain function so it can be tested on its own.
// mode: 'state' (is the analyzer on screen?), 'close', 'open'. It answers with a plain object.
// ---------------------------------------------------------------------------------------------------------------
function analyzerInPage(mode) {
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const plain = s => norm(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');       // lower case, no accents
  // lang-59: really on screen. Since the game's update of 2026-11-03 a closed Hunt Analyzer stays in the page, its box faded or slid out of view:
  // the element itself looks shown, so every box around it is checked too, and that it is on the screen
  const visible = el => {
    if (visible.any) return !!el;                                                          // (lang-60: the Análise button left out of a narrow toolbar, hidden: it is still pressed)
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false;
    try { if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false; } catch (e) {}
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    }
    if (el.closest && el.closest('[aria-hidden="true"], [inert]')) return false;
    if (visible.loose) return true;                                                        // (the Análise button: scrolled out of the narrow toolbar is fine, see below)
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const classOf = el => (typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '');
  function findText(test, limit) {                                                         // the visible elements that directly contain a short text accepted by `test`
    const out = [], root = document.body || document.documentElement;
    if (!root) return out;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const s = n.nodeValue;
      if (!s || s.length > 80 || !s.trim()) continue;
      if (test(plain(s)) && n.parentElement && visible(n.parentElement)) { out.push(n.parentElement); if (out.length > (limit || 30)) break; }
    }
    return out;
  }
  const X_TEXT = /^(?:[x\u00d7\u2715\u2716\u2717\u2718\u2a2f\u2573\u2613]|close|fechar|dismiss)$/i;
  const CLOSE_META = /close|fechar|dismiss|btn-x|x-btn|modal-x|icon-x/i;
  const clickableOf = el => el.closest('button,[role="button"],a,[onclick]') || el;
  function closeCandidates(box) {                                                          // the buttons in the top-right corner of `box` that look like "close", best first
    const rect = box.getBoundingClientRect(), strong = [], weak = [];
    Array.prototype.slice.call(box.querySelectorAll('*'), 0, 700).forEach(el => {
      if (!visible(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width > 90 || r.height > 90 || r.width < 8 || r.height < 8) return;
      const t = norm(el.textContent), meta = [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-testid'), classOf(el)].join(' ');
      if (X_TEXT.test(t) || CLOSE_META.test(meta)) { strong.push({ el: clickableOf(el), r: r }); return; }
      const tag = el.tagName.toLowerCase();
      if ((tag === 'button' || el.getAttribute('role') === 'button') && t.length <= 1 && (!t || !/[a-z0-9]/i.test(t)) && el.querySelector('svg,img,i,span')) weak.push({ el: el, r: r });
    });
    const dist = c => Math.hypot(rect.right - c.r.right, c.r.top - rect.top);
    const inCorner = c => c.r.top <= rect.top + 90 && c.r.right >= rect.right - 120 && c.r.left < rect.right;
    return (strong.some(inCorner) ? strong : weak).filter(inCorner).sort((a, b) => dist(a) - dist(b));
  }
  function dialogAround(el) {                                                              // from the title, up to the window that has a close button in its corner
    let a = el;
    for (let i = 0; a && a !== document.body && i < 10; i++, a = a.parentElement) {
      const r = a.getBoundingClientRect();
      if (r.width > innerWidth * 0.92 && r.height > innerHeight * 0.92) break;
      if (r.width < 120 || r.height < 80) continue;
      const c = closeCandidates(a);
      if (c.length) return { box: a, button: c[0].el };
    }
    return null;
  }
  function press(el) {                                                                     // a click like a real one, for pages that listen to mouse events
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
      try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
    });
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const titles = () => findText(s => s === 'hunt analyzer');
  const isOpen = () => titles().length > 0;
  async function waitFor(cond, ms) { const t0 = Date.now(); for (;;) { if (cond()) return true; if (Date.now() - t0 >= ms) return false; await sleep(80); } }
  const signedOut = () => Array.prototype.some.call(document.querySelectorAll('input[type="password"]'), visible);

  // the Análise icon of the game's toolbar (it opens AND closes the analyzer): visible, scrolled out of view, or hidden in a narrow toolbar (lang-59/60)
  const NAMES = ['analise', 'analysis', 'analyzer', 'analytics', 'hunt analysis'];
  const topLimit = Math.max(220, innerHeight * 0.3);
  function findAnalise() {
    let list, hidden = false;
    visible.loose = true;
    try { list = findText(s => NAMES.indexOf(s) >= 0).filter(el => el.getBoundingClientRect().top < topLimit); } finally { visible.loose = false; }
    if (!list.length) {
      visible.any = true;
      try { list = findText(s => NAMES.indexOf(s) >= 0).filter(el => el.getBoundingClientRect().top < topLimit && !el.closest('script,style,template,noscript')); } finally { visible.any = false; }
      hidden = list.length > 0;
    }
    list.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); });
    return { el: list[0] || null, hidden: hidden };
  }
  // what an element is, for the report (no text from the game beyond a short label)
  const describe = (el, box) => {
    if (!el) return 'nothing';
    const r = el.getBoundingClientRect(), b = box ? box.getBoundingClientRect() : null;
    const label = (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) || plain(el.textContent).slice(0, 12);
    return el.tagName.toLowerCase() + (label ? ' "' + String(label).slice(0, 12) + '"' : '') + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + (b ? ' at ' + Math.round(b.right - r.right) + ' px from the right, ' + Math.round(r.top - b.top) + ' px from the top of the analyzer' : '');
  };

  if (mode === 'state') return Promise.resolve({ open: isOpen(), signedOut: signedOut() });

  if (mode === 'close') {
    const t = titles();
    if (!t.length) return Promise.resolve({ ok: true, skipped: true });
    const dlg = dialogAround(t[0]);
    return (async () => {
      // lang-62: the Análise icon of the toolbar first (since the game's update of 2026-11-03 it is what closes the analyzer, at once);
      // the corner button only when that icon is not there or did not close it
      const a = findAnalise();
      if (a.el) { press(clickableOf(a.el)); if (await waitFor(() => !isOpen(), 1500)) return { ok: true, via: 'toolbar' }; }
      if (dlg && isOpen()) { press(dlg.button); if (await waitFor(() => !isOpen(), 1500)) return { ok: true }; }
      if (!isOpen()) return { ok: true };
      return { ok: false, reason: dlg ? 'did not close' : 'no close button', pressed: dlg ? describe(clickableOf(dlg.button), dlg.box) : 'nothing', toolbar: a.el ? (a.hidden ? 'hidden' : 'yes') : 'not found' };
    })();
  }

  // ---- open ----
  if (isOpen()) return Promise.resolve({ ok: true, skipped: true });
  const found = findAnalise(), spots = found.el ? [found.el] : [], hiddenButton = found.hidden;
  if (!spots.length) {
    // for the report: the short words at the top of the page (the menu of the game)
    const seen = [];
    findText(s => s.length >= 2 && s.length <= 18, 120).forEach(el => { if (el.getBoundingClientRect().top < topLimit) { const w = plain(el.textContent); if (seen.indexOf(w) < 0 && seen.length < 16) seen.push(w); } });
    return Promise.resolve({ ok: false, reason: signedOut() ? 'not signed in' : 'button not found', labels: seen });
  }
  // press the button (its own clickable ancestor first, then the text itself, then the parents one by one) until the analyzer shows
  const chain = [];
  let el = spots[0];
  const first = clickableOf(el);
  chain.push(first);
  if (first !== el) chain.push(el);
  for (let p = first.parentElement, i = 0; p && p !== document.body && i < 3; p = p.parentElement, i++) chain.push(p);
  return (async () => {
    for (let i = 0; i < chain.length; i++) {
      press(chain[i]);
      if (await waitFor(isOpen, i === 0 ? 1500 : 700)) return hiddenButton ? { ok: true, hiddenButton: true } : { ok: true };
    }
    return { ok: false, reason: hiddenButton ? 'did not open (its button is hidden)' : 'did not open' };
  })();
}

// ---------------------------------------------------------------------------------------------------------------
const guestMap = () => (accounts && accounts._guests) || {};
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('the page did not answer in ' + Math.round(ms / 1000) + ' s')), ms))]);
const run = (g, mode) => withTimeout(g.executeJavaScript('(' + analyzerInPage.toString() + ')(' + JSON.stringify(mode) + ')', true), pageTimeoutMs);

// the button: closes the analyzer of every panel when any shows it, otherwise opens it on every panel
async function toggle() {
  const guests = guestMap(), ns = PANELS.filter(n => guests[n]);
  if (!ns.length) { last = { at: Date.now(), action: 'none', results: [] }; return { action: 'none', results: [] }; }
  const states = await Promise.all(ns.map(async n => { try { const r = await run(guests[n], 'state'); return { n: n, open: !!(r && r.open), signedOut: !!(r && r.signedOut) }; } catch (e) { return { n: n, error: String(e && e.message || e).slice(0, 120) }; } }));
  const mode = states.some(s => s.open) ? 'close' : 'open';
  const results = await Promise.all(states.map(async s => {
    if (s.error) return { n: s.n, ok: false, reason: 'page did not answer' };
    if (mode === 'close' && !s.open) return { n: s.n, ok: true, skipped: true };
    if (mode === 'open' && s.signedOut) return { n: s.n, ok: false, reason: 'not signed in' };
    try {
      const r = (await run(guests[s.n], mode)) || {};
      const out = { n: s.n, ok: !!r.ok };
      if (r.skipped) out.skipped = true;
      if (r.reason) out.reason = String(r.reason).slice(0, 60);
      if (Array.isArray(r.labels)) out.labels = r.labels.map(x => String(x).slice(0, 18)).slice(0, 16);
      if (r.pressed) out.pressed = String(r.pressed).slice(0, 120);                       // lang-61: what was pressed as the close button
      if (r.toolbar) out.toolbar = String(r.toolbar).slice(0, 12);
      if (r.via) out.via = String(r.via).slice(0, 12);
      if (r.hiddenButton) out.hiddenButton = true;
      return out;
    } catch (e) { return { n: s.n, ok: false, reason: 'page did not answer' }; }
  }));
  last = { at: Date.now(), action: mode, results: results };
  return { action: mode, results: results };
}

// for the report of the Diagnostics: what the last press did (words of the menu only when something was not found)
function lastInfo() {
  if (!last) return null;
  return { ageSec: Math.round((Date.now() - last.at) / 1000), action: last.action, results: last.results.map(r => ({ n: r.n, ok: !!r.ok, skipped: !!r.skipped, reason: r.reason || '', labels: r.labels || [], pressed: r.pressed || '', toolbar: r.toolbar || '', via: r.via || '', hiddenButton: !!r.hiddenButton })) };
}

function init() {
  if (!electron || !electron.ipcMain || !electron.ipcMain.handle) return;
  let settings = null; try { settings = require('./settings'); } catch (e) {}
  const ours = e => !!(settings && settings.fromOurWindow && settings.fromOurWindow(e));       // only the app's own window, never a game panel
  electron.ipcMain.handle('analyzer:toggle', e => (ours(e) ? toggle() : null));
}

module.exports = { init, toggle, lastInfo, analyzerInPage, _setTimeout: ms => { pageTimeoutMs = ms; }, _reset: () => { last = null; } };
