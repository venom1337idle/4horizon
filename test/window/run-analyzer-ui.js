// run-analyzer-ui.js: the Analyzer button of the top bar (the main process does the pressing; here: the button, and what it tells)
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const STUB = answer => `window.__an = { calls: 0, answer: ${JSON.stringify(answer)}, wait: 0 }; __bridgeObject.analyzerToggle = async () => { window.__an.calls++; if (window.__an.wait) await new Promise(r => setTimeout(r, window.__an.wait)); if (window.__an.answer === 'throw') throw new Error('x'); return window.__an.answer; };`;
const toast = p => p.locator('#toast').innerText();
const R = (...ns) => ns.map(n => ({ n, ok: true }));
(async () => {
  const b = await chromium.launch();
  let p = await open(b, { extraInit: STUB({ action: 'open', results: R(2, 3, 4) }), w: 1500, h: 900 }); await p.waitForTimeout(300);
  const L = await p.evaluate(() => { const a = document.getElementById('btnAnalyzer'), pn = document.getElementById('btnPanel'), r = a.getBoundingClientRect(), rp = pn.getBoundingClientRect(), svg = a.querySelector('svg'), bar = document.getElementById('bar').getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), hPanel: Math.round(rp.height), next: a.nextElementSibling === pn, gap: Math.round(rp.left - r.right), cy: Math.round(r.top + r.height / 2 - bar.top), barCy: Math.round(bar.height / 2), text: a.textContent.trim(), icon: !!svg, title: a.title, aria: a.getAttribute('aria-label') }; });
  ok('the button is right BEFORE the Panel button (the other side of it, not between Panel and Simple), a small square (28 x 28, the other buttons are 34 high) with only an icon, centred in the bar', L.next && L.w === 28 && L.h === 28 && L.hPanel === 34 && L.text === '' && L.icon && Math.abs(L.cy - L.barCy) <= 1 && L.gap >= 0 && L.gap <= 12, L);
  ok('...its name is "Analyzer" and its tooltip says what it does', L.aria === 'Analyzer' && /opens or closes the Hunt Analyzer of the game on all the accounts/.test(L.title), L);
  await p.click('#btnAnalyzer'); await p.waitForTimeout(120);
  ok('a press asks the main process once, and says "Hunt Analyzer opened on 3 accounts"', (await p.evaluate(() => window.__an.calls)) === 1 && (await toast(p)) === 'Hunt Analyzer opened on 3 accounts', await toast(p));
  const kind = async () => p.evaluate(() => document.getElementById('toast').className);
  ok('...as a normal message (not a warning)', (await kind()) === '');
  const say = async ans => { await p.evaluate(a => { window.__an.answer = a; }, ans); await p.click('#btnAnalyzer'); await p.waitForTimeout(120); return [await toast(p), await kind()]; };
  let m = await say({ action: 'close', results: R(2, 3, 4) });
  ok('closing: "Hunt Analyzer closed on 3 accounts"', m[0] === 'Hunt Analyzer closed on 3 accounts' && m[1] === '', m);
  m = await say({ action: 'open', results: R(2) });
  ok('one account: "on 1 account" (no plural)', m[0] === 'Hunt Analyzer opened on 1 account', m);
  m = await say({ action: 'close', results: [{ n: 2, ok: true, skipped: true }, { n: 3, ok: true }, { n: 4, ok: true, skipped: true }] });
  ok('the accounts that had nothing to close are not counted: "closed on 1 account"', m[0] === 'Hunt Analyzer closed on 1 account', m);
  m = await say({ action: 'open', results: [{ n: 2, ok: true }, { n: 3, ok: false, reason: 'not signed in' }, { n: 4, ok: false, reason: 'button not found' }] });
  ok('when some accounts failed: what worked, then each failure with its reason, as a warning', m[0] === 'Hunt Analyzer opened on 1 account · Account 3: not signed in · Account 4: the Análise button was not found' && m[1] === 'warn', m);
  m = await say({ action: 'open', results: [{ n: 2, ok: false, reason: 'did not open' }] });
  ok('nothing worked: only the reasons ("Account 2: it did not open"), as a warning', m[0] === 'Account 2: it did not open' && m[1] === 'warn', m);
  m = await say({ action: 'close', results: [{ n: 2, ok: false, reason: 'no close button' }, { n: 3, ok: false, reason: 'did not close' }, { n: 4, ok: false, reason: 'page did not answer' }] });
  ok('the other reasons are in words too: no close button found / it did not close / the page did not answer', /Account 2: no close button found · Account 3: it did not close · Account 4: the page did not answer/.test(m[0]), m);
  m = await say({ action: 'none', results: [] });
  ok('no game screen ready: "No game screen is ready yet." as a warning', m[0] === 'No game screen is ready yet.' && m[1] === 'warn', m);
  m = await say(null);
  ok('an answer of nothing (not our window) is also "No game screen is ready yet."', m[0] === 'No game screen is ready yet.', m);
  m = await say('throw');
  ok('if the request fails the button says so ("Could not reach the game screens.") and does not break', m[0] === 'Could not reach the game screens.' && m[1] === 'warn', m);
  // double click: one request at a time
  await p.evaluate(() => { window.__an.calls = 0; window.__an.answer = { action: 'open', results: [{ n: 2, ok: true }] }; window.__an.wait = 400; });
  await p.click('#btnAnalyzer'); await p.click('#btnAnalyzer'); await p.click('#btnAnalyzer'); await p.waitForTimeout(700);
  ok('three quick presses make one request (the others are ignored while it is running), and the button works again afterwards', (await p.evaluate(() => window.__an.calls)) === 1 && (await (async () => { await p.evaluate(() => { window.__an.wait = 0; }); await p.click('#btnAnalyzer'); await p.waitForTimeout(100); return p.evaluate(() => window.__an.calls); })()) === 2);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // without the bridge function (the installer was not run)
  p = await open(b, { w: 1500, h: 900 }); await p.waitForTimeout(200); await p.click('#btnAnalyzer'); await p.waitForTimeout(100);
  ok('without the bridge function: the button says to run install-diagnostics.js, as a warning, and nothing breaks', /Analyzer button needs install-diagnostics\.js/.test(await toast(p)) && (await kind()) === 'warn' && p.errors.length === 0, [await toast(p), p.errors]);
  await p.context().close();

  // widths: the bar still fits
  for (const w of [1920, 1500, 1330, 1100, 1000, 900]) {
    const q = await open(b, { extraInit: STUB({ action: 'open', results: R(2) }), w, h: 800 }); await q.waitForTimeout(200);
    const r = await q.evaluate(() => { const bar = document.getElementById('bar'), a = document.getElementById('btnAnalyzer'), rr = a.getBoundingClientRect(); return { over: bar.scrollWidth > bar.clientWidth + 1, shown: !!a.offsetParent, w: Math.round(rr.width), inside: rr.right <= innerWidth }; });
    ok(w + ' px: the bar fits, the Analyzer button is there (28 px wide) and inside the window', !r.over && r.shown && r.w === 28 && r.inside, r);
    await q.context().close();
  }
  // Portuguese
  p = await open(b, { extraInit: STUB({ action: 'open', results: [{ n: 2, ok: true }, { n: 3, ok: false, reason: 'not signed in' }] }), lang: 'pt-BR', w: 1500, h: 900 }); await p.waitForTimeout(250);
  const pt = await p.evaluate(() => { const a = document.getElementById('btnAnalyzer'); return { aria: a.getAttribute('aria-label'), title: a.title }; });
  ok('in Portuguese the name is "Analisador" and the tooltip is in Portuguese', pt.aria === 'Analisador' && /Analisador: abre ou fecha o Hunt Analyzer do jogo em todas as contas/.test(pt.title), pt);
  await p.click('#btnAnalyzer'); await p.waitForTimeout(120);
  ok('...and the answer too: "Hunt Analyzer aberto em 1 conta · Conta 3: não está conectada"', (await toast(p)) === 'Hunt Analyzer aberto em 1 conta · Conta 3: não está conectada', await toast(p));
  await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
