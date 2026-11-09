// run-balltime.js: the 5th line of each account card in the Summary (lang-70): how long the auto-catch ball lasts at the pace of this hunt
// white above 3 h, yellow from 1 h to 3 h, red under 1 h, grey while it cannot be known
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const H = 3600000;
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

  // venom's example: 13,000 Ultra Balls, 500 thrown in 2 hours = 250 per hour = 52 h
  let c = await set(2, { autoBall: 'ultra-ball', autoBalls: 13000, startedAt: 2, elapsedMs: 2 * H, active: true, ballsByType: { 'ultra-ball': 500, 'luxury-ball': 3 } });
  ok('13,000 Ultra, 500 thrown in 2 h: "⏱ Ultra Ball: 52h 0m left", white (the 3 Luxury thrown at shinies are not counted)', c.txt === '\u23f1 Ultra Ball: 52h 0m left' && /\bok\b/.test(c.cls) && c.color === WHITE, c);
  ok('...the tooltip says the stock and the pace ("13,000 Ultra Ball left, 250 thrown per hour in this hunt")', c.tip === '13,000 Ultra Ball left, 250 thrown per hour in this hunt', c.tip);
  c = await set(2, { autoBalls: 800 });
  ok('800 left at 250/h = 3h 12m: still white (above 3 h)', c.txt === '\u23f1 Ultra Ball: 3h 12m left' && c.color === WHITE, c);
  c = await set(2, { autoBalls: 750 });
  ok('750 left = exactly 3 h: yellow (white is only ABOVE 3 h)', c.txt === '\u23f1 Ultra Ball: 3h 0m left' && /\bwarn\b/.test(c.cls) && c.color === YELLOW, c);
  c = await set(2, { autoBalls: 400 });
  ok('400 left = 1h 36m: yellow', c.txt === '\u23f1 Ultra Ball: 1h 36m left' && c.color === YELLOW, c);
  c = await set(2, { autoBalls: 250 });
  ok('250 left = exactly 1 h: yellow (red is UNDER 1 h)', c.txt === '\u23f1 Ultra Ball: 1h 0m left' && c.color === YELLOW, c);
  c = await set(2, { autoBalls: 100 });
  ok('100 left = 24 min: "24m left", red', c.txt === '\u23f1 Ultra Ball: 24m left' && /\blow\b/.test(c.cls) && c.color === RED, c);
  c = await set(2, { autoBalls: 1 });
  ok('1 left = 14 s: "1m left" (never "0m"), red', c.txt === '\u23f1 Ultra Ball: 1m left' && c.color === RED, c);
  c = await set(2, { autoBalls: 0 });
  ok('none in stock: "⏱ Ultra Ball: none left", red, with a tooltip', c.txt === '\u23f1 Ultra Ball: none left' && c.color === RED && /nothing to throw/.test(c.tip || ''), c);
  c = await set(2, { autoBalls: 2000000 });
  ok('a huge stock: "99h+ left", white', c.txt === '\u23f1 Ultra Ball: 99h+ left' && c.color === WHITE, c);
  c = await set(2, { autoBalls: 13000, active: false });
  ok('the hunt is paused: the last estimate stays, with "(paused)", in grey', c.txt === '\u23f1 Ultra Ball: 52h 0m left (paused)' && /\bna\b/.test(c.cls) && c.color !== WHITE && c.color !== YELLOW && c.color !== RED, c);
  c = await set(2, { active: true, autoCatchOn: false });
  ok('auto-catch is off: "⏱ Auto-catch off", grey', c.txt === '\u23f1 Auto-catch off' && /\bna\b/.test(c.cls), c);
  c = await set(2, { autoCatchOn: true });
  ok('...on again: the time is back', c.txt === '\u23f1 Ultra Ball: 52h 0m left', c);
  c = await set(2, { autoBall: 'great-ball', autoBalls: 300 });
  ok('another ball chosen for auto-catch (Great, none thrown in this hunt yet): "Great Ball: not used in this hunt", grey', c.txt === '\u23f1 Great Ball: not used in this hunt' && /\bna\b/.test(c.cls), c);
  await set(2, { autoBall: 'ultra-ball', autoBalls: 13000 });

  // a new hunt: the balls of the old one are forgotten, and the pace needs 5 minutes
  c = await set(2, { startedAt: 99, elapsedMs: 3 * 60000, ballsByType: { 'ultra-ball': 40 } });
  ok('a new hunt of 3 minutes: "Ultra Ball: measuring…", grey, the tooltip says it needs 5 minutes', c.txt === '\u23f1 Ultra Ball: measuring\u2026' && /\bna\b/.test(c.cls) && /after 5 minutes/.test(c.tip || ''), c);
  c = await set(2, { startedAt: 100, elapsedMs: 10 * 60000 });
  ok('a new hunt whose balls have not come yet: the old hunt\u2019s are not used ("not used in this hunt")', c.txt === '\u23f1 Ultra Ball: not used in this hunt', c);
  c = await set(2, { elapsedMs: 10 * 60000, ballsByType: { 'ultra-ball': 50 } });
  ok('10 minutes, 50 thrown = 300/h, 13,000 left: 43h 20m', c.txt === '\u23f1 Ultra Ball: 43h 20m left' && c.color === WHITE, c);
  c = await set(3, { autoBall: 'premier-ball', autoBalls: 30, startedAt: 3, elapsedMs: H, active: true, ballTypes: { 'premier-ball': 30 }, ballsByType: { 'premier-ball': 60 } });
  ok('the accounts are separate: account 3 with Premier Ball, 30 left at 60/h = 30m, red; account 2 unchanged', c.txt === '\u23f1 Premier Ball: 30m left' && c.color === RED && (await card(fr, 1)).txt === '\u23f1 Ultra Ball: 43h 20m left', [c, await card(fr, 1)]);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // a short window: the Summary gets tighter, the time left stays (only the shiny and potions line goes)
  p = await open(b, { w: 1500, h: 660 }); await feedAll(p); await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500); fr = p.dash();
  await p.s(2, { autoBall: 'ultra-ball', autoBalls: 100, startedAt: 2, elapsedMs: 2 * H, active: true, ballsByType: { 'ultra-ball': 500 } }); await p.waitForTimeout(300); await sel(fr, 'sum'); await p.waitForTimeout(150);
  const tight = await fr.evaluate(() => { const bd = document.getElementById('sideBody'); return { cls: document.body.className, over: bd.scrollHeight - bd.clientHeight }; });
  c = await card(fr, 1);
  ok('in a 660 px window every account still fits (' + tight.cls.replace(/\s+/g, ' ') + ') and the time left is still shown', tight.over <= 1 && c.shown && c.txt === '\u23f1 Ultra Ball: 24m left', [tight, c]);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // Portuguese
  p = await open(b, { w: 1500, h: 1000, lang: 'pt-BR' }); await feedAll(p); await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500); fr = p.dash();
  const pt = [];
  for (const d of [{ autoBall: 'ultra-ball', autoBalls: 13000, startedAt: 2, elapsedMs: 2 * H, active: true, ballsByType: { 'ultra-ball': 500 } }, { active: false }, { autoBalls: 0 }, { autoBalls: 9, startedAt: 7, elapsedMs: 60000, active: true }, { autoCatchOn: false }]) { await p.s(2, d); await p.waitForTimeout(250); await sel(fr, 'sum'); await p.waitForTimeout(80); pt.push((await card(fr, 1)).txt); }
  ok('in Portuguese: "restantes", "(pausada)", "nenhuma sobrando", "medindo…", "Captura automática desligada"', JSON.stringify(pt) === JSON.stringify(['\u23f1 Ultra Ball: 52h 0m restantes', '\u23f1 Ultra Ball: 52h 0m restantes (pausada)', '\u23f1 Ultra Ball: nenhuma sobrando', '\u23f1 Ultra Ball: medindo\u2026', '\u23f1 Captura automática desligada']), pt);
  ok('...and account 1 (nothing yet): "Bola da captura automática: —"', (await card(fr, 0)).txt === '\u23f1 Bola da captura automática: \u2014', await card(fr, 0));
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
