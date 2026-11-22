// run-drops-combined.js (lang-75): the Session drops · all accounts card on the Overview.
// One line per item (total ×, total $), sorted like the per-account Session drops; a tooltip with the per-account breakdown; the account tick boxes HIDE the account
// in the list but keep counting behind the scenes (ticking an account back is instant and accurate); Settings › Notifications › Valuable drop decides the highlight.
'use strict';
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 700))); c ? pass++ : fail++; };
const settle = p => p.waitForTimeout(1200);
const rows = p => p.dash().evaluate(() => Array.from(document.querySelectorAll('#dropsList .row')).map(e => { const nm = e.querySelector('.nm').textContent.replace(/[^A-Za-z0-9\u00d7\u00b7 ,\\.]/g, '').replace(/\s+/g, ' ').trim(); const prices = Array.from(e.querySelectorAll('.gold')).map(x => x.textContent.trim()); return { name: nm, gold: prices[prices.length - 1] || '', who: Array.from(e.querySelectorAll('.who i')).length, tip: e.title, tier: e.classList.contains('top') ? 'top' : e.classList.contains('hot') ? 'hot' : 'plain' }; }));
const accs = p => p.dash().evaluate(() => Array.from(document.querySelectorAll('#dropsAcc label')).map(l => ({ on: l.classList.contains('on'), n: Number(l.querySelector('input').getAttribute('data-drops-acc')), checked: l.querySelector('input').checked, name: l.textContent.trim() })));
const drops = (p, n, sid, list) => p.s(n, { startedAt: sid, drops: list.map(([name, qty, each]) => ({ name, qty, value: qty * each })) });
(async () => {
  const b = await chromium.launch();
  let p = await open(b, { w: 1700, h: 1000 }); await feedAll(p); await settle(p);
  // clear the drops that scen.feedAll already put on the four accounts: this suite checks only what IT sends
  await p.dash().evaluate(() => { accounts.forEach(a => { a.drops = []; }); drawDropsCombined(); });
  // layout: the card is on the Overview, below Latest captures and Today's highlights
  const lay = await p.dash().evaluate(() => { const c = document.getElementById('dropsCard'), t = document.getElementById('todayCard'); return { title: c.querySelector('.h span').textContent, after: c.getBoundingClientRect().top >= t.getBoundingClientRect().top, inOverview: !!c.closest('#mainCol') }; });
  ok('a "Session drops · all accounts" card below Today\u2019s highlights, inside the Overview', lay.title === 'Session drops · all accounts' && lay.after && lay.inOverview, lay);
  // the account tick boxes: four, all ticked at first, in the account colour
  const a0 = await accs(p);
  ok('the header has four account tick boxes, all ticked at first, in order 1 to 4', a0.length === 4 && a0.every((x, i) => x.n === i + 1 && x.checked && x.on), a0);
  // send drops from three accounts
  await drops(p, 1, 9001, [['Shiny Stone', 2, 1000000], ['Small stone', 20, 20]]);
  await drops(p, 2, 9002, [['Shiny Stone', 3, 1000000], ['Water gem', 1, 15000]]);
  await drops(p, 3, 9003, [['Adupoke', 1, 1000000]]);
  await settle(p);
  let R = await rows(p);
  ok('one line per item: Shiny Stone \u00d75 (two accounts), Adupoke \u00d71, Water gem \u00d71, Small stone \u00d720', R.map(x => x.name).join() === 'Shiny Stone \u00d75,Adupoke \u00d71,Water gem \u00d71,Small stone \u00d720', R.map(x => x.name));
  ok('...the expensive ones are highlighted ("hot": Shiny Stone, Adupoke, Water gem), the cheap Small stone is plain', R[0].tier !== 'plain' && R[1].tier !== 'plain' && R[2].tier !== 'plain' && R[3].tier === 'plain', R.map(x => x.name + ':' + x.tier));
  ok('...the top row shows a dot per contributing account (Shiny Stone: two dots)', R[0].who === 2 && R[1].who === 1, R.slice(0, 3).map(x => [x.name, x.who]));
  ok('...each row\'s tooltip has the per-account breakdown and the price of one', /trainer1: \u00d72/.test(R[0].tip) && /trainer2: \u00d73/.test(R[0].tip) && /\$1M each/.test(R[0].tip), R[0].tip);
  const sel = await p.dash().evaluate(() => { const r = document.querySelector('#dropsList .row.hot'); const gs = r.querySelectorAll('.gold'); return { gold: gs[gs.length - 1].textContent, name: r.querySelector('.nm').textContent.replace(/\s+/g, ' ').trim() }; });
  ok('...the gold column shows the combined value (the top Shiny Stone row): $5M', /\$5M/.test(sel.gold), sel);
  // untick trainer2 (idx 1 -> data-drops-acc=2): Shiny Stone drops to ×2, trainer2's Water gem goes away
  await p.dash().evaluate(() => document.querySelector('#dropsAcc input[data-drops-acc="2"]').click());
  await p.waitForTimeout(300); R = await rows(p);
  ok('unticking trainer2: Shiny Stone falls to \u00d72 (trainer1 only), Water gem is gone (only trainer2 had it)', R.find(r => /Shiny Stone/.test(r.name)).name === 'Shiny Stone \u00d72' && !R.find(r => /Water gem/.test(r.name)), R.map(x => x.name));
  // the data is kept behind the scenes: ticking back brings the sums back at once (no new drops message was sent)
  await p.dash().evaluate(() => document.querySelector('#dropsAcc input[data-drops-acc="2"]').click());
  await p.waitForTimeout(300); R = await rows(p);
  ok('ticking trainer2 back: Shiny Stone is \u00d75 again at once, Water gem is back (no new data was sent)', R.find(r => /Shiny Stone/.test(r.name)).name === 'Shiny Stone \u00d75' && !!R.find(r => /Water gem/.test(r.name)), R.map(x => x.name));
  // the choice is saved under sumCfg.ovDropsOff and survives a reload
  await p.dash().evaluate(() => document.querySelector('#dropsAcc input[data-drops-acc="2"]').click());
  await p.waitForTimeout(200);
  const saved = await p.dash().evaluate(() => JSON.parse(localStorage.getItem('4h.summary')).ovDropsOff);
  ok('...the untick is saved under sumCfg.ovDropsOff[2] = true', saved && saved['2'] === true, saved);
  await p.dash().evaluate(() => location.reload()); await p.waitForTimeout(1600);
  const A2 = await accs(p), R2 = await rows(p);
  ok('after a reload: trainer2 is still unticked (saved choice is applied)', A2.find(x => x.n === 2).checked === false, [A2, R2.map(x => x.name)]);
  // the gear has a new "Session drops (combined)" row, ticked by default
  await p.evaluate(() => { if (!ui.simple) document.getElementById('btnSimple').click(); }); await p.waitForTimeout(300);
  await p.dash().click('#btnOvSettings'); await p.waitForTimeout(200);
  const gear = await p.dash().evaluate(() => Array.from(document.querySelectorAll('#ovSettings input[data-ov]')).map(i => ({ k: i.getAttribute('data-ov'), on: i.checked, name: i.closest('.ss-row').querySelector('.nm').textContent })));
  ok('the Overview gear has a seventh row "Session drops (combined)"', gear[gear.length - 1].k === 'drops' && gear[gear.length - 1].name === 'Session drops (combined)' && gear[gear.length - 1].on, gear);
  await p.dash().click('#ovSettings input[data-ov="drops"]'); await p.waitForTimeout(200);
  const hid = await p.dash().evaluate(() => getComputedStyle(document.getElementById('dropsCard')).display);
  ok('unticking it hides the card', hid === 'none', hid);
  await p.dash().click('#ovSettings input[data-ov="drops"]'); await p.waitForTimeout(200);
  ok('ticking it brings the card back', (await p.dash().evaluate(() => getComputedStyle(document.getElementById('dropsCard')).display)) !== 'none');
  // ---- lang-75: pins (click to send a row to the top; click again to unpin; the choice is kept in sumCfg.dropsPins)
  const names = () => p.dash().evaluate(() => Array.from(document.querySelectorAll('#dropsList .row .nm')).map(n => n.textContent.replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().split(' ')[0]));
  const nm0 = await names();
  ok('before pinning: the list starts with the expensive ones ("Shiny Stone", "Adupoke", ...)', nm0[0] === 'Shiny' && nm0[1] === 'Adupoke', nm0);
  // pin the cheap "Small stone" and check it jumps to the top
  await p.dash().evaluate(() => { const b = Array.from(document.querySelectorAll('#dropsList .pin')).find(x => x.getAttribute('data-pin') === 'Small stone'); b.click(); });
  await p.waitForTimeout(150);
  const nm1 = await names();
  ok('clicking the pin of a cheap item ("Small stone") sends it to the top, as a pinned row', nm1[0] === 'Small' && (await p.dash().evaluate(() => document.querySelector('#dropsList .row').classList.contains('pinned'))), nm1);
  ok('...the pin is saved in sumCfg.dropsPins and shows as a filled star', (await p.dash().evaluate(() => JSON.parse(localStorage.getItem('4h.summary')).dropsPins['Small stone'])) === true && (await p.dash().evaluate(() => document.querySelector('#dropsList .row.pinned .pin').textContent)) === '\u2605');
  // click it again to unpin
  await p.dash().evaluate(() => { const b = Array.from(document.querySelectorAll('#dropsList .pin')).find(x => x.getAttribute('data-pin') === 'Small stone'); b.click(); });
  await p.waitForTimeout(150);
  const nm2 = await names();
  ok('clicking the pin again: the row goes back to its natural place (the bottom), and the key is gone from storage', nm2[0] === 'Shiny' && (await p.dash().evaluate(() => JSON.parse(localStorage.getItem('4h.summary')).dropsPins['Small stone'])) === undefined, nm2);
  // ---- lang-75: layout — Latest captures, Today's highlights and Session drops are inside .split3; two per row (half-width each)
  const sizes = await p.dash().evaluate(() => { const ids = ['capCard', 'todayCard', 'dropsCard']; const w = window.innerWidth; const r = ids.map(id => Math.round(document.getElementById(id).getBoundingClientRect().width)); const sameParent = new Set(ids.map(id => document.getElementById(id).parentElement)).size === 1; return { w, r, sameParent }; });
  ok('the three cards (Latest captures, Today\u2019s highlights, Session drops) share the same parent (.split3) and are the same width (two per row)', sizes.sameParent && sizes.r[0] === sizes.r[1] && sizes.r[1] === sizes.r[2] && Math.abs(sizes.r[0] * 2 + 14 - (sizes.w - 300)) < 300, sizes);          // (the main column is the full width minus the sidebar, which varies with the window size)
  // hide Latest captures: Session drops goes to row 1 beside Today's highlights
  await p.dash().click('#btnOvSettings'); await p.waitForTimeout(150);
  await p.dash().click('#ovSettings input[data-ov="caps"]'); await p.waitForTimeout(200);
  await p.dash().click('#btnOvSettings'); await p.waitForTimeout(150);
  const after = await p.dash().evaluate(() => { const t = document.getElementById('todayCard').getBoundingClientRect(), d = document.getElementById('dropsCard').getBoundingClientRect(); return { onSameRow: Math.abs(t.top - d.top) < 2, toRight: d.left > t.right - 5 }; });
  ok('with Latest captures hidden, Today\u2019s highlights and Session drops share the top row (Session drops is to the right of Today\u2019s highlights)', after.onSameRow && after.toRight, after);
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();
  // Portuguese
  p = await open(b, { w: 1700, h: 1000, lang: 'pt-BR' }); await feedAll(p); await settle(p);
  const pt = await p.dash().evaluate(() => ({ title: document.querySelector('#dropsCard .h span').textContent, empty: (document.querySelector('#dropsList .empty') || {}).textContent }));
  // force-empty list (one unticked account, others with no drops in this scenario) to see the Portuguese empty line
  await p.dash().evaluate(() => { accounts.forEach(a => { a.drops = []; }); drawDropsCombined(); });
  const pt2 = await p.dash().evaluate(() => (document.querySelector('#dropsList .empty') || {}).textContent);
  ok('in Portuguese: "Drops da sessão · todas as contas", empty line "Nenhum drop ainda..."', pt.title === 'Drops da sessão · todas as contas' && /^Nenhum drop ainda/.test(pt2), [pt, pt2]);
  ok('no JavaScript errors (Portuguese)', p.errors.length === 0, p.errors);
  await b.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
