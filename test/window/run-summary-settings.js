// run-summary-settings.js: the gear of the Summary (kinds of balls and potions, type of best catch, price of the highlight), and the Best catch row
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const TYPES = {
  2: { ballTypes: { 'ultra-ball': 1000, 'luxury-ball': 50, 'earth-ball': 1565, 'shadow-ball': 12 }, potionTypes: { 'great-potion': 20 }, balls: 1050, potions: 20 },
  3: { ballTypes: { 'ultra-ball': 22312, 'idle-ball': 5310, 'poke-ball': 500, 'great-ball': 300 }, potionTypes: { 'ultra-potion': 5058, 'great-potion': 638, 'small-potion': 400 }, balls: 22612, potions: 6096 },
  4: { balls: 777, potions: 33 },
  1: { ballTypes: {}, potionTypes: {}, balls: 0, potions: 0 }
};
const PICKS = { bestIV: { name: 'Alpha', iv: 181, max: 192, rarity: 'Rara \u00d71.20', quality: 1.2, shiny: false }, bestQ: { name: 'Beta', iv: 120, max: 192, rarity: '\u00c9pica \u00d71.90', quality: 1.9, shiny: false }, bestS: { name: 'Gamma', iv: 150, max: 192, rarity: 'Lend\u00e1ria \u00d71.60', quality: 1.6, shiny: false } };
const setup = async (b, o) => {
  const p = await open(b, Object.assign({ w: 1700, h: 1000 }, o || {})); await feedAll(p);
  for (const n of [1, 2, 3, 4]) await p.s(n, TYPES[n]);
  await p.s(3, Object.assign({ drops: [{ name: 'Gem', qty: 1, value: 5000 }, { name: 'Stone', qty: 1, value: 20000 }, { name: 'Crown', qty: 1, value: 60000 }] }, PICKS));
  await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500);
  const fr = p.dash(); await fr.evaluate(() => { selected = 'sum'; renderAll(); }); await p.waitForTimeout(250);
  return { p, fr };
};
const open_ = async (p, fr) => { await fr.evaluate(() => document.getElementById('btnSumSettings').click()); await p.waitForTimeout(150); };
const rows = fr => fr.evaluate(() => Array.from(document.querySelectorAll('#sumSettings .ss-row')).map(r => ({ name: r.querySelector('.nm').textContent.trim(), n: r.querySelector('.n').textContent.trim(), on: r.querySelector('input').checked, off: r.classList.contains('off'), kind: r.querySelector('input').dataset.kind })));
const tiles = fr => fr.evaluate(() => ({ balls: document.querySelectorAll('.duo .kv .v')[0].textContent.trim(), potions: document.querySelectorAll('.duo .kv .v')[1].textContent.trim(), cards: Array.from(document.querySelectorAll('.acard')).map(c => ({ bk: Array.from(c.querySelectorAll('.ln.balls .bk')).map(b => b.textContent.replace(/\s+/g, ' ').trim()), fb: c.querySelector('.ln.balls').textContent.replace(/\s+/g, ' ').trim(), potions: ((c.querySelector('.ln.dim').innerText.match(/([\d.,]+[KM]?) potions/) || [])[1]) })) }));
(async () => {
  const b = await chromium.launch();
  let { p, fr } = await setup(b);
  // ---- the gear
  const G = await fr.evaluate(() => { const g = document.getElementById('btnSumSettings'), h = document.querySelector('.side-head').getBoundingClientRect(), r = g.getBoundingClientRect(); return { refresh: document.querySelectorAll('#btnRefresh').length, title: g.title, aria: g.getAttribute('aria-label'), svg: !!g.querySelector('svg'), text: g.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(h.right - r.right), open: !document.getElementById('sumSettings').classList.contains('hidden') }; });
  ok('the redraw button is gone and the gear is in its place (right end of the header, same size 30 x 28, an icon, no text), closed at first', G.refresh === 0 && G.title === 'Summary settings' && G.aria === 'Summary settings' && G.svg && G.text === '' && G.w === 30 && G.h === 28 && G.right <= 20 && !G.open, G);
  await open_(p, fr);
  ok('a press opens the panel (the gear is lit), a second press closes it', (await fr.evaluate(() => !document.getElementById('sumSettings').classList.contains('hidden') && document.getElementById('btnSumSettings').classList.contains('on'))) && (await (async () => { await open_(p, fr); return fr.evaluate(() => document.getElementById('sumSettings').classList.contains('hidden') && !document.getElementById('btnSumSettings').classList.contains('on')); })()));
  await open_(p, fr); await fr.evaluate(() => document.getElementById('sideBody').click()); await p.waitForTimeout(100);
  ok('a click outside the panel closes it', await fr.evaluate(() => document.getElementById('sumSettings').classList.contains('hidden')));
  await open_(p, fr); await fr.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); await p.waitForTimeout(100);
  ok('Escape closes it and the focus goes back to the gear', await fr.evaluate(() => document.getElementById('sumSettings').classList.contains('hidden') && document.activeElement === document.getElementById('btnSumSettings')));
  // ---- what is in it (all accounts)
  await open_(p, fr);
  const C = await fr.evaluate(() => ({ scope: document.querySelector('#sumSettings .ss-scope').textContent.trim(), heads: Array.from(document.querySelectorAll('#sumSettings .ss-h')).map(e => e.textContent.trim()), note: document.querySelector('#sumSettings .ss-note').textContent.trim() }));
  ok('the panel says what it counts ("Counts of all accounts") and has the parts: Poké Balls, Heal, Best catch, Drops, and a note', C.scope === 'Counts of all accounts' && JSON.stringify(C.heads) === '["Poké Balls","Heal","Best catch","Drops"]' && /Only the Summary uses these choices/.test(C.note), C);
  const R = await rows(fr), balls = R.slice(0, 6), potions = R.slice(6);
  ok('the balls of the game with their amounts, the biggest first, like the screenshot: Ultra 23,312 (22,312 + 1,000), Idle 5,310, Poké 500, Great 300, Luxury 50, and Master Ball with 0 (an option even when there is none)', JSON.stringify(balls.map(r => r.name + ' ' + r.n)) === '["Ultra Ball 23,312","Idle Ball 5,310","Poké Ball 500","Great Ball 300","Luxury Ball 50","Master Ball 0"]', balls);
  ok('Earth Ball (Bola de Terra, a drop worth $1) and Shadow Ball are not balls: not in the list, although the account sent them, and not in the totals', !R.some(r => /Earth Ball|Shadow Ball/.test(r.name)) && R.every(r => !/earth|shadow/.test(r.kind)), R.map(r => r.kind));
  ok('...and the potions of the game: Ultra 5,058, Great 658 (638 + 20), Small 400, and Potion, Gift Potion and Super Potion with 0 (all the options are there, also the ones nobody has)', JSON.stringify(potions.map(r => r.name + ' ' + r.n)) === '["Ultra Potion 5,058","Great Potion 658","Small Potion 400","Potion 0","Gift Potion 0","Super Potion 0"]', potions);
  ok('every kind is checked at first (nothing changes in the totals until you choose)', R.every(r => r.on && !r.off), R);
  const T0 = await tiles(fr);
  ok('the totals with everything checked: balls 22,312 + 1,000 + 5,310 + 500 + 300 + 50 = 29,472 and (account 4, which sends no kinds) 777 = 30,249; potions 6,096 + 20 + 33 = 6,149', T0.balls === '30.2K' && T0.potions === '6,149', T0);
  // ---- unchecking, as in the screenshot (Poké Ball and Ultra Potion out)
  await fr.evaluate(() => { document.querySelector('#sumSettings input[data-kind="poke-ball"]').click(); }); await p.waitForTimeout(150);
  await fr.evaluate(() => { document.querySelector('#sumSettings input[data-kind="ultra-potion"]').click(); }); await p.waitForTimeout(200);
  const T1 = await tiles(fr);
  ok('Poké Ball and Ultra Potion unchecked: balls drop by 500 (29,749, shown 29.7K) and potions by 5,058 (1,091)', T1.balls === '29.7K' && T1.potions === '1,091', T1);
  ok('...the card of account 3 follows (potions 638 + 400 = 1,038) and the account without kinds keeps its old numbers (777 balls, 33 potions)', T1.cards[2].potions === '1,038' && T1.cards[3].fb === '777 balls' && T1.cards[3].potions === '33', T1.cards);
  // ---- the balls of each account, one number for each kind that is checked (Poké Ball is unchecked now)
  ok('the cards show the balls one by one, only the kinds that are checked and that the account has, always in the same order (Ultra, Great, Poké, Luxury, Idle, Master): trainer2 "1,000 Ultra", "50 Luxury"; trainer3 "22.3K Ultra", "300 Great", "5,310 Idle" (no Poké: unchecked)', JSON.stringify(T1.cards[1].bk) === '["1,000 Ultra","50 Luxury"]' && JSON.stringify(T1.cards[2].bk) === '["22.3K Ultra","300 Great","5,310 Idle"]', T1.cards.map(c => c.bk));
  ok('...an account with no balls says "0 balls", and one whose reader does not send the kinds keeps its total ("777 balls")', T1.cards[0].fb === '0 balls' && T1.cards[0].bk.length === 0 && T1.cards[3].fb === '777 balls' && T1.cards[3].bk.length === 0, T1.cards.map(c => c.fb));
  const tipOf = await fr.evaluate(() => document.querySelectorAll('.acard')[1].querySelector('.ln.balls .bk').getAttribute('title'));
  ok('...each number has the full name and the exact amount as a tooltip (Ultra Ball: 1,000)', tipOf === 'Ultra Ball: 1,000', tipOf);
  await fr.evaluate(() => { document.querySelector('#sumSettings input[data-kind="ultra-ball"]').click(); }); await p.waitForTimeout(250);
  const T1b = await tiles(fr);
  ok('Ultra Ball unchecked: it is gone from every card (trainer2 is left with "50 Luxury", trainer3 with "300 Great" and "5,310 Idle")', JSON.stringify(T1b.cards[1].bk) === '["50 Luxury"]' && JSON.stringify(T1b.cards[2].bk) === '["300 Great","5,310 Idle"]', T1b.cards.map(c => c.bk));
  await fr.evaluate(() => { ['great-ball', 'luxury-ball', 'idle-ball'].forEach(k => document.querySelector('#sumSettings input[data-kind="' + k + '"]').click()); }); await p.waitForTimeout(250);
  const T1c = await tiles(fr);
  ok('all the kinds unchecked: the cards with kinds say "0 balls" (nothing is counted), not an empty line', T1c.cards[1].fb === '0 balls' && T1c.cards[2].fb === '0 balls', T1c.cards.map(c => c.fb));
  await fr.evaluate(() => { ['ultra-ball', 'great-ball', 'luxury-ball', 'idle-ball'].forEach(k => document.querySelector('#sumSettings input[data-kind="' + k + '"]').click()); }); await p.waitForTimeout(250);
  ok('and checking them again brings every number back (trainer3: "22.3K Ultra", "300 Great", "5,310 Idle")', JSON.stringify((await tiles(fr)).cards[2].bk) === '["22.3K Ultra","300 Great","5,310 Idle"]', (await tiles(fr)).cards[2].bk);
  const R1 = await rows(fr);
  ok('the unchecked rows look unchecked (dimmed, box empty) and the others are still checked', R1.filter(r => !r.on).map(r => r.kind).sort().join() === 'poke-ball,ultra-potion' && R1.filter(r => r.off).length === 2, R1);
  // ---- a kind that only another account has stays on the list, with 0, so that it can be checked again
  await fr.evaluate(() => { document.getElementById('sumSettings').dispatchEvent(new Event('x')); selected = 2; renderAll(); }); await p.waitForTimeout(250);
  const R2 = await rows(fr), sc = await fr.evaluate(() => document.querySelector('#sumSettings .ss-scope').textContent.trim());
  ok('one account (trainer3): "Counts of trainer3", its own amounts (Ultra 22,312, Idle 5,310, Great 300, Poké 500), and the kind it does not have (Luxury Ball) is still listed, with 0', sc === 'Counts of trainer3' && R2[0].name === 'Ultra Ball' && R2[0].n === '22,312' && R2.find(r => r.name === 'Luxury Ball').n === '0' && R2.find(r => r.name === 'Poké Ball').n === '500' && !R2.find(r => r.name === 'Poké Ball').on, [sc, R2]);
  // ---- it is kept
  await fr.evaluate(() => { location.reload(); }); await p.waitForTimeout(800);
  for (const n of [1, 2, 3, 4]) await p.s(n, TYPES[n]);
  await p.waitForTimeout(500); await fr.evaluate(() => { selected = 'sum'; renderAll(); }); await p.waitForTimeout(250);
  const T2 = await tiles(fr);
  ok('after the dashboard is loaded again the choices are still there (balls 29.7K, potions 1,091)', T2.balls === '29.7K' && T2.potions === '1,091', T2);
  await open_(p, fr);
  ok('...and the boxes are as they were left', (await rows(fr)).filter(r => !r.on).map(r => r.kind).sort().join() === 'poke-ball,ultra-potion');
  await fr.evaluate(() => { document.querySelector('#sumSettings input[data-kind="poke-ball"]').click(); document.querySelector('#sumSettings input[data-kind="ultra-potion"]').click(); }); await p.waitForTimeout(250);
  ok('checking them again gives the first totals back (30.2K and 6,149)', JSON.stringify([(await tiles(fr)).balls, (await tiles(fr)).potions]) === '["30.2K","6,149"]', await tiles(fr));
  // ---- kinds that are not in the list of the game: a ball the account is set to use, a potion with another name; loot that ends with "-ball" that nobody set is not a ball
  await p.s(1, { autoBall: 'premier-ball', ballTypes: { 'premier-ball': 9, 'dusk-ball': 4 }, balls: 13 }); await p.s(4, { potionTypes: { 'hyper-potion': 12 } }); await p.waitForTimeout(400);
  await fr.evaluate(() => { selected = 'sum'; renderAll(); }); await p.waitForTimeout(250);
  await open_(p, fr);
  const RD = await rows(fr);
  ok('a ball the account is set to use (premier-ball, its auto-catch ball) is listed and counted; a "-ball" nobody set (dusk-ball) is not', RD.some(r => r.name === 'Premier Ball' && r.n === '9') && !RD.some(r => /Dusk/.test(r.name)), RD.map(r => r.name + ' ' + r.n));
  ok('a potion with a name that is not in the list (hyper-potion) is added to the list as soon as an account has it', RD.some(r => r.name === 'Hyper Potion' && r.n === '12'), RD.map(r => r.name + ' ' + r.n));
  ok('...and the balls total takes the premier balls in (30,249 + 9 = 30,258: 30.3K)', (await tiles(fr)).balls === '30.3K', await tiles(fr));
  const TD = await tiles(fr);
  ok('the card of the account that is set to use premier-ball shows "9 Premier" (and no Dusk): the extra kinds are in the cards too', JSON.stringify(TD.cards[0].bk) === '["9 Premier"]', TD.cards[0]);
  await fr.evaluate(() => { document.getElementById('btnSumSettings').click(); }); await p.waitForTimeout(100);
  // ---- best catch: the row of the account and the type
  await fr.evaluate(() => { document.getElementById('btnSumSettings').click(); selected = 2; renderAll(); }); await p.waitForTimeout(250);
  const bestRow = () => fr.evaluate(() => { const row = Array.from(document.querySelectorAll('#sideBody .row')).find(r => /Best catch|Last catch/.test(r.querySelector('.k').textContent)); return row ? { key: row.querySelector('.k').textContent.replace(/\s+/g, ' ').trim(), text: row.querySelector('.v').innerText.replace(/\s+/g, ' ').trim(), ivs: Array.from(row.querySelectorAll('span')).filter(e => e.children.length === 0 && /^\d+\/192$/.test(e.textContent.trim())).map(e => [e.textContent.trim(), getComputedStyle(e).color]), lastRow: Array.from(document.querySelectorAll('#sideBody .k')).some(k => /Last catch/.test(k.textContent)) } : null; });
  let br = await bestRow();
  ok('the account has "Best catch (IV)" with the best catch by IV (Alpha, 181/192 in red) and no "Last catch" row any more', br && br.key === 'Best catch (IV)' && /^Alpha .*181\/192$/.test(br.text) && br.ivs[0][1] === 'rgb(149, 16, 27)' && !br.lastRow, br);
  await open_(p, fr);
  await fr.evaluate(() => { const s = document.getElementById('ssBest'); s.value = 'quality'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(250);
  br = await bestRow();
  const tbl = await fr.evaluate(() => ({ sel: document.getElementById('bestMode').value, cell: Array.from(document.querySelectorAll('#view-overview table tr')).map(r => r.innerText.replace(/\s+/g, ' ')).find(t => /trainer3/.test(t)) }));
  ok('type "Quality": the row is "Best catch (Quality)" with the best by quality (Beta, 120/192), the selector of the table follows (quality) and the table shows the same one', br.key === 'Best catch (Quality)' && /^Beta .*120\/192$/.test(br.text) && tbl.sel === 'quality' && /Beta/.test(tbl.cell), [br, tbl]);
  await fr.evaluate(() => { const s = document.getElementById('ssBest'); s.value = 'score'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(250);
  br = await bestRow();
  ok('type "IV × Quality": "Best catch (IV × Quality)" with Gamma (150/192, orange... purple, tier of 150)', br.key === 'Best catch (IV × Quality)' && /^Gamma .*150\/192$/.test(br.text), br);
  await fr.evaluate(() => { const s = document.getElementById('bestMode'); s.value = 'iv'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(250);
  br = await bestRow();
  ok('changing the selector of the TABLE changes the row of the Summary and the one of the panel (back to IV: Alpha)', br.key === 'Best catch (IV)' && /^Alpha/.test(br.text) && (await fr.evaluate(() => document.getElementById('ssBest').value)) === 'iv', br);
  await fr.evaluate(() => { const s = document.getElementById('ssBest'); s.value = 'quality'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(250);
  await fr.evaluate(() => { location.reload(); }); await p.waitForTimeout(900);
  for (const n of [1, 2, 3, 4]) await p.s(n, TYPES[n]); await p.s(3, PICKS); await p.waitForTimeout(500);
  await fr.evaluate(() => { selected = 2; renderAll(); }); await p.waitForTimeout(250);
  br = await bestRow();
  ok('the type is kept after the dashboard is loaded again (Quality: Beta), and the table\'s selector shows it too', br.key === 'Best catch (Quality)' && /^Beta/.test(br.text) && (await fr.evaluate(() => document.getElementById('bestMode').value)) === 'quality', br);
  await fr.evaluate(() => { const s = document.getElementById('bestMode'); s.value = 'iv'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(200);
  // ---- drops
  const drops = () => fr.evaluate(() => Array.from(document.querySelectorAll('.drops .row')).map(r => [r.querySelector('.nm').textContent.replace(/\s+/g, ' ').trim().replace(/^✦ /, ''), /\bhot\b/.test(r.className), /\btop\b/.test(r.className)]));
  let dr = await drops();
  ok('...(the three of them in order of price, only the first two highlighted)', dr.filter(r => r[1]).map(r => r[0].split(' ×')[0]).join() === 'Crown,Stone' && dr.find(r => /^Crown/.test(r[0]))[2] === false && dr.find(r => /^Gem/.test(r[0]))[1] === false, dr);
  await open_(p, fr);
  await fr.evaluate(() => { const i = document.getElementById('ssHot'); i.value = '4000'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(250);
  dr = await drops();
  ok('highlight from $4,000: Gem is highlighted too, and Crown ($60,000 = more than 10 times) gets the strong one', dr.find(r => /^Gem/.test(r[0]))[1] && dr.find(r => /^Crown/.test(r[0]))[2], dr);
  ok('...the tooltip of the title says the new price', /\$4,?000|\$4K/.test(await fr.evaluate(() => document.querySelector('.drops .sec-h').getAttribute('title'))), await fr.evaluate(() => document.querySelector('.drops .sec-h').getAttribute('title')));
  for (const bad of ['50', '', 'abc', '-5']) { await fr.evaluate(v => { const i = document.getElementById('ssHot'); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); }, bad); await p.waitForTimeout(100); }
  ok('a price that makes no sense (50, nothing, text, negative) is not accepted: the box goes back to $4,000', (await fr.evaluate(() => document.getElementById('ssHot').value)) === '4000', await fr.evaluate(() => document.getElementById('ssHot').value));
  // ---- typing is not interrupted by the live redraws
  await fr.evaluate(() => { const i = document.getElementById('ssHot'); i.focus(); i.value = '12345'; }); await p.s(3, { goldH: 123 }); await p.s(2, { goldH: 456 }); await p.waitForTimeout(1500);
  ok('while the cursor is in the price box a redraw of the Summary does not replace the panel (what is typed is still there, the box still has the focus)', await fr.evaluate(() => document.getElementById('ssHot').value === '12345' && document.activeElement === document.getElementById('ssHot')));
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // ---- every account still fits without scrolling when the cards have their balls one by one (four accounts, four to six kinds each)
  const MANY = { 1: { ballTypes: { 'ultra-ball': 12, 'great-ball': 5, 'poke-ball': 300, 'luxury-ball': 20, 'idle-ball': 7, 'master-ball': 1 }, potionTypes: { 'potion': 5 } }, 2: { ballTypes: { 'ultra-ball': 4636, 'poke-ball': 2100, 'great-ball': 1000, 'luxury-ball': 626 }, potionTypes: { 'super-potion': 1011 } }, 3: { ballTypes: { 'ultra-ball': 22312, 'idle-ball': 5310, 'luxury-ball': 120, 'great-ball': 300, 'poke-ball': 500, 'master-ball': 2 }, potionTypes: { 'potion': 40 } }, 4: { ballTypes: { 'ultra-ball': 960, 'luxury-ball': 14 }, potionTypes: { 'potion': 7 } } };
  for (const [h, name] of [[1080, 'a 1080 screen'], [950, 'a 950 window'], [850, 'an 850 window'], [740, 'a 740 window'], [660, 'a 660 window']]) {
    const q = await open(b, { w: 1500, h }); await feedAll(q); for (const n of [1, 2, 3, 4]) await q.s(n, MANY[n]);
    await q.evaluate(() => document.getElementById('btnPanel').click()); await q.waitForTimeout(500); const f2 = q.dash(); await f2.evaluate(() => { selected = 'sum'; renderAll(); }); await q.waitForTimeout(300);
    const F = await f2.evaluate(() => { const bd = document.getElementById('sideBody'), r = bd.getBoundingClientRect(), cs = Array.from(document.querySelectorAll('.acard')).map(c => c.getBoundingClientRect()); return { over: bd.scrollHeight - bd.clientHeight, cards: cs.length, last: cs.length ? Math.round(cs[cs.length - 1].bottom - r.top) : 0, h: Math.round(r.height), cls: document.body.className, bkLines: Array.from(document.querySelectorAll('.acard .ln.balls')).map(l => Math.round(l.getBoundingClientRect().height)) }; });
    ok('all four accounts show without scrolling in ' + name + ' with 2 to 6 kinds of balls each (the Summary is ' + F.h + ' px, "' + F.cls.replace('no-main', '').trim() + '")', F.cards === 4 && F.over <= 1 && F.last <= F.h + 1, F);
    if (h === 1080) ok('...and four kinds fit on one row of the card at normal size, six wrap to two (heights of the balls lines in px: ' + F.bkLines.join(', ') + ')', F.bkLines[1] <= 16 && F.bkLines[3] <= 16 && F.bkLines[2] > 16, F.bkLines);
    await q.context().close();
  }
  // ---- the reader that sends no kinds: the panel says how to get them
  p = await open(b, { w: 1700, h: 1000 }); await feedAll(p); await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500); fr = p.dash(); await fr.evaluate(() => { selected = 'sum'; renderAll(); }); await p.waitForTimeout(200);
  await open_(p, fr);
  const E = await fr.evaluate(() => ({ notes: Array.from(document.querySelectorAll('#sumSettings .ss-empty')).map(e => e.textContent.trim()), rows: document.querySelectorAll('#sumSettings .ss-row').length }));
  ok('without kinds from the reader: a note says what to run (install-diagnostics.js), and the options of the game are listed anyway (6 balls, 6 potions)', E.notes.length === 1 && /install-diagnostics\.js/.test(E.notes[0]) && E.rows === 12, E);
  await p.context().close();

  // ---- Portuguese
  ({ p, fr } = await setup(b, { lang: 'pt-BR' }));
  await open_(p, fr);
  const P = await fr.evaluate(() => ({ title: document.getElementById('btnSumSettings').title, scope: document.querySelector('#sumSettings .ss-scope').textContent.trim(), heads: Array.from(document.querySelectorAll('#sumSettings .ss-h')).map(e => e.textContent.trim()), opts: Array.from(document.querySelectorAll('#ssBest option')).map(o => o.textContent) }));
  ok('in Portuguese: "Configurações do Resumo", "Contagens de todas as contas", Poké Balls / Cura / Melhor captura / Drops, and the three types', P.title === 'Configurações do Resumo' && P.scope === 'Contagens de todas as contas' && JSON.stringify(P.heads) === '["Poké Balls","Cura","Melhor captura","Drops"]' && JSON.stringify(P.opts) === '["IV","Qualidade","IV × Qualidade"]', P);
  await fr.evaluate(() => { document.getElementById('btnSumSettings').click(); selected = 2; renderAll(); }); await p.waitForTimeout(250);
  const k = await fr.evaluate(() => { const row = Array.from(document.querySelectorAll('#sideBody .row')).find(r => /Melhor captura/.test(r.querySelector('.k').textContent)); return row && row.querySelector('.k').textContent.replace(/\s+/g, ' ').trim(); });
  ok('...and the row of the account: "Melhor captura (IV)"', k === 'Melhor captura (IV)', k);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
