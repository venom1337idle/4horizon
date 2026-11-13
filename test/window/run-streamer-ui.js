// run-streamer-ui.js (lang-71): Settings › Streamer mode in the window: the switch, "restart needed", the e-mails of the Accounts window as dots,
// economy mode not available (the leaf button refuses, says why), and back to normal when it is off
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const STUB = (on, atStart) => `window.__st = { on: ${on}, atStart: ${atStart}, calls: [], eco: [] };
  __bridgeObject.streamerGet = async () => ({ on: window.__st.on, atStart: window.__st.atStart, needsRestart: window.__st.on !== window.__st.atStart });
  __bridgeObject.streamerSet = async v => { window.__st.calls.push(v); window.__st.on = v === true; return { on: window.__st.on, saved: true, atStart: window.__st.atStart, needsRestart: window.__st.on !== window.__st.atStart }; };
  __bridgeObject.economySet = async v => { window.__st.eco.push(v); return { on: v }; };
  __bridgeObject.accountsGet = async () => ({ encryption: true, autoLogin: true, rows: [1, 2, 3, 4].map(n => ({ n, name: 'venom' + n, user: 'venom' + n + '@mail.com', hasPassword: true })) });`;
const toasts = p => p.evaluate(() => Array.from(document.querySelectorAll('.toast, #toast, .toasts > *')).map(x => x.textContent.trim()).join(' | '));
(async () => {
  const b = await chromium.launch();
  let p = await open(b, { extraInit: STUB(false, false), w: 1400, h: 900 }); await feedAll(p);
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const row = await p.evaluate(() => { const r = document.getElementById('sStreamRow'); return { shown: !r.classList.contains('hidden') && r.getBoundingClientRect().height > 0, title: r.querySelector('b').firstChild.textContent.trim(), tick: document.getElementById('sStream').closest('label').textContent.trim(), checked: document.getElementById('sStream').checked, tip: r.querySelector('.sd').textContent }; });
  ok('Settings has "Streamer mode" with "Use streamer mode", off at first; it explains OBS, minimized windows, the e-mails, the CPU, economy mode and the restart', row.shown && row.title === 'Streamer mode' && row.tick === 'Use streamer mode' && !row.checked && /OBS/.test(row.tip) && /minimized/.test(row.tip) && /e-mails/.test(row.tip) && /CPU/.test(row.tip) && /economy mode is not available/.test(row.tip) && /Restart 4horizon/.test(row.tip), row);
  const order = await p.evaluate(() => Array.from(document.querySelectorAll('#settingsModal .srow > div:first-child > b')).map(x => x.firstChild.textContent.trim()));
  ok('...right under Light mode', order.indexOf('Streamer mode') === order.indexOf('Light mode') + 1, order);
  // off: economy mode works, the e-mails are shown
  await p.click('#setClose'); await p.evaluate(() => document.getElementById('btnEco').click()); await p.waitForTimeout(200);
  ok('streamer mode off: the leaf button turns economy mode on as before', await p.evaluate(() => document.body.classList.contains('eco')) && (await p.evaluate(() => window.__st.eco.filter(v => v === true).length)) === 1);          // (the window says "off" once when it starts)
  await p.evaluate(() => document.getElementById('btnEco').click()); await p.waitForTimeout(200);
  // turned on
  await p.click('#btnSettings'); await p.waitForTimeout(200); await p.check('#sStream'); await p.waitForTimeout(250);
  ok('ticking it asks the main process, and says to restart 4horizon', JSON.stringify(await p.evaluate(() => window.__st.calls)) === '[true]' && /Restart 4horizon for the change to take effect/.test(await toasts(p)), await toasts(p));
  await p.click('#setClose'); await p.evaluate(() => document.getElementById('btnEco').click()); await p.waitForTimeout(250);
  const eco = await p.evaluate(() => ({ on: document.body.classList.contains('eco'), calls: window.__st.eco.filter(v => v === true).length, title: document.getElementById('btnEco').title, op: getComputedStyle(document.getElementById('btnEco')).opacity }));
  ok('...economy mode is now not available: the leaf button looks off, does nothing, and says why', !eco.on && eco.calls === 1 && /not available while Streamer mode is on/.test(eco.title) && Number(eco.op) < 0.5 && /Economy mode is not available while Streamer mode is on/.test(await toasts(p)), [eco, await toasts(p)]);
  // the Accounts window
  await p.click('#btnSettings'); await p.waitForTimeout(150); await p.click('#btnAccounts'); await p.waitForTimeout(250);
  const acc = await p.evaluate(() => Array.from(document.querySelectorAll('#arows .f-user')).map(i => ({ v: i.value, sec: getComputedStyle(i).webkitTextSecurity })));
  ok('in the Accounts window the e-mails are dots on screen (still there to be saved: "venom1@mail.com" ...)', acc.length === 4 && acc.every(a => a.sec === 'disc') && acc[0].v === 'venom1@mail.com', acc);
  await p.fill('#arows .arow:first-child .f-user', 'new@mail.com');
  ok('...a new one can be typed (as dots too)', (await p.evaluate(() => document.querySelector('#arows .f-user').value)) === 'new@mail.com');
  await p.click('#aCancel'); await p.waitForTimeout(150);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // started with it on: blocked from the start; turned off but not restarted: still blocked; after the restart, normal
  p = await open(b, { extraInit: STUB(true, true), w: 1400, h: 900 }); await feedAll(p); await p.waitForTimeout(300);
  await p.evaluate(() => document.getElementById('btnEco').click()); await p.waitForTimeout(200);
  ok('started in streamer mode: economy mode is refused from the start', !(await p.evaluate(() => document.body.classList.contains('eco'))) && (await p.evaluate(() => window.__st.eco.filter(v => v === true).length)) === 0);
  await p.click('#btnSettings'); await p.waitForTimeout(200);
  ok('...Settings shows it ticked', await p.evaluate(() => document.getElementById('sStream').checked));
  await p.uncheck('#sStream'); await p.waitForTimeout(250); await p.click('#setClose');
  await p.evaluate(() => document.getElementById('btnEco').click()); await p.waitForTimeout(200);
  ok('turned off but 4horizon not started again: economy mode still refused (the screens are still kept drawn until the restart)', !(await p.evaluate(() => document.body.classList.contains('eco'))) && /not available while Streamer mode is on/.test(await toasts(p)), await toasts(p));
  await p.click('#btnSettings'); await p.waitForTimeout(150); await p.click('#btnAccounts'); await p.waitForTimeout(250);
  ok('...but the e-mails are shown again at once (as in the game panels)', (await p.evaluate(() => getComputedStyle(document.querySelector('#arows .f-user')).webkitTextSecurity)) === 'none');
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  p = await open(b, { extraInit: STUB(false, false), w: 1400, h: 900 }); await feedAll(p);
  await p.click('#btnSettings'); await p.click('#btnAccounts'); await p.waitForTimeout(250);
  ok('streamer mode off: the e-mails are shown as they are', (await p.evaluate(() => getComputedStyle(document.querySelector('#arows .f-user')).webkitTextSecurity)) === 'none');
  await p.context().close();

  // an older main process (no Streamer mode): the row is hidden, economy mode works
  p = await open(b, { w: 1400, h: 900 }); await p.click('#btnSettings'); await p.waitForTimeout(250);
  ok('an app whose main process has no Streamer mode: the row is hidden', await p.evaluate(() => document.getElementById('sStreamRow').classList.contains('hidden')));
  await p.context().close();

  // Portuguese
  p = await open(b, { extraInit: STUB(true, true), w: 1400, h: 900, lang: 'pt-BR' }); await feedAll(p); await p.click('#btnSettings'); await p.waitForTimeout(250);
  const pt = await p.evaluate(() => { const r = document.getElementById('sStreamRow'); return [r.querySelector('b').firstChild.textContent.trim(), document.getElementById('sStream').closest('label').textContent.trim(), document.getElementById('btnEco').title]; });
  ok('in Portuguese: "Modo streamer", "Usar modo streamer", and the leaf button says why it is off', pt[0] === 'Modo streamer' && pt[1] === 'Usar modo streamer' && /^O modo economia não está disponível enquanto o Modo streamer está ligado/.test(pt[2]), pt);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
