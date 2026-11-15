// run-hunt-compare.js: the comparison of the Summary of an account: its hunt is a button that opens a list with two views (lang-72): "Last 5" (the last visits of the
// account, newest first, each with its own numbers; the first is the previous hunt, shown at first) and "Best 5" (each hunt the time-weighted average of all its sessions,
// ranked by $ (gold/h), XP (xp/h) or $+XP (both, each against the best hunt)); kept on this computer; hunts with less than 30 min are marked; a hunt done in a party
// says so and is kept apart from the same hunt done alone; the explanation shows when the pointer stays on the button
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 900))); c ? pass++ : fail++; };

// a hunt session as the game connection sends it (each new startedAt is a new session: the dashboard keeps the one that ends)
const sess = (p, n, sid, name, min, g, x, k, party) => p.s(n, { live: true, active: true, startedAt: sid, huntId: 'h' + sid, huntName: name, minutes: min, sessionTime: min + 'm 0s', goldH: g, xpH: x, killsH: k, defeated: min * 10, partySize: party || 1 });
// past sessions of account 1, then the one that runs now (H). Hunts: A (two visits: 20 + 40 min), B, C, E (10 min only), F, G
const PAST = [[101, 'Hunt A', 20, 100000, 1000000, 500], [102, 'Hunt B', 40, 300000, 500000, 600], [103, 'Hunt C', 90, 200000, 2000000, 700], [104, 'Hunt A', 40, 160000, 1300000, 520],
  [105, 'Hunt E', 10, 900000, 100000, 300], [106, 'Hunt F', 45, 50000, 800000, 400], [107, 'Hunt G', 35, 120000, 880000, 450]];
async function feed(p) { for (const s of PAST) await sess(p, 1, ...s); await sess(p, 1, 108, 'Hunt H', 5, 250000, 1500000, 610); await p.waitForTimeout(1400); }

const D = p => p.dash();
const view = p => D(p).evaluate(() => {
  const btn = document.getElementById('cmpBtn'), sec = btn && btn.closest('.sec');
  const menu = document.getElementById('cmpMenu'), side = document.getElementById('side').getBoundingClientRect(), mr = menu.getBoundingClientRect(), br = btn ? btn.getBoundingClientRect() : null;
  const items = Array.from(menu.querySelectorAll('.cm-item')).map(e => ({ kind: e.getAttribute('data-kind'), cmp: e.getAttribute('data-cmp'), rk: e.querySelector('.rk').textContent, nm: e.querySelector('.nm').textContent, val: e.querySelector('.val').textContent, sub: e.querySelector('.sub').textContent, sel: e.classList.contains('sel'), thin: e.classList.contains('thin'), title: e.title }));
  return { has: !!btn, title: sec ? sec.querySelector('.sec-h').textContent : '', btn: btn ? btn.textContent.replace(/\s+/g, ' ').trim() : '', expanded: btn ? btn.getAttribute('aria-expanded') : null, thinBtn: btn ? btn.classList.contains('thin') : null,
    head: sec ? Array.from(sec.querySelectorAll('th')).map(x => x.textContent) : [], rows: sec ? Array.from(sec.querySelectorAll('tbody tr')).map(tr => Array.from(tr.children).map(td => td.textContent.trim())) : [],
    open: !menu.classList.contains('hidden'), items: items, names: items.map(i => i.nm), modes: Array.from(menu.querySelectorAll('[data-rank]')).map(b => b.textContent + (b.classList.contains('on') ? '*' : '')),
    views: Array.from(menu.querySelectorAll('[data-cmpview]')).map(b => b.textContent + (b.classList.contains('on') ? '*' : '')),
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
// a hunt of the list, by its name (the first one with that name)
async function clickItem(p, name) {
  const o = await frameOff(p), r = await D(p).evaluate(nm => { const e = Array.from(document.querySelectorAll('#cmpMenu .cm-item')).find(x => x.querySelector('.nm').textContent === nm); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, name);
  if (!r) return false; await p.mouse.move(o.x + r.x, o.y + r.y); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(200); return true;
}
const pickTab = async (p, t) => { await D(p).evaluate(t => document.querySelector('#tabs [data-tab="' + t + '"]').click(), String(t)); await p.waitForTimeout(200); };
const panelOn = p => p.evaluate(() => { if (!ui.panel) document.getElementById('btnPanel').click(); });

(async () => {
  const b = await chromium.launch();
  let p = await open(b, { w: 1700, h: 1000 });
  await panelOn(p); await p.waitForTimeout(300);
  await sess(p, 1, 100, 'Hunt Z', 1, 1, 1, 1); await p.waitForTimeout(1300); await pickTab(p, 0);
  let v = await view(p);
  ok('a first session (no hunt before it): no comparison, as before', !v.has && !v.open, v);
  await feed(p);
  v = await view(p);
  // ---- the button
  ok('after some hunts: the comparison shows the previous hunt (G, 35 min): "Comparison (last hunts)", "PREVIOUS", the button "1 Hunt G · 35 min"', v.has && v.title === 'Comparison (last hunts)' && v.btn === '1 Hunt G · 35 min' && v.head.join('|') === '|PREVIOUS|CURRENT' && v.expanded === 'false' && !v.open, v);
  ok('...its numbers are the previous hunt\u2019s against the current one (+120K / 880K / 450 vs +250K / 1.5M / 610)', JSON.stringify(v.rows) === JSON.stringify([['Gold/h', '+120K', '+250K ▲'], ['XP/h', '880K', '1.5M ▲'], ['Kills/h', '450', '610 ▲']]), v.rows);
  ok('a session shorter than 2 minutes (Z, 1 min) is not kept', !(await D(p).evaluate(() => JSON.stringify(huntLog.acc[1]))).includes('Hunt Z'));
  // ---- the hover explanation
  await p.mouse.move(5, 5); await mouseTo(p, '#cmpBtn'); await p.waitForTimeout(150);
  ok('the explanation does not show at once (the pointer must stay a moment)', !(await tip(p)).shown);
  await p.waitForTimeout(600);
  let T = await tip(p);
  ok('...then it shows: the last 5 or the best 5, the three ways of ranking, own numbers vs the average of all its time, the party, and the suggested minimum (30 minutes, 1 hour is best, less is marked)',
    T.shown && /one of the last 5 hunts of this account \(newest first\), or one of its 5 best hunts \(best first\)/.test(T.text) && /\$ gold per hour, XP XP per hour, \$\+XP both together/.test(T.text) && /each visit has its own numbers; in the best 5 each hunt is the average of all the time/.test(T.text) && /done in a party is marked, and is kept apart from the same hunt done alone/.test(T.text) && /at least 30 minutes on a hunt/.test(T.text) && /1 hour or more is best/.test(T.text) && /marked ○/.test(T.text), T.text);
  ok('...inside the window, not over the button, and the button has no browser tooltip of its own (it would show twice); screen readers get it (aria-describedby)', T.l >= 0 && T.t >= 0 && T.r <= T.W && T.b <= T.H && !T.overBtn && T.title === null && T.described === 'cmpTip', T);
  await sess(p, 1, 108, 'Hunt H', 6, 250000, 1500000, 610); await p.waitForTimeout(1400);
  T = await tip(p);
  ok('...it stays while the Summary is drawn again with new numbers (the pointer has not moved)', T.shown && !T.overBtn, T);
  await p.mouse.move(5, 5); await p.waitForTimeout(150);
  ok('...and it goes when the pointer leaves the button', !(await tip(p)).shown);
  // ---- the list: Last 5 first
  await clickAt(p, '#cmpBtn');
  v = await view(p);
  ok('a click opens the list: the switch "Last 5" / "Best 5" (Last 5 at first), then "Last 5 hunts, newest first"; no "Rank by" here (it is for the best 5)', v.open && v.expanded === 'true' && v.views.join() === 'Last 5*,Best 5' && v.heads.join('|') === 'Last 5 hunts, newest first' && v.modes.length === 0, v);
  ok('...the last 5 visits, newest first: G, F, E, A, C (1 to 5); B and the first visit of A are older; the hunt running now (H) is not there', v.names.join() === 'Hunt G,Hunt F,Hunt E,Hunt A,Hunt C' && v.items.map(i => i.rk).join() === '1,2,3,4,5' && v.items.every(i => i.kind === 'last'), v.items);
  ok('...each with its OWN numbers (A: +160K and 1.3M of its last visit, not the average of its two visits), gold and XP', v.items[3].val === '+160K · 1.3M XP' && v.items[0].val === '+120K · 880K XP', v.items.map(i => i.val));
  ok('...the first one says "previous hunt" and is marked as the one shown; the others their time ("40 min")', v.items[0].sub === '35 min · previous hunt' && v.items[0].sel && v.items.filter(i => i.sel).length === 1 && v.items[3].sub === '40 min', v.items.map(i => i.sub));
  ok('...a visit under 30 min (E, 10 min) is marked ○, says why on hover, and the note under the list explains the mark', v.items[2].thin && /○/.test(v.items[2].sub) && /Only 10 min on this hunt so far/.test(v.items[2].title) && /Under 30 min on this hunt: the average can still change a lot\./.test(v.note), v);
  ok('...the list is inside the Summary panel and does not cover the button', v.menuBox.left >= v.sideBox.left && v.menuBox.right <= v.sideBox.right && v.menuBox.top >= v.sideBox.top && v.menuBox.bottom <= v.sideBox.bottom && (v.menuBox.top >= v.btnBox.bottom || v.menuBox.bottom <= v.btnBox.top), [v.menuBox, v.sideBox, v.btnBox]);
  // ---- Best 5: $ first
  await clickAt(p, '#cmpMenu [data-cmpview="best"]'); v = await view(p);
  ok('"Best 5": the list stays open, "Rank by" $ / XP / $+XP ($ chosen at first), then the 5 best by gold per hour', v.open && v.views.join() === 'Last 5,Best 5*' && v.modes.join() === '$*,XP,$+XP' && v.heads.join('|') === 'Rank by|Best 5 by gold per hour', v);
  ok('...best 5 by $/h, best first: E (900K), B (300K), C (200K), A (140K: 20 min at 100K and 40 min at 160K, weighted by time), G (120K); F (50K) is 6th, not shown', v.names.join() === 'Hunt E,Hunt B,Hunt C,Hunt A,Hunt G' && v.items[0].val === '+900K/h' && v.items[3].val === '+140K/h' && v.items.map(i => i.rk).join() === '#1,#2,#3,#4,#5' && v.items.every(i => i.kind === 'best'), v.items);
  ok('...each with its time and visits: A "1h 00m · 2 visits", B "40 min · 1 visit"', v.items[3].sub === '1h 00m · 2 visits' && v.items[1].sub === '40 min · 1 visit', v.items.map(i => i.sub));
  ok('...the previous hunt is shown, so no hunt of the best 5 is marked as chosen; the hunt running now (H) is not in the list', v.items.every(i => !i.sel) && v.items.every(i => i.nm !== 'Hunt H'), v.items);
  ok('...the switch is saved with the other choices of the Summary', JSON.parse(v.saved).cmpView === 'best', v.saved);
  await mouseTo(p, '#cmpBtn'); await p.waitForTimeout(800);
  ok('...while the list is open the explanation does not show', !(await tip(p)).shown);
  await sess(p, 1, 108, 'Hunt H', 7, 250000, 1500000, 610); await p.waitForTimeout(1400);
  v = await view(p);
  ok('...and the list stays open while the Summary is drawn again', v.open && v.expanded === 'true', v);
  // ---- XP, then $+XP
  await clickAt(p, '#cmpMenu [data-rank="xp"]'); v = await view(p);
  ok('XP: the list stays open and is ranked by XP per hour: C (2M), A (1.2M), G (880K), F (800K), B (500K)', v.open && v.modes.join() === '$,XP*,$+XP' && v.heads[1] === 'Best 5 by XP per hour' && v.names.join() === 'Hunt C,Hunt A,Hunt G,Hunt F,Hunt B' && v.items[0].val === '2M XP/h', v);
  ok('...no hunt under 30 min in the 5: no note', !v.note, v.note);
  ok('...the choice is saved with the other choices of the Summary (and they are kept)', JSON.parse(v.saved).rank === 'xp' && JSON.parse(v.saved).hot === 10000 && JSON.parse(v.saved).best === 'iv', v.saved);
  await clickAt(p, '#cmpMenu [data-rank="both"]'); v = await view(p);
  ok('$+XP: each against the best of the account, added: C (0.22+1), E (1+0.05), A (0.16+0.6), B (0.33+0.25), G (0.13+0.44)', v.heads[1] === 'Best 5 by gold and XP together' && v.names.join() === 'Hunt C,Hunt E,Hunt A,Hunt B,Hunt G' && v.items[0].val === '+200K · 2M XP', v);
  // ---- choosing a hunt
  await clickItem(p, 'Hunt A'); v = await view(p);
  ok('choosing #3 (A): the list closes, the title says best hunts, the button "#3 Hunt A · 1h 00m", the column "AVERAGE"', !v.open && v.expanded === 'false' && v.title === 'Comparison (best hunts)' && v.btn === '#3 Hunt A · 1h 00m' && v.head.join('|') === '|AVERAGE|CURRENT', v);
  ok('...its numbers are A\u2019s averages (+140K, 1.2M, 513) against the current hunt', JSON.stringify(v.rows) === JSON.stringify([['Gold/h', '+140K', '+250K ▲'], ['XP/h', '1.2M', '1.5M ▲'], ['Kills/h', '513', '610 ▲']]), v.rows);
  await sess(p, 1, 108, 'Hunt H', 8, 130000, 1000000, 500); await p.waitForTimeout(1400); v = await view(p);
  ok('...it stays chosen when new numbers come (and the arrows follow them)', v.btn === '#3 Hunt A · 1h 00m' && JSON.stringify(v.rows) === JSON.stringify([['Gold/h', '+140K', '+130K ▼'], ['XP/h', '1.2M', '1M ▼'], ['Kills/h', '513', '500 ▼']]), v.rows);
  await clickAt(p, '#cmpBtn'); await clickAt(p, '#cmpMenu [data-rank="gold"]'); v = await view(p);
  ok('...changing the ranking keeps the hunt chosen, with its new place (A is #4 by $)', v.open && v.btn === '#4 Hunt A · 1h 00m' && v.items.find(i => i.nm === 'Hunt A').sel, v);
  await clickAt(p, '#cmpMenu [data-cmpview="last"]'); v = await view(p);
  ok('...in "Last 5" a hunt of the best 5 that is chosen is not marked there (a visit is another thing)', v.open && v.items.every(i => !i.sel), v.items);
  await clickAt(p, '#cmpMenu [data-cmpview="best"]');
  await clickItem(p, 'Hunt E'); v = await view(p);
  ok('choosing a hunt under 30 min (E): the button carries the mark ○', v.btn === '#1 Hunt E · 10 min ○' && v.thinBtn, v.btn);
  await clickAt(p, '#cmpBtn'); await clickAt(p, '#cmpMenu [data-cmpview="last"]'); await clickItem(p, 'Hunt F'); v = await view(p);
  ok('choosing a visit of the last 5 (F, 2nd): "Comparison (last hunts)", "2 Hunt F · 45 min", "PREVIOUS", its own numbers', !v.open && v.title === 'Comparison (last hunts)' && v.btn === '2 Hunt F · 45 min' && v.head[1] === 'PREVIOUS' && v.rows[0][1] === '+50K', v);
  await clickAt(p, '#cmpBtn'); await clickItem(p, 'Hunt G'); v = await view(p);
  ok('choosing the first one (the previous hunt) goes back to the previous hunt', !v.open && v.title === 'Comparison (last hunts)' && v.btn === '1 Hunt G · 35 min' && v.head[1] === 'PREVIOUS', v);
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
  const focused = () => D(p).evaluate(() => { const e = document.activeElement; return e && e.querySelector ? (e.querySelector('.nm') || {}).textContent || e.getAttribute('data-cmpview') || e.id : null; });
  let f = [await D(p).evaluate(() => !document.getElementById('cmpMenu').classList.contains('hidden')), await focused()];
  ok('keyboard: Enter on the button opens the list and puts the focus on the hunt shown (the previous hunt, G)', f[0] && f[1] === 'Hunt G', f);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(100);
  f = await focused();
  ok('...arrow down moves through the list (3rd, E)', f === 'Hunt E', f);
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  f = await D(p).evaluate(() => [document.getElementById('cmpMenu').classList.contains('hidden'), document.activeElement.id, document.getElementById('cmpBtn').textContent]);
  ok('...Enter chooses it, closes the list and gives the focus back to the button', f[0] && f[1] === 'cmpBtn' && /^3 Hunt E/.test(f[2]), f);
  await p.waitForTimeout(1300);
  ok('...the focus stays on the button when the Summary is drawn again', await D(p).evaluate(() => document.activeElement.id === 'cmpBtn'));
  // ---- the session that ends is kept; "here now"
  await sess(p, 1, 109, 'Hunt A', 3, 10, 10, 10); await p.waitForTimeout(1400);
  await clickAt(p, '#cmpBtn'); v = await view(p);
  ok('when the hunt H ends (a new session starts) it is kept with its last numbers and is now the previous hunt, first of the last 5 (8 min, marked ○): H, G, F, E, A', v.names.join() === 'Hunt H,Hunt G,Hunt F,Hunt E,Hunt A' && v.items[0].val === '+130K · 1M XP' && v.items[0].sub === '8 min ○ · previous hunt' && v.items[0].thin, v.items);
  ok('...the visit chosen before (E) stays chosen, now 4th', v.items[3].nm === 'Hunt E' && v.items[3].sel && v.btn === '4 Hunt E · 10 min ○', [v.btn, v.items.map(i => i.sel)]);
  ok('...a hunt that is also the one running now says so ("here now": A)', v.items.filter(i => /here now/.test(i.sub)).map(i => i.nm).join() === 'Hunt A', v.items.map(i => i.sub));
  await clickAt(p, '#cmpMenu [data-cmpview="best"]'); v = await view(p);
  ok('...also in the best 5 (#5 by $: H, 130K, just under A; "here now": A)', v.items.some(i => i.nm === 'Hunt H' && i.val === '+130K/h' && i.rk === '#5' && i.thin) && v.items.filter(i => /here now/.test(i.sub)).map(i => i.nm).join() === 'Hunt A', v.items);
  await clickAt(p, '#cmpMenu [data-cmpview="last"]'); await p.keyboard.press('Escape');
  // ---- kept on this computer
  const before = await view(p);
  await D(p).evaluate(() => location.reload()); await p.waitForTimeout(2000); await pickTab(p, 0); await p.waitForTimeout(300);
  v = await view(p);
  ok('after the Summary is loaded again (the app started again): the previous hunt comes from what was kept (H), the choice of E is gone (the previous hunt is shown)', v.has && v.btn === '1 Hunt H · 8 min ○' && v.title === 'Comparison (last hunts)', [v.btn, before.btn]);
  await clickAt(p, '#cmpBtn'); v = await view(p);
  ok('...and the same list as before, in the view chosen last (Last 5)', v.views.join() === 'Last 5*,Best 5' && v.names.join() === 'Hunt H,Hunt G,Hunt F,Hunt E,Hunt A', [v.views, v.names]);
  await p.keyboard.press('Escape');
  const st = await D(p).evaluate(() => { const o = JSON.parse(localStorage.getItem('4h.hunts')); return { v: o.v, n1: Object.keys(o.acc[1]).length, n2: Object.keys(o.acc[2] || {}).length, names: Object.values(o.acc[1]).map(e => e.h), parties: Object.values(o.acc[1]).map(e => e.p) }; });
  ok('what is kept: one entry per session of account 1 (9: the 7 before H, H, and the one running; Z had 1 min), none for the others, only names and numbers (and the party: 1, alone)', st.v === 1 && st.n1 === 9 && st.n2 === 0 && st.names.indexOf('Hunt H') >= 0 && st.parties.every(x => x === 1), st);
  // ---- the running session is kept while it runs (closing the app does not lose it), and is saved at most every 20 s
  ok('the session that runs is in the saved list (A, 3 min) but not in the comparison (it is "current")', await D(p).evaluate(() => { const o = JSON.parse(localStorage.getItem('4h.hunts')); return Object.keys(o.acc[1]).indexOf('s109') >= 0 && huntStats(accounts[0]).find(s => s.name === 'Hunt A').visits === 2 && huntVisits(accounts[0]).every(s => s.key !== 'v' + o.acc[1].s109.q); }));
  // ---- data that make no sense
  for (const bad of ['not json', '{"acc":{"1":{"x":{"h":"Q","m":"9","g":1,"x":1,"k":1,"q":1},"y":{"h":"","m":9,"g":1,"x":1,"k":1,"q":2},"z":{"h":"R","m":1,"g":1,"x":1,"k":1,"q":3},"w":{"h":"S","m":9,"g":1,"x":1,"k":1,"q":4,"p":"x"}}}}', '{"acc":5}', 'null']) {
    await D(p).evaluate(v => localStorage.setItem('4h.hunts', v), bad);
    await D(p).evaluate(() => location.reload()); await p.waitForTimeout(1600);
    const r = await D(p).evaluate(() => Object.values(huntLog.acc[1]).map(e => e.h + '/' + e.p).join());
    ok('saved hunts that make no sense (' + bad.slice(0, 40) + ') are left out, the good ones kept (an odd party size reads as alone), and nothing breaks', (bad.indexOf('"w"') >= 0 ? /^S\/1(,Hunt A\/1)?$/.test(r) : /^(Hunt A\/1)?$/.test(r)) && p.errors.length === 0, [r, p.errors]);
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

  // ---- lang-72: a hunt done in a party
  p = await open(b, { w: 1700, h: 1000 });
  await panelOn(p); await p.waitForTimeout(300);
  // account 2: P alone (30 min, 100K), P in a party of 3 (40 min at 60K, then a reconnect: 20 min at 90K), Q alone, and R running now
  for (const s of [[201, 'Hunt P', 30, 100000, 900000, 500, 1], [202, 'Hunt P', 40, 60000, 700000, 300, 3], [203, 'Hunt P', 20, 90000, 1000000, 330, 3], [204, 'Hunt Q', 30, 80000, 600000, 400, 1], [205, 'Hunt R', 5, 70000, 500000, 350, 1]]) await sess(p, 2, ...s);
  await p.waitForTimeout(1400); await pickTab(p, 1); await clickAt(p, '#cmpBtn'); v = await view(p);
  ok('party: the last visits are Q, then P in a party of 3 (its two pieces, a reconnect, are ONE visit: 1h 00m, +70K weighted by time), then P alone, apart', v.names.join() === 'Hunt Q,Hunt P,Hunt P' && v.items[1].sub === '1h 00m · party of 3' && v.items[1].val === '+70K · 800K XP' && v.items[2].sub === '30 min' && v.items[2].val === '+100K · 900K XP', v.items);
  await clickAt(p, '#cmpMenu [data-cmpview="best"]'); v = await view(p);
  ok('...in the best 5 the hunt in a party and the same hunt alone are two entries, the party one marked: P (100K, alone), Q (80K), P (70K, party of 3)', v.names.join() === 'Hunt P,Hunt Q,Hunt P' && v.items[0].sub === '30 min · 1 visit' && v.items[2].sub === '1h 00m · 2 visits · party of 3', v.items);
  await clickItem(p, 'Hunt Q'); await clickAt(p, '#cmpBtn'); await clickAt(p, '#cmpMenu [data-cmpview="last"]'); v = await view(p);
  const pIdx = v.items.findIndex(i => /party of 3/.test(i.sub));
  await D(p).evaluate(i => document.querySelectorAll('#cmpMenu .cm-item')[i].click(), pIdx); await p.waitForTimeout(250); v = await view(p);
  ok('...chosen, the button says it too: "2 Hunt P · 1h 00m · party of 3"', v.btn === '2 Hunt P · 1h 00m · party of 3', v.btn);
  const kept = await D(p).evaluate(() => Object.values(huntLog.acc[2]).map(e => e.h + '/' + e.p).sort().join());
  ok('...what is kept: the hunt\u2019s own name, and the party apart (not "Hunt P · party of 3")', kept === 'Hunt P/1,Hunt P/3,Hunt P/3,Hunt Q/1,Hunt R/1', kept);
  // hunts kept by 1.0.9 and before: the party was part of the name, in the language of the moment
  await D(p).evaluate(() => { huntLog.dirty = false; localStorage.setItem('4h.hunts', JSON.stringify({ v: 1, acc: { 3: { a: { h: 'Hunt T \u00b7 party of 2', m: 30, g: 1, x: 1, k: 1, q: 1 }, b: { h: 'Hunt T \u00b7 grupo de 2', m: 30, g: 1, x: 1, k: 1, q: 2 }, c: { h: 'Hunt T', m: 30, g: 1, x: 1, k: 1, q: 3 } } } })); location.reload(); });
  await p.waitForTimeout(1600);
  const old = await D(p).evaluate(() => ({ kept: Object.values(huntLog.acc[3]).map(e => e.h + '/' + e.p).join(), stats: huntStats(accounts[2]).map(s => s.name + '/' + s.party + '/' + s.visits).sort().join() }));
  ok('hunts kept by an older 4horizon ("Hunt T · party of 2", "Hunt T · grupo de 2"): read as Hunt T in a party of 2, the same hunt as each other, apart from Hunt T alone', old.kept === 'Hunt T/2,Hunt T/2,Hunt T/1' && old.stats === 'Hunt T/1/1,Hunt T/2/2', old);
  ok('no JavaScript errors (party)', p.errors.length === 0, p.errors);
  await p.context().close();

  // ---- lang-72: with the Overview on screen (Panel and Simple), the switch Last 5 / Best 5 never hides the Overview (its buttons once shared the Overview tab's data-view)
  p = await open(b, { w: 1700, h: 1000 });
  await panelOn(p); await p.evaluate(() => { if (!ui.simple) document.getElementById('btnSimple').click(); }); await p.waitForTimeout(300);
  await feed(p); await pickTab(p, 0);
  const ov = () => D(p).evaluate(() => ({ shown: !document.getElementById('view-overview').classList.contains('hidden') && document.getElementById('view-overview').getBoundingClientRect().height > 100, tabOn: document.querySelector('#topTabs .vt').classList.contains('on') }));
  ok('the Overview is on screen next to the Summary', (await ov()).shown, await ov());
  await clickAt(p, '#cmpBtn'); await clickAt(p, '#cmpMenu [data-cmpview="best"]'); let o1 = await ov(); v = await view(p);
  ok('...pressing "Best 5" switches the list and the Overview stays on screen, its tab still lit', v.open && v.views.join() === 'Last 5,Best 5*' && o1.shown && o1.tabOn, [o1, v.views]);
  await clickAt(p, '#cmpMenu [data-cmpview="last"]'); o1 = await ov(); v = await view(p);
  ok('...and so does pressing "Last 5"', v.views.join() === 'Last 5*,Best 5' && o1.shown && o1.tabOn, [o1, v.views]);
  await clickItem(p, 'Hunt F'); o1 = await ov();
  ok('...and choosing a hunt in the list', o1.shown && o1.tabOn, o1);
  await D(p).evaluate(() => document.querySelector('#topTabs .vt').click()); o1 = await ov();
  ok('...the Overview tab itself still works (pressed: the Overview stays)', o1.shown && o1.tabOn, o1);
  ok('no JavaScript errors (Overview)', p.errors.length === 0, p.errors);
  await p.context().close();

  // ---- a short window: the list fits in the Summary and scrolls
  p = await open(b, { w: 1300, h: 560 });
  await panelOn(p); await p.waitForTimeout(300);
  await feed(p); await pickTab(p, 0);
  await D(p).evaluate(() => { const e = document.getElementById('cmpBtn'); if (e) e.scrollIntoView({ block: 'end' }); }); await p.waitForTimeout(200);
  for (const vw of ['last', 'best']) {
    await clickAt(p, '#cmpBtn'); if (vw === 'best') await clickAt(p, '#cmpMenu [data-cmpview="best"]'); v = await view(p);
    ok('short window (560 px), ' + (vw === 'best' ? 'Best 5' : 'Last 5') + ': the list opens where there is room, stays inside the Summary panel and scrolls if needed, without covering the button', v.open && v.menuBox.top >= v.sideBox.top && v.menuBox.bottom <= v.sideBox.bottom && (v.menuBox.top >= v.btnBox.bottom || v.menuBox.bottom <= v.btnBox.top), v);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    ok('...opened with the mouse, Escape closes it at once (lang-72: the keyboard is put in the list; before, it was still outside the Summary)', !(await view(p)).open);
  }
  await clickAt(p, '#cmpBtn'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(100);
  const fk = await D(p).evaluate(() => [document.activeElement === document.querySelector('#cmpMenu .cm-item'), document.activeElement.className]);
  ok('...and the arrow keys move in it at once (to the first hunt of the list)', fk[0], fk);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok('no JavaScript errors (short window)', p.errors.length === 0, p.errors);
  await p.context().close();

  // ---- Portuguese
  p = await open(b, { lang: 'pt-BR', w: 1700, h: 1000 });
  await panelOn(p); await p.waitForTimeout(300);
  await feed(p); await pickTab(p, 0);
  v = await view(p);
  ok('in Portuguese: "Comparação (últimas hunts)", "ANTERIOR"', v.title === 'Comparação (últimas hunts)' && v.head[1] === 'ANTERIOR', v);
  await mouseTo(p, '#cmpBtn'); await p.waitForTimeout(800); T = await tip(p);
  ok('...the explanation ("Escolha com o que esta hunt é comparada ... grupo ... pelo menos 30 minutos ... 1 hora ou mais é o ideal")', T.shown && /^Escolha com o que esta hunt é comparada: uma das 5 últimas hunts/.test(T.text) && /feita em grupo fica marcada/.test(T.text) && /pelo menos 30 minutos numa hunt/.test(T.text) && /1 hora ou mais é o ideal/.test(T.text), T.text);
  await clickAt(p, '#cmpBtn'); v = await view(p);
  ok('...the list: "Últimas 5" / "5 melhores", "Últimas 5 hunts, da mais recente", "35 min · hunt anterior", the note', v.views.join() === 'Últimas 5*,5 melhores' && v.heads.join('|') === 'Últimas 5 hunts, da mais recente' && v.items[0].sub === '35 min · hunt anterior' && /^○ Menos de 30 min nesta hunt/.test(v.note), v);
  await clickAt(p, '#cmpMenu [data-cmpview="best"]'); v = await view(p);
  ok('...the best 5: "Ordenar por", "5 melhores por gold por hora", "1h 00m · 2 visitas"', v.heads.join('|') === 'Ordenar por|5 melhores por gold por hora' && v.items[3].sub === '1h 00m · 2 visitas', v);
  await clickItem(p, 'Hunt A'); v = await view(p);
  ok('...the title and the column: "Comparação (melhores hunts)", "MÉDIA"', v.title === 'Comparação (melhores hunts)' && v.head[1] === 'MÉDIA', v);
  ok('no JavaScript errors (Portuguese)', p.errors.length === 0, p.errors);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
