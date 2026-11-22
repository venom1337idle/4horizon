// run-overview-settings.js (lang-72): the gear beside "Overview": a panel like the Summary's, with one box per part of the Overview (Today, Live totals, Per account,
// Incubators, Latest captures, Today's highlights); a part that is unticked is hidden and not drawn, the others keep their size; the choice is kept (and is part of the
// Summary's settings, so of Settings › Settings backup); when nothing is left on screen one line says how to get it back
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 700))); c ? pass++ : fail++; };
const IDS = { today: 'todayRow', live: 'kpis', table: 'tableCard', eggs: 'eggCard', caps: 'capCard', high: 'todayCard' };
const setup = async (b, o) => {
  const p = await open(b, Object.assign({ w: 1700, h: 1000 }, o || {})); await feedAll(p);
  await p.evaluate(() => { if (!ui.simple) document.getElementById('btnSimple').click(); }); await p.waitForTimeout(500);
  return { p, fr: p.dash() };
};
const parts = fr => fr.evaluate(ids => { const o = {}; Object.keys(ids).forEach(k => { const e = document.getElementById(ids[k]); o[k] = { off: e.classList.contains('ov-off'), shown: getComputedStyle(e).display !== 'none', w: Math.round(e.getBoundingClientRect().width) }; });
  const em = document.getElementById('ovEmpty'); o.empty = getComputedStyle(em).display !== 'none' ? em.textContent : null; return o; }, IDS);
const panel = fr => fr.evaluate(() => { const box = document.getElementById('ovSettings'), btn = document.getElementById('btnOvSettings');
  return { open: !box.classList.contains('hidden'), on: btn.classList.contains('on'), expanded: btn.getAttribute('aria-expanded'), head: (box.querySelector('.ss-h') || {}).textContent || '',
    rows: Array.from(box.querySelectorAll('.ss-row input[data-ov]')).map(i => { const r = i.closest('.ss-row'); return { key: i.getAttribute('data-ov'), name: r.querySelector('.nm').textContent, on: i.checked }; }), note: (box.querySelector('.ss-note') || {}).textContent || '' }; });
const tick = (fr, key) => fr.click('#ovSettings input[data-ov="' + key + '"]');
(async () => {
  const b = await chromium.launch();
  let { p, fr } = await setup(b);
  const place = await fr.evaluate(() => { const tabs = Array.from(document.querySelectorAll('#topTabs > *')), g = document.getElementById('btnOvSettings'); return { next: tabs.indexOf(g) === tabs.indexOf(document.querySelector('#topTabs .vt')) + 1, title: g.title, label: g.getAttribute('aria-label') }; });
  ok('a gear right beside the "Overview" button, "Overview settings"', place.next && place.title === 'Overview settings' && place.label === 'Overview settings', place);
  let P = await parts(fr);
  ok('at first everything is shown (as before), and no "everything is hidden" line', ['today', 'live', 'table', 'caps', 'high'].every(k => !P[k].off && P[k].shown) && !P.eggs.off && P.empty === null, P);
  const w0 = P.high.w;
  await fr.click('#btnOvSettings'); await p.waitForTimeout(150);
  let S = await panel(fr);
  ok('pressed: the panel opens (the gear lit), "Show in the Overview", the six parts in their order on screen, all ticked', S.open && S.on && S.expanded === 'true' && S.head === 'Show in the Overview' && S.rows.map(r => r.name).join('|') === 'Today (daily totals)|Live totals (per hour)|Per account|Incubators|Latest captures|Today\u2019s highlights' && S.rows.every(r => r.on), S);
  ok('...and a note: only the Overview uses these choices, the incubators only while an account is breeding', /^Only the Overview uses these choices\. The incubators show only while an account is breeding\./.test(S.note), S.note);
  const look = await fr.evaluate(() => { const a = getComputedStyle(document.getElementById('ovSettings')), s = document.getElementById('ovSettings').getBoundingClientRect(), g = document.getElementById('btnOvSettings').getBoundingClientRect(); return { border: a.borderTopColor, bg: a.backgroundColor, below: s.top >= g.bottom, left: Math.abs(s.left - g.left) < 120 }; });
  ok('...it looks like the Summary\u2019s panel (gold border, dark box) and opens under the gear', look.border === 'rgb(227, 192, 107)' && look.bg === 'rgb(14, 23, 48)' && look.below && look.left, look);
  // one part off: hidden, not drawn, and the others keep their place and size
  await tick(fr, 'table'); await p.waitForTimeout(200); P = await parts(fr); S = await panel(fr);
  ok('"Per account" unticked: the table is hidden at once, the rest stays, the panel stays open', P.table.off && !P.table.shown && P.live.shown && P.caps.shown && P.high.shown && S.open && S.rows.find(r => r.key === 'table').on === false, [P, S.open]);
  await fr.evaluate(() => { document.getElementById('tableWrap').innerHTML = 'MARK'; }); await p.s(1, { killsH: 12345, goldH: 777777 }); await p.waitForTimeout(1500);
  ok('...and it is not drawn while it is hidden (new numbers came, it was left as it was)', (await fr.evaluate(() => document.getElementById('tableWrap').innerHTML)) === 'MARK');
  await tick(fr, 'table'); await p.waitForTimeout(200); P = await parts(fr);
  ok('...ticked again: shown, and drawn at once with the new numbers', !P.table.off && P.table.shown && (await fr.evaluate(() => document.getElementById('tableWrap').innerHTML)) !== 'MARK' && (await fr.evaluate(() => document.getElementById('tableWrap').textContent.indexOf(fmt(12345)) >= 0)), [P.table, await fr.evaluate(() => [fmt(12345), document.getElementById('tableWrap').textContent.slice(0, 300)])]);
  await tick(fr, 'caps'); await p.waitForTimeout(200); P = await parts(fr);
  ok('"Latest captures" unticked: hidden, and "Today\u2019s highlights" next to it keeps its standard size (it does not grow)', P.caps.off && !P.caps.shown && P.high.shown && Math.abs(P.high.w - w0) <= 2, [P.high.w, w0]);
  // kept
  const saved = await fr.evaluate(() => JSON.parse(localStorage.getItem('4h.summary')));
  ok('the choice is kept with the Summary\u2019s other choices (so in Settings › Settings backup too): only "caps" is hidden', saved && saved.ovOff && saved.ovOff.caps === true && Object.keys(saved.ovOff).length === 1 && saved.hot === 10000, saved);
  await fr.click('#tableCard .h span'); await p.waitForTimeout(200);
  ok('a click outside closes the panel', !(await panel(fr)).open);
  await fr.evaluate(() => location.reload()); await p.waitForTimeout(1800); fr = p.dash(); P = await parts(fr);
  ok('after the Overview is loaded again (the app started again): "Latest captures" is still hidden, the rest shown', P.caps.off && !P.caps.shown && P.table.shown && P.live.shown && P.high.shown, P);
  // everything hidden
  await fr.click('#btnOvSettings'); await p.waitForTimeout(150);
  for (const k of ['today', 'live', 'table', 'eggs', 'high']) { await tick(fr, k); await p.waitForTimeout(80); }
  P = await parts(fr);
  ok('everything unticked: nothing of the Overview is left, and one line says how to get it back: "Everything is hidden: use the gear to show it again"', Object.keys(IDS).every(k => P[k].off && !P[k].shown) && P.empty === 'Everything is hidden: use the gear to show it again', P);
  await tick(fr, 'high'); await p.waitForTimeout(150); P = await parts(fr);
  ok('...one ticked again (Today\u2019s highlights): it shows, the line goes', P.high.shown && P.empty === null, P);
  await tick(fr, 'high'); await tick(fr, 'eggs'); await p.waitForTimeout(150); P = await parts(fr);
  const eggsUp = await fr.evaluate(() => !document.getElementById('eggCard').classList.contains('hidden'));
  ok('...only "Incubators" ticked: the line shows when no account is breeding (the card is not there), not when one is', eggsUp ? (P.eggs.shown && P.empty === null) : (P.empty !== null), [eggsUp, P]);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok('Escape closes the panel and gives the focus back to the gear', !(await panel(fr)).open && (await fr.evaluate(() => document.activeElement.id)) === 'btnOvSettings');
  // one panel of settings at a time
  await p.evaluate(() => { if (!ui.panel) document.getElementById('btnPanel').click(); }); await p.waitForTimeout(400); fr = p.dash();
  await fr.click('#btnOvSettings'); await p.waitForTimeout(150); await fr.click('#btnSumSettings'); await p.waitForTimeout(150);
  let both = await fr.evaluate(() => [!document.getElementById('ovSettings').classList.contains('hidden'), !document.getElementById('sumSettings').classList.contains('hidden')]);
  ok('opening the Summary\u2019s gear closes the Overview\u2019s panel (one at a time)', !both[0] && both[1], both);
  await fr.click('#btnOvSettings'); await p.waitForTimeout(150);
  both = await fr.evaluate(() => [!document.getElementById('ovSettings').classList.contains('hidden'), !document.getElementById('sumSettings').classList.contains('hidden')]);
  ok('...and the other way round', both[0] && !both[1], both);
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();
  // ---- lang-75: Today's highlights filter in the gear (six kinds, all ticked at first)
  ({ p, fr } = await setup(b));
  await fr.click('#btnOvSettings'); await p.waitForTimeout(150);
  const flt = async () => fr.evaluate(() => { const box = document.getElementById('ovSettings'); return { heads: Array.from(box.querySelectorAll('.ss-h')).map(h => h.textContent.trim()), rows: Array.from(box.querySelectorAll('input[data-ovtoday]')).map(i => ({ k: i.getAttribute('data-ovtoday'), on: i.checked, name: i.closest('.ss-row').querySelector('.nm').textContent })) }; });
  let F = await flt();
  ok('the gear has a second section "Today\u2019s highlights: show" with the six kinds, in order (shiny, catch, drop, egg, hunt, evo), all ticked', F.heads.join('|') === 'Show in the Overview|Today\u2019s highlights: show' && F.rows.map(r => r.k).join() === 'shiny,catch,drop,egg,hunt,evo' && F.rows.every(r => r.on), F);
  ok('...the labels match Notifications: "A shiny is captured", "Great catch", "Valuable drop", "Egg ready to hatch", "New hunt unlocks", "Evolved"', F.rows.map(r => r.name).join('|') === 'A shiny is captured|Great catch|Valuable drop|Egg ready to hatch|New hunt unlocks|Evolved', F.rows.map(r => r.name));
  // the Today's highlights list reads the filter
  await fr.evaluate(() => { today.items = [{ t: Date.now(), acc: 0, name: 'x', kind: 'shiny', p: { name: 'A', iv: 1, max: 192, rarity: 'Comum' } }, { t: Date.now(), acc: 0, name: 'x', kind: 'catch', p: { name: 'B', iv: 192, max: 192, quality: 2, rarity: 'Lend\u00e1ria' } }, { t: Date.now(), acc: 0, name: 'x', kind: 'egg', p: { name: 'C' } }]; drawToday(); });
  const before = await fr.evaluate(() => Array.from(document.querySelectorAll('#todayList .ev')).map(e => e.className.replace('ev ', '')).join());
  ok('with everything ticked all the kinds show in the list', before === 'shiny,catch,egg');
  await fr.click('#ovSettings input[data-ovtoday="catch"]'); await p.waitForTimeout(150);
  F = await flt(); const after = await fr.evaluate(() => Array.from(document.querySelectorAll('#todayList .ev')).map(e => e.className.replace('ev ', '')).join());
  ok('unticking "Great catch": the row disappears at once, the others stay, the choice is in storage (ovTodayOff.catch = true)', after === 'shiny,egg' && !F.rows.find(r => r.k === 'catch').on && (await fr.evaluate(() => JSON.parse(localStorage.getItem('4h.summary')).ovTodayOff.catch)) === true);
  await fr.click('#ovSettings input[data-ovtoday="catch"]'); await p.waitForTimeout(150);
  ok('...ticking it again brings the row back, the key is gone from storage', (await fr.evaluate(() => Array.from(document.querySelectorAll('#todayList .ev')).map(e => e.className.replace('ev ', '')).join())) === 'shiny,catch,egg' && (await fr.evaluate(() => JSON.parse(localStorage.getItem('4h.summary')).ovTodayOff.catch)) === undefined);
  // a kind that is unticked still counts; ticking shows it again (same stored events)
  await fr.click('#ovSettings input[data-ovtoday="shiny"]'); await fr.click('#ovSettings input[data-ovtoday="egg"]'); await p.waitForTimeout(150);
  ok('two kinds off: only "catch" shows', (await fr.evaluate(() => Array.from(document.querySelectorAll('#todayList .ev')).map(e => e.className.replace('ev ', '')).join())) === 'catch');
  await fr.evaluate(() => location.reload()); await p.waitForTimeout(1500); fr = p.dash();
  const F2 = await fr.evaluate(() => { const s = JSON.parse(localStorage.getItem('4h.summary')); return s.ovTodayOff; });
  ok('after a reload: the two kinds are still off (saved under ovTodayOff)', F2.shiny === true && F2.egg === true && !F2.catch);
  ok('no JavaScript errors (filter)', p.errors.length === 0, p.errors);
  await p.context().close();
  // the "Overview" button folds the whole Overview away and back; the gear's choices are what comes back
  ({ p, fr } = await setup(b));
  const btn = () => fr.evaluate(() => { const v = document.querySelector('#topTabs .vt'); return { on: v.classList.contains('on'), pressed: v.getAttribute('aria-pressed'), title: v.title }; });
  await fr.click('#btnOvSettings'); await tick(fr, 'caps'); await fr.click('#btnOvSettings'); await p.waitForTimeout(150);
  let B = await btn();
  ok('the "Overview" button is lit while the Overview shows, with a tooltip "Hide the Overview, or show it again"', B.on && B.pressed === 'true' && B.title === 'Hide the Overview, or show it again', B);
  await fr.click('#topTabs .vt'); await p.waitForTimeout(200); P = await parts(fr); B = await btn();
  ok('pressed: everything is folded away, the button goes dim, and one line: "Hidden: press Overview to show it again"', Object.keys(IDS).every(k => !P[k].shown) && !B.on && B.pressed === 'false' && P.empty === 'Hidden: press Overview to show it again', [P, B]);
  await fr.evaluate(() => { document.getElementById('tableWrap').innerHTML = 'MARK'; }); await p.s(1, { killsH: 23456 }); await p.waitForTimeout(1500);
  ok('...nothing of it is drawn while it is folded away', (await fr.evaluate(() => document.getElementById('tableWrap').innerHTML)) === 'MARK');
  await fr.click('#btnOvSettings'); await p.waitForTimeout(150); S = await panel(fr);
  ok('...the gear\u2019s choices are not touched (only "Latest captures" is unticked)', S.rows.filter(r => !r.on).map(r => r.key).join() === 'caps', S.rows);
  await fr.click('#btnOvSettings');
  const sv = await fr.evaluate(() => JSON.parse(localStorage.getItem('4h.summary')));
  ok('...and the fold is kept with the other choices', sv.ovFold === true && sv.ovOff.caps === true, sv);
  await fr.evaluate(() => location.reload()); await p.waitForTimeout(1800); fr = p.dash(); P = await parts(fr); B = await btn();
  ok('after the Overview is loaded again (the app started again): still folded away, the button dim', Object.keys(IDS).every(k => !P[k].shown) && !B.on && P.empty === 'Hidden: press Overview to show it again', [P, B]);
  await fr.click('#topTabs .vt'); await p.waitForTimeout(250); P = await parts(fr); B = await btn();
  ok('pressed again: back as the gear says (all but "Latest captures"), drawn at once, the button lit, no line', B.on && P.today.shown && P.live.shown && P.table.shown && P.high.shown && !P.caps.shown && P.empty === null && (await fr.evaluate(() => document.getElementById('tableWrap').innerHTML)) !== 'MARK', [P, B]);
  ok('no JavaScript errors (fold)', p.errors.length === 0, p.errors);
  await p.context().close();
  // a short window: the panel fits and scrolls inside the Overview
  ({ p, fr } = await setup(b, { w: 1300, h: 420 }));
  await fr.click('#btnOvSettings'); await p.waitForTimeout(150);
  const fit = await fr.evaluate(() => { const s = document.getElementById('ovSettings').getBoundingClientRect(), m = document.getElementById('mainCol').getBoundingClientRect(); return { top: Math.round(s.top), bottom: Math.round(s.bottom), mb: Math.round(m.bottom), vh: innerHeight }; });
  ok('in a short window (420 px) the panel stays inside the Overview', fit.bottom <= fit.mb + 1 && fit.bottom <= fit.vh, fit);
  await p.context().close();
  // Portuguese
  ({ p, fr } = await setup(b, { lang: 'pt-BR' }));
  await fr.click('#btnOvSettings'); await p.waitForTimeout(150); S = await panel(fr);
  const ttl = await fr.evaluate(() => document.getElementById('btnOvSettings').title);
  ok('in Portuguese: "Configurações da Visão geral", "Mostrar na Visão geral", the six parts', ttl === 'Configurações da Visão geral' && S.head === 'Mostrar na Visão geral' && S.rows.map(r => r.name).join('|') === 'Hoje (totais do dia)|Totais ao vivo (por hora)|Por conta|Incubadoras|Últimas capturas|Destaques de hoje' && /^Só a Visão geral usa estas escolhas/.test(S.note), [ttl, S]);
  for (const k of Object.keys(IDS)) { await tick(fr, k); await p.waitForTimeout(60); }
  P = await parts(fr);
  ok('...and "Está tudo escondido: use a engrenagem para mostrar de novo"', P.empty === 'Está tudo escondido: use a engrenagem para mostrar de novo', P.empty);
  await fr.click('#btnOvSettings'); await fr.click('#topTabs .vt'); await p.waitForTimeout(200); P = await parts(fr);
  ok('...folded away: "Escondida: clique em Visão geral para mostrar de novo", the tooltip "Esconder a Visão geral, ou mostrar de novo"', P.empty === 'Escondida: clique em Visão geral para mostrar de novo' && (await fr.evaluate(() => document.querySelector('#topTabs .vt').title)) === 'Esconder a Visão geral, ou mostrar de novo', P.empty);
  ok('no JavaScript errors (Portuguese)', p.errors.length === 0, p.errors);
  await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
