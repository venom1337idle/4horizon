// run-donate-page.js: the guard script that runs INSIDE the game page: the "+ Doar" button of the diamond shop cannot be pressed, and a note with a link takes its place
const { chromium } = require('./pw');
const DG = require('./donate-guard');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const EN = { url: DG.OFFICIAL, before: 'Visit the official ', link: 'webpage', after: ' to donate' };
const PT = { url: DG.OFFICIAL, before: 'Visite a ', link: 'página', after: ' oficial para doar' };
// the shop as the game draws it (a box "Seus diamantes" with the number, and the button), the tabs, buying buttons, and a guild window with its own "Doar"
const SHOP = (o) => { o = Object.assign({ label: 'Seus diamantes', btn: '+ Doar', title: 'Loja de Diamantes', boxLabel: true, tabDiv: false, form: true, price: '33,25', via: 'Pix' }, o || {});
  return `<div id="shop" class="modal"><div class="banner"><h2>${o.title}</h2><p>Boosts, VIP, outfits, Pokémon e itens</p>
    <div id="box" class="box"><img alt="" width="30" height="24" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='30' height='24'><polygon points='15,0 30,10 15,24 0,10' fill='%2375cff8'/></svg>"><span class="lb">${o.boxLabel ? o.label : ''}</span><b class="num">20</b><button id="doar" class="gold">${o.btn}</button></div></div>
    <div class="tabs"><button class="tab" id="tabb">Boosts</button><button class="tab" id="tabv">VIP</button><button class="tab">Outfits</button><button class="tab">Pokémon</button><button class="tab">Itens</button>${o.tabDiv ? '<div id="tabd" style="cursor:pointer;display:inline-block;padding:6px"><img alt="" width="18" height="14" src="data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'18\' height=\'14\'><rect width=\'18\' height=\'14\' fill=\'%2375cff8\'/></svg>"><span>Diamantes</span></div>' : '<button class="tab" id="tabd">Diamantes</button>'}</div>
    ${o.form ? `<div id="form"><div class="subtabs"><button id="subd">Doar e ganhar diamantes</button><button id="hist">Histórico</button></div><h3>Quantos diamantes quer receber?</h3><div><button class="amt">50</button><button class="amt">100</button></div><div><button class="via">Pix</button><button class="via">Cartão de crédito</button></div><input placeholder="Maria Silva"><input placeholder="000.000.000-00"><button id="pay" class="gold"><span>Doar R$ </span><span id="price">${o.price}</span><span> com ${o.via}</span></button></div>` : ''}
    <div class="cards"><div class="card">Boost XP Pokémon 1h <button class="buy">Comprar</button></div><div class="card">Boost XP Treinador 1h <button class="buy">Comprar</button></div></div></div>`; };
const PAGE = (o) => `<!doctype html><meta charset=utf-8><body style="margin:0;background:#111;color:#eee;font:14px sans-serif">
<div id="root">${SHOP(o)}</div>
<div id="guild" class="modal2"><h2>Guilda</h2><p>Banco da guilda: 1.200 de ouro</p><button id="gdoar">Doar</button> <button id="gdoar2">Doar ouro</button></div>
<script>
window.__donated = 0; window.__guild = 0; window.__bought = 0; window.__order = []; window.__linkClick = null;
// the game: listeners on the button, on the root (capture and bubble) and on the document, like a real app has
window.__tab = 0; window.__pay = 0; window.__sub = 0; window.__boost = 0; window.__vip = 0;
function wire() { const b = document.getElementById('doar'); if (b && !b.__w) { b.__w = 1; ['click','mousedown','pointerdown','mouseup','keydown'].forEach(t => b.addEventListener(t, () => { window.__donated++; })); }
  [['tabd', '__tab'], ['pay', '__pay'], ['subd', '__sub'], ['tabb', '__boost'], ['tabv', '__vip']].forEach(([id, k]) => { const e = document.getElementById(id); if (e && !e.__w) { e.__w = 1; ['click','mousedown','pointerdown','mouseup','keydown'].forEach(t => e.addEventListener(t, () => { window[k]++; })); } }); }
document.getElementById('root').addEventListener('click', e => { if (e.target.closest('#doar')) { window.__donated++; window.__order.push('root-bubble'); } if (e.target.closest('.buy')) window.__bought++; });
document.getElementById('root').addEventListener('click', e => { if (e.target.closest('#doar')) { window.__donated++; window.__order.push('root-capture'); } }, true);
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#doar')) { window.__donated++; window.__order.push('document'); } if (e.target.tagName === 'A') window.__linkClick = { defaultPrevented: e.defaultPrevented, href: e.target.href, target: e.target.target }; });
document.getElementById('gdoar').addEventListener('click', () => { window.__guild++; });
wire(); new MutationObserver(wire).observe(document.body, { childList: true, subtree: true });
window.__redraw = (o) => { document.getElementById('root').innerHTML = o; wire(); };
</script>`;
const press = p => p.evaluate(() => { const b = document.getElementById('doar'); const r = []; try { b.click(); } catch (e) {} ['click','dblclick','auxclick','mousedown','mouseup','pointerdown','pointerup'].forEach(t => b.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }))); ['keydown','keyup','keypress'].forEach(t => ['Enter', ' '].forEach(k => b.dispatchEvent(new KeyboardEvent(t, { key: k, code: k === ' ' ? 'Space' : 'Enter', bubbles: true, cancelable: true })))); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'NumpadEnter', bubbles: true, cancelable: true })); try { b.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true })); } catch (e) {} return window.__donated; });
const look = p => p.evaluate(() => { const b = document.getElementById('doar'), n = document.querySelector('[data-4h-note]'), a = n && n.querySelector('a'), cs = b && getComputedStyle(b), ac = a && getComputedStyle(a);
  return { hidden: !!b && cs.display === 'none', attr: !!b && b.getAttribute('data-4h-blocked'), aria: !!b && b.getAttribute('aria-hidden'), tab: !!b && b.getAttribute('tabindex'), dis: !!b && b.disabled, inert: !!b && b.inert, notes: document.querySelectorAll('[data-4h-note]').length, text: n ? n.textContent : null, link: a ? { text: a.textContent, href: a.getAttribute('href'), target: a.target, rel: a.rel, color: ac.color, deco: ac.textDecorationLine, weight: ac.fontWeight } : null, before: !!n && n.nextElementSibling === b, sameBox: !!n && n.parentElement === b.parentElement, noteDisplay: n ? getComputedStyle(n).display : null }; });
(async () => {
  const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1100, height: 700 } });
  await ctx.route('https://pokehorizonidle.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>official</title>' }));
  let p = await ctx.newPage(); const logs = []; p.on('console', m => logs.push(m.text())); await p.setContent(PAGE());
  const styles0 = await p.evaluate(() => document.querySelectorAll('style').length);
  ok('before the script: the button is there and a press reaches the game (the stand-in counts it)', (await press(p)) > 0 && (await p.evaluate(() => getComputedStyle(document.getElementById('doar')).display)) !== 'none');
  await p.evaluate(() => { window.__donated = 0; });
  const r1 = await p.evaluate(DG.scriptFor(EN));
  let L = await look(p);
  ok('the script is installed', r1 === 'installed', r1);
  ok('the button is hidden, marked, out of the reach of the keyboard (tabindex -1), disabled, inert and hidden from screen readers', L.hidden && L.attr === '1' && L.tab === '-1' && L.dis && L.inert && L.aria === 'true', L);
  ok('the note is in the box of the diamonds, right where the button was (just before it): "Visit the official webpage to donate"', L.notes === 1 && L.text === 'Visit the official webpage to donate' && L.before && L.sameBox && L.noteDisplay === 'inline-block', L);
  ok('"webpage" is a link to https://pokehorizonidle.com/ that asks for a new window (so it opens in the browser), without handing over the page (noopener noreferrer), and it stands out: light blue, bold, underlined', L.link && L.link.text === 'webpage' && L.link.href === 'https://pokehorizonidle.com/' && L.link.target === '_blank' && /noopener/.test(L.link.rel) && /noreferrer/.test(L.link.rel) && L.link.color === 'rgb(127, 214, 255)' && L.link.deco === 'underline' && Number(L.link.weight) >= 700, L.link);
  // presses
  await p.evaluate(() => { window.__donated = 0; window.__order.length = 0; });
  const after = await press(p);
  ok('a plain .click() on the disabled button fires nothing at all (the browser itself ignores it), so the game cannot get it', await p.evaluate(() => { window.__donated = 0; let n = 0; window.addEventListener('click', () => n++, true); document.getElementById('doar').click(); return n === 0 && window.__donated === 0; }));
  ok('every kind of press on it (click, double click, mouse, pointer, touch, Enter, Space, numpad Enter, also made by a script) never reaches the game: the game counted 0 (on the button, on the root in capture and in bubble, on the document)', after === 0 && (await p.evaluate(() => window.__order.length)) === 0, [after, await p.evaluate(() => window.__order)]);
  ok('...and each press that was stopped is told to the app (a line in the console of the page), but not more than twice a second', logs.filter(x => x === '4h-donate:blocked').length >= 1 && logs.filter(x => x === '4h-donate:blocked').length <= 2, logs);
  ok('...and it told the app that it saw the button, once', logs.filter(x => x === '4h-donate:seen').length === 1, logs);
  // a real mouse click where the button was
  await p.evaluate(() => { window.__donated = 0; }); const bx = await p.evaluate(() => { const r = document.querySelector('.num').getBoundingClientRect(); return [Math.round(r.right + 120), Math.round(r.top + r.height / 2)]; });
  await p.mouse.click(bx[0], bx[1]); await p.mouse.dblclick(bx[0], bx[1]);
  ok('a real mouse click on the place where the button was does nothing either (it is not there)', (await p.evaluate(() => window.__donated)) === 0);
  // it does not get in the way of the rest
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
  await p.evaluate(() => { document.querySelectorAll('.buy')[0].click(); });
  await p.click('.buy >> nth=1');
  ok('the rest of the shop works: the buying buttons (script click and real click) are counted by the game, and the other tabs (Boosts, VIP) and the sub-tabs of the donation page can be pressed', (await p.evaluate(() => window.__bought)) === 2 && await p.evaluate(() => { const b0 = window.__boost, v0 = window.__vip; document.getElementById('tabb').click(); document.getElementById('tabv').click(); document.getElementById('hist').click(); return window.__boost === b0 + 1 && window.__vip === v0 + 1; }), await p.evaluate(() => [window.__bought, window.__boost, window.__vip]));
  const tabNotBlocked = await p.evaluate(() => { const e = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }); document.getElementById('tabb').dispatchEvent(e); return e.defaultPrevented; });
  ok('the Tab key is never stopped (focus does not get trapped), only Enter and Space on that one button', tabNotBlocked === false);
  const enterOnOther = await p.evaluate(() => { let n = 0; const b = document.querySelector('.buy'); b.addEventListener('keydown', () => n++); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); return n; });
  ok('Enter on any other button reaches the game as always', enterOnOther === 1, enterOnOther);
  // the guild keeps its own Doar
  const G = await p.evaluate(() => { const g = document.getElementById('gdoar'); g.click(); return { shown: getComputedStyle(g).display !== 'none', count: window.__guild, marked: g.hasAttribute('data-4h-blocked'), note: !!g.previousElementSibling && g.previousElementSibling.hasAttribute('data-4h-note'), other: document.getElementById('gdoar2').hasAttribute('data-4h-blocked') }; });
  ok('another "Doar" of the game (the guild, outside the shop of diamonds) is not touched: visible, pressed, no note; and "Doar ouro" neither', G.shown && G.count === 1 && !G.marked && !G.note && !G.other, G);
  // the link
  const popup = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
  await p.click('[data-4h-note] a'); const pop = await popup;
  const lc = await p.evaluate(() => window.__linkClick);
  ok('a click on "webpage" is a normal link click that asks for a new window (not stopped, not changed: the game is not replaced), and the shop does not count it as a donation', lc && lc.defaultPrevented === false && lc.target === '_blank' && lc.href === 'https://pokehorizonidle.com/' && (await p.evaluate(() => window.__donated)) === 0, lc);
  ok('...a window was really requested for https://pokehorizonidle.com/ (in the app this request is the one external.js sends to the default browser)', !!pop && pop.url() === 'https://pokehorizonidle.com/', pop && pop.url());
  if (pop) await pop.close().catch(() => {});
  // the language
  await p.evaluate(c => window.__4hDonate.set(c), PT); L = await look(p);
  ok('a new language rewrites the note: "Visite a página oficial para doar", the link is "página", still one note, still the same address', L.notes === 1 && L.text === 'Visite a página oficial para doar' && L.link.text === 'página' && L.link.href === 'https://pokehorizonidle.com/', L);
  // the game draws the shop again: new button, the race before the script looks
  await p.evaluate(c => window.__4hDonate.set(c), EN);
  const raced = await p.evaluate((html) => { window.__redraw(html); window.__donated = 0; const b = document.getElementById('doar'); b.click(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); return window.__donated; }, SHOP());
  ok('the game draws the shop again with a NEW button: a press in the very same moment (before the script looked) is already stopped, because it is the text of the button that counts', raced === 0, raced);
  await p.waitForTimeout(500); L = await look(p);
  ok('...and a moment later the new button is hidden and marked, with one note (not two)', L.hidden && L.attr === '1' && L.notes === 1 && L.before, L);
  // closed and opened
  await p.evaluate(() => { document.getElementById('root').innerHTML = ''; }); await p.waitForTimeout(500);
  ok('the shop is closed: no note is left behind', (await p.evaluate(() => document.querySelectorAll('[data-4h-note]').length)) === 0);
  await p.evaluate(html => { window.__redraw(html); }, SHOP()); await p.waitForTimeout(500); L = await look(p);
  ok('...and when it opens again it is taken care of again', L.hidden && L.notes === 1, L);
  // run it again
  const r2 = await p.evaluate(DG.scriptFor(EN)); await p.evaluate(() => { window.__donated = 0; });
  const logs0 = logs.length; await p.waitForTimeout(600); await p.evaluate(() => document.getElementById('doar').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))); await p.waitForTimeout(150);
  const st = await p.evaluate(() => window.__4hDonate.stats());
  ok('the script put in again (a page that loads again, a new language) only updates: one note, and one press is counted once, not twice', r2 === 'updated' && (await look(p)).notes === 1 && (await p.evaluate(() => window.__donated)) === 0 && logs.slice(logs0).filter(x => x === '4h-donate:blocked').length === 1, [r2, st, logs.slice(logs0)]);
  ok('it adds no style sheet and no markup text (a strict page policy cannot stop it)', (await p.evaluate(() => document.querySelectorAll('style').length)) === styles0);
  await p.close();
  // other ways the button can be written
  const variants = [
    ['English: "Donate" in the box "Your diamonds"', { label: 'Your diamonds', btn: 'Donate', title: 'Diamond shop' }],
    ['capitals and spaces: "  + DOAR "', { btn: '  + DOAR ' }],
    ['no label in the box, but the window begins with "Loja de Diamantes"', { boxLabel: false }],
    ['the button is a link-like element with a role', { btn: '+ Doar' }]
  ];
  for (const [name, o] of variants) {
    const q = await ctx.newPage(); await q.setContent(PAGE(o)); await q.evaluate(DG.scriptFor(EN)); const lk = await look(q); await q.evaluate(() => { window.__donated = 0; }); const pr = await press(q);
    ok(name + ': handled (hidden, one note, nothing reaches the game)', lk.hidden && lk.notes === 1 && pr === 0, [lk, pr]); await q.close();
  }
  const q2 = await ctx.newPage(); await q2.setContent(PAGE({ label: 'Saldo', boxLabel: true, title: 'Outra Loja' })); await q2.evaluate(DG.scriptFor(EN));
  const nm = await q2.evaluate(() => { const b = document.getElementById('doar'); b.click(); return { shown: getComputedStyle(b).display !== 'none', donated: window.__donated, notes: document.querySelectorAll('[data-4h-note]').length }; });
  ok('a "Doar" in a window that is not the diamond shop and has no box of diamonds is left alone', nm.shown && nm.donated > 0 && nm.notes === 0, nm); await q2.close();
  // a page with a strict content policy
  const q3 = await ctx.newPage(); await q3.setContent(PAGE().replace('<meta charset=utf-8>', "<meta charset=utf-8><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'none'; img-src data:\">")); await q3.evaluate(DG.scriptFor(EN)); const lk3 = await look(q3);
  ok('on a page with a strict content policy (no style at all) it still works: hidden, noted, styled', lk3.hidden && lk3.notes === 1 && lk3.noteDisplay === 'inline-block' && lk3.link && lk3.link.deco === 'underline', lk3); await q3.close();
  // the game's own text with markup is never run (the script only reads text)
  const q4 = await ctx.newPage(); await q4.setContent(PAGE({ label: 'Seus diamantes &lt;img src=x onerror=&quot;window.__xss=1&quot;&gt;' })); await q4.evaluate(DG.scriptFor(EN)); await q4.waitForTimeout(200);
  ok('text of the page that looks like markup (in the label of the box) is only ever read, never turned into markup: nothing runs, and the button is still handled', (await q4.evaluate(() => window.__xss)) === undefined && (await look(q4)).hidden && (await look(q4)).notes === 1, [await q4.evaluate(() => window.__xss), await look(q4)]); await q4.close();
  // ---- the second way in: the tab "Diamantes" and the pay button of the donation page
  const barrage = (pg, id, key) => pg.evaluate(([id, key]) => { const b = document.getElementById(id), n0 = window[key]; try { b.click(); } catch (e) {} ['click','dblclick','auxclick','mousedown','mouseup','pointerdown','pointerup'].forEach(t => b.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }))); ['keydown','keyup','keypress'].forEach(t => ['Enter', ' '].forEach(k => b.dispatchEvent(new KeyboardEvent(t, { key: k, code: k === ' ' ? 'Space' : 'Enter', bubbles: true, cancelable: true })))); try { b.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true })); } catch (e) {} return window[key] - n0; }, [id, key]);
  const shown = (pg, id) => pg.evaluate(i => { const e = document.getElementById(i); return !!e && getComputedStyle(e).display !== 'none'; }, id);
  {
    const logs2 = []; const q = await ctx.newPage(); q.on('console', m => logs2.push(m.text())); await q.setContent(PAGE()); await q.evaluate(DG.scriptFor(EN)); await q.waitForTimeout(300);
    const st = await q.evaluate(() => { const t = document.getElementById('tabd'), y = document.getElementById('pay'); return { tabHidden: getComputedStyle(t).display === 'none', tabKind: t.getAttribute('data-4h-kind'), tabDis: t.disabled, tabInert: t.inert, tabIdx: t.getAttribute('tabindex'), tabAria: t.getAttribute('aria-hidden'), payHidden: getComputedStyle(y).display === 'none', payKind: y.getAttribute('data-4h-kind'), payDis: y.disabled, payInert: y.inert, notes: document.querySelectorAll('[data-4h-note]').length, noteNear: [t, y].map(e => !!e.previousElementSibling && e.previousElementSibling.hasAttribute('data-4h-note')) }; });
    ok('the tab "Diamantes" is hidden, marked as a tab, disabled, inert, out of the reach of the keyboard and of screen readers', st.tabHidden && st.tabKind === 'tab' && st.tabDis && st.tabInert && st.tabIdx === '-1' && st.tabAria === 'true', st);
    ok('the pay button "Doar R$ 33,25 com Pix" (its text is in three pieces) is hidden, marked as pay, disabled and inert', st.payHidden && st.payKind === 'pay' && st.payDis && st.payInert, st);
    ok('only the "+ Doar" gets the note: one note in all, not next to the tab or the pay button', st.notes === 1 && st.noteNear[0] === false && st.noteNear[1] === false, st);
    ok('the other tabs (Boosts, VIP, Outfits, Pokémon, Itens) and the sub-tabs and options of the donation page are left alone: visible', (await Promise.all(['tabb', 'tabv', 'subd', 'hist'].map(i => shown(q, i)))).every(Boolean) && (await q.evaluate(() => Array.from(document.querySelectorAll('.tab')).every(t => t.id === 'tabd' || getComputedStyle(t).display !== 'none'))));
    ok('every kind of press on the tab never reaches the game (the game counted 0)', (await barrage(q, 'tabd', '__tab')) === 0 && (await q.evaluate(() => window.__tab)) === 0);
    ok('every kind of press on the pay button never reaches the game (0)', (await barrage(q, 'pay', '__pay')) === 0 && (await q.evaluate(() => window.__pay)) === 0);
    ok('...and the game still hears the sub-tab "Doar e ganhar diamantes" (it is not a payment, and it is not reachable without the tab anyway)', await q.evaluate(() => { const n = window.__sub; document.getElementById('subd').click(); return window.__sub === n + 1; }));
    ok('the app is told once that the tab was found and once that the pay button was found (and once the "+ Doar")', logs2.filter(x => x === '4h-donate:tab').length === 1 && logs2.filter(x => x === '4h-donate:pay').length === 1 && logs2.filter(x => x === '4h-donate:seen').length === 1, logs2);
    ok('...and the presses that were stopped are counted: blocked presses > 0 and the three "seen" flags are true', await q.evaluate(() => { const s = window.__4hDonate.stats(); return s.blocked > 0 && s.seen && s.tab && s.pay; }));
    // the game draws the page again: another amount, card instead of Pix, and a press in the very same moment
    const raced = await q.evaluate((html) => { window.__redraw(html); const y = document.getElementById('pay'), t = document.getElementById('tabd'); const n0 = window.__pay + window.__tab; y.click(); t.click(); y.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); return (window.__pay + window.__tab) - n0; }, SHOP({ price: '1.000,00', via: 'Cartão de crédito' }));
    ok('the game draws the page again (another amount, "com Cartão de crédito") and a press in that very moment on the new buttons is already stopped (it is the text that counts)', raced === 0, raced);
    await q.waitForTimeout(500);
    ok('...and a moment later the new tab and the new pay button are hidden, with still one note', (await shown(q, 'tabd')) === false && (await shown(q, 'pay')) === false && (await q.evaluate(() => document.querySelectorAll('[data-4h-note]').length)) === 1);
    await q.evaluate(() => { document.getElementById('root').innerHTML = ''; }); await q.waitForTimeout(400);
    await q.evaluate(html => { window.__redraw(html); }, SHOP()); await q.waitForTimeout(500);
    ok('the shop closed and opened again: the tab and the pay button are hidden again', (await shown(q, 'tabd')) === false && (await shown(q, 'pay')) === false);
    await q.close();
    // a tab that is not a <button> (a box with a click handler: only its hand cursor shows that it is clickable)
    const q2 = await ctx.newPage(); await q2.setContent(PAGE({ tabDiv: true })); await q2.evaluate(DG.scriptFor(EN)); await q2.waitForTimeout(300);
    ok('a tab that is a plain box with a click handler (no button, no role; only the hand cursor) is found and hidden too, and its presses are stopped', (await shown(q2, 'tabd')) === false && (await barrage(q2, 'tabd', '__tab')) === 0);
    await q2.close();
    // the pay button of a donation, anywhere
    const q3 = await ctx.newPage(); await q3.setContent('<body><div id="modal"><h2>Apoie o jogo</h2><button id="pay"><span>Doar R$ </span><span>10,00</span><span> com Cartão</span></button><button id="other">Doar</button></div><script>window.__pay=0;window.__other=0;pay.addEventListener("click",()=>window.__pay++);other.addEventListener("click",()=>window.__other++);</script>'); await q3.evaluate(DG.scriptFor(EN)); await q3.waitForTimeout(300);
    const w3 = await q3.evaluate(() => { document.getElementById('pay').click(); document.getElementById('other').click(); return { pay: window.__pay, other: window.__other, payShown: getComputedStyle(document.getElementById('pay')).display !== 'none', otherShown: getComputedStyle(document.getElementById('other')).display !== 'none' }; });
    ok('a "Doar R$ ..." button anywhere in the game (money) is blocked too, while a plain "Doar" outside the shop is not touched', w3.pay === 0 && !w3.payShown && w3.other === 1 && w3.otherShown, w3);
    await q3.close();
    // a "Diamantes" that is not the tab of the shop
    const q4 = await ctx.newPage(); await q4.setContent('<body><div id="market"><h2>Mercado</h2><div><button>Todos</button><button>Itens</button><button id="tabd">Diamantes</button></div></div><script>window.__tab=0;tabd.addEventListener("click",()=>window.__tab++);</script>'); await q4.evaluate(DG.scriptFor(EN)); await q4.waitForTimeout(300);
    ok('a button "Diamantes" in another window (a market filter: no shop title, no Boosts or Outfits next to it) is not touched', (await shown(q4, 'tabd')) && await q4.evaluate(() => { document.getElementById('tabd').click(); return window.__tab === 1; }));
    await q4.close();
    // found by the title of the shop alone, or by the row of tabs alone
    const q5 = await ctx.newPage(); await q5.setContent('<body><div><h2>Loja de Diamantes</h2><div><button>A</button><button id="tabd">Diamantes</button></div></div>'); await q5.evaluate(DG.scriptFor(EN)); await q5.waitForTimeout(300);
    const q6 = await ctx.newPage(); await q6.setContent('<body><div><h2>Loja</h2><div><button>Boosts</button><button>Outfits</button><button id="tabd">Diamantes</button></div></div>'); await q6.evaluate(DG.scriptFor(EN)); await q6.waitForTimeout(300);
    ok('the tab is found by the title of the shop alone ("Loja de Diamantes"), and by its row of tabs alone (Boosts, Outfits ...)', (await shown(q5, 'tabd')) === false && (await shown(q6, 'tabd')) === false);
    await q5.close(); await q6.close();
    // English
    const q7 = await ctx.newPage(); await q7.setContent('<body><div><h2>Diamond shop</h2><div><button>Boosts</button><button>Outfits</button><button id="tabd">Diamonds</button></div><button id="pay">Donate $5 with card</button></div>'); await q7.evaluate(DG.scriptFor(EN)); await q7.waitForTimeout(300);
    ok('English names are found too: the tab "Diamonds" and "Donate $5 with card"', (await shown(q7, 'tabd')) === false && (await shown(q7, 'pay')) === false);
    await q7.close();
  }
  // the whole way: the main process puts the script into a live page the way the app does, and a new language of the app changes the note of that page
  {
    const Module = require('module'); const created = [];
    const stub = { app: { on: (ev, f) => { if (ev === 'web-contents-created') created.push(f); }, whenReady: () => new Promise(() => {}), getAppPath: () => __dirname, getLocale: () => 'en-US', getPath: () => __dirname }, webContents: { getAllWebContents: () => [] }, BrowserWindow: { fromWebContents: () => null }, ipcMain: { handle: () => {} } };
    const orig = Module._load; Module._load = function (req) { return req === 'electron' ? stub : orig.apply(this, arguments); };
    Object.keys(require.cache).filter(k => /donate-guard\.js|i18n\.js/.test(k)).forEach(k => delete require.cache[k]);
    const DG2 = require('./donate-guard'), i18n2 = require('./i18n'); Module._load = orig;
    const q = await ctx.newPage(); await q.setContent(PAGE()); const ls = {};
    const wc = { getType: () => 'webview', on(ev, f) { (ls[ev] = ls[ev] || []).push(f); }, isDestroyed: () => false, isLoading: () => true, getURL: () => 'https://pokehorizonidle.com/', executeJavaScript: code => q.evaluate(code) };
    i18n2.setLang('en'); DG2.init(); created[0]({}, wc); await Promise.all((ls['dom-ready'] || []).map(f => f())); await q.waitForTimeout(300);
    let lk = await look(q); await q.evaluate(() => { window.__donated = 0; }); const pr = await press(q);
    ok('the whole way, as the app does it: the string the main process sends makes the page safe (hidden, "Visit the official webpage to donate", nothing reaches the game)', lk.hidden && lk.text === 'Visit the official webpage to donate' && pr === 0, [lk, pr]);
    i18n2.setLang('pt-BR'); await q.waitForTimeout(300); lk = await look(q);
    ok('...and when the language of the app changes, the note in the page changes with it, with no reload: "Visite a página oficial para doar"', lk.text === 'Visite a página oficial para doar' && lk.link.text === 'página' && lk.notes === 1, lk);
    await q.close();
  }
  await br.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
