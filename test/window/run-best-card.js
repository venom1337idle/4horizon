// run-best-card.js (lang-72): the all-accounts Summary: each card of "Per account" has the best catch of its account as its last line, the same as in the
// account's own Summary (name, tier and IV in their colours, the type chosen in the gear), always on one line (the whole of it in the tooltip), and the Summary still fits.
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 500))); c ? pass++ : fail++; };
const PICKS = { bestIV: { name: 'Alpha', iv: 181, max: 192, rarity: 'Rara \u00d71.20', quality: 1.2, shiny: false }, bestQ: { name: 'Beta', iv: 120, max: 192, rarity: '\u00c9pica \u00d71.90', quality: 1.9, shiny: true }, bestS: { name: 'Gamma', iv: 150, max: 192, rarity: 'Lend\u00e1ria \u00d71.60', quality: 1.6, shiny: false } };
const setup = async (b, o) => {
  const p = await open(b, Object.assign({ w: 1700, h: 1000 }, o || {})); await feedAll(p);
  await p.s(3, PICKS);
  await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(500);
  const fr = p.dash(); await fr.evaluate(() => { selected = 'sum'; renderAll(); }); await p.waitForTimeout(250);
  return { p, fr };
};
const cards = fr => fr.evaluate(() => Array.from(document.querySelectorAll('#sideBody .acard')).map(c => { const l = c.querySelector('.ln.best'), v = l && l.querySelector('.bv'), lines = Array.from(c.querySelectorAll('.ln'));
  return l ? { label: l.querySelector('.dim').textContent, html: v.innerHTML, text: v.textContent, tip: l.getAttribute('title'), last: lines[lines.length - 1] === l, h: Math.round(l.getBoundingClientRect().height), cut: v.scrollWidth > v.clientWidth + 1, inside: v.getBoundingClientRect().right <= c.getBoundingClientRect().right + 1 } : null; }));
const own = async (fr, i) => { await fr.evaluate(i => { selected = i; renderAll(); }, i); const h = await fr.evaluate(() => { const r = Array.from(document.querySelectorAll('#sideBody .row')).find(x => /^Best catch|^Melhor captura/.test(x.querySelector('.k') ? x.querySelector('.k').textContent : '')); return r ? r.querySelector('.v').innerHTML : null; }); await fr.evaluate(() => { selected = 'sum'; renderAll(); }); return h; };
(async () => {
  const b = await chromium.launch();
  let { p, fr } = await setup(b);
  let c = await cards(fr);
  ok('every card of "Per account" has a "Best catch" line, the last line of the card', c.length === 4 && c.every(x => x && x.label === 'Best catch' && x.last), c);
  const owns = []; for (let i = 0; i < 4; i++) owns.push(await own(fr, i));
  ok('...it is exactly what the account\u2019s own Summary shows under Best catch (name, tier and IV in their colours)', c.every((x, i) => x.html === owns[i]), [c.map(x => x.html), owns]);
  ok('...an account with nothing caught yet: "\u2014"', c.some(x => x.text === '\u2014'), c.map(x => x.text));
  ok('...the account with a catch (IV type): Alpha, its tier \u00d71.20 and 181/192', /^Alpha .*\u00d71\.20 181\/192$/.test(c[2].text.replace(/\s+/g, ' ').trim()), c[2].text);
  ok('...the tooltip: "Best catch (IV): Alpha ... 181/192"', /^Best catch \(IV\): Alpha .*181\/192$/.test(c[2].tip), c[2].tip);
  // the type of the gear
  await fr.evaluate(() => { bestMode = 'quality'; renderAll(); }); await p.waitForTimeout(150); c = await cards(fr);
  ok('the gear on Quality: the card shows the best by quality (\u2726 Beta, a shiny), as the account\u2019s Summary does', /Beta/.test(c[2].text) && /\u2726/.test(c[2].text) && /^Best catch \(Quality\): /.test(c[2].tip) && c[2].html === await own(fr, 2), c[2]);
  await fr.evaluate(() => { bestMode = 'score'; renderAll(); }); await p.waitForTimeout(150); c = await cards(fr);
  ok('...on IV \u00d7 Quality: Gamma', /Gamma/.test(c[2].text) && /^Best catch \(IV \u00d7 Quality\): /.test(c[2].tip), c[2]);
  await fr.evaluate(() => { bestMode = 'iv'; renderAll(); });
  // a very long name: one line, cut with "\u2026", the whole of it in the tooltip
  await p.s(3, { bestIV: { name: 'Crabominable Extraordinarily Long Name Of A Pokemon', iv: 181, max: 192, rarity: 'Lend\u00e1ria \u00d71.90', quality: 1.9, shiny: true } }); await p.waitForTimeout(400);
  await fr.evaluate(() => { selected = 'sum'; renderAll(); }); await p.waitForTimeout(150); c = await cards(fr);
  ok('a very long best catch stays on ONE line (as high as the line of an empty one), cut inside the card, the whole of it in the tooltip', c[2].h <= c[0].h + 1 && c[2].cut && c[2].inside && /Crabominable Extraordinarily Long Name Of A Pokemon .*181\/192$/.test(c[2].tip), c.map(x => [x.h, x.cut, x.inside]));
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();
  // the Summary still fits: at every height where it fitted without the new line, it fits with it (it gets tighter, in its steps)
  const fits = [];
  for (const h of [1000, 900, 820, 760, 700]) {
    ({ p, fr } = await setup(b, { w: 1500, h }));
    const r = await fr.evaluate(() => { const body = document.getElementById('sideBody'), m = () => body.scrollHeight - body.clientHeight;
      const st = document.createElement('style'); st.textContent = '.acard .ln.best { display: none !important; }'; document.head.appendChild(st); fitSide(); const before = m(), cb = document.body.className;
      st.remove(); fitSide(); return { before, after: m(), cb, ca: document.body.className }; });
    fits.push(Object.assign({ h }, r)); await p.context().close();
  }
  ok('the all-accounts Summary still fits without scrolling wherever it fitted before (it uses its tighter steps when needed)', fits.every(f => f.before > 1 || f.after <= 1), fits);
  // Portuguese
  ({ p, fr } = await setup(b, { lang: 'pt-BR' })); c = await cards(fr);
  ok('in Portuguese: "Melhor captura" on every card, the tooltip "Melhor captura (IV): ..."', c.every(x => x && x.label === 'Melhor captura') && /^Melhor captura \(IV\): Alpha/.test(c[2].tip), c.map(x => [x.label, x.tip]));
  ok('no JavaScript errors (Portuguese)', p.errors.length === 0, p.errors);
  await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
