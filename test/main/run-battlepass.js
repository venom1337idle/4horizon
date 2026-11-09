// run-battlepass.js: the guard script INSIDE the game page, Battle Pass window (lang-70): "Comprar passe" and "Dar o Passe para um amigo" cannot be pressed in the app,
// one note with a link to the official page takes their place, and the rest of the window (rewards, tabs) works as before
const { chromium } = require('./pw');
const DG = require('./donate-guard');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const EN = Object.assign({ url: DG.OFFICIAL }, DG.texts('en')), PT = Object.assign({ url: DG.OFFICIAL }, DG.texts('pt-BR'));
// the Battle Pass window as the game draws it (screenshot of 2026-11-08): the title, the tabs, the level, the column with the two pass cards and the two buttons, the rewards
const PASS = o => { o = Object.assign({ title: 'Passe de Batalha', buy: 'Comprar passe', gift: 'Dar o Passe para um amigo', hasBuy: true, buyDiv: false }, o || {});
  return `<div id="bp" class="modal"><div class="head"><img alt="" width="40" height="40" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='20' cy='20' r='18' fill='%23e3c06b'/></svg>"><div><h2>${o.title}</h2><p>Temporada 1</p></div>
    <div class="stats"><span>Nível 15/30</span><span>Para resgatar 0</span><span>Premium Ativo</span><span>Deluxe —</span></div></div>
    <div class="tabs"><button class="tab" id="t1">Temporada</button><button class="tab" id="t2">Recompensas exclusivas</button><button class="tab">Como funciona</button></div>
    <div class="season"><h3>Temporada 1</h3><p>Faltam 50 PP para o nível 16</p>
      <div class="side" id="side" style="width:280px"><div class="card" id="prem">Passe Premium <b>✓ Ativo</b></div><div class="card" id="deluxe" style="cursor:pointer">Passe Premium Deluxe <b>R$ 79,90</b></div>
        ${o.hasBuy ? (o.buyDiv ? `<div id="buy" style="cursor:pointer;padding:10px;background:#e3c06b;color:#000"><span>${o.buy}</span></div>` : `<button id="buy" class="gold" style="width:100%">${o.buy}</button>`) : ''}
        <button id="gift" style="width:100%"><span>\u{1F381}</span> <span>${o.gift}</span></button></div></div>
    <div class="rewards"><span>Grátis</span><span>Premium</span><button id="claim">Resgatar tudo</button><div class="r">Ultra Ball ×200</div></div></div>`; };
const PAGE = o => `<!doctype html><meta charset=utf-8><body style="margin:0;background:#111;color:#eee;font:14px sans-serif">
<div id="root">${PASS(o)}</div>
<div id="other" class="modal2"><h2>Loja de itens</h2><button id="obuy">Comprar passe</button></div>
<script>
window.__n = {};
function wire() { ['buy', 'gift', 'claim', 'deluxe', 't1', 't2', 'obuy'].forEach(id => { const e = document.getElementById(id); if (e && !e.__w) { e.__w = 1; ['click', 'mousedown', 'pointerdown', 'mouseup', 'keydown', 'touchend'].forEach(t => e.addEventListener(t, () => { window.__n[id] = (window.__n[id] || 0) + 1; })); } }); }
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#buy,#gift'); if (b) window.__n.doc = (window.__n.doc || 0) + 1; });
wire(); new MutationObserver(wire).observe(document.body, { childList: true, subtree: true });
window.__redraw = h => { document.getElementById('root').innerHTML = h; wire(); };
</script>`;
// every kind of press, also on a piece inside the button (the gift picture)
const press = (p, id) => p.evaluate(id => { const b = document.getElementById(id); if (!b) return -1; window.__n = {}; const tg = [b].concat(Array.from(b.querySelectorAll('span')));
  tg.forEach(x => { try { x.click(); } catch (e) {} ['click', 'dblclick', 'auxclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach(t => x.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }))); ['keydown', 'keyup', 'keypress'].forEach(t => ['Enter', ' '].forEach(k => x.dispatchEvent(new KeyboardEvent(t, { key: k, code: k === ' ' ? 'Space' : 'Enter', bubbles: true, cancelable: true })))); try { x.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true })); } catch (e) {} });
  return (window.__n[id] || 0) + (window.__n.doc || 0); }, id);
const look = p => p.evaluate(() => { const st = id => { const b = document.getElementById(id); return b ? { hidden: getComputedStyle(b).display === 'none', mark: b.getAttribute('data-4h-blocked'), kind: b.getAttribute('data-4h-kind'), tab: b.getAttribute('tabindex'), aria: b.getAttribute('aria-hidden') } : null; };
  const ns = Array.from(document.querySelectorAll('[data-4h-note="pass"]')), n = ns[0], a = n && n.querySelector('a');
  return { buy: st('buy'), gift: st('gift'), notes: ns.length, allNotes: document.querySelectorAll('[data-4h-note]').length, text: n ? n.textContent : null, next: n && n.nextElementSibling ? n.nextElementSibling.id : null, inSide: !!n && !!n.closest('#side'),
    link: a ? { text: a.textContent, href: a.getAttribute('href'), target: a.target, rel: a.rel } : null, box: n ? { display: getComputedStyle(n).display, w: Math.round(n.getBoundingClientRect().width), border: getComputedStyle(n).borderTopWidth } : null,
    other: st('obuy'), claim: st('claim'), deluxe: st('deluxe') }; });
(async () => {
  const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1200, height: 800 } });
  let p = await ctx.newPage(); const logs = []; p.on('console', m => logs.push(m.text())); await p.setContent(PAGE());
  ok('before the script: both buttons are there and a press reaches the game', (await press(p, 'buy')) > 0 && (await press(p, 'gift')) > 0);
  const r1 = await p.evaluate(DG.scriptFor(EN)); await p.waitForTimeout(100);
  let L = await look(p);
  ok('the script is installed', r1 === 'installed', r1);
  ok('"Comprar passe" and "Dar o Passe para um amigo" are hidden, marked (passbuy, passgift), out of the reach of the keyboard and hidden from screen readers', L.buy.hidden && L.buy.mark === '1' && L.buy.kind === 'passbuy' && L.buy.tab === '-1' && L.buy.aria === 'true' && L.gift.hidden && L.gift.kind === 'passgift' && L.gift.tab === '-1', L);
  ok('ONE note takes their place, in the column, just before where "Comprar passe" was: "To buy or gift the Battle Pass, visit the official webpage"', L.notes === 1 && L.inSide && L.next === 'buy' && L.text === 'To buy or gift the Battle Pass, visit the official webpage', L);
  ok('...a box as wide as the buttons were (a block with a border), and "webpage" is the link to https://pokehorizonidle.com/ in a new window (the browser), noopener noreferrer', L.box.display === 'block' && L.box.w === 280 && L.box.border === '1px' && L.link && L.link.text === 'webpage' && L.link.href === 'https://pokehorizonidle.com/' && L.link.target === '_blank' && /noopener/.test(L.link.rel) && /noreferrer/.test(L.link.rel), [L.box, L.link]);
  ok('every kind of press on the two buttons (also on the gift picture inside, by a script, by keyboard, by touch) never reaches the game', (await press(p, 'buy')) === 0 && (await press(p, 'gift')) === 0);
  ok('...the app is told: "4h-donate:pass" once, and the stopped presses ("4h-donate:blocked")', logs.filter(x => x === '4h-donate:pass').length === 1 && logs.includes('4h-donate:blocked'), logs);
  ok('the rest of the window works as before: "Resgatar tudo", the Deluxe card and the tabs are not touched and their presses reach the game', !L.claim.mark && !L.deluxe.mark && (await press(p, 'claim')) > 0 && (await press(p, 'deluxe')) > 0 && (await press(p, 't2')) > 0, L);
  ok('a "Comprar passe" OUTSIDE the Battle Pass window (another window of the game) is not touched', !L.other.mark && !L.other.hidden && (await press(p, 'obuy')) > 0, L.other);
  ok('a real mouse click on the place where the buttons were does nothing (they are not there)', await (async () => { await p.evaluate(() => { window.__n = {}; }); const r = await p.evaluate(() => { const s = document.getElementById('side').getBoundingClientRect(); return [Math.round(s.left + 140), Math.round(s.bottom - 10)]; }); await p.mouse.click(r[0], r[1]); return !(await p.evaluate(() => window.__n.buy || window.__n.gift || window.__n.doc)); })());

  // the game draws the window again (a new day, the tab clicked again)
  await p.evaluate(h => window.__redraw(h), PASS()); await p.waitForTimeout(450); L = await look(p);
  ok('the game draws the window again: both buttons hidden again, still ONE note', L.buy.hidden && L.gift.hidden && L.notes === 1 && L.next === 'buy' && (await press(p, 'buy')) === 0, L);
  await p.evaluate(h => window.__redraw(h), PASS({ hasBuy: false })); await p.waitForTimeout(450); L = await look(p);
  ok('only the gift button (no "Comprar passe", e.g. the pass was bought): it is hidden and the note is just before it', L.buy === null && L.gift.hidden && L.notes === 1 && L.next === 'gift', L);
  await p.evaluate(h => window.__redraw(h), PASS({ buyDiv: true })); await p.waitForTimeout(450); L = await look(p);
  ok('"Comprar passe" drawn as a box with a hand cursor (not a <button>): found and hidden all the same', L.buy.hidden && L.buy.kind === 'passbuy' && L.notes === 1 && (await press(p, 'buy')) === 0, L);
  await p.evaluate(() => { document.getElementById('root').innerHTML = ''; }); await p.waitForTimeout(450); L = await look(p);
  ok('the window is closed: no note is left anywhere', L.allNotes === 0, L);
  await p.evaluate(h => window.__redraw(h), PASS({ title: 'Battle Pass', buy: 'Buy pass', gift: 'Gift the Pass to a friend' })); await p.waitForTimeout(450); L = await look(p);
  ok('the game in English ("Battle Pass", "Buy pass", "Gift the Pass to a friend"): the same', L.buy.hidden && L.gift.hidden && L.notes === 1 && (await press(p, 'gift')) === 0, L);
  await p.evaluate(h => window.__redraw(h), PASS({ title: 'Temporada', buy: 'Comprar passe' })); await p.waitForTimeout(450); L = await look(p);
  ok('a window that is NOT the Battle Pass (no such title) with the same buttons: not touched', !L.buy.mark && !L.buy.hidden && !L.gift.mark && L.notes === 0, L);
  ok('no style sheet was added to the page', (await p.evaluate(() => document.querySelectorAll('style').length)) === 0);
  await p.close();

  // Portuguese
  p = await ctx.newPage(); await p.setContent(PAGE()); await p.evaluate(DG.scriptFor(PT)); await p.waitForTimeout(100); L = await look(p);
  ok('in Portuguese: "Para comprar ou dar o Passe de Batalha, visite a página oficial", "página" is the link', L.text === 'Para comprar ou dar o Passe de Batalha, visite a página oficial' && L.link.text === 'página', L);
  const again = await p.evaluate(DG.scriptFor(EN)); L = await look(p);
  ok('the language changes (the script is sent again): the note changes with no reload, still one', again === 'updated' && L.notes === 1 && L.text === 'To buy or gift the Battle Pass, visit the official webpage', [again, L]);
  await p.close();
  await br.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
