// run-light-ui.js (lang-70): Light mode in a real browser.
//  1. the command light.js sends really stops the game's looping animations that have a "reduced motion" rule (sent to a real page through the browser's own protocol)
//  2. Settings › Light mode: the switch, the window and the Summary follow it (no animations, the Summary redrawn every 5 s instead of every second)
//  3. for everyone: while the window is hidden (tray, minimized) the Summary is not drawn, but the hunts are still recorded; it is drawn at once when the window shows again
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
const L = require('./light');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
// rules copied from the game's stylesheet of 2026-11-08 (the VIP shine and the fishing bubbles loop forever; the game stops them for reduced motion)
const GAME = `<!doctype html><meta charset=utf-8><style>
@keyframes vip-shine{0%{opacity:.6}50%{opacity:1}100%{opacity:.6}} @keyframes bubble{0%{transform:translateY(0)}100%{transform:translateY(-20px)}}
.trainer-vip{animation:vip-shine 3s linear infinite} .fishing-bubble{animation:bubble 2s ease-in-out infinite} .no-rule{animation:vip-shine 3s linear infinite}
@media(prefers-reduced-motion:reduce){.trainer-vip,.trainer-vip:after{animation:none}}
@media(prefers-reduced-motion:reduce){.fishing-card:before,.fishing-card:after,.fishing-card-poke,.fishing-card .fishing-bubble{animation:none}}
</style><body><span class="trainer-vip">VIP</span><div class="fishing-card"><span class="fishing-bubble">o</span></div><span class="no-rule">x</span>
<script>window.__ticks = 0; setInterval(() => { window.__ticks++; }, 100);</script>`;
const STUB = on => `window.__light = { on: ${on ? 'true' : 'false'}, calls: [] };
  __bridgeObject.lightGet = async () => ({ on: window.__light.on });
  __bridgeObject.lightSet = async v => { window.__light.calls.push(v); window.__light.on = v === true; return { on: window.__light.on, saved: true }; };`;
(async () => {
  const b = await chromium.launch();
  // ---- 1. the game page
  {
    const ctx = await b.newContext(); const p = await ctx.newPage(); await p.setContent(GAME); const cdp = await ctx.newCDPSession(p);
    const anim = () => p.evaluate(() => ['.trainer-vip', '.fishing-bubble', '.no-rule'].map(s => getComputedStyle(document.querySelector(s)).animationName));
    const before = await anim();
    // a game panel as light.js sees it, whose debugger is the browser's own protocol connection to this page
    const wc = { getType: () => 'webview', isDestroyed: () => false, on() {}, debugger: { isAttached: () => true, on() {}, sendCommand: (m, prm) => cdp.send(m, prm) } };
    L._reset(); L._setOn(true);
    const sent = await L.apply(wc); const after = await anim();
    ok('before: the game\u2019s VIP shine and fishing bubble loop (their animations run)', before[0] === 'vip-shine' && before[1] === 'bubble', before);
    ok('light.js sends its command to the page and the browser takes it', sent === true && (await p.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)) === true, sent);
    ok('...the game\u2019s own rules then stop them: VIP shine and fishing bubble have no animation', after[0] === 'none' && after[1] === 'none', after);
    ok('...an animation the game gave no reduced-motion rule is left as the game wants it (nothing is forced)', after[2] === 'vip-shine', after);
    const t0 = await p.evaluate(() => window.__ticks); await p.waitForTimeout(600); const t1 = await p.evaluate(() => window.__ticks);
    ok('the page\u2019s own script keeps running at full speed (a 100 ms timer ticked ' + (t1 - t0) + ' times in 600 ms): nothing of the game is slowed', t1 - t0 >= 4, t1 - t0);
    L._setOn(false); await L.apply(wc);          // turned off: light.js clears what it had set
    ok('turned off: light.js clears it and the animations run again', (await anim())[0] === 'vip-shine');
    await ctx.close();
  }

  // ---- 2. Settings › Light mode
  let p = await open(b, { extraInit: STUB(false), w: 1400, h: 900 }); await feedAll(p);
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const row = await p.evaluate(() => { const r = document.getElementById('sLightRow'); return { shown: !r.classList.contains('hidden') && r.getBoundingClientRect().height > 0, title: r.querySelector('b').firstChild.textContent.trim(), tick: document.getElementById('sLight').closest('label').textContent.trim(), checked: document.getElementById('sLight').checked, tip: r.querySelector('.sd').textContent }; });
  ok('Settings has "Light mode" with "Use light mode", unticked at first; its explanation says what changes and what does not', row.shown && row.title === 'Light mode' && row.tick === 'Use light mode' && !row.checked && /slower PCs/.test(row.tip) && /do not change/.test(row.tip), row);
  const order = await p.evaluate(() => Array.from(document.querySelectorAll('#settingsModal .srow > div:first-child > b')).map(x => x.firstChild.textContent.trim()));
  ok('...right under "Disable GPU acceleration"', order.indexOf('Light mode') === order.indexOf('Disable GPU acceleration') + 1, order);
  const fade0 = await p.evaluate(() => getComputedStyle(document.querySelector('#settingsModal .shead .saved')).transitionDuration);
  await p.check('#sLight'); await p.waitForTimeout(200);
  const st = await p.evaluate(() => ({ calls: window.__light.calls, body: document.body.classList.contains('light'), fade: getComputedStyle(document.querySelector('#settingsModal .shead .saved')).transitionDuration }));
  const dst = await p.dash().evaluate(() => ({ light: lightMode, body: document.body.classList.contains('light') }));
  ok('ticking it asks the main process to turn it on, once', JSON.stringify(st.calls) === '[true]', st.calls);
  ok('...the window has no fades any more (a fade of ' + fade0 + ' is now 0s), and the Summary knows Light mode is on', st.body && fade0 !== '0s' && st.fade === '0s' && dst.light && dst.body, [st, dst]);
  await p.click('#setClose');
  // the Summary: every 5 s instead of every second
  const shown = () => p.dash().evaluate(() => document.querySelector('.acard[data-tab="1"] .money').textContent.trim());
  await p.waitForTimeout(5500); await p.s(2, { money: 1234567 }); await p.waitForTimeout(1600); const at1 = await shown(); await p.waitForTimeout(4000); const at5 = await shown();
  ok('Light mode: new numbers are not drawn after 1 s ($' + at1 + ' still), but within 5 s ($' + at5 + ')', at1 !== '$1.23M' && at5 === '$1.23M', [at1, at5]);
  await p.click('#btnSettings'); await p.waitForTimeout(200); await p.uncheck('#sLight'); await p.waitForTimeout(200); await p.click('#setClose');
  await p.waitForTimeout(1200); await p.s(2, { money: 7654321 }); await p.waitForTimeout(1500);
  ok('turned off: drawn within a second again, and the fades are back', (await shown()) === '$7.65M' && !(await p.evaluate(() => document.body.classList.contains('light'))) && !(await p.dash().evaluate(() => lightMode)), await shown());

  // ---- 3. the window is hidden (tray, minimized): nothing is drawn, the hunts are still recorded
  const hide = v => p.dash().evaluate(v => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => v }); document.dispatchEvent(new Event('visibilitychange')); }, v);
  await hide(true);
  const draws = await p.dash().evaluate(() => { window.__draws = 0; const s = document.getElementById('sideBody'); new MutationObserver(() => { window.__draws++; }).observe(s, { childList: true, subtree: true, characterData: true }); return true; });
  await p.s(2, { money: 1111111, minutes: 70, goldH: 999999 }); await p.waitForTimeout(1600);
  const hid = await p.dash().evaluate(() => ({ draws: window.__draws, money: document.querySelector('.acard[data-tab="1"] .money').textContent.trim(), kept: Object.values(huntLog.acc[2] || {}).some(e => e.m === 70 && e.g === 999999) }));
  ok('while the window is hidden new numbers are NOT drawn (the Summary did not change: ' + hid.money + ')', draws && hid.draws === 0 && hid.money === '$7.65M', hid);
  ok('...but the hunt is still recorded (the hunt log has its 70 minutes and its gold per hour)', hid.kept, hid);
  await hide(false); await p.waitForTimeout(150);
  ok('the window shows again: drawn at once, with the newest numbers', (await shown()) === '$1.11M', await shown());
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // ---- an older main process (no Light mode): the row is hidden, Settings works
  p = await open(b, { w: 1400, h: 900 }); await p.click('#btnSettings'); await p.waitForTimeout(250);
  ok('an app whose main process has no Light mode: the row is hidden', await p.evaluate(() => document.getElementById('sLightRow').classList.contains('hidden')));
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // ---- on at the start, and Portuguese
  p = await open(b, { extraInit: STUB(true), lang: 'pt-BR', w: 1400, h: 900 }); await p.waitForTimeout(400);
  ok('saved as on: the window starts in Light mode, and the Summary too', (await p.evaluate(() => document.body.classList.contains('light'))) && (await p.dash().evaluate(() => lightMode)));
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const pt = await p.evaluate(() => { const r = document.getElementById('sLightRow'); return [r.querySelector('b').firstChild.textContent.trim(), document.getElementById('sLight').closest('label').textContent.trim(), document.getElementById('sLight').checked]; });
  ok('in Portuguese: "Modo leve", "Usar modo leve", ticked', JSON.stringify(pt) === JSON.stringify(['Modo leve', 'Usar modo leve', true]), pt);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
