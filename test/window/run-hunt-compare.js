// run-hunt-compare.js: the comparison of the Summary of an account: its hunt is a button that opens a list (the previous hunt, then the 5 best hunts of the account, best first),
// ranked by $ (gold/h), XP (xp/h) or $+XP (both, each against the best hunt); each hunt is the time-weighted average of all its sessions, kept on this computer;
// hunts with less than 30 min are marked; the explanation shows when the pointer stays on the button
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };

// a hunt session as the game connection sends it (each new startedAt is a new session: the dashboard keeps the one that ends)
const sess = (p, n, sid, name, min, g, x, k) => p.s(n, { live: true, active: true, startedAt: sid, huntId: 'h' + sid, huntName: name, minutes: min, sessionTime: min + 'm 0s', goldH: g, xpH: x, killsH: k, defeated: min * 10 });
// past sessions of account 1, then the one that runs now (H). Hunts: A (two visits: 20 + 40 min), B, C, E (10 min only), F, G
const PAST = [[101, 'Hunt A', 20, 100000, 1000000, 500], [102, 'Hunt B', 40, 300000, 500000, 600], [103, 'Hunt C', 90, 200000, 2000000, 700], [104, 'Hunt A', 40, 160000, 1300000, 520],
  [105, 'Hunt E', 10, 900000, 100000, 300], [106, 'Hunt F', 45, 50000, 800000, 400], [107, 'Hunt G', 35, 120000, 880000, 450]];
async function feed(p) { for (const s of PAST) await sess(p, 1, ...s); await sess(p, 1, 108, 'Hunt H', 5, 250000, 1500000, 610); await p.waitForTimeout(1400); }

const D = p => p.dash();
const view = p => D(p).evaluate(() => {
  const btn = document.getElementById('cmpBtn'), sec = btn && btn.closest('.sec');
  const menu = document.getElementById('cmpMenu'), side = document.getElementById('side').getBoundingClientRect(), mr = menu.getBoundingClientRect(), br = btn ? btn.getBoundingClientRect() : null;
  const items = Array.from(menu.querySelectorAll('.cm-item')).map(e => ({ cmp: e.getAttribute('data-cmp'), rk: e.querySelector('.rk').textContent, nm: e.querySelector('.nm').textContent, val: e.querySelector('.val').textContent, sub: e.querySelector('.sub').textContent, sel: e.classList.contains('sel'), thin: e.classList.contains('thin'), title: e.title }));
  return { has: !!btn, title: sec ? sec.querySelector('.sec-h').textContent : '', btn: btn ? btn.textContent.replace(/\s+/g, ' ').trim() : '', expanded: btn ? btn.getAttribute('aria-expanded') : null, thinBtn: btn ? btn.classList.contains('thin') : null,
    head: sec ? Array.from(sec.querySelectorAll('th')).map(x => x.textContent) : [], rows: sec ? Array.from(sec.querySelectorAll('tbody tr')).map(tr => Array.from(tr.children).map(td => td.textContent.trim())) : [],
    open: !menu.classList.contains('hidden'), items: items, best: items.filter(i => i.cmp !== 'prev').map(i => i.nm), modes: Array.from(menu.querySelectorAll('[data-rank]')).map(b => b.textContent + (b.classList.contains('on') ? '*' : '')),
    heads: Array.from(menu.querySelectorAll('.cm-h')).map(h => h.textContent), note: (menu.querySelector('.cm-note') || {}).textContent || '', empty: (menu.querySelector('.cm-empty') || {}).textContent || '',
    menuBox: { top: Math.round(mr.top), bottom: Math.round(mr.bottom), left: Math.round(mr.left), right: Math.round(mr.right) }, sideBox: { top: Math.round(side.top), bottom: Math.round(side.bottom), left: Math.round(side.left), right: Math.round(side.right) },
    btnBox: br ? { top: Math.round(br.top), bottom: Math.round(br.bottom), left: Math.round(br.left), right: Math.round(br.right) } : null, menuScroll: menu.scrollHeight > menu.clientHeight + 1, saved: localStorage.getItem('4h.summary') };
});
const tip = p => D(p).evaluate(() => { const t = document.getElementById('cmpTip'), r = t.getBoundingClientRect(), b = document.getElementById('cmpBtn'), br = b ? b.getBoundingClientRect() : null;
  return { shown: !t.classList.contains('hidden'), text: t.textContent, l: r.left, t: r.top, r: r.right, b: r.bottom, W: innerWidth, H: innerHeight, overBtn: !!br && !(r.bottom <= br.top || r.top >= br.bottom || r.right <= br.left || r.left >= br.right), title: b ? b.getAttribute('title') : 'no button', described: b ? b.getAttribute('aria-describedby') : null }; });
// where the dashboard frame is in the window, so that the real mouse can be used
const frameOff = p => p.evaluate(() => { const r = document.getElementById('dash').getBoundingClientRect(); return { x: r.left, y: r.top }; });
async function mouseTo(p, sel, dx, dy) {
  const o = await frameOff(p), r = await D(p).evaluate(s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
  if (!r) return false; await p.mouse.move(o.x + r.x + (dx || 0), o.y + r.y + (dy || 0)); await p.mouse.move(o.x + r.x + (dx || 0) + 1, o.y + r.y + (dy || 0) + 1); return true;
}
async function clickAt(p, sel) { if (!(await mouseTo(p, sel))) return false; await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(200); return true; }
const pickTab = async (p, t) => { await D(p).evaluate(t => document.querySelector('#tabs [data-tab="' + t + '"]').click(), String(t)); await p.waitForTimeout(200); };

(async () => {
  const b = await chromium.launch();
  let p = await open(b, { w: 1700, h: 1000 });
  await p.evaluate(() => { if (!ui.panel) document.getElementById('btnPanel').click(); }); await p.waitForTimeout(300);
  await sess(p, 1, 100, 'Hunt Z', 1, 1, 1, 1); await p.waitForTimeout(1300); await pickTab(p, 0);
  let v = await view(p);
  ok('a first session (no hunt before it): no comparison, as before', !v.has && !v.open, v);
  await feed(p);
  v = await view(p);
  // ---- the button
  ok('after some hunts: the comparison shows the previous hunt (G, 35 min) as before: same title, "PREVIOUS", the hunt and its time are now a button', v.has && v.title === 'Comparison (previous hunt)' && v.btn === 'Hunt G · 35 min' && v.head.join('|') === '|PREVIOUS|CURRENT' && v.expanded === 'false' && !v.open, v);
  ok('...its numbers are the previous hunt\u2019s against the current one (+120K / 880K / 450 vs +250K / 1.5M / 610)', JSON.stringify(v.rows) === JSON.stringify([['Gold/h', '+120K', '+250K ▲'], ['XP/h', '880K', '1.5M ▲'], ['Kills/h', '450', '610 ▲']]), v.rows);
  ok('a session shorter than 2 minutes (Z, 1 min) is not kept', !(await D(p).evaluate(() => JSON.stringify(huntLog.acc[1]))).includes('Hunt Z'));
  // ---- the hover explanation
  await p.mouse.move(5, 5); await mouseTo(p, '#cmpBtn'); await p.waitForTimeout(150);
  ok('the explanation does not show at once (the pointer must stay a moment)', !(await tip(p)).shown);
  await p.waitForTimeout(600);
  let T = await tip(p);
  ok('...then it shows: what it compares, the three ways of ranking, that each hunt is an average of its time, and the suggested minimum (30 minutes, 1 hour is best, less is marked)',
    T.shown && /previous hunt, or one of the 5 best hunts/.test(T.text) && /\$ gold per hour, XP XP per hour, \$\+XP both together/.test(T.text) && /average of all the time/.test(T.text) && /at least 30 minutes on a hunt/.test(T.text) && /1 hour or more is best/.test(T.text) && /marked ○/.test(T.text), T.text);
  ok('...inside the window, not over the button, and the button has no browser tooltip of its own (it would show twice); screen readers get it (aria-describedby)', T.l >= 0 && T.t >= 0 && T.r <= T.W && T.b <= T.H && !T.overBtn && T.title === null && T.described === 'cmpTip', T);
  await sess(p, 1, 108, 'Hunt H', 6, 250000, 1500000, 610); await p.waitForTimeout(1400);
  T = await tip(p);
  ok('...it stays while the Summary is drawn again with new numbers (the pointer has not moved)', T.shown && !T.overBtn, T);
  await p.mouse.move(5, 5); await p.waitForTimeout(150);
  ok('...and it goes when the pointer leaves the button', !(await tip(p)).shown);
  // ---- the list: $ first
  await clickAt(p, '#cmpBtn');
  v = await view(p);
  ok('a click opens the list: "Rank by" $ / XP / $+XP ($ chosen at first), the previous hunt, then the 5 best by gold per hour', v.open && v.expanded === 'true' && v.modes.join() === '$*,XP,$+XP' && v.heads.join('|') === 'Rank by|Previous hunt|Best 5 by gold per hour', v);
  ok('...the previous hunt (G) is marked as the one shown', v.items[0].cmp === 'prev' && v.items[0].nm === 'Hunt G' && v.items[0].sel && v.items.filter(i => i.sel).length === 1, v.items);
  ok('...best 5 by $/h, best first: E (900K), B (300K), C (200K), A (140K: 20 min at 100K and 40 min at 160K, weighted by time), G (120K); F (50K) is 6th, not shown', v.best.join() === 'Hunt E,Hunt B,Hunt C,Hunt A,Hunt G' && v.items[1].val === '+900K/h' && v.items[4].val === '+140K/h' && v.items.slice(1).map(i => i.rk).join() === '#1,#2,#3,#4,#5', v.items);
  ok('...each with its time and visits: A "1h 00m · 2 visits", B "40 min · 1 visit"', v.items[4].sub === '1h 00m · 2 visits' && v.items[2].sub === '40 min · 1 visit', v.items.map(i => i.sub));
  ok('...the hunt running now (H) is not in the list', v.items.every(i => i.nm !== 'Hunt H'));
  ok('...a hunt under 30 min (E, 10 min) is marked ○, says why on hover, and the note under the list explains the mark; the others are not marked', v.items[1].thin && /○/.test(v.items[1].sub) && /Only 10 min on this hunt so far: spend at least 30 min there/.test(v.items[1].title) && v.items.slice(2).every(i => !i.thin && !i.title) && /Under 30 min on this hunt: the average can still change a lot\./.test(v.note), v);
  ok('...the list is inside the Summary panel and does not cover the button', v.menuBox.left >= v.sideBox.left && v.menuBox.right <= v.sideBox.right && v.menuBox.top >= v.sideBox.top && v.menuBox.bottom <= v.sideBox.bottom && (v.menuBox.top >= v.btnBox.bottom || v.menuBox.bottom <= v.btnBox.top), [v.menuBox, v.sideBox, v.btnBox]);
  await mouseTo(p, '#cmpBtn'); await p.waitForTimeout(800);
  ok('...while the list is open the explanation does not show', !(await tip(p)).shown);
  await sess(p, 1, 108, 'Hunt H', 7, 250000, 1500000, 610); await p.waitForTimeout(1400);
  v = await view(p);
  ok('...and the list stays open while the Summary is drawn again', v.open && v.expanded === 'true', v);
  // ---- XP, then $+XP
  await clickAt(p, '#cmpMenu [data-rank="xp"]'); v = await view(p);
  ok('XP: the list stays open and is ranked by XP per hour: C (2M), A (1.2M), G (880K), F (800K), B (500K)', v.open && v.modes.join() === '$,XP*,$+XP' && v.heads[2] === 'Best 5 by XP per hour' && v.best.join() === 'Hunt C,Hunt A,Hunt G,Hunt F,Hunt B' && v.items[1].val === '2M XP/h', v);
  ok('...no hunt under 30 min in the 5: no note', !v.note, v.note);
  ok('...the choice is saved with the other choices of the Summary (and they are kept)', JSON.parse(v.saved).rank === 'xp' && JSON.parse(v.saved).hot === 10000 && JSON.parse(v.saved).best === 'iv', v.saved);
  await clickAt(p, '#cmpMenu [data-rank="both"]'); v = await view(p);
  ok('$+XP: each against the best of the account, added: C (0.22+1), E (1+0.05), A (0.16+0.6), B (0.33+0.25), G (0.13+0.44)', v.heads[2] === 'Best 5 by gold and XP together' && v.best.join() === 'Hunt C,Hunt E,Hunt A,Hunt B,Hunt G' && v.items[1].val === '+200K · 2M XP', v);
  // ---- choosing a hunt
  await clickAt(p, '#cmpMenu .cm-item[data-cmp="Hunt A"]'); v = await view(p);
  ok('choosing #3 (A): the list closes, the title says best hunts, the button "#3 Hunt A · 1h 00m", the column "AVERAGE"', !v.open && v.expanded === 'false' && v.title === 'Comparison (best hunts)' && v.btn === '#3 Hunt A · 1h 00m' && v.head.join('|') === '|AVERAGE|CURRENT', v);
  ok('...its numbers are A\u2019s averages (+140K, 1.2M, 513) against the current hunt', JSON.stringify(v.rows) === JSON.stringify([['Gold/h', '+140K', '+250K ▲'], ['XP/h', '1.2M', '1.5M ▲'], ['Kills/h', '513', '610 ▲']]), v.rows);
  await sess(p, 1, 108, 'Hunt H', 8, 130000, 1000000, 500); await p.waitForTimeout(1400); v = await view(p);
  ok('...it stays chosen when new numbers come (and the arrows follow them)', v.btn === '#3 Hunt A · 1h 00m' && JSON.stringify(v.rows) === JSON.stringify([['Gold/h', '+140K', '+130K ▼'], ['XP/h', '1.2M', '1M ▼'], ['Kills/h', '513', '500 ▼']]), v.rows);
  await clickAt(p, '#cmpBtn'); await clickAt(p, '#cmpMenu [data-rank="gold"]'); v = await view(p);
  ok('...changing the ranking keeps the hunt chosen, with its new place (A is #4 by $)', v.open && v.btn === '#4 Hunt A · 1h 00m' && v.items.find(i => i.nm === 'Hunt A' && i.cmp !== 'prev').sel, v);
  await clickAt(p, '#cmpMenu .cm-item[data-cmp="Hunt E"]'); v = await view(p);
  ok('choosing a hunt under 30 min (E): the button carries the mark ○', v.btn === '#1 Hunt E · 10 min ○' && v.thinBtn, v.btn);
  await clickAt(p, '#cmpBtn'); await clickAt(p, '#cmpMenu .cm-item[data-cmp="prev"]'); v = await view(p);
  ok('choosing "Previous hunt" goes back to the previous hunt (as before)', !v.open && v.title === 'Comparison (previous hunt)' && v.btn === 'Hunt G · 35 min' && v.head[1] === 'PREVIOUS', v);
  // ---- closing
  await clickAt(p, '#cmpBtn'); await p.keyboard.press('Escape'); await p.waitForTimeout(150); v = await view(p);
  ok('Escape closes the list', !v.open && v.expanded === 'false');
  await clickAt(p, '#cmpBtn'); await clickAt(p, '#kpis'); v = await view(p);
  ok('a click anywhere else closes it', !v.open);
  await clickAt(p, '#cmpBtn'); await clickAt(p, '#cmpBtn'); v = await view(p);
  ok('a second click on the button closes it', !v.open);
  await mouseTo(p, '#cmpBtn', 3, 0); await p.waitForTimeout(900);
  ok('...and the explanation does not pop up while the pointer is still on the button that was just pressed', !(await tip(p)).shown);
  await p.mouse.move(5, 5); await mouseTo(p, '#cmpBtn'); await p.waitForTimeout(900);
  ok('...once the pointer has left and come back, it shows again', (await tip(p)).shown);
  await p.mouse.move(5, 5);
  await clickAt(p, '#cmpBtn'); await pickTab(p, 'sum'); v = await view(p);
  ok('choosing another tab of the Summary closes it (no list left floating)', !v.open && !v.has, v);
  await pickTab(p, 0);
  // ---- the keyboard
  await D(p).evaluate(() => document.getElementById('cmpBtn').focus()); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  let f = await D(p).evaluate(() => [!document.getElementById('cmpMenu').classList.contains('hidden'), document.activeElement.getAttribute('data-cmp')]);
  ok('keyboard: Enter on the button opens the list and puts the focus on the hunt shown (the previous hunt)', f[0] && f[1] === 'prev', f);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(100);
  f = await D(p).evaluate(() => document.activeElement.getAttribute('data-cmp'));
  ok('...arrow down moves through the list (#2, B)', f === 'Hunt B', f);
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  f = await D(p).evaluate(() => [document.getElementById('cmpMenu').classList.contains('hidden'), document.activeElement.id, document.getElementById('cmpBtn').textContent]);
  ok('...Enter chooses it, closes the list and gives the focus back to the button', f[0] && f[1] === 'cmpBtn' && /#2 Hunt B/.test(f[2]), f);
  await p.waitForTimeout(1300);
  ok('...the focus stays on the button when the Summary is drawn again', await D(p).evaluate(() => document.activeElement.id === 'cmpBtn'));
  // ---- the session that ends is kept; "here now"
  await sess(p, 1, 109, 'Hunt A', 3, 10, 10, 10); await p.waitForTimeout(1400);
  await clickAt(p, '#cmpBtn'); v = await view(p);
  ok('when the hunt H ends (a new session starts) it is kept with its last numbers and shows in the list (#5 by $, 130K, just under A; marked: 8 min) and is now the previous hunt', v.items.some(i => i.nm === 'Hunt H' && i.val === '+130K/h' && i.rk === '#5' && i.thin) && v.items[0].nm === 'Hunt H' && v.items[0].sub === '8 min', v.items);
  ok('...a hunt that is also the one running now says so ("here now": A)', v.items.filter(i => /here now/.test(i.sub)).map(i => i.nm).join() === 'Hunt A', v.items.map(i => i.sub));
  await p.keyboard.press('Escape');
  // ---- kept on this computer
  const before = await view(p);
  await D(p).evaluate(() => location.reload()); await p.waitForTimeout(2000); await pickTab(p, 0); await p.waitForTimeout(300);
  v = await view(p);
  ok('after the Summary is loaded again (the app started again): the previous hunt comes from what was kept (H), the choice of B is gone (the previous hunt is shown), the ranking choice stays ($)', v.has && v.btn === 'Hunt H · 8 min' && v.title === 'Comparison (previous hunt)', [v.btn, before.btn]);
  await clickAt(p, '#cmpBtn'); v = await view(p);
  ok('...and the same list as before', v.best.join() === before.best.join() || v.best.join() === 'Hunt E,Hunt B,Hunt H,Hunt C,Hunt A', [v.best, before.best]);
  await p.keyboard.press('Escape');
  const st = await D(p).evaluate(() => { const o = JSON.parse(localStorage.getItem('4h.hunts')); return { v: o.v, n1: Object.keys(o.acc[1]).length, n2: Object.keys(o.acc[2] || {}).length, names: Object.values(o.acc[1]).map(e => e.h) }; });
  ok('what is kept: one entry per session of account 1 (9: the 7 before H, H, and the one running; Z had 1 min), none for the others, only names and numbers', st.v === 1 && st.n1 === 9 && st.n2 === 0 && st.names.indexOf('Hunt H') >= 0, st);
  // ---- the running session is kept while it runs (closing the app does not lose it), and is saved at most every 20 s
  ok('the session that runs is in the saved list (A, 3 min) but not in the comparison (it is "current")', await D(p).evaluate(() => { const o = JSON.parse(localStorage.getItem('4h.hunts')); return Object.keys(o.acc[1]).indexOf('s109') >= 0 && huntStats(accounts[0]).find(s => s.name === 'Hunt A').visits === 2; }));
  // ---- data that make no sense
  for (const bad of ['not json', '{"acc":{"1":{"x":{"h":"Q","m":"9","g":1,"x":1,"k":1,"q":1},"y":{"h":"","m":9,"g":1,"x":1,"k":1,"q":2},"z":{"h":"R","m":1,"g":1,"x":1,"k":1,"q":3},"w":{"h":"S","m":9,"g":1,"x":1,"k":1,"q":4}}}}', '{"acc":5}', 'null']) {
    await D(p).evaluate(v => localStorage.setItem('4h.hunts', v), bad);
    await D(p).evaluate(() => location.reload()); await p.waitForTimeout(1600);
    const r = await D(p).evaluate(() => Object.values(huntLog.acc[1]).map(e => e.h).join());
    ok('saved hunts that make no sense (' + bad.slice(0, 40) + ') are left out, the good ones kept, and nothing breaks', (bad.indexOf('"w"') >= 0 ? /^S(,Hunt A)?$/.test(r) : /^(Hunt A)?$/.test(r)) && p.errors.length === 0, [r, p.errors]);
  }
  // ---- at most 200 sessions per account: the oldest go
  await D(p).evaluate(() => { const box = {}; for (let i = 1; i <= 230; i++) box['s' + (5000 + i)] = { h: 'Old ' + (i % 7), m: 30, g: i, x: i, k: i, q: i }; localStorage.setItem('4h.hunts', JSON.stringify({ v: 1, acc: { 1: box } })); location.reload(); });
  await p.waitForTimeout(1600); await sess(p, 1, 6000, 'Hunt N', 9, 1, 1, 1); await p.waitForTimeout(1400);
  const cap = await D(p).evaluate(() => { const box = huntLog.acc[1], qs = Object.keys(box).map(k => box[k].q).sort((a, b) => a - b); return { n: qs.length, min: qs[0], hasNew: Object.keys(box).indexOf('s6000') >= 0 }; });
  ok('at most 200 sessions are kept per account: the oldest are dropped, the newest stays', cap.n === 200 && cap.min > 30 && cap.hasNew, cap);
  // ---- the Diagnostics data
  const dd = await D(p).evaluate(() => diagData().huntLog);
  ok('the Diagnostics data: sessions and hunts of each account, the ranking, no save error (counts only, no hunt names, no gold): 200 sessions, 9 hunts (7 old ones, the running A sent again by the window, N)', dd.accounts[0].sessions === 200 && dd.accounts[0].hunts === 9 && dd.accounts[1].sessions === 0 && dd.rank === 'gold' && dd.saveError === false && !/Old|Hunt|\$/.test(JSON.stringify(dd)), dd);
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();

  // ---- a short window: the list fits in the Summary and scrolls
  p = await open(b, { w: 1300, h: 560 });
  await p.evaluate(() => { if (!ui.panel) document.getElementById('btnPanel').click(); }); await p.waitForTimeout(300);
  await feed(p); await pickTab(p, 0);
  await D(p).evaluate(() => { const e = document.getElementById('cmpBtn'); if (e) e.scrollIntoView({ block: 'end' }); }); await p.waitForTimeout(200);
  await clickAt(p, '#cmpBtn'); v = await view(p);
  ok('short window (560 px): the list opens where there is room, stays inside the Summary panel and scrolls if needed, without covering the button', v.open && v.menuBox.top >= v.sideBox.top && v.menuBox.bottom <= v.sideBox.bottom && (v.menuBox.top >= v.btnBox.bottom || v.menuBox.bottom <= v.btnBox.top), v);
  ok('no JavaScript errors (short window)', p.errors.length === 0, p.errors);
  await p.context().close();

  // ---- Portuguese
  p = await open(b, { lang: 'pt-BR', w: 1700, h: 1000 });
  await p.evaluate(() => { if (!ui.panel) document.getElementById('btnPanel').click(); }); await p.waitForTimeout(300);
  await feed(p); await pickTab(p, 0);
  await mouseTo(p, '#cmpBtn'); await p.waitForTimeout(800); T = await tip(p);
  ok('in Portuguese: the explanation ("Escolha com o que esta hunt é comparada ... pelo menos 30 minutos ... 1 hora ou mais é o ideal")', T.shown && /^Escolha com o que esta hunt é comparada/.test(T.text) && /pelo menos 30 minutos numa hunt/.test(T.text) && /1 hora ou mais é o ideal/.test(T.text), T.text);
  await clickAt(p, '#cmpBtn'); v = await view(p);
  ok('...and the list: "Ordenar por", "Hunt anterior", "5 melhores por gold por hora", "1h 00m · 2 visitas", the note', v.heads.join('|') === 'Ordenar por|Hunt anterior|5 melhores por gold por hora' && v.items[4].sub === '1h 00m · 2 visitas' && /^○ Menos de 30 min nesta hunt/.test(v.note), v);
  await clickAt(p, '#cmpMenu .cm-item[data-cmp="Hunt A"]'); v = await view(p);
  ok('...the title and the column: "Comparação (melhores hunts)", "MÉDIA"', v.title === 'Comparação (melhores hunts)' && v.head[1] === 'MÉDIA', v);
  ok('no JavaScript errors (Portuguese)', p.errors.length === 0, p.errors);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
