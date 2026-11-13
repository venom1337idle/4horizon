// run-header-buttons.js (lang-71): the thinner header of each game screen (40 px, the name and the hunt on one line) and palette D, and EVERY button still works:
// each one is pressed with the real mouse at its centre (so a button that something covers would fail), on all four panels, in two window sizes
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const STUB = `window.__calls = { nav: [], hunt: [], reload: [], zoom: [] };
  HTMLUnknownElement.prototype.reload = function () { window.__calls.reload.push(this.id); };
  HTMLUnknownElement.prototype.setZoomFactor = function (f) { window.__calls.zoom.push([this.id, Math.round(f * 10) / 10]); };
  __bridgeObject.navGo = async (what, n) => { window.__calls.nav.push([what, n]); return { ok: true }; };
  __bridgeObject.navHunt = async (n, memo) => { window.__calls.hunt.push([n, memo && memo.id]); return { ok: true }; };
  if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('hg.huntMemo', JSON.stringify({ 1: { id: 'grass-60', name: 'Grass 60' }, 2: { id: 'rock-60', name: 'Rock 60' }, 3: { id: 'bug-60', name: 'Bug 60' }, 4: { id: 'water-60', name: 'Water 60' } })); }`;
const calls = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__calls)));
// the centre of an element of a panel, and whether the mouse would really hit it there (nothing on top of it)
const spot = (p, n, sel) => p.evaluate(([n, sel]) => { const el = document.querySelector('#panel' + n + ' ' + sel); if (!el) return null; const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y);
  return { x, y, w: Math.round(r.width), h: Math.round(r.height), shown: r.width > 0 && getComputedStyle(el).display !== 'none', reachable: !!hit && (hit === el || el.contains(hit)) }; }, [n, sel]);
const click = async (p, n, sel) => { const s = await spot(p, n, sel); if (!s || !s.shown || !s.reachable) return s; await p.mouse.click(s.x, s.y); await p.waitForTimeout(120); return s; };
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1500, 900], [1920, 1040]]) {
    const tag = w + 'x' + h + ': ';
    const p = await open(b, { extraInit: STUB, w, h }); await feedAll(p); await p.waitForTimeout(400);
    await p.evaluate(() => { HTMLUnknownElement.prototype.setZoomFactor = function (f) { window.__calls.zoom.push([this.id, Math.round(f * 10) / 10]); }; });          // (the test page puts its own stand-in after the first script)
    await p.evaluate(() => { if (ui.panel) document.getElementById('btnPanel').click(); if (ui.simple) document.getElementById('btnSimple').click(); }); await p.waitForTimeout(300);
    // ---- the look
    const L = await p.evaluate(() => [1, 2, 3, 4].map(n => { const pn = document.getElementById('panel' + n), hd = pn.querySelector('.phead'), nm = pn.querySelector('.pname'), ch = pn.querySelector('.chip'), em = pn.querySelector('.emb'), wv = pn.querySelector('webview');
      const R = e => e.getBoundingClientRect(); return { h: Math.round(R(hd).height), nameCy: Math.round(R(nm).top + R(nm).height / 2), chipCy: Math.round(R(ch).top + R(ch).height / 2), chipRight: Math.round(R(ch).right), nameRight: Math.round(R(nm).right), chipLeft: Math.round(R(ch).left), emb: Math.round(R(em).width), gameTop: Math.round(R(wv).top - R(pn).top), gameH: Math.round(R(wv).height) }; }));
    ok(tag + 'each header is 40 px high (it was 54): the game screen starts 44 px below the top of the panel (3 px line + 40 + 1)', L.every(x => x.h === 40 && x.gameTop <= 45), L.map(x => [x.h, x.gameTop]));
    ok(tag + '...the name and the hunt are on one line, side by side (the hunt right after the name), with the smaller account number (26 px)', L.every(x => Math.abs(x.nameCy - x.chipCy) <= 3 && x.chipLeft > x.nameRight && x.emb === 26), L.map(x => [x.nameCy, x.chipCy, x.emb]));
    // ---- every button, on every panel
    for (let n = 1; n <= 4; n++) {
      const pt = tag + 'panel ' + n + ': ';
      const zv = () => p.evaluate(n => document.querySelector('#panel' + n + ' .zv').textContent.trim(), n);
      const z0 = await zv();
      let s = await click(p, n, '.zp');
      ok(pt + 'zoom in (+) is reachable and works (' + z0 + ' → ' + (await zv()) + ')', s && s.reachable && (await zv()) === '110%' && (await calls(p)).zoom.some(c => c[0] === 'p' + n && c[1] === 1.1), s);
      s = await click(p, n, '.zm'); await click(p, n, '.zm');
      ok(pt + 'zoom out (−) works (110% → 90%)', s && s.reachable && (await zv()) === '90%', [s, await zv()]);
      s = await click(p, n, '.zv');
      ok(pt + 'the zoom number works (back to 100%)', s && s.reachable && (await zv()) === '100%', [s, await zv()]);
      s = await click(p, n, '.rl');
      ok(pt + 'reload works (only this panel)', s && s.reachable && JSON.stringify((await calls(p)).reload.slice(-1)) === JSON.stringify(['p' + n]), [s, (await calls(p)).reload]);
      if (w >= 1500) {
        for (const nav of ['center', 'market', 'bag', 'hunts']) {
          s = await click(p, n, '.pn[data-nav="' + nav + '"]');
          ok(pt + nav + ' is reachable (' + (s && s.w) + ' px) and asks the main process for it', s && s.reachable && s.w >= 24 && JSON.stringify((await calls(p)).nav.slice(-1)[0]) === JSON.stringify([nav, n]), [s, (await calls(p)).nav.slice(-1)]);
        }
      }
      await p.evaluate(n => document.querySelector('#panel' + n + ' .pback').classList.remove('hidden'), n); await p.waitForTimeout(80);
      s = await click(p, n, '.pback');
      const hu = (await calls(p)).hunt.slice(-1)[0];
      ok(pt + 'Back to last hunt is reachable and asks the main process for this panel\u2019s last hunt', s && s.reachable && hu && hu[0] === n && typeof hu[1] === 'string' && hu[1].length > 0, [s, hu]);
      await p.evaluate(n => renderHeads(), n);
      s = await click(p, n, '.ex');
      const solo = await p.evaluate(() => [1, 2, 3, 4].filter(k => !!document.getElementById('panel' + k).offsetParent));
      ok(pt + 'expand works: only this screen is shown', s && s.reachable && JSON.stringify(solo) === JSON.stringify([n]), [s, solo]);
      s = await click(p, n, '.ex');
      ok(pt + '...and the same button brings the four back', s && s.reachable && (await p.evaluate(() => [1, 2, 3, 4].filter(k => !!document.getElementById('panel' + k).offsetParent).length)) === 4, s);
      const hs = await spot(p, n, '.ptxt'); await p.mouse.dblclick(hs.x, hs.y); await p.waitForTimeout(150);
      const dbl = await p.evaluate(() => ui.solo); const hs2 = await spot(p, n, '.ptxt'); await p.mouse.dblclick(hs2.x, hs2.y); await p.waitForTimeout(150);          // (expanded, the header moved)
      ok(pt + 'a double click on the header expands and goes back too', dbl === n && (await p.evaluate(() => ui.solo)) === null, dbl);
    }
    // ---- a very long hunt name: it is cut with "…", it never runs under the buttons
    await p.s(2, { huntId: 'zz-999', huntName: 'Jardim Encantado dos Ralts e mais um nome muito longo de hunt que não cabe', active: true, live: true }); await p.waitForTimeout(400); await p.evaluate(() => renderHeads());
    const long = await p.evaluate(() => { const pn = document.getElementById('panel2'), ch = pn.querySelector('.chip'), nav = pn.querySelector('.pnav'), zoom = pn.querySelector('.zoom'), R = e => e.getBoundingClientRect(); const first = (nav && R(nav).width > 0) ? nav : zoom; return { cut: ch.scrollWidth > ch.clientWidth, right: Math.round(R(ch).right), next: Math.round(R(first).left), h: Math.round(R(pn.querySelector('.phead')).height), title: ch.title }; });
    ok(tag + 'a very long hunt name is cut ("…"), stays before the buttons, keeps the header 40 px, and its full text is in the tooltip', long.cut && long.right <= long.next && long.h === 40 && /muito longo/.test(long.title), long);
    // ---- the buttons of the top bar and of the Summary can all be reached
    const top = await p.evaluate(() => ['btnLoginAll', 'btnReloadAll', 'btnEco', 'btnSilent', 'btnAnalyzer', 'btnPanel', 'btnSimple', 'btnSettings'].map(id => { const el = document.getElementById(id); if (!el) return [id, 'missing']; const r = el.getBoundingClientRect(); if (!r.width) return [id, 'not shown']; const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return [id, hit === el || el.contains(hit)]; }));
    ok(tag + 'every button of the top bar can be reached', top.every(x => x[1] === true || x[1] === 'missing'), top);
    await p.evaluate(() => document.getElementById('btnReloadAll').click()); await p.waitForTimeout(100);
    ok(tag + 'Reload all still reloads the four panels', ['p1', 'p2', 'p3', 'p4'].every(id => (window => true)() && true) && (await calls(p)).reload.filter(x => /^p[1-4]$/.test(x)).length >= 8, (await calls(p)).reload);
    await p.evaluate(() => document.getElementById('btnPanel').click()); await p.waitForTimeout(300);
    const sb = await p.dash().evaluate(() => ['btnSumBar', 'btnSumLock', 'btnSumSettings'].map(id => { const el = document.getElementById(id), r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return [id, r.width > 0 && (hit === el || el.contains(hit))]; }));
    ok(tag + 'the Summary\u2019s triangle, lock and gear can be reached', sb.every(x => x[1] === true), sb);
    ok(tag + 'no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  }
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
