// selftest.js: "Check the game" (Settings › Diagnostics) (lang-67).
// After a game update, does 4horizon still find what it relies on in the game's page? For every panel it LOOKS (it never presses, types or changes
// anything): the toolbar icons it uses (Hunts, Análise, Centro, Mochila, Market), whether the account is signed in, whether the Hunt Analyzer is
// open. If the Hunts panel happens to be open on an account, that panel is looked at too: its search box, region tabs, filters, cards, Caçar button.
// The result goes to the report (GAME CHECK), with the 4horizon feature that each missing piece affects.

const results = { at: 0, panels: [] };
let now = () => Date.now();
const PAGE_MS = 5000;

// ---- runs inside a game page: reads only
function selfTestInPage() {
  const norm = s => String(s == null ? '' : s).replace(/[\u00ad\u200b\u200c\u200d\u2060\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  const plain = s => norm(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const shown = el => {                                                  // really on screen: it and every box around it shown, inside the window
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false; }
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const texts = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const t = plain(n.nodeValue).replace(/^[^a-z0-9]+/, ''); if (t && t.length <= 40 && n.parentElement && !n.parentElement.closest('script,style,template,noscript')) texts.push({ t: t, el: n.parentElement }); }
  const topLimit = Math.max(220, innerHeight * 0.3);
  // (Market is not a toolbar icon: the Market button presses Centro, then the game's "Ir ao Market" button, which can be anywhere on the page)
  const ICONS = { hunts: ['hunts'], analise: ['analise', 'analysis', 'analyzer'], centro: ['centro', 'center'], mochila: ['mochila', 'bag', 'backpack'] };
  const toolbar = {};
  Object.keys(ICONS).forEach(k => {
    const hits = texts.filter(x => ICONS[k].indexOf(x.t) >= 0 && x.el.getBoundingClientRect().top < topLimit);
    toolbar[k] = hits.some(x => shown(x.el)) ? 'visible' : hits.length ? 'hidden' : 'missing';
  });
  const goMarket = texts.filter(x => /^(ir ao|go to|visit)\s+(the\s+|o\s+)?market$/.test(x.t));
  toolbar.market = goMarket.some(x => shown(x.el)) ? 'visible' : goMarket.length ? 'hidden' : 'notnow';          // "notnow": not on the page now (it can appear after Centro): not a problem
  const signedIn = !Array.prototype.some.call(document.querySelectorAll('input[type="password"]'), shown);
  const analyzer = texts.some(x => x.t === 'hunt analyzer' && shown(x.el)) ? 'open' : 'closed';
  // the Hunts panel, only if it is open: around its search box
  let hunts = null;
  const search = Array.prototype.find.call(document.querySelectorAll('input'), i => shown(i) && /buscar|search|procurar/.test(plain(i.placeholder || '')));
  if (search) {
    let box = search; for (let i = 0; i < 12 && box.parentElement; i++) { box = box.parentElement; const r = box.getBoundingClientRect(); if (r.width >= 700 && r.height >= 350) break; }
    const inBox = texts.filter(x => box.contains(x.el) && shown(x.el));
    const RX = /^(kanto|johto|hoenn?|sinnoh|unova|kalos|alola|galar|paldea)( ?(lv|nv)\.? ?\d+)?$/;
    const regions = inBox.filter(x => RX.test(x.t)).map(x => x.t.split(' ')[0]);
    Array.prototype.forEach.call(box.querySelectorAll('[alt],[title],[aria-label]'), el => { const v = plain(el.getAttribute('alt') || el.getAttribute('title') || el.getAttribute('aria-label')); if (RX.test(v) && shown(el)) regions.push(v.split(' ')[0]); });
    const weakLabel = inBox.find(x => /^fraco contra:?$/.test(x.t));
    const sel = Array.prototype.find.call(box.querySelectorAll('select'), s => shown(s));
    const weak = weakLabel ? plain(weakLabel.el.parentElement ? weakLabel.el.parentElement.textContent : '').replace(/^fraco contra:?\s*/, '').replace(/[^a-z0-9 ]/g, '').trim().slice(0, 20) || (sel ? plain(sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : '') : '') : '';
    const pointer = el => { for (let e = el, i = 0; e && i < 4; e = e.parentElement, i++) { if (e.closest && e.closest('button,[role="button"],a,[onclick]')) return true; try { if (getComputedStyle(e).cursor === 'pointer') return true; } catch (x) {} } return false; };
    // the cards: pressable boxes of a card's size with a short name, below the search box; only the outermost one of a card counts
    const sb = search.getBoundingClientRect().bottom, like = [];
    Array.prototype.forEach.call(box.querySelectorAll('*'), el => { const r = el.getBoundingClientRect(), t = plain(el.textContent); if (r.width >= 60 && r.width <= 220 && r.height >= 50 && r.height <= 170 && r.top > sb && t && t.length <= 30 && shown(el) && pointer(el)) like.push(el); });
    const cards = like.filter(el => !like.some(o => o !== el && o.contains(el))).length;
    hunts = {
      search: true, regions: Array.from(new Set(regions)).slice(0, 8), todos: inBox.some(x => x.t === 'todos' || x.t === 'all'), levels: inBox.some(x => x.t === 'todos os niveis' || x.t === 'all levels'),
      weak: weak, cards: Math.min(cards, 999), cacar: inBox.some(x => (x.t === 'cacar' || x.t === 'cacando') && pointer(x.el)) ? 'found' : 'none'
    };
  }
  return { signedIn: signedIn, toolbar: toolbar, analyzer: analyzer, hunts: hunts };
}

const withTimeout = (p, ms) => Promise.race([p, new Promise(res => setTimeout(() => res({ timeout: true }), ms))]);

// guests: [{ n, wc }] of the panels that exist
async function run(guests) {
  const out = [];
  for (const g of guests || []) {
    if (!g || !g.n || !g.wc) continue;
    let r = null;
    try { r = await withTimeout(g.wc.executeJavaScript('(' + selfTestInPage.toString() + ')()', true), PAGE_MS); } catch (e) { r = { error: String(e && e.message || e).slice(0, 60) }; }
    out.push(Object.assign({ n: g.n }, r || { error: 'no answer' }));
  }
  results.at = now(); results.panels = out;
  return summary();
}

// what does not work any more, per 4horizon feature
const AFFECTS = { hunts: 'the Hunts button and Back to last hunt (they open the Hunts panel)', analise: 'the Analyzer button and popup tidy', centro: 'the Centro and Market buttons (Market goes through Centro)', mochila: 'the Mochila button' };
function problems() {
  const list = [];
  results.panels.forEach(p => {
    if (p.error || p.timeout) { list.push({ n: p.n, what: 'the page did not answer', affects: 'nothing could be checked on this panel' }); return; }
    if (!p.signedIn) return;                                             // a signed-out page has no toolbar: not a problem of 4horizon
    Object.keys(AFFECTS).forEach(k => { if (p.toolbar && p.toolbar[k] === 'missing') list.push({ n: p.n, what: 'the ' + k + ' icon of the toolbar was not found', affects: AFFECTS[k] }); });
    const h = p.hunts;
    if (h) {
      if (!h.regions.length) list.push({ n: p.n, what: 'no region tab in the Hunts panel', affects: 'Back to last hunt (searching the other regions)' });
      if (!h.todos || !h.levels) list.push({ n: p.n, what: 'the "Todos" / "Todos os níveis" filters were not found', affects: 'Back to last hunt (a filter left on may hide the hunt)' });
      if (!h.cards) list.push({ n: p.n, what: 'no hunt card in the Hunts panel', affects: 'Back to last hunt (choosing the card)' });
    }
  });
  return list;
}
function summary() {
  const panels = results.panels.length, huntsSeen = results.panels.some(p => p.hunts), list = problems();
  return { panels: panels, huntsSeen: huntsSeen, problems: list.length, list: list };
}
function info() { return results.at ? { ageSec: Math.round((now() - results.at) / 1000), panels: results.panels, problems: problems() } : null; }

module.exports = { run, info, summary, selfTestInPage, _setNow: f => { now = f; } };
