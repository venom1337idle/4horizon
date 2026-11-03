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
  const visible = el => {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
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

  if (mode === 'state') return Promise.resolve({ open: isOpen(), signedOut: signedOut() });

  if (mode === 'close') {
    const t = titles();
    if (!t.length) return Promise.resolve({ ok: true, skipped: true });
    const dlg = dialogAround(t[0]);
    if (!dlg) return Promise.resolve({ ok: false, reason: 'no close button' });
    press(dlg.button);
    return waitFor(() => !isOpen(), 1500).then(gone => gone ? { ok: true } : { ok: false, reason: 'did not close' });
  }

  // ---- open ----
  if (isOpen()) return Promise.resolve({ ok: true, skipped: true });
  const NAMES = ['analise', 'analysis', 'analyzer', 'analytics', 'hunt analysis'];
  const topLimit = Math.max(220, innerHeight * 0.3);
  const spots = findText(s => NAMES.indexOf(s) >= 0).filter(el => el.getBoundingClientRect().top < topLimit)
    .sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); });
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
      if (await waitFor(isOpen, i === 0 ? 1500 : 700)) return { ok: true };
    }
    return { ok: false, reason: 'did not open' };
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
      return out;
    } catch (e) { return { n: s.n, ok: false, reason: 'page did not answer' }; }
  }));
  last = { at: Date.now(), action: mode, results: results };
  return { action: mode, results: results };
}

// for the report of the Diagnostics: what the last press did (words of the menu only when something was not found)
function lastInfo() {
  if (!last) return null;
  return { ageSec: Math.round((Date.now() - last.at) / 1000), action: last.action, results: last.results.map(r => ({ n: r.n, ok: !!r.ok, skipped: !!r.skipped, reason: r.reason || '', labels: r.labels || [] })) };
}

function init() {
  if (!electron || !electron.ipcMain || !electron.ipcMain.handle) return;
  let settings = null; try { settings = require('./settings'); } catch (e) {}
  const ours = e => !!(settings && settings.fromOurWindow && settings.fromOurWindow(e));       // only the app's own window, never a game panel
  electron.ipcMain.handle('analyzer:toggle', e => (ours(e) ? toggle() : null));
}

module.exports = { init, toggle, lastInfo, analyzerInPage, _setTimeout: ms => { pageTimeoutMs = ms; }, _reset: () => { last = null; } };
