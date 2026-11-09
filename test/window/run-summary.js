// run-summary.js: the Summary (left side of the app): cleaner, no wrong shiny balls, no captures list, expensive drops highlighted, every account fits
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const DROPS = [
  { name: 'Ghost essence', qty: 51, value: 20400 }, { name: 'Venom stone', qty: 3, value: 30000 }, { name: 'Rare candy', qty: 1, value: 25000 }, { name: 'Shiny stone', qty: 2, value: 300000 },
  { name: 'Almost stone', qty: 3, value: 29997 }, { name: 'Unknown thing', qty: 4, value: null },
].concat(Array.from({ length: 16 }, (_, i) => ({ name: 'Cheap item ' + (i + 1), qty: 400 - i, value: 400 - i })));
const sel = (fr, i) => fr.evaluate(i => { selected = i; renderAll(); }, i);
const side = fr => fr.evaluate(() => { const b = document.getElementById('sideBody'), r = b.getBoundingClientRect(), cards = Array.from(document.querySelectorAll('.acard')).map(c => c.getBoundingClientRect());
  return { h: Math.round(r.height), sh: b.scrollHeight, ch: b.clientHeight, over: b.scrollHeight - b.clientHeight, cards: cards.length, lastBottom: cards.length ? Math.round(cards[cards.length - 1].bottom - r.top) : null, cls: document.body.className }; });
(async () => {
  const b = await chromium.launch();
  let p = await open(b, { w: 1500, h: 1000 }); await feedAll(p); await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500);
  let fr = p.dash(); await sel(fr, 'sum'); await p.waitForTimeout(150);
  const stats = await fr.evaluate(() => Array.from(document.querySelectorAll('#sideBody .grid4 .stat .l')).map(e => e.textContent.trim()));
  ok('Session has 4 numbers: Defeated, Captures, Shiny capt., Balls at shinies', JSON.stringify(stats) === '["Defeated","Captures","Shiny capt.","Balls at shinies"]', stats);
  const dash0 = await fr.evaluate(() => document.querySelector('#sideBody .grid4 .stat:nth-child(4) .v').textContent.trim());
  ok('until the reader sends its count the number is a dash (not a 0 that could be wrong, and not the stock of balls)', dash0 === '\u2014', dash0);
  // the stock of the ball set for shiny auto-catch (what was shown here before) is never shown
  await p.s(2, { shinyBalls: 1929 }); await p.s(4, { shinyBalls: 7777 }); await p.waitForTimeout(300); await sel(fr, 'sum'); await p.waitForTimeout(150);
  const txt0 = await fr.evaluate(() => document.getElementById('sideBody').innerText);
  ok('the stock of Luxury Balls (1,929 and 7,777 here) is NOT shown anywhere in the Summary', !/1,?929|1\.9K|7,?777|7\.8K/.test(txt0), txt0.slice(0, 400));
  // the reader's counts
  await p.s(2, { shinyThrown: 3, shinyCaught: 1, throws: 120, throwsMatched: 119, dexShinyBalls: 21, dexShinySpecies: 1, dexOpened: 3, shinyThrownBy: { 'luxury-ball': 3 } });
  await p.s(3, { shinyThrown: 0, shinyCaught: 0, throws: 50, throwsMatched: 50, dexShinyBalls: 0, dexShinySpecies: 0, dexOpened: 0, shinyThrownBy: {} });
  await p.s(4, { shinyThrown: 2, shinyCaught: 2, throws: 80, throwsMatched: 80, dexShinyBalls: 9, dexShinySpecies: 2, dexOpened: 2, shinyThrownBy: { 'ultra-ball': 2 } });
  await p.waitForTimeout(400); await sel(fr, 'sum'); await p.waitForTimeout(150);
  const tile = await fr.evaluate(() => { const t = document.querySelector('#sideBody .grid4 .stat:nth-child(4)'); return { v: t.querySelector('.v').textContent.trim(), tip: t.getAttribute('title'), cls: t.querySelector('.v').className }; });
  ok('with the counts: the tile adds up the balls thrown at shinies of the accounts (3 + 0 + 2 = 5), in gold, with a tooltip that says what it is', tile.v === '5' && /gold/.test(tile.cls) && /since this window opened, counted from each throw/.test(tile.tip), tile);
  const lines = await fr.evaluate(() => Array.from(document.querySelectorAll('.acard')).map(c => c.querySelector('.ln.dim').innerText.replace(/\s+/g, ' ')));
  ok('the cards show "N thrown" after the shiny captures only when there is some (account 2: 3 thrown, account 4: 2 thrown, accounts 1 and 3: nothing extra)', /✦ \d+ cap · 3 thrown/.test(lines[1]) && /✦ \d+ cap · 2 thrown/.test(lines[3]) && !/thrown/.test(lines[0]) && !/thrown/.test(lines[2]), lines);
  const txt = await fr.evaluate(() => document.getElementById('sideBody').innerText);
  ok('...and the Summary still has no number of the stock of balls under that name', !/shiny balls/i.test(txt), txt.slice(0, 200));
  const dsty = await fr.evaluate(() => { const k = document.querySelector('.duo .kv'), cs = getComputedStyle(k), col = getComputedStyle(document.querySelector('.duo .col')); return { n: document.querySelectorAll('.duo .kv').length, bg: cs.backgroundColor, bw: cs.borderTopWidth, colBg: col.backgroundColor, colBw: col.borderTopWidth, boxes: document.querySelectorAll('#sideBody .big2, #sideBody .big2 .stat').length, labels: Array.from(document.querySelectorAll('.duo .kv .l')).map(e => e.textContent.trim()), heads: Array.from(document.querySelectorAll('.duo .sec-h')).map(e => e.textContent.trim()) }; });
  ok('Balls, Potions, $ total and ◆ total have no boxes (no background, no border, no tile), they are in two columns with the titles Supplies and Assets', dsty.n === 4 && dsty.bg === 'rgba(0, 0, 0, 0)' && dsty.bw === '0px' && dsty.colBg === 'rgba(0, 0, 0, 0)' && dsty.boxes === 0 && JSON.stringify(dsty.labels) === '["Balls","Potions","$ total","total"]' && JSON.stringify(dsty.heads) === '["Supplies","Assets"]', dsty);
  const fades = await fr.evaluate(() => { const g = (sel, prop, pseudo) => { const e = document.querySelector(sel); return e ? getComputedStyle(e, pseudo || null)[prop] : null; };
    return { tabs: g('#tabs', 'borderImageSource'), strip: g('.strip', 'borderImageSource'), head: g('.sec-h', 'borderImageSource'), card: g('.acard + .acard', 'borderImageSource'), cardW: g('.acard + .acard', 'borderTopWidth'), vsep: g('.duo .col:last-child', 'backgroundImage', '::before'), secBorder: g('.sec', 'borderBottomWidth') }; });
  ok('the information is separated by thin fading lines (under the tabs and the three numbers, between the accounts, between Supplies and Assets), made like the line under the titles, and not by hard lines', /linear-gradient/.test(fades.tabs) && /linear-gradient/.test(fades.strip) && /linear-gradient/.test(fades.card) && fades.cardW === '1px' && /linear-gradient/.test(fades.vsep) && fades.secBorder === '0px', fades);
  const cards = await fr.evaluate(() => Array.from(document.querySelectorAll('.acard')).map(c => { const cs = getComputedStyle(c); return { lines: c.querySelectorAll('.ln').length, bg: cs.backgroundImage + '|' + cs.backgroundColor, bw: cs.borderLeftWidth, txt: c.innerText.replace(/\s+/g, ' ') }; }));
  ok('the four account cards are not boxes any more (no tile, no frame) and have 5 lines: name with money, what it earns, its balls, its shiny captures and potions, the time its auto-catch ball lasts (lang-70)', cards.length === 4 && cards.every(c => c.lines === 4 && /^none\|rgba\(0, 0, 0, 0\)$/.test(c.bg) && c.bw === '0px' && !/shiny|at shinies/i.test(c.txt)), cards);
  ok('...the balls have a line of their own, then the shiny captures and potions, and the last line is the time left of the auto-catch ball', cards.every(c => /\d+ cap.*\d+ balls.*✦ \d+ cap.*\d+ potions.*⏱ /.test(c.txt)), cards[1] && cards[1].txt);
  await p.context().close();

  // every account fits, at the heights of real screens
  for (const [h, name] of [[1080, 'a 1080 screen'], [950, 'a 950 window'], [850, 'an 850 window'], [740, 'a 740 window'], [660, 'a 660 window']]) {
    p = await open(b, { w: 1500, h }); await feedAll(p); await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500);
    fr = p.dash(); await sel(fr, 'sum'); await p.waitForTimeout(200);
    const S = await side(fr);
    ok('all four accounts show without scrolling in ' + name + ' (the Summary is ' + S.h + ' px tall' + (S.cls ? ', "' + S.cls.replace(/\s+/g, ' ') + '"' : '') + ')', S.cards === 4 && S.over <= 1 && S.lastBottom <= S.h + 1, S);
    await p.context().close();
  }
  // it is tighter only when it has to be
  p = await open(b, { w: 1500, h: 1080 }); await feedAll(p); await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500); fr = p.dash(); await sel(fr, 'sum'); await p.waitForTimeout(150);
  await p.s(2, { shinyThrown: 3, shinyCaught: 1, throws: 120, throwsMatched: 119, dexShinyBalls: 21, dexShinySpecies: 1, dexOpened: 3, shinyThrownBy: { 'luxury-ball': 3 } });
  await p.s(3, { shinyThrown: 0, shinyCaught: 0, throws: 50, throwsMatched: 50, dexShinyBalls: 0, dexShinySpecies: 0, dexOpened: 0, shinyThrownBy: {} });
  await p.waitForTimeout(400); await sel(fr, 'sum'); await p.waitForTimeout(150);
  ok('in a tall window it is not made tighter (no "tight" class)', !/tight/.test((await side(fr)).cls), await side(fr));
  // one account
  await sel(fr, 1); await p.waitForTimeout(200);
  const one = await fr.evaluate(() => { const t = document.getElementById('sideBody').innerText, rows = Array.from(document.querySelectorAll('#sideBody .row')).map(r => [r.querySelector('.k') && r.querySelector('.k').textContent.replace(/\s+/g, ' ').trim(), r.querySelector('.v') && r.querySelector('.v').textContent.trim(), r.getAttribute('title')]); return { latest: /latest captures/i.test(t), last: /last catch/i.test(t), best: /best catch/i.test(t), heads: Array.from(document.querySelectorAll('#sideBody .sec-h')).map(e => e.textContent.trim()), rows: rows }; });
  ok('one account: no "Latest captures" list and no "Last catch" row; "Best catch" and "Session drops" are there', !one.latest && !one.last && one.best && one.heads.indexOf('Session drops') >= 0, one);
  const r1 = one.rows.find(r => /Balls at shinies/.test(r[0] || '')), r2 = one.rows.find(r => /In the Pokédex/.test(r[0] || ''));
  ok('one account (trainer2): "Balls at shinies" 3, and "In the Pokédex" 21 with "(3 species opened)"; each with its tooltip', r1 && r1[1] === '3' && /counted from each throw/.test(r1[2]) && r2 && r2[1] === '21' && /\(3 species opened\)/.test(r2[0]) && /Capturas tab/.test(r2[2]), one.rows);
  await sel(fr, 2); await p.waitForTimeout(150);
  const none = await fr.evaluate(() => Array.from(document.querySelectorAll('#sideBody .row .k')).map(k => k.textContent.replace(/\s+/g, ' ').trim()));
  ok('an account whose Pokédex was not opened: the "In the Pokédex" row is not there (no zero that means nothing), "Balls at shinies" is (0)', none.some(k => /Balls at shinies/.test(k)) && !none.some(k => /In the Pokédex/.test(k)), none);
  await sel(fr, 1); await p.waitForTimeout(150);
  // the drops
  await p.s(2, { drops: DROPS }); await p.waitForTimeout(400); await sel(fr, 1); await p.waitForTimeout(150);
  const rows = await fr.evaluate(() => Array.from(document.querySelectorAll('.drops .row')).map(r => ({ name: r.querySelector('.nm').textContent.replace(/\s+/g, ' ').trim(), cls: r.className, title: r.getAttribute('title'), bg: getComputedStyle(r).backgroundImage.slice(0, 15), edge: getComputedStyle(r).boxShadow.slice(0, 40), nmColor: getComputedStyle(r.querySelector('.nm')).color })));
  ok('the most expensive come first: Shiny stone (150,000 each), then Rare candy (25,000 each) and Venom stone (10,000 each), by the price of ONE, then the rest', rows.slice(0, 3).map(r => r.name.split(' ×')[0].replace(/^✦ /, '')).join() === 'Shiny stone,Rare candy,Venom stone', rows.slice(0, 5).map(r => r.name));
  ok('150,000 each gets the strong highlight ("hot top", with a star); 10,000 and 25,000 each get the highlight ("hot"); 9,999 and the cheap ones get none', /hot top/.test(rows[0].cls) && /^✦ /.test(rows[0].name) && /\bhot\b/.test(rows[1].cls) && !/top/.test(rows[1].cls) && /\bhot\b/.test(rows[2].cls) && rows.slice(3).every(r => !/hot/.test(r.cls)), rows.map(r => [r.name, r.cls]));
  ok('the highlight is visible: a gold tint, a gold edge and a gold name (the others are plain)', rows.slice(0, 3).every(r => /linear-gradient/.test(r.bg) && /227, 192, 107/.test(r.edge) && /227, 192, 107/.test(r.nmColor)) && rows.slice(3).every(r => r.bg === 'none'), rows.slice(0, 4));
  ok('the price of one item shows when the pointer is on a row ("$150K each")', rows[0].title === '$150K each' && rows[1].title === '$25K each' && rows[2].title === '$10K each' && rows[3].title === '$9,999 each', [rows[0].title, rows[1].title, rows[2].title, rows[3].title]);
  await p.s(2, { drops: [{ name: 'Unknown thing', qty: 4, value: null }, { name: 'Ghost essence', qty: 51, value: 20400 }] }); await p.waitForTimeout(300); await sel(fr, 1); await p.waitForTimeout(100);
  const unk = await fr.evaluate(() => Array.from(document.querySelectorAll('.drops .row')).map(r => [r.querySelector('.nm').textContent.replace(/\s+/g, ' ').trim(), r.className, r.getAttribute('title')]));
  ok('an item with an unknown price (null) is shown without highlight and without a price tip, and breaks nothing', unk.length === 2 && unk.every(r => !/hot/.test(r[1])) && unk.find(r => /Unknown/.test(r[0]))[2] === null, unk);
  await p.s(2, { drops: DROPS }); await p.waitForTimeout(300); await sel(fr, 1); await p.waitForTimeout(100);
  ok('the list is not cut in the middle of the expensive ones: 12 rows (there were 22 items), the three expensive ones in them even though they are few in number', rows.length === 12 && rows.slice(0, 3).every(r => /hot/.test(r.cls)), rows.length);
  const hdr = await fr.evaluate(() => document.querySelector('.drops .sec-h').getAttribute('title'));
  ok('the title of Session drops explains the highlight ("Items worth $10K or more each are highlighted")', hdr === 'Items worth $10K or more each are highlighted', hdr);
  await p.s(2, { drops: Array.from({ length: 15 }, (_, i) => ({ name: 'Gem ' + i, qty: 1, value: 20000 + i })) }); await p.waitForTimeout(300); await sel(fr, 1); await p.waitForTimeout(100);
  ok('when more than 12 items are expensive all of them show (none is hidden by the limit)', (await fr.evaluate(() => document.querySelectorAll('.drops .row.hot').length)) === 15);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // Portuguese
  p = await open(b, { w: 1500, h: 1000, lang: 'pt-BR' }); await feedAll(p); await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500); fr = p.dash();
  await p.s(2, { drops: DROPS }); await p.waitForTimeout(400); await sel(fr, 1); await p.waitForTimeout(150);
  const pt = await fr.evaluate(() => ({ row: document.querySelector('.drops .row').getAttribute('title'), head: document.querySelector('.drops .sec-h').getAttribute('title') }));
  ok('in Portuguese: the tooltips read "$150K cada" and "Itens que valem $10K ou mais cada um ficam destacados"', pt.row === '$150K cada' && pt.head === 'Itens que valem $10K ou mais cada um ficam destacados', pt);
  await sel(fr, 'sum'); await p.waitForTimeout(150);
  const ptTxt = await fr.evaluate(() => document.getElementById('sideBody').innerText);
  ok('...and the all-accounts Summary has Suprimentos, Bolas, Poções, Total $ in Portuguese', /Suprimentos/i.test(ptTxt) && /Bolas/i.test(ptTxt) && /Poções/i.test(ptTxt) && !/\bSupplies\b|\bAssets\b/.test(ptTxt), ptTxt.slice(0, 400));
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
