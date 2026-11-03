// run-team-card.js: the team card of the Summary after a Pokémon evolves (Horsea becomes Seadra)
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const m = (id, speciesId, name, level, slot) => ({ id: String(id), speciesId, name, level, xp: 36, hp: 1135, maxHp: 1800, slot, shiny: false });
const card = fr => fr.evaluate(() => { const boxes = Array.from(document.querySelectorAll('#sideBody .tm, #sideBody [class*="team"] > div, #sideBody .member')); const html = document.getElementById('sideBody').innerHTML; const t = document.getElementById('sideBody').innerText.replace(/\s+/g, ' ');
  return { text: t, tips: Array.from(document.querySelectorAll('#sideBody .tmrow .spr')).map(e => e.title).join(' | '), sprites: Array.from(document.querySelectorAll('#sideBody img')).map(i => i.getAttribute('src') || '').filter(s => /sprites\/pokemon/.test(s)).map(s => s.split('/').pop()) }; });
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { w: 1700, h: 1000 }); await feedAll(p);
  await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500);
  const fr = p.dash();
  await p.s(3, { teamList: [m(2002, 62, 'Poliwrath', 153, 1), m(2003, 116, 'Horsea', 76, 2)], teamActiveId: '2002', live: true }); await p.waitForTimeout(400);
  await fr.evaluate(() => { selected = 2; renderAll(); }); await p.waitForTimeout(300);
  let c = await card(fr);
  ok('before: the card has Poliwrath (the active one), Horsea is a small icon under it (its name in its tooltip); icons 62 and 116', /Poliwrath/.test(c.text) && /^Horsea · Lv 76/.test(c.tips) && c.sprites.join() === '62.png,116.png', c);
  // what the reader now sends when Horsea evolves
  await p.s(3, { teamList: [m(2002, 62, 'Poliwrath', 153, 1), m(2003, 117, 'Seadra', 76, 2)], teamActiveId: '2002', live: true }); await p.waitForTimeout(500);
  await fr.evaluate(() => renderAll()); await p.waitForTimeout(250);
  c = await card(fr);
  ok('after: the icon is Seadra (no Horsea left), still level 76, with the icon of species 117', /^Seadra · Lv 76/.test(c.tips) && !/Horsea/.test(c.text + c.tips) && c.sprites.join() === '62.png,117.png', c);
  ok('the active one is untouched (Poliwrath, Lvl. 153, in the card)', /Poliwrath Lvl\. 153/.test(c.text), c.text.slice(0, 300));
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
