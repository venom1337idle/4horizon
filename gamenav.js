// gamenav.js: the four buttons of the top bar that work on the panel that is EXPANDED: Centro (back to the city), Market, Mochila (the backpack) and Hunts (the Hunts panel of the game).
//
// It does what you would do by hand, in the page of that panel: it presses the "Centro", "Mochila" or "Hunts" button of the game's menu (found by its words, only in the top part of the page,
// so the same word in a chat or in a window title lower down is not taken for it). For the Market it does the two steps you do: "Centro" first (unless the "Ir ao Market"
// button is already on screen), then it waits for the "Ir ao Market" button to appear and presses it. Nothing else is clicked and nothing of the game is played.
// When a button cannot be found, the report of the Diagnostics gets the texts of the buttons of the page (only buttons and links, never a chat), so that it can be fixed.

let electron = null;
try { electron = require('electron'); } catch (e) {}
let accounts = null;
try { accounts = require('./accounts'); } catch (e) {}

const WHAT = ['center', 'market', 'bag', 'hunts'];
let last = null;                         // what the last press did, for the report
let pageTimeoutMs = 9000;
let marketWaitMs = 5000;                 // how long the "Ir ao Market" button is waited for after "Centro"

// ---------------------------------------------------------------------------------------------------------------
// This function is sent to the game page as text and runs THERE. what: 'center' | 'market' | 'bag'; waitMs: how long to wait for the market button.
// ---------------------------------------------------------------------------------------------------------------
function navInPage(what, waitMs) {
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const plain = s => norm(String(s == null ? '' : s).replace(/[\u00ad\u200b\u200c\u200d\u2060\ufeff]/g, '')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');          // (lang-62: soft hyphens and zero-width breaks that split long names are left out)
  const visible = el => {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  function findText(test, limit) {                                                         // the visible elements that directly contain a short text accepted by `test`
    const out = [], root = document.body || document.documentElement;
    if (!root) return out;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const s = n.nodeValue;
      if (!s || s.length > 60 || !s.trim()) continue;
      if (test(plain(s).replace(/^[^a-z0-9]+/, '')) && n.parentElement && visible(n.parentElement)) { out.push(n.parentElement); if (out.length > (limit || 30)) break; }
    }
    return out;
  }
  const clickableOf = el => el.closest('button,[role="button"],a,[onclick]') || el;
  function press(el) {                                                                     // a click like a real one, for pages that listen to mouse events
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
      try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
    });
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(cond, ms) { const t0 = Date.now(); for (;;) { const v = cond(); if (v) return v; if (Date.now() - t0 >= ms) return null; await sleep(80); } }
  const signedOut = () => Array.prototype.some.call(document.querySelectorAll('input[type="password"]'), visible);
  const topLimit = Math.max(220, innerHeight * 0.3);
  const NAMES = { center: ['centro', 'center', 'pokemon center', 'centro pokemon'], bag: ['mochila', 'backpack', 'bag', 'inventory'], hunts: ['hunts', 'hunt'] };
  const menuButton = key => findText(s => NAMES[key].indexOf(s) >= 0).filter(el => el.getBoundingClientRect().top < topLimit)
    .sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); })[0] || null;
  const marketButton = () => findText(s => /^(ir ao|go to|visit)\s+(the\s+|o\s+)?market$/.test(s))[0] || null;
  const buttonTexts = () => {                                                              // for the report: the texts of the buttons and links (never a chat)
    const seen = [];
    Array.prototype.slice.call(document.querySelectorAll('button,[role="button"],a'), 0, 400).forEach(b => {
      if (!visible(b)) return;
      const t = plain(b.textContent).replace(/^[^a-z0-9]+/, '');
      if (t.length >= 2 && t.length <= 24 && seen.indexOf(t) < 0 && seen.length < 24) seen.push(t);
    });
    return seen;
  };
  const notFound = () => ({ ok: false, reason: signedOut() ? 'not signed in' : 'button not found', labels: buttonTexts() });
  // presses the element (its own clickable first, then the text itself, then its parents) until `done()` is true
  async function pressUntil(el, done, ms) {
    const first = clickableOf(el), chain = [first];
    if (first !== el) chain.push(el);
    for (let p = first.parentElement, i = 0; p && p !== document.body && i < 3; p = p.parentElement, i++) chain.push(p);
    for (let i = 0; i < chain.length; i++) { press(chain[i]); if (await waitFor(done, i === 0 ? ms : Math.min(ms, 700))) return true; }
    return false;
  }

  return (async () => {
    if (what === 'center' || what === 'bag' || what === 'hunts') {
      const b = menuButton(what);
      if (!b) return notFound();
      press(clickableOf(b));                                                               // one press: the menu buttons of the game may open AND close
      return { ok: true };
    }
    if (what === 'market') {
      let m = marketButton();
      if (!m) {
        const c = menuButton('center');
        if (!c) return notFound();
        const got = await pressUntil(c, marketButton, waitMs);                               // "Centro" first, then the "Ir ao Market" button shows up
        m = got ? marketButton() : null;
        if (!m) return { ok: false, reason: signedOut() ? 'not signed in' : 'market button not found', labels: buttonTexts() };
      }
      press(clickableOf(m));
      return { ok: true };
    }
    return { ok: false, reason: 'bad request' };
  })();
}

// ---------------------------------------------------------------------------------------------------------------
// Back to the last hunt. This function is sent to the game page as text and runs THERE.
// arg: { name: "Cratera dos Torchic", species: ["Torchic"] }. It does what you would do by hand in the Hunts panel of the game:
//   1. opens the panel if it is not open (the menu button "Hunts"),
//   2. if the details of the panel already show that hunt (its name is in them): that is the one, go to 4,
//   3. otherwise: the filters are set back to "Todos", the Pokémon is typed in the search box of the panel, its card is pressed (never the star) and the details are awaited,
//   4. only when the details show the hunt: "Caçar" is pressed. If the button says "Caçando" you are already there and nothing is pressed.
// "Caçar" is NEVER pressed for a hunt that the details do not show. The search box is emptied again afterwards.
// ---------------------------------------------------------------------------------------------------------------
function huntInPage(arg, waitMs) {
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const plain = s => norm(String(s == null ? '' : s).replace(/[\u00ad\u200b\u200c\u200d\u2060\ufeff]/g, '')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');          // (lang-62: soft hyphens and zero-width breaks that split long names are left out)
  const visible = el => {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  function findNodes(test, limit) {
    const out = [], root = document.body || document.documentElement;
    if (!root) return out;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const raw = n.nodeValue;
      if (!raw || raw.length > 90 || !raw.trim()) continue;
      const s = plain(raw).replace(/^[^a-z0-9]+/, '');
      if (test(s) && n.parentElement && visible(n.parentElement)) { out.push({ el: n.parentElement, s: s }); if (out.length > (limit || 30)) break; }
    }
    return out;
  }
  const clickableOf = el => el.closest('button,[role="button"],a,[onclick]') || el;
  function press(el) {
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
      try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
    });
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(cond, ms) { const t0 = Date.now(); for (;;) { const v = cond(); if (v) return v; if (Date.now() - t0 >= ms) return null; await sleep(80); } }
  const signedOut = () => Array.prototype.some.call(document.querySelectorAll('input[type="password"]'), visible);
  const topLimit = Math.max(220, innerHeight * 0.3);
  const buttonTexts = () => {
    const seen = [];
    Array.prototype.slice.call(document.querySelectorAll('button,[role="button"],a'), 0, 400).forEach(b => {
      if (!visible(b)) return;
      const t = plain(b.textContent).replace(/^[^a-z0-9]+/, '');
      if (t.length >= 2 && t.length <= 24 && seen.indexOf(t) < 0 && seen.length < 24) seen.push(t);
    });
    return seen;
  };
  const fail = reason => ({ ok: false, reason: signedOut() ? 'not signed in' : reason, labels: buttonTexts() });
  const A = arg || {};
  const want = plain(A.name || '');
  const speciesShown = (Array.isArray(A.species) ? A.species : []).map(norm).filter(Boolean);
  const speciesPlain = speciesShown.map(plain);
  const lvl = typeof A.level === 'number' && isFinite(A.level) ? A.level : null;
  const escRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const BTN_START = ['cacar', 'hunt', 'start hunt', 'start hunting', 'go hunting'], BTN_HERE = ['cacando', 'hunting', 'hunting here'];
  const huntsButton = () => findNodes(s => s === 'hunts' || s === 'hunt').filter(x => x.el.getBoundingClientRect().top < topLimit)
    .sort((a, b) => { const ra = a.el.getBoundingClientRect(), rb = b.el.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); })[0] || null;
  // lang-63: only a Caçar / Caçando INSIDE the Hunts panel (the panel around its search box) is its button: a word like it elsewhere on the page
  // (the map, the chat, another window) made the search throw away the right card (Exeggcute)
  const huntButton = () => {
    const si = searchInput(), pb = si ? boxOf(si) : null;
    if (!pb) return null;                                                                // no Hunts panel (no search box): no button of it either
    return findNodes(s => BTN_START.concat(BTN_HERE).indexOf(s) >= 0).filter(x => x.el.getBoundingClientRect().top >= topLimit && pb.contains(x.el))
      .sort((a, b) => b.el.getBoundingClientRect().top - a.el.getBoundingClientRect().top)[0] || null;      // the one lowest in the panel: the button of the details
  };
  // (for the report: a Caçar-like word outside the panel)
  const huntButtonOutside = () => { const si = searchInput(), pb = si ? boxOf(si) : null; return !!pb && findNodes(s => BTN_START.concat(BTN_HERE).indexOf(s) >= 0).some(x => x.el.getBoundingClientRect().top >= topLimit && !pb.contains(x.el)); };
  const searchInput = () => Array.prototype.filter.call(document.querySelectorAll('input'), i => visible(i) && /^(text|search|)$/.test(i.type || '') && /buscar|search|procurar|pesquisar/.test(plain((i.placeholder || '') + ' ' + (i.getAttribute('aria-label') || ''))))[0] || null;
  // the details of the hunt: the highest box around the button that is not much narrower than the box around it (so that it is the column of the details, not the whole panel)
  const paneOf = el => { let pane = el; for (let i = 0; i < 12 && pane.parentElement && pane.parentElement !== document.body; i++) { const pw = pane.getBoundingClientRect().width; if (pw >= 200 && pane.parentElement.getBoundingClientRect().width > pw * 1.35) break; pane = pane.parentElement; } return pane; };
  const detailsShow = () => { const b = huntButton(); if (!b) return null; return plain(paneOf(b.el).textContent).slice(0, 320).indexOf(want) >= 0 ? b : null; };
  // lang-59: a hunt the game renamed (its name in 4horizon's data is the old one): its details still show its Pokémon, and its level when known
  const detailsShowSpecies = () => {
    const b = huntButton(); if (!b || !speciesPlain.length) return null;
    const pe = paneOf(b.el), t = plain(pe.innerText || pe.textContent).slice(0, 400);          // (innerText: the words as shown, with the line breaks between them)
    const hasSp = speciesPlain.some(x => new RegExp('(^|[^a-z0-9])' + escRe(x) + '([^a-z0-9]|$)').test(t));
    return hasSp && (lvl === null || new RegExp('nv\\.? ?' + lvl + '([^0-9]|$)').test(t)) ? b : null;
  };
  // lang-59: the regions of the Hunts panel (Kanto, Johto, Hoenn, Sinnoh...): the search only looks inside the region shown
  const regionTabs = () => {                                                              // (they are near the top of the panel: looked for inside the panel around the search box)
    const i = searchInput(), box = i ? boxOf(i) : null;
    const RX = /^(kanto|johto|hoenn?|sinnoh|unova|kalos|alola|galar|paldea)( ?(lv|nv)\.? ?\d+)?$/;
    const out = findNodes(x => RX.test(x), 16).filter(x => (box ? box.contains(x.el) : x.el.getBoundingClientRect().top >= 60) && x.el !== i);
    // (lang-60: the tabs may be pictures, their name only in alt / title / aria-label)
    Array.prototype.forEach.call(document.querySelectorAll('[alt],[title],[aria-label]'), el => {
      const v = plain(el.getAttribute('alt') || el.getAttribute('title') || el.getAttribute('aria-label') || '').replace(/^[^a-z0-9]+/, '');
      if (RX.test(v) && visible(el) && (box ? box.contains(el) : true) && !out.some(o => o.el === el || o.el.contains(el) || el.contains(o.el))) out.push({ el: el, s: v });
    });
    return out;
  };
  const setValue = (el, v) => { el.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const boxOf = el => { let b = el; for (let i = 0; i < 12 && b.parentElement; i++) { b = b.parentElement; const r = b.getBoundingClientRect(); if (r.width >= 700 && r.height >= 350) return b; } return null; };

  return (async () => {
    if (!want) return { ok: false, reason: 'bad request' };
    let typed = null;
    try {
      // 1) the Hunts panel of the game (pressing the menu button again would close it)
      if (!huntButton() && !searchInput()) {
        const h = huntsButton();
        if (!h) return fail('hunts button not found');
        press(clickableOf(h.el));
        if (!(await waitFor(() => huntButton() || searchInput(), waitMs))) return fail('hunts panel did not open');
      }
      // 2) maybe the details already show that hunt
      let shown = detailsShow();
      if (!shown) {
        // 3) search for the Pokémon of the hunt and press its card
        const inp = searchInput();
        if (!inp) return { ok: false, reason: 'search box not found', labels: buttonTexts() };
        let term = speciesShown[0], sp = speciesPlain.slice();
        // (without the Pokémon of the hunt: the words after the LAST "dos" / "de" of its name; "Mina de Ferro dos Aron" is Aron)
        if (!term) { const m = /^.*\s(?:dos|das|do|da|de)\s+([^\s].*)$/i.exec(norm(A.name)); term = m ? norm(m[1]) : ''; sp = term ? [plain(term)] : []; }
        if (!term) return { ok: false, reason: 'hunt not found', labels: buttonTexts() };
        let sawCards = false, probe = null, bySpecies = false;
        // in the region shown: "Todos" everywhere (a type, a level, a tab chosen before could hide the hunt), the Pokémon in the search box, its cards
        const searchHere = async () => {
          const inp2 = searchInput() || inp, box = boxOf(inp2);
          if (box) {
            findNodes(s => s === 'todos os niveis' || s === 'todos' || s === 'all levels' || s === 'all', 12).filter(x => box.contains(x.el)).forEach(x => press(clickableOf(x.el)));
            await sleep(250);
          }
          typed = inp2; setValue(inp2, term);
          await sleep(700);
          const ir = inp2.getBoundingClientRect();
          const cands = () => {
            const b = huntButton(), pane = b ? paneOf(b.el) : null, pr = pane ? pane.getBoundingClientRect() : null;
            const found = findNodes(s => sp.indexOf(s) >= 0, 60);
            // lang-62: a name the page split into pieces ("Exeg" + "gcute" around a <wbr>): the deepest element whose whole text is the name
            if (box) Array.prototype.forEach.call(box.querySelectorAll('*'), el => {
              if (el.children.length === 0 || found.length > 60) return;
              const t = plain(el.textContent).replace(/^[^a-z0-9]+/, '');
              if (sp.indexOf(t) < 0 || Array.prototype.some.call(el.children, c => plain(c.textContent).replace(/^[^a-z0-9]+/, '') === t)) return;
              if (visible(el) && !found.some(f => f.el === el || el.contains(f.el) || f.el.contains(el))) found.push({ el: el, s: t });
            });
            return found.filter(x => { const r = x.el.getBoundingClientRect(), cx = r.left + r.width / 2; return x.el !== inp2 && !(box && !box.contains(x.el)) && !(pane && pane.contains(x.el)) && r.top >= ir.bottom - 2 && !(pr && cx > pr.left); });
          };
          const list = cands();
          if (!list.length) {
            if (!probe) {
              // lang-60: what the search saw, for the report (counts only): the texts that are exactly the Pokémon, visible, in the panel, below the search box
              let all = 0, vis = 0, inBox = 0, below = 0;
              const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let tn;
              while ((tn = w.nextNode())) { const t = plain(tn.nodeValue || '').replace(/^[^a-z0-9]+/, ''); if (sp.indexOf(t) < 0 || !tn.parentElement || tn.parentElement === inp2) continue; all++; const pe = tn.parentElement; if (!visible(pe)) continue; vis++; if (box && !box.contains(pe)) continue; inBox++; if (pe.getBoundingClientRect().top >= ir.bottom - 2) below++; }
              let contains = 0; if (box) Array.prototype.forEach.call(box.querySelectorAll('*'), el => { if (el.children.length === 0 && sp.some(x => plain(el.textContent).indexOf(x) >= 0)) contains++; });
              const hb = huntButton();
              probe = { caçar: hb ? 'in the panel' : (huntButtonOutside() ? 'only outside the panel' : 'none'), contains: contains, input: Math.round(ir.width) + 'x' + Math.round(ir.height), box: box ? Math.round(box.getBoundingClientRect().width) + 'x' + Math.round(box.getBoundingClientRect().height) : 'none', term: term, texts: buttonTexts().length, all: all, vis: vis, inBox: inBox, below: below, regions: regionTabs().map(x => x.s.split(' ')[0]).slice(0, 8).join(',') };
            }
            return null;
          }
          sawCards = true;
          let fallback = -1;
          for (let i = 0; i < Math.min(list.length, 4); i++) {                               // the same Pokémon can be in more than one hunt: the details tell which
            const now = cands();                                                             // (the game may draw the list again after a press: the cards are looked for again each time)
            if (i >= now.length) break;
            press(now[i].el);
            const r = await waitFor(() => detailsShow() || (fallback < 0 && detailsShowSpecies() ? 'species' : null), 1800);
            if (r && r !== 'species') return r;                                              // its name: that is the hunt
            if (r === 'species' && fallback < 0) { fallback = i; if (await waitFor(detailsShow, 300)) return detailsShow(); }
          }
          if (fallback >= 0) {                                                               // no card had its name, one had its Pokémon (and level): the hunt was renamed
            const now = cands(); if (fallback < now.length) { press(now[fallback].el); const r = await waitFor(detailsShowSpecies, 1800); if (r) { bySpecies = true; return r; } }
          }
          return null;
        };
        shown = await searchHere();
        if (!shown) {                                                                        // not in the region shown: the other regions, one by one
          const done = [];
          for (let k = 0; k < 8 && !shown; k++) {
            const tabs = regionTabs().filter(x => done.indexOf(x.s.split(' ')[0]) < 0);
            if (!tabs.length) break;
            done.push(tabs[0].s.split(' ')[0]); press(clickableOf(tabs[0].el)); await sleep(450);
            shown = await searchHere();
          }
        }
        if (!shown) return sawCards ? { ok: false, reason: 'hunt did not open', labels: buttonTexts() } : { ok: false, reason: 'hunt not found', labels: buttonTexts(), probe: probe };   // Caçar is NOT pressed
        if (bySpecies) shown.bySpecies = true;
      }
      // 4) go
      if (BTN_HERE.indexOf(shown.s) >= 0) return { ok: true, already: true, bySpecies: !!shown.bySpecies };
      press(clickableOf(shown.el));
      return { ok: true, bySpecies: !!shown.bySpecies };
    } finally {
      if (typed && typed.isConnected) { try { setValue(typed, ''); } catch (e) {} }          // the search box of the game is left empty
    }
  })();
}

// ---------------------------------------------------------------------------------------------------------------
const guestOf = n => ((accounts && accounts._guests) || {})[n];
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('the page did not answer in ' + Math.round(ms / 1000) + ' s')), ms))]);

// what: 'center' | 'market' | 'bag'; n: the panel (1 to 4), the one that is expanded
async function go(what, n) {
  if (WHAT.indexOf(what) < 0 || !Number.isInteger(n) || n < 1 || n > 4) return { ok: false, what: String(what).slice(0, 12), n: n, reason: 'bad request' };
  const g = guestOf(n);
  let out;
  if (!g) out = { ok: false, reason: 'no game screen' };
  else {
    try {
      const r = (await withTimeout(g.executeJavaScript('(' + navInPage.toString() + ')(' + JSON.stringify(what) + ',' + marketWaitMs + ')', true), pageTimeoutMs)) || {};
      out = { ok: !!r.ok };
      if (r.reason) out.reason = String(r.reason).slice(0, 60);
      if (Array.isArray(r.labels)) out.labels = r.labels.map(x => String(x).slice(0, 24)).slice(0, 24);
    } catch (e) { out = { ok: false, reason: 'page did not answer' }; }
  }
  out.what = what; out.n = n;
  last = { at: Date.now(), what: what, n: n, ok: out.ok, reason: out.reason || '', labels: out.labels || [] };
  return out;
}

// the data of the hunts (hunt-data.js, the same file the notifications use): the name, the level and the Pokémon of a hunt
let huntData = null;
function huntsTable() {
  if (huntData) return huntData;
  huntData = { hunts: [], species: {} };
  try {
    const fs = require('fs'), path = require('path');
    const t = fs.readFileSync(path.join(__dirname, 'hunt-data.js'), 'utf8').replace(/^\s*window\.HUNT_DATA\s*=\s*/, '').replace(/;\s*$/, '');
    const d = JSON.parse(t); huntData = { hunts: Array.isArray(d.hunts) ? d.hunts : [], species: d.species && typeof d.species === 'object' ? d.species : {} };
  } catch (e) {}
  return huntData;
}
function huntInfo(h) {
  const T = huntsTable();
  const found = T.hunts.find(x => h.id && x.id === h.id) || T.hunts.find(x => h.name && x.name === h.name);
  const names = found && Array.isArray(found.ids) ? found.ids.map(i => (T.species[i] && T.species[i].n) || '').filter(Boolean) : [];
  if (found) return { name: found.name || h.name, level: found.level, species: names.slice(0, 3) };
  // lang-59: a hunt that is not in the data (the game added or renamed it after the data was made): its id is often the name of its Pokémon ("torchic")
  const all = Object.keys(T.species).map(k => T.species[k] && T.species[k].n).filter(Boolean);
  const sp = [h.id, h.name].map(x => String(x || '').trim().toLowerCase()).map(x => all.find(n => n.toLowerCase() === x)).find(Boolean);
  return { name: h.name || h.id, level: undefined, species: sp ? [sp] : [] };
}
// go back to a hunt (what the window remembers as the last one of the panel n): { id, name }
async function goHunt(n, hunt) {
  const h = (hunt && typeof hunt === 'object') ? { id: String(hunt.id || '').slice(0, 40), name: String(hunt.name || '').slice(0, 60) } : null;
  if (!Number.isInteger(n) || n < 1 || n > 4 || !h || (!h.id && !h.name)) return { ok: false, n: n, reason: 'bad request' };
  const info = huntInfo(h);
  if (!info.name) return { ok: false, n: n, reason: 'hunt not found' };
  const g = guestOf(n);
  let out;
  if (!g) out = { ok: false, reason: 'no game screen' };
  else {
    try {
      const r = (await withTimeout(g.executeJavaScript('(' + huntInPage.toString() + ')(' + JSON.stringify({ name: info.name, species: info.species, level: info.level }) + ',' + marketWaitMs + ')', true), pageTimeoutMs * 4 + 6000))          // (lang-59: the regions may be searched one by one: about 40 s at most) || {};
      out = { ok: !!r.ok };
      if (r.reason) out.reason = String(r.reason).slice(0, 60);
      if (r.already) out.already = true;
      if (r.bySpecies) out.bySpecies = true;                                                // found by its Pokémon: the game renamed the hunt
      if (Array.isArray(r.labels)) out.labels = r.labels.map(x => String(x).slice(0, 24)).slice(0, 24);
      if (r.probe && typeof r.probe === 'object') out.probe = { input: String(r.probe.input || '').slice(0, 14), box: String(r.probe.box || '').slice(0, 14), term: String(r.probe.term || '').slice(0, 30), texts: Number(r.probe.texts) || 0,
        all: Number(r.probe.all) || 0, vis: Number(r.probe.vis) || 0, inBox: Number(r.probe.inBox) || 0, below: Number(r.probe.below) || 0, contains: Number(r.probe.contains) || 0, cacar: String(r.probe['caçar'] || '').slice(0, 30), regions: String(r.probe.regions || '').replace(/[^a-z,]/g, '').slice(0, 60) };
    } catch (e) { out = { ok: false, reason: 'page did not answer' }; }
  }
  out.n = n;
  last = { at: Date.now(), what: 'lasthunt', n: n, ok: out.ok, reason: out.reason || '', labels: out.labels || [], probe: out.probe, already: !!out.already, bySpecies: !!out.bySpecies, hunt: info.name };
  return out;
}

// for the report of the Diagnostics
function lastInfo() {
  if (!last) return null;
  return { ageSec: Math.round((Date.now() - last.at) / 1000), what: last.what, n: last.n, ok: last.ok, reason: last.reason, labels: last.labels, probe: last.probe, already: last.already, bySpecies: last.bySpecies, hunt: last.hunt };
}

function init() {
  if (!electron || !electron.ipcMain || !electron.ipcMain.handle) return;
  let settings = null; try { settings = require('./settings'); } catch (e) {}
  const ours = e => !!(settings && settings.fromOurWindow && settings.fromOurWindow(e));       // only the app's own window, never a game panel
  electron.ipcMain.handle('nav:go', (e, what, n) => (ours(e) ? go(what, n) : null));
  electron.ipcMain.handle('nav:hunt', (e, n, hunt) => (ours(e) ? goHunt(n, hunt) : null));
}

module.exports = { init, go, goHunt, huntInfo, lastInfo, navInPage, huntInPage, _setHuntData: d => { huntData = d; }, _setTimeout: ms => { pageTimeoutMs = ms; }, _setMarketWait: ms => { marketWaitMs = ms; }, _reset: () => { last = null; } };
