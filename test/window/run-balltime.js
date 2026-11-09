// run-balltime.js: the 5th line of each account card in the Summary (lang-70): how long the auto-catch ball lasts at the CURRENT pace (the last 30 minutes of hunting)
// white above 3 h, yellow from 1 h to 3 h, red under 1 h, grey while it cannot be known
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const H = 3600000, M = 60000;
const sel = (fr, i) => fr.evaluate(i => { selected = i; renderAll(); }, i);
const card = (fr, i) => fr.evaluate(i => { const l = document.querySelectorAll('.acard')[i].querySelector('.ln.btime'); if (!l) return null; const cs = getComputedStyle(l);
  return { txt: l.innerText.replace(/\s+/g, ' ').trim(), cls: l.className, color: cs.color, tip: l.getAttribute('title'), shown: cs.display !== 'none' && l.getBoundingClientRect().height > 0 }; }, i);
const WHITE = 'rgb(255, 255, 255)', YELLOW = 'rgb(255, 216, 77)', RED = 'rgb(255, 92, 92)';
(async () => {
  const b = await chromium.launch();
  let p = await open(b, { w: 1500, h: 1000 }); await feedAll(p); await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500);
  let fr = p.dash(); await sel(fr, 'sum'); await p.waitForTimeout(150);
  const set = async (n, d) => { await p.s(n, d); await p.waitForTimeout(250); await sel(fr, 'sum'); await p.waitForTimeout(80); return card(fr, n - 1); };

  const c1 = await card(fr, 0);
  ok('every card has the line; an account that sent nothing yet: "⏱ Auto-catch ball: —" in grey', c1 && c1.txt === '\u23f1 Auto-catch ball: \u2014' && /\bna\b/.test(c1.cls), c1);
  const lines = await fr.evaluate(() => Array.from(document.querySelectorAll('.acard')).map(c => c.querySelectorAll('.ln').length));
  ok('the four cards have 4 lines under the name now (earnings, balls, shiny and potions, time left): 5 lines in all', JSON.stringify(lines) === '[4,4,4,4]', lines);

  // the first count of the game: the pace is not known yet
  let c = await set(2, { autoBall: 'ultra-ball', autoBalls: 13000, startedAt: 2, elapsedMs: 2 * H, active: true, ballsByType: { 'ultra-ball': 500, 'luxury-ball': 3 } });
  ok('the first count (2 h into the hunt, 500 Ultra so far): "measuring…" in grey, the pace is not taken from the whole hunt', c.txt === '\u23f1 Ultra Ball: measuring\u2026' && /\bna\b/.test(c.cls) && /after 5 minutes/.test(c.tip || ''), c);
  // 10 minutes later: 50 more = 300 per hour (and 3 more Luxury at shinies, not counted)
  c = await set(2, { elapsedMs: 2 * H + 10 * M, ballsByType: { 'ultra-ball': 550, 'luxury-ball': 6 } });
  ok('10 minutes later, 50 more Ultra (300 per hour): 13,000 last "43h 20m", white (the Luxury thrown at shinies are not counted)', c.txt === '\u23f1 Ultra Ball: 43h 20m left' && /\bok\b/.test(c.cls) && c.color === WHITE, c);
  ok('...the tooltip says the stock and the pace, and over what time ("300 thrown per hour (the last 10 minutes of the hunt)")', c.tip === '13,000 Ultra Ball left, 300 thrown per hour (the last 10 minutes of the hunt)', c.tip);
  for (const [stock, txt, color, what] of [[1000, '3h 20m', WHITE, 'above 3 h: white'], [900, '3h 0m', YELLOW, 'exactly 3 h: yellow (white is only ABOVE 3 h)'], [480, '1h 36m', YELLOW, 'yellow'], [300, '1h 0m', YELLOW, 'exactly 1 h: yellow (red is UNDER 1 h)'], [120, '24m', RED, 'red'], [1, '1m', RED, '12 s: "1m" (never "0m"), red'], [2000000, '99h+', WHITE, 'a huge stock: "99h+", white']]) {
    c = await set(2, { autoBalls: stock });
    ok(fmt(stock) + ' left at 300/h: "' + txt + ' left", ' + what, c.txt === '\u23f1 Ultra Ball: ' + txt + ' left' && c.color === color, c);
  }
  c = await set(2, { autoBalls: 0 });
  ok('none in stock: "⏱ Ultra Ball: none left", red, with a tooltip', c.txt === '\u23f1 Ultra Ball: none left' && c.color === RED && /nothing to throw/.test(c.tip || ''), c);
  c = await set(2, { autoBalls: 13000, active: false });
  ok('the hunt is paused: the last estimate stays, with "(paused)", in grey', c.txt === '\u23f1 Ultra Ball: 43h 20m left (paused)' && /\bna\b/.test(c.cls) && ![WHITE, YELLOW, RED].includes(c.color), c);
  c = await set(2, { active: true, autoCatchOn: false });
  ok('auto-catch is off: "⏱ Auto-catch off", grey', c.txt === '\u23f1 Auto-catch off' && /\bna\b/.test(c.cls), c);
  c = await set(2, { autoCatchOn: true });
  ok('...on again: the time is back', c.txt === '\u23f1 Ultra Ball: 43h 20m left', c);

  // THE CASE OF THE SCREENSHOT: a ball chosen late in a long hunt (9h 41m of Ultra Balls, then Eng Ball Magu)
  await set(3, { autoBall: 'ultra-ball', autoBalls: 9000, startedAt: 3, elapsedMs: 9 * H + 30 * M, active: true, ballsByType: { 'ultra-ball': 5000 } });
  c = await set(3, { autoBall: 'eng-ball-magu', autoBalls: 521, elapsedMs: 9 * H + 31 * M, ballsByType: { 'ultra-ball': 5000, 'eng-ball-magu': 400 } });
  ok('the auto-catch ball is changed late in a hunt (Eng Ball Magu after 9 h 31 min): "measuring…", not a time from the whole hunt', c.txt === '\u23f1 Eng Ball Magu: measuring\u2026', c);
  c = await set(3, { elapsedMs: 9 * H + 41 * M, ballsByType: { 'ultra-ball': 5000, 'eng-ball-magu': 450 } });
  ok('10 minutes later, 50 thrown (300 per hour): 521 Eng Ball Magu last "1h 44m", yellow (the old way, over the whole hunt, said about 11 h; your screenshot said 28 h)', c.txt === '\u23f1 Eng Ball Magu: 1h 44m left' && c.color === YELLOW, c);
  ok('...and account 2 is not touched by it', (await card(fr, 1)).txt === '\u23f1 Ultra Ball: 43h 20m left', await card(fr, 1));

  // the pace follows the hunt: only the last 30 minutes count
  await set(4, { autoBall: 'ultra-ball', autoBalls: 600, startedAt: 44, elapsedMs: 1 * M, active: true, ballsByType: { 'ultra-ball': 0 } });
  let u = 0;
  for (let m = 5; m <= 60; m += 5) { u += m <= 30 ? 10 : 50; c = await set(4, { elapsedMs: m * M + 1 * M, ballsByType: { 'ultra-ball': u } }); }
  ok('a hunt whose pace went up (10 every 5 min for half an hour, then 50 every 5 min): the time uses the last 30 minutes (600/h): 600 balls "1h 0m"', c.txt === '\u23f1 Ultra Ball: 1h 0m left' && /the last 30 minutes/.test(c.tip || ''), c);
  c = await set(4, { elapsedMs: 70 * M, ballsByType: { 'ultra-ball': u } });
  c = await set(4, { elapsedMs: 95 * M, ballsByType: { 'ultra-ball': u } });
  ok('no ball thrown for half an hour (nothing to catch): "none thrown lately", grey', c.txt === '\u23f1 Ultra Ball: none thrown lately' && /\bna\b/.test(c.cls), c);

  // another ball, a new hunt
  await set(2, { autoBall: 'great-ball', autoBalls: 300 });
  c = await set(2, { elapsedMs: 2 * H + 30 * M });
  ok('another ball chosen (Great), none of it thrown in this hunt: "Great Ball: not used in this hunt", grey', c.txt === '\u23f1 Great Ball: not used in this hunt' && /\bna\b/.test(c.cls), c);
  await set(2, { autoBall: 'ultra-ball', autoBalls: 13000 });
  c = await set(2, { startedAt: 99, elapsedMs: 3 * M, ballsByType: { 'ultra-ball': 40 } });
  ok('a new hunt: the measure starts again ("measuring…")', c.txt === '\u23f1 Ultra Ball: measuring\u2026', c);
  c = await set(2, { elapsedMs: 9 * M, ballsByType: { 'ultra-ball': 70 } });
  ok('...6 minutes later, 30 thrown = 300/h: 43h 20m', c.txt === '\u23f1 Ultra Ball: 43h 20m left', c);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // the counts are noted while the window is hidden too (nothing is drawn then)
  p = await open(b, { w: 1500, h: 1000 }); await feedAll(p); await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500); fr = p.dash();
  await p.s(2, { autoBall: 'ultra-ball', autoBalls: 13000, startedAt: 2, elapsedMs: 2 * H, active: true, ballsByType: { 'ultra-ball': 500 } }); await p.waitForTimeout(1300);
  await fr.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.s(2, { elapsedMs: 2 * H + 10 * M, ballsByType: { 'ultra-ball': 550 } }); await p.waitForTimeout(1300);
  await fr.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(150);
  c = await card(fr, 1);
  ok('the counts that came while the window was hidden are used when it shows again (43h 20m at once, not "measuring…")', c.txt === '\u23f1 Ultra Ball: 43h 20m left', c);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // a short window: the Summary gets tighter, the time left stays (only the shiny and potions line goes)
  p = await open(b, { w: 1500, h: 660 }); await feedAll(p); await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500); fr = p.dash();
  await p.s(2, { autoBall: 'ultra-ball', autoBalls: 120, startedAt: 2, elapsedMs: 2 * H, active: true, ballsByType: { 'ultra-ball': 500 } }); await p.waitForTimeout(300); await sel(fr, 'sum');
  await p.s(2, { elapsedMs: 2 * H + 10 * M, ballsByType: { 'ultra-ball': 550 } }); await p.waitForTimeout(300); await sel(fr, 'sum'); await p.waitForTimeout(150);
  const tight = await fr.evaluate(() => { const bd = document.getElementById('sideBody'); return { cls: document.body.className, over: bd.scrollHeight - bd.clientHeight }; });
  c = await card(fr, 1);
  ok('in a 660 px window every account still fits (' + tight.cls.replace(/\s+/g, ' ') + ') and the time left is still shown', tight.over <= 1 && c.shown && c.txt === '\u23f1 Ultra Ball: 24m left', [tight, c]);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // Portuguese
  p = await open(b, { w: 1500, h: 1000, lang: 'pt-BR' }); await feedAll(p); await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500); fr = p.dash();
  const pt = [];
  for (const d of [{ autoBall: 'ultra-ball', autoBalls: 13000, startedAt: 2, elapsedMs: 2 * H, active: true, ballsByType: { 'ultra-ball': 500 } }, { elapsedMs: 2 * H + 10 * M, ballsByType: { 'ultra-ball': 550 } }, { active: false }, { autoBalls: 0 }, { autoBalls: 9, startedAt: 7, elapsedMs: M, active: true }, { autoCatchOn: false }]) { await p.s(2, d); await p.waitForTimeout(250); await sel(fr, 'sum'); await p.waitForTimeout(80); pt.push((await card(fr, 1)).txt); }
  ok('in Portuguese: "medindo…", "restantes", "(pausada)", "nenhuma sobrando", "Captura automática desligada"', JSON.stringify(pt) === JSON.stringify(['\u23f1 Ultra Ball: medindo\u2026', '\u23f1 Ultra Ball: 43h 20m restantes', '\u23f1 Ultra Ball: 43h 20m restantes (pausada)', '\u23f1 Ultra Ball: nenhuma sobrando', '\u23f1 Ultra Ball: medindo\u2026', '\u23f1 Captura automática desligada']), pt);
  ok('...and account 1 (nothing yet): "Bola da captura automática: —"', (await card(fr, 0)).txt === '\u23f1 Bola da captura automática: \u2014', await card(fr, 0));
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
function fmt(n) { return n.toLocaleString('en-US'); }
