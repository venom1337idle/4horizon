// run-summary-compact.js: the Summary of one account, more compact (lang-40): a lower band, smaller tiles with their text centred, no line above the team,
// the team as ONE card (the active Pokémon: HP, XP, level) with the others as small icons under it, a shiny look for a shiny active one, "Lvl." instead of "Nv."
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x).slice(0, 600))); c ? pass++ : fail++; };
const m = (id, sp, name, level, slot, extra) => Object.assign({ id: String(id), speciesId: sp, name, level, xp: 36, hp: 900, maxHp: 1800, slot, shiny: false }, extra || {});
const TEAM = [m(1, 62, 'Poliwrath', 164, 1), m(2, 230, 'Kingdra', 149, 2), m(3, 111, 'Rhyhorn', 30, 3), m(4, 111, 'Rhyhorn', 1, 4, { shiny: true })];
const look = fr => fr.evaluate(() => {
  const q = s => document.querySelector('#sideBody ' + s), qa = s => Array.from(document.querySelectorAll('#sideBody ' + s)), cs = (e, k) => e ? getComputedStyle(e)[k] : null, h = e => e ? Math.round(e.getBoundingClientRect().height) : null;
  const lead = q('.tm.lead'), stats = qa('.stat'), strip = q('.strip');
  return { one: document.body.classList.contains('oneacc'), profH: h(q('.prof')), stripTileH: h(q('.strip > div')), statH: h(stats[0]), statAlign: stats.map(e => cs(e, 'textAlign')).join(), stripLine: cs(strip, 'borderBottomWidth'),
    cards: qa('.tm').length, lead: lead ? { cls: lead.className, name: lead.querySelector('.tmn').textContent, lvl: lead.querySelector('.tml').textContent, bars: Array.from(lead.querySelectorAll('.pb')).map(b => b.className + ':' + Math.round(b.getBoundingClientRect().height) + ':' + getComputedStyle(b.querySelector('span')).fontSize + ':' + b.textContent).join(' | '), tip: lead.title } : null,
    icons: qa('.tmrow .spr').map(e => ({ cls: e.className, tip: e.title, w: Math.round(e.getBoundingClientRect().width) })), iconRowTops: Array.from(new Set(qa('.tmrow .spr').map(e => Math.round(e.getBoundingClientRect().top)))).length,
    profLvl: (q('.prof .lvl') || {}).textContent, text: document.getElementById('sideBody').innerText };
});

(async () => {
  const b = await chromium.launch();
  const p = await open(b, { w: 1700, h: 1000 }); await feedAll(p);
  await p.evaluate(() => { if (!ui.panel) document.getElementById('btnPanel').click(); }); await p.waitForTimeout(300);
  const fr = p.dash();
  await p.s(3, { teamList: TEAM, teamActiveId: '2', live: true }); await p.waitForTimeout(400);
  await fr.evaluate(() => { selected = 2; renderAll(); }); await p.waitForTimeout(300);
  let v = await look(fr);
  ok('one account: the compact look is on (body.oneacc)', v.one, v);
  ok('everything is lower than in lang-39 in the same state: the band with its EXP bar 79 → at most 64 px, the tiles 65 → at most 54, the session tiles 59 → at most 52, and those are centred', v.profH <= 64 && v.stripTileH <= 54 && v.statH <= 52 && /^(center,?)+$/.test(v.statAlign), [v.profH, v.stripTileH, v.statH, v.statAlign]);
  ok('no line between the tiles and "Team"', v.stripLine === '0px', v.stripLine);
  ok('the team: ONE card, the active Pokémon (Kingdra, gold edge), "Lvl. 149", its HP and XP bars', v.cards === 1 && /\bact\b/.test(v.lead.cls) && !/noact|shiny/.test(v.lead.cls) && v.lead.name === 'Kingdra' && v.lead.lvl === 'Lvl. 149' && /pb hp/.test(v.lead.bars) && /pb xp/.test(v.lead.bars), v.lead);
  ok('...the bars are thinner (11 px) and still legible (9 px bold text, the HP numbers in it)', v.lead.bars.split(' | ').every(x => x.split(':')[1] === '11' && x.split(':')[2] === '9px') && /900\/1,800/.test(v.lead.bars), v.lead.bars);
  ok('the others are small icons side by side under it (3 icons, 30 px, one row), in their slot order', v.icons.length === 3 && v.icons.every(i => i.w === 30) && v.iconRowTops === 1 && v.icons.map(i => i.tip.split(' · ')[0]).join() === 'Poliwrath,Rhyhorn,Rhyhorn', v.icons);
  ok('...each icon tells its name, level, HP and EXP in its tooltip; a shiny one says so and has a gold ring', /^Poliwrath · Lv 164 · HP 900\/1,800 · EXP /.test(v.icons[0].tip) && /shiny/.test(v.icons[2].cls) && / · shiny$/.test(v.icons[2].tip) && !/shiny/.test(v.icons[0].cls), v.icons);
  ok('"Lvl." instead of "Nv." in the band and the team; no "Nv." left in the Summary', v.profLvl.indexOf('Lvl. ') === 0 && !/Nv\./.test(v.text), [v.profLvl]);
  // a shiny active one
  await p.s(3, { teamList: TEAM.map(x => x.id === '2' ? Object.assign({}, x, { shiny: true }) : x), teamActiveId: '2', live: true }); await p.waitForTimeout(400); await fr.evaluate(() => renderAll()); await p.waitForTimeout(200);
  v = await look(fr);
  const shine = await fr.evaluate(() => { const e = document.querySelector('#sideBody .tm.lead'), cs = getComputedStyle(e); return { star: !!e.querySelector('.shy'), bg: cs.backgroundImage, shadow: cs.boxShadow, anim: cs.animationName, border: cs.borderTopWidth, spr: getComputedStyle(e.querySelector('.spr')).backgroundImage }; });
  ok('a shiny active Pokémon: a star before its name, an iridescent edge (2 px), a pink-gold glow and an iridescent ring around the sprite', /shiny/.test(v.lead.cls) && shine.star && /linear-gradient\(115deg/.test(shine.bg) && shine.border === '2px' && /rgba\(255, 143, 208/.test(shine.shadow) && /linear-gradient\(135deg/.test(shine.spr), shine);
  ok('...and nothing moves (no animation: nothing to redraw all the time, also in economy mode)', shine.anim === 'none', shine.anim);
  // the game did not say which one is active
  await p.s(3, { teamList: TEAM, teamActiveId: null, live: true }); await p.waitForTimeout(400); await fr.evaluate(() => { accounts[2].teamActiveId = undefined; renderAll(); }); await p.waitForTimeout(200);
  v = await look(fr);
  ok('when the game has not said which one hunts: the first of the team gets the card, without the gold edge, and the others are icons', v.lead.name === 'Poliwrath' && /noact/.test(v.lead.cls) && !/\bact\b/.test(v.lead.cls) && v.icons.length === 3, v.lead);
  // a team of one
  await p.s(3, { teamList: [TEAM[1]], teamActiveId: '2', live: true }); await p.waitForTimeout(400); await fr.evaluate(() => renderAll()); await p.waitForTimeout(200);
  v = await look(fr);
  ok('a team of one: the card, and no empty row of icons', v.cards === 1 && v.icons.length === 0 && !(await fr.evaluate(() => !!document.querySelector('#sideBody .tmrow'))), v);
  // the all-accounts view is as before
  await fr.evaluate(() => { selected = 'sum'; renderAll(); }); await p.waitForTimeout(200);
  v = await look(fr);
  ok('the Summary of all accounts (Σ) keeps its look (not compact, its line under the tiles)', !v.one && v.stripLine !== '0px', [v.one, v.stripLine]);
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();
  // Portuguese
  const q = await open(b, { w: 1700, h: 1000, lang: 'pt-BR' }); await feedAll(q);
  await q.evaluate(() => { if (!ui.panel) document.getElementById('btnPanel').click(); }); await q.waitForTimeout(300);
  await q.s(3, { teamList: TEAM, teamActiveId: '2', live: true }); await q.waitForTimeout(400);
  await q.dash().evaluate(() => { selected = 2; renderAll(); }); await q.waitForTimeout(300);
  v = await look(q.dash());
  ok('in Portuguese too: "Lvl." (not "Nv."), and a shiny icon says "shiny"', v.lead.lvl === 'Lvl. 149' && !/Nv\./.test(v.text) && / · shiny$/.test(v.icons[2].tip), [v.lead.lvl, v.icons[2].tip]);
  ok('no JavaScript errors (Portuguese)', q.errors.length === 0, q.errors);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
