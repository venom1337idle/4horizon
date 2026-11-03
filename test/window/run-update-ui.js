// run-update-ui.js (lang-58): the version of the app in the top bar, the Update button (only when a newer release is out), and Accounts moved
// from the top bar into Settings, under Game panels.
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 500))); c ? pass++ : fail++; };
const STUB = avail => `window.__up = { avail: ${avail}, opened: 0 };
  __bridgeObject.updateGet = async () => ({ version: '1.0.2', latest: window.__up.avail ? '1.0.3' : '1.0.2', available: window.__up.avail, url: 'https://github.com/venom1337idle/4horizon/releases/tag/v1.0.3' });
  __bridgeObject.updateOpen = async () => { window.__up.opened++; return { ok: true }; };
  __bridgeObject.accountsGet = async () => ({ encryption: true, autoLogin: false, rows: [1, 2, 3, 4].map(n => ({ n, name: 'trainer' + n, user: 'u' + n, hasPassword: true })) });`;
const bar = p => p.evaluate(() => ({ ids: Array.from(document.querySelectorAll('#bar > button, #bar > span[id]')).map(x => x.id), ver: document.getElementById('appVer').textContent, upShown: getComputedStyle(document.getElementById('btnUpdate')).display !== 'none', upTitle: document.getElementById('btnUpdate').title, accInBar: !!document.querySelector('#bar #btnAccounts') }));

(async () => {
  const b = await chromium.launch();
  // ---- up to date
  let p = await open(b, { extraInit: STUB(false) }); await p.waitForTimeout(400);
  let s = await bar(p);
  ok('the top bar shows the version of the app ("v1.0.2") where Accounts was, before Settings', s.ver === 'v1.0.2' && !s.accInBar && s.ids.indexOf('appVer') === s.ids.indexOf('btnSettings') - 2 && s.ids.indexOf('btnUpdate') === s.ids.indexOf('btnSettings') - 1, s);
  ok('...no Update button while this is the latest version', !s.upShown, s);
  // Accounts in Settings, under Game panels
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const rows = await p.evaluate(() => Array.from(document.querySelectorAll('#settingsModal .srow > div:first-child b')).map(x => x.textContent));
  ok('Settings: "Accounts" is the row right under "Game panels", with an "Open accounts" button', rows[0] === 'Game panels' && rows[1] === 'Accounts' && (await p.evaluate(() => document.getElementById('btnAccounts').closest('.srow').querySelector('b').textContent === 'Accounts' && document.getElementById('btnAccounts').textContent.trim() === 'Open accounts')), rows.slice(0, 3));
  await p.click('#btnAccounts'); await p.waitForTimeout(300);
  const st = await p.evaluate(() => ({ acc: !document.getElementById('modal').classList.contains('hidden'), set: !document.getElementById('settingsModal').classList.contains('hidden'), rows: document.querySelectorAll('#arows .arow').length }));
  ok('"Open accounts": the Accounts window opens (Settings steps aside)', st.acc && !st.set && st.rows === 4, st);
  await p.click('#aCancel'); await p.waitForTimeout(250);
  ok('...closing it brings Settings back, where you were', await p.evaluate(() => document.getElementById('modal').classList.contains('hidden') && !document.getElementById('settingsModal').classList.contains('hidden')));
  await p.click('#btnAccounts'); await p.waitForTimeout(250); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  ok('...also with Escape', await p.evaluate(() => document.getElementById('modal').classList.contains('hidden') && !document.getElementById('settingsModal').classList.contains('hidden')));
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();
  // ---- a newer version is out
  p = await open(b, { extraInit: STUB(true) }); await p.waitForTimeout(400);
  s = await bar(p);
  ok('a newer version is out: the Update button shows next to the version, and says which version', s.upShown && s.ver === 'v1.0.2' && /^Version 1\.0\.3 is out: opens its page, to download the new installer$/.test(s.upTitle), s);
  await p.click('#btnUpdate'); await p.waitForTimeout(300);
  const toastT = await p.evaluate(() => document.getElementById('toast').textContent);
  ok('...pressed: the page of the new version is opened (by the main process), and a message says what to do', (await p.evaluate(() => window.__up.opened)) === 1 && /download the installer there and run it/.test(toastT), toastT);
  const look = await p.evaluate(() => { const u = getComputedStyle(document.getElementById('btnUpdate')), other = getComputedStyle(document.getElementById('btnSettings')).color, v = document.getElementById('appVer').getBoundingClientRect(), bb = document.getElementById('btnUpdate').getBoundingClientRect(), se = document.getElementById('btnSettings').getBoundingClientRect(); return { color: u.color, other: other, vy: Math.round(v.top + v.height / 2), by: Math.round(bb.top + bb.height / 2), sy: Math.round(se.top + se.height / 2), order: v.right <= bb.left + 1 && bb.right <= se.left + 1 }; });
  ok('...it stands out (gold), on one line with the version and Settings', (c => c && c[0] > 200 && c[1] > 170 && c[2] < 140)((look.color.match(/\d+/g) || []).map(Number)) && look.color !== look.other && Math.abs(look.vy - look.by) <= 2 && Math.abs(look.by - look.sy) <= 2 && look.order, look);
  // it shows up later too (checked again when the window gets the focus)
  await p.evaluate(() => { window.__up.avail = false; window.dispatchEvent(new Event('focus')); }); await p.waitForTimeout(300);
  ok('when the app is up to date again (after updating), the button goes away', !(await bar(p)).upShown);
  ok('no JavaScript errors (update)', p.errors.length === 0, p.errors);
  await p.context().close();
  // ---- an app without the bridge (older main process): no version, no button, no error
  p = await open(b, {}); await p.waitForTimeout(400); s = await bar(p);
  ok('without the update bridge: no version text, no button, no error', s.ver === '' && !s.upShown && p.errors.length === 0, s);
  await p.context().close();
  // ---- Portuguese
  p = await open(b, { extraInit: STUB(true), lang: 'pt-BR' }); await p.waitForTimeout(400);
  s = await bar(p);
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const pt = await p.evaluate(() => ({ up: document.querySelector('#btnUpdate .bl').textContent, acc: document.getElementById('btnAccounts').closest('.srow').querySelector('b').textContent, btn: document.getElementById('btnAccounts').textContent.trim() }));
  ok('in Portuguese: "Atualizar", "Contas", "Abrir contas", and the tooltip', pt.up === 'Atualizar' && pt.acc === 'Contas' && pt.btn === 'Abrir contas' && /^A versão 1\.0\.3 saiu/.test(s.upTitle), [pt, s.upTitle]);
  await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
