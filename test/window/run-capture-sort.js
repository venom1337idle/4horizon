// run-capture-sort.js: the order of "Latest captures": latest, highest IV, highest quality, IV × Quality (a menu just left of "shiny only"), kept on this computer
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x).slice(0, 500))); c ? pass++ : fail++; };
let seq = 900;
const cap = (p, n, name, iv, q, extra) => p.s(n, { catchEvent: Object.assign({ name: name, iv: iv, max: 192, quality: q, rarity: 'Rara \u00d7' + q, shiny: false }, extra || {}), catchSeq: ++seq });
const names = p => p.dash().evaluate(() => Array.from(document.querySelectorAll('#capList .cap .nm b')).map(b => b.textContent));
const sortTo = async (p, v) => { await p.dash().selectOption('#capSort', v); await p.waitForTimeout(150); };

(async () => {
  const b = await chromium.launch();
  let p = await open(b);
  await p.evaluate(() => { if (!ui.simple) document.getElementById('btnSimple').click(); }); await p.waitForTimeout(300);
  // A..E arrive in this order (E is the newest). B and D have the same IV, C and E the same quality.
  await cap(p, 1, 'A', 100, 1.5); await cap(p, 2, 'B', 180, 0.8); await cap(p, 1, 'C', 120, 1.9); await cap(p, 3, 'D', 180, 1.0); await cap(p, 2, 'E', 60, 1.9);
  await p.waitForTimeout(1300);
  const ui = await p.dash().evaluate(() => { const s = document.getElementById('capSort'), sh = document.getElementById('capShiny'), r = s.getBoundingClientRect(), rs = sh.getBoundingClientRect();
    return { next: s.nextElementSibling && s.nextElementSibling.id, opts: Array.from(s.options).map(o => o.value + ':' + o.textContent).join('|'), value: s.value, title: s.title, row: Math.abs(r.top - rs.top) < 6, left: r.right <= rs.left, h: Math.round(r.height), hRar: Math.round(document.getElementById('capRar').getBoundingClientRect().height) }; });
  ok('the menu sits just left of "shiny only", in the same row, as high as the other menus', ui.next === 'capShiny' && ui.row && ui.left && ui.h === ui.hRar, ui);
  ok('...with latest, highest IV, highest quality, IV × Quality; "latest" at first', ui.opts === 'new:latest|iv:highest IV|q:highest quality|ivq:IV × Quality' && ui.value === 'new' && ui.title === 'Order of the list', ui);
  ok('latest: newest first (E, D, C, B, A), as before', (await names(p)).join() === 'E,D,C,B,A', await names(p));
  await sortTo(p, 'iv');
  ok('highest IV: D, B (both 180: the newer first), C 120, A 100, E 60', (await names(p)).join() === 'D,B,C,A,E', await names(p));
  await sortTo(p, 'q');
  ok('highest quality: E, C (both ×1.9: the newer first), A ×1.5, D ×1.0, B ×0.8', (await names(p)).join() === 'E,C,A,D,B', await names(p));
  await sortTo(p, 'ivq');
  ok('IV × Quality: C (228), D (180), A (150), B (144), E (114)', (await names(p)).join() === 'C,D,A,B,E', await names(p));
  // a capture without a quality number: the × of its rarity is used
  await cap(p, 4, 'F', 90, undefined, { rarity: 'Divina \u00d72.9' }); await p.waitForTimeout(1300);
  ok('a capture with no quality number uses the × of its rarity (F: 90 × 2.9 = 261, first)', (await names(p))[0] === 'F', await names(p));
  await sortTo(p, 'q');
  ok('...and is first by quality too (×2.9)', (await names(p))[0] === 'F', await names(p));
  // with the filters
  await p.dash().selectOption('#capAcc', '0'); await p.waitForTimeout(150);
  ok('the filters still apply: account 1 only, by quality: C, A', (await names(p)).join() === 'C,A', await names(p));
  await p.dash().selectOption('#capAcc', 'all'); await p.dash().fill('#capIv', '100'); await p.waitForTimeout(150);
  ok('...IV ≥ 100, by quality: C, A, D, B', (await names(p)).join() === 'C,A,D,B', await names(p));
  await p.dash().fill('#capIv', ''); await p.waitForTimeout(150);
  // a new capture while sorted: it goes where it belongs
  await cap(p, 2, 'G', 150, 1.6); await p.waitForTimeout(1300);
  ok('a new capture while sorted by quality goes to its place (G ×1.6 after C, before A)', (await names(p)).join() === 'F,E,C,G,A,D,B', await names(p));
  // kept on this computer
  await p.dash().evaluate(() => location.reload()); await p.waitForTimeout(1500);
  ok('the order is kept when the Summary is loaded again (highest quality)', await p.dash().evaluate(() => document.getElementById('capSort').value === 'q' && localStorage.getItem('4h.capSort') === 'q'));
  await p.dash().evaluate(() => { localStorage.setItem('4h.capSort', 'nonsense'); location.reload(); }); await p.waitForTimeout(1500);
  ok('...a saved value that makes no sense gives "latest"', await p.dash().evaluate(() => document.getElementById('capSort').value === 'new'));
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();
  // more than the 80 rows shown: the best are taken from ALL captures, not from the 80 newest
  p = await open(b);
  await p.evaluate(() => { if (!ui.simple) document.getElementById('btnSimple').click(); }); await p.waitForTimeout(300);
  await cap(p, 1, 'Best', 190, 2.0);
  for (let i = 0; i < 90; i++) await cap(p, 1 + (i % 4), 'M' + i, 50 + (i % 40), 1.0);
  await p.waitForTimeout(1300);
  ok('latest: 80 rows, the oldest (Best) not among them', await p.dash().evaluate(() => document.querySelectorAll('#capList .cap').length) === 80 && (await names(p)).indexOf('Best') < 0);
  await sortTo(p, 'iv');
  ok('highest IV: the best of ALL captures comes first, even when it is older than the 80 newest (Best, 190)', (await names(p))[0] === 'Best' && (await names(p)).length === 80, (await names(p)).slice(0, 3));
  await p.dash().evaluate(() => { document.getElementById('capList').scrollTop = 400; }); await sortTo(p, 'ivq');
  ok('changing the order goes back to the top of the list', await p.dash().evaluate(() => document.getElementById('capList').scrollTop === 0));
  ok('no JavaScript errors (many captures)', p.errors.length === 0, p.errors);
  await p.context().close();
  // Portuguese
  p = await open(b, { lang: 'pt-BR' });
  const pt = await p.dash().evaluate(() => { const s = document.getElementById('capSort'); return { opts: Array.from(s.options).map(o => o.textContent).join('|'), title: s.title, label: s.getAttribute('aria-label') }; });
  ok('in Portuguese: mais recentes, maior IV, maior qualidade, IV × Qualidade; "Ordem da lista"', pt.opts === 'mais recentes|maior IV|maior qualidade|IV × Qualidade' && pt.title === 'Ordem da lista' && pt.label === 'Ordem da lista', pt);
  ok('no JavaScript errors (Portuguese)', p.errors.length === 0, p.errors);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
