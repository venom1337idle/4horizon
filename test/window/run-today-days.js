// run-today-days.js (lang-75): the two arrows on Today's highlights header let the user step through the last 7 days (today + 6 before it), kept on this computer.
// A past day shows its rows, counters and header title; a day the app did not see shows "4horizon was not running on this day". The right arrow is disabled on today.
// The old key `4h.today` is moved to `4h.today.<date>` on the first load (migration kept for 1.0.12 → 1.0.13).
'use strict';
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 700))); c ? pass++ : fail++; };
const head = p => p.dash().evaluate(() => ({ title: document.getElementById('todayTitle').textContent, past: document.getElementById('todayTitle').classList.contains('past'),
  prevOff: document.getElementById('todayPrev').disabled, nextOff: document.getElementById('todayNext').disabled,
  rows: Array.from(document.querySelectorAll('#todayList .ev')).length, empty: (document.querySelector('#todayList .empty') || {}).textContent || '',
  counts: Array.from(document.querySelectorAll('#todayTot .tc')).map(e => ({ k: e.classList.contains('shiny') ? 'shiny' : e.classList.contains('stone') ? 'stone' : 'adu', n: e.querySelector('b').textContent })) }));
const SEED = (date, extras) => ({ v: 1, date: date, items: extras || [{ t: Date.parse(date + 'T10:00:00'), acc: 0, name: 'trainer1', kind: 'shiny', p: { name: 'Gengar', iv: 180, max: 192, rarity: 'M\u00edtica', q: 2.1 } }], keys: ['seed'], counts: { shiny: 1, shinyStone: 2, adupoke: 0 } });
const yd = async (p, n) => p.dash().evaluate(n => { const d = new Date(today.date + 'T12:00:00'); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }, n);
(async () => {
  const b = await chromium.launch();
  // ---- start with 3 past days in storage; today is empty
  let p = await open(b, { w: 1700, h: 1000 });
  await feedAll(p); await p.waitForTimeout(500);
  const [yd1, yd2, yd5] = [await yd(p, 1), await yd(p, 2), await yd(p, 5)];
  await p.dash().evaluate(seed => { Object.keys(localStorage).filter(k => k.indexOf('4h.today') === 0).forEach(k => localStorage.removeItem(k)); Object.keys(seed).forEach(d => localStorage.setItem('4h.today.' + d, JSON.stringify(seed[d]))); location.reload(); },
    { [yd1]: SEED(yd1), [yd2]: SEED(yd2, [{ t: Date.parse(yd2 + 'T12:00:00'), acc: 1, name: 'trainer2', kind: 'drop', p: { item: 'Shiny Stone', n: 2, each: 1000000 } }]), [yd5]: SEED(yd5) });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { if (!ui.simple) document.getElementById('btnSimple').click(); }); await p.waitForTimeout(300);
  let H = await head(p);
  ok('the header reads "Today\u2019s highlights \u00b7 00:00 to 23:59", "today" style (not past), the left arrow is on and the right one is off', /Today\u2019s highlights/.test(H.title) && !H.past && !H.prevOff && H.nextOff, H);
  await p.dash().click('#todayPrev'); await p.waitForTimeout(150); H = await head(p);
  ok('one left arrow: the title becomes "Yesterday\u2019s highlights", the "past" style is on, the right arrow turns on, the seeded shiny row and its counters show', /Yesterday\u2019s highlights/.test(H.title) && H.past && !H.nextOff && H.rows === 1 && H.counts.find(c => c.k === 'shiny').n === '1', H);
  await p.dash().click('#todayPrev'); await p.waitForTimeout(150); H = await head(p);
  ok('two left arrows: a different day (2 days back), the Shiny Stone drop row shows, counters match that day\u2019s', H.past && H.rows === 1 && H.counts.find(c => c.k === 'stone').n === '2', H);
  await p.dash().click('#todayPrev'); await p.waitForTimeout(150); H = await head(p);
  ok('three left arrows: 3 days back, no saved data, "4horizon was not running on this day" shows (no rows, no counters)', H.past && H.rows === 0 && /not running on this day/.test(H.empty) && H.counts.length === 0, H);
  // go back to the oldest allowed day (6 before today) and check the left arrow is disabled
  for (let i = 0; i < 3; i++) { await p.dash().click('#todayPrev'); await p.waitForTimeout(90); }
  H = await head(p);
  ok('at the oldest day (6 before today): the left arrow is disabled, the right arrow is on', H.prevOff && !H.nextOff, H);
  // step back to today with the right arrow
  for (let i = 0; i < 6; i++) { await p.dash().click('#todayNext'); await p.waitForTimeout(90); }
  H = await head(p);
  ok('back to today: title is "Today\u2019s highlights...", "past" style off, right arrow disabled, left arrow on', /Today\u2019s highlights/.test(H.title) && !H.past && H.nextOff && !H.prevOff, H);
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();
  // ---- migration: the old key `4h.today` moves to `4h.today.<date>` on first load
  p = await open(b, { w: 1700, h: 1000 });
  await p.dash().evaluate(() => { Object.keys(localStorage).filter(k => k.indexOf('4h.today') === 0).forEach(k => localStorage.removeItem(k));
    const d = new Date(); d.setDate(d.getDate() - 1); const yd1 = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    localStorage.setItem('4h.today', JSON.stringify({ v: 1, date: yd1, items: [{ t: Date.now(), acc: 0, kind: 'shiny', p: { name: 'A', iv: 1, max: 192, rarity: 'x' } }], keys: [], counts: { shiny: 7, shinyStone: 0, adupoke: 0 } })); location.reload(); });
  await p.waitForTimeout(1500);
  const after = await p.dash().evaluate(() => ({ old: localStorage.getItem('4h.today'), keys: Object.keys(localStorage).filter(k => k.indexOf('4h.today.') === 0).sort() }));
  ok('on first load the old "4h.today" key is removed and its data is moved to a dated key', after.old === null && after.keys.length === 1 && /^4h\.today\.\d{4}-\d{2}-\d{2}$/.test(after.keys[0]), after);
  ok('no JavaScript errors (migration)', p.errors.length === 0, p.errors);
  await p.context().close();
  // ---- the prune keeps only 7 days worth of entries
  p = await open(b, { w: 1700, h: 1000 });
  await p.dash().evaluate(() => { Object.keys(localStorage).filter(k => k.indexOf('4h.today') === 0).forEach(k => localStorage.removeItem(k));
    for (let i = 0; i < 12; i++) { const d = new Date(); d.setDate(d.getDate() - i); const k = '4h.today.' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); localStorage.setItem(k, '{"v":1,"date":"' + k.slice(-10) + '","items":[],"keys":[],"counts":{"shiny":0,"shinyStone":0,"adupoke":0}}'); }
    location.reload(); });
  await p.waitForTimeout(1500);
  const left = await p.dash().evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('4h.today.') === 0).length);
  ok('after a reload only 7 day-entries are left (today + 6 before it); the older ones are pruned', left === 7, left);
  ok('no JavaScript errors (prune)', p.errors.length === 0, p.errors);
  await p.context().close();
  // ---- Portuguese (the two arrow tooltips, the "Yesterday" label)
  p = await open(b, { w: 1700, h: 1000, lang: 'pt-BR' });
  await p.dash().evaluate(() => { Object.keys(localStorage).filter(k => k.indexOf('4h.today') === 0).forEach(k => localStorage.removeItem(k));
    const d = new Date(); d.setDate(d.getDate() - 1); const k = '4h.today.' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    localStorage.setItem(k, JSON.stringify({ v: 1, date: k.slice(-10), items: [{ t: Date.parse(k.slice(-10) + 'T12:00:00'), acc: 0, name: 'trainer1', kind: 'shiny', p: { name: 'Pikachu', iv: 180, max: 192, rarity: 'M\u00edtica', q: 2.1 } }], keys: [], counts: { shiny: 1, shinyStone: 0, adupoke: 0 } }));
    location.reload(); });
  await p.waitForTimeout(1500); await feedAll(p);
  await p.evaluate(() => { if (!ui.simple) document.getElementById('btnSimple').click(); }); await p.waitForTimeout(300);
  const prevTitle = await p.dash().evaluate(() => document.getElementById('todayPrev').title);
  ok('in Portuguese the left arrow tooltip is "Mostrar o dia anterior"', prevTitle === 'Mostrar o dia anterior', prevTitle);
  await p.dash().click('#todayPrev'); await p.waitForTimeout(200);
  const ttl = await p.dash().evaluate(() => document.getElementById('todayTitle').textContent);
  ok('in Portuguese one left arrow gives "Destaques de Ontem"', ttl === 'Destaques de Ontem', ttl);
  ok('no JavaScript errors (Portuguese)', p.errors.length === 0, p.errors);
  await b.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
