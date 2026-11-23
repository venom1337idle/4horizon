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
  // lang-73: the boxes of the game's screen that a clean mini screen will hide (the player card with the team, the icon bar, the hunt box, the chat, the Auto Helper):
  // for each one, the outermost box around a word that is only in it, described by its tag, id and classes, and its size. This is what the hiding rules will be written from
  // (the report shows it; nothing is hidden yet). Reads only.
  const boxes = {};
  try {
    // lang-75+: when a .hud .toolbar-wrap exists, the icon bar's "perfil" word must be inside it; a modal (Hunt Analyzer, Pokédex, Perfil itself) can also carry a "Perfil" label and would otherwise be picked as the anchor (reported 2026-11-22: "icon bar NOT FOUND" when the Analyzer was open). If no .hud .toolbar-wrap exists (older game or test harness), the top-position rule is kept.
    const toolbarWrap = document.querySelector('.hud .toolbar-wrap');
    const ANCHORS = { team: x => /^equipe\b/.test(x.t), bar: x => x.t === 'perfil' && x.el.getBoundingClientRect().top < topLimit && (toolbarWrap ? toolbarWrap.contains(x.el) : true), hunt: x => x.t === 'abates', chat: null, helper: x => x.t === 'auto helper' };
    const chatInput = Array.prototype.find.call(document.querySelectorAll('input,textarea'), i => shown(i) && /^falar em|^chat|^say|^talk/.test(plain(i.placeholder || '')));
    const chatTab = (texts.find(x => (x.t === 'geral' || x.t === 'general') && shown(x.el) && x.el.getBoundingClientRect().top > innerHeight * 0.5) || {}).el;          // the chat collapsed to its tabs (popup tidy does that at login)
    const anchorEl = {}; Object.keys(ANCHORS).forEach(k => { const hit = k === 'chat' ? (chatInput || chatTab) : (texts.find(x => ANCHORS[k](x) && shown(x.el)) || {}).el; if (hit) anchorEl[k] = hit; });
    const desc = el => { const r = el.getBoundingClientRect(), cls = Array.prototype.slice.call(el.classList, 0, 4).join('.'); return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '') + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + '@' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + getComputedStyle(el).position; };
    Object.keys(anchorEl).forEach(k => {
      let box = anchorEl[k];
      for (let i = 0; i < 14 && box.parentElement && box.parentElement !== document.body; i++) {
        const up = box.parentElement, r = up.getBoundingClientRect();
        if (r.width > innerWidth * 0.8 || r.height > innerHeight * 0.6) break;                                      // the page itself, or the map: too big to be the box
        if (Object.keys(anchorEl).some(o => o !== k && up.contains(anchorEl[o]))) break;                           // it would hold another box too
        box = up;
      }
      const chain = [desc(box)]; if (box.parentElement && box.parentElement !== document.body) chain.push(desc(box.parentElement)); if (box !== anchorEl[k]) chain.push('from ' + desc(anchorEl[k]));
      boxes[k] = chain.map(s => s.slice(0, 120));
    });
    // the icon bar's own position (the clean expanded screen widens it: left, right, width, max-width, margins, transform as the game set them; inner = its content / its width)
    const tw = document.querySelector('.hud .toolbar-wrap');
    if (tw) { const s = getComputedStyle(tw); boxes.barStyle = ['left ' + s.left, 'right ' + s.right, 'width ' + s.width, 'max-width ' + s.maxWidth, 'margin ' + s.marginLeft + ' ' + s.marginRight, 'transform ' + s.transform, 'inner ' + Math.round(tw.scrollWidth) + '/' + Math.round(tw.clientWidth)].join(' \u00b7 ').slice(0, 200); }
    // lang-75: pair every item icon on screen with its Portuguese name, so that the slug -> numeric id map (used by the Overview rows) can be built from one game panel
    // (Mochila: a button.slot has title="<name>" and an inner <img class=item-icon>; Hunt Analyzer Drops: the <img class=item-icon> sits next to a sibling .grow with the name).
    // The images are loading="lazy": offsetParent may be null even when they are visible, so this ignores shown(img) for item-icon images and only filters by URL + size.
    const icons = [];
    try {
      const seen = new Set(), SRC_RX = /\.(png|webp|jpg|jpeg|gif|svg)(\?|$)/i;
      const push = (name, src) => {
        if (icons.length >= 60) return;                                                           // one Mochila has about 40 items; 60 is plenty
        if (!src || !SRC_RX.test(src) || /^data:/.test(src) || seen.has(src)) return;
        const n = plain((name || '').replace(/\s+/g, ' ').trim());
        if (!n || n.length < 2 || n.length > 40) return;
        seen.add(src); icons.push(n + ' | ' + src.slice(0, 180));
      };
      // the Mochila: button.slot title="<name>" > img.item-icon
      Array.prototype.forEach.call(document.querySelectorAll('button.slot[title], button.slot[data-tip], button.slot[aria-description]'), btn => {
        const img = btn.querySelector('img'); if (!img) return;
        const name = btn.getAttribute('title') || btn.getAttribute('data-tip') || btn.getAttribute('aria-description');
        push(name, img.getAttribute('src'));
      });
      // the Hunt Analyzer Drops (and any other list with img.item-icon next to a sibling with the name)
      Array.prototype.forEach.call(document.querySelectorAll('img.item-icon'), img => {
        const row = img.closest('li') || img.parentElement, grow = row && row.querySelector('.grow');
        const name = (grow && grow.textContent) || img.getAttribute('alt') || img.getAttribute('title') || img.getAttribute('aria-label') || '';
        push(name, img.getAttribute('src'));
      });
      // a general fallback: any small <img> that is actually visible, with its alt/title/nearby word (catches top-bar UI icons etc.)
      const closestWord = el => { let e = el; for (let i = 0; e && i < 6; i++, e = e.parentElement) { const t = plain((e.textContent || '').replace(/\s+/g, ' ').trim()); if (t && t.length >= 3 && t.length <= 60) return t.slice(0, 40); } return ''; };
      Array.prototype.forEach.call(document.querySelectorAll('img'), img => {
        if (icons.length >= 60) return;
        const src = img.getAttribute('src'); if (!src || seen.has(src) || !SRC_RX.test(src) || /^data:/.test(src) || !shown(img)) return;
        const r = img.getBoundingClientRect(); if (r.width < 14 || r.width > 96 || r.height < 14 || r.height > 96) return;
        push(img.getAttribute('alt') || img.getAttribute('title') || img.getAttribute('aria-label') || closestWord(img), src);
      });
    } catch (e) { boxes.iconsError = String(e && e.message || e).slice(0, 60); }
    if (icons.length) boxes.icons = icons;
  } catch (e) { boxes.error = String(e && e.message || e).slice(0, 60); }
  return { signedIn: signedIn, toolbar: toolbar, analyzer: analyzer, hunts: hunts, boxes: boxes };
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
