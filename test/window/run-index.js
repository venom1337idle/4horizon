const { chromium } = require('./pw');
const path = require('path');
const res = []; const ok = (l, c, x) => res.push((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x)));

// a stand-in for what preload.js gives the page
const BRIDGE = `
  window.__calls = []; window.__stats = null;
  window.__saved = { encryption: true, autoLogin: false, rows: [
    { n: 1, name: 'trainer1', user: 'trainer1@example.com', hasPassword: true }, { n: 2, name: '', user: '', hasPassword: false },
    { n: 3, name: '<img src=x onerror="window.__xss=1">', user: 'u3', hasPassword: true }, { n: 4, name: '', user: '', hasPassword: false } ] };
  const __bridgeObject = {
    onStats: cb => { window.__stats = cb; },
    accountsGet: async () => JSON.parse(JSON.stringify(window.__saved)),
    accountsSave: async p => { window.__calls.push(['save', p]); return window.__saveAnswer || { ok: true }; },
    accountsClearCache: async n => { window.__calls.push(['cache', n]); return { ok: true }; },
    accountsLogin: async w => { window.__calls.push(['login', w]); return { results: [{ n: 1, ok: true }, { n: 2, ok: false, reason: 'no-saved-login' }, { n: 3, ok: false, reason: 'no-login-form' }, { n: 4, ok: false, reason: 'panel-not-ready' }] }; },
    getHistory: async () => ({ days: {}, today: '2026-10-28', now: 0 }), exportCsv: async () => ({ ok: true })
  };
  Object.defineProperty(window, 'bridge', { value: __bridgeObject, writable: false, configurable: false, enumerable: true });   // what contextBridge does
  window.__reloads = [];
  HTMLUnknownElement.prototype.reload = function () { window.__reloads.push(this.id); };   // <webview> only exists inside Electron
`;

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(BRIDGE);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForTimeout(500);
  const dashBody = () => p.frameLocator('#dash').locator('body').evaluate(b => b.className);
  const dashVisible = () => p.evaluate(() => getComputedStyle(document.getElementById('dash')).display !== 'none');
  const css = (sel, prop) => p.evaluate(([s, pr]) => getComputedStyle(document.querySelector(s))[pr], [sel, prop]);

  // ---- the look: everything is in the bar
  const labels = await p.evaluate(() => Array.from(document.querySelectorAll('#bar > button, #bar #accBtns .pill')).map(b => b.textContent.trim()));      // textContent: below 1700 px the words are hidden but still there
  ok('top bar has Log in all, Reload all, 4 account pills, Panel, Simple, Accounts, Settings (History and Diagnostics are in Settings, Where to hunt is gone)', ['Log in all', 'Reload all', 'Panel', 'Simple', 'Accounts', 'Settings'].every(l => labels.includes(l)) && !labels.includes('History') && !labels.includes('Diagnostics') && (await p.locator('.pill').count()) === 4, labels);
  ok('"Dashboard" and "Panels" are gone (replaced by Simple and Panel)', !labels.includes('Dashboard') && !labels.includes('Panels'), labels);
  ok('the pills use the saved names (trainer1) and "Conta N" otherwise', (await p.locator('.pill .lbl').allInnerTexts()).join() === 'trainer1,Conta 2,<img src=x onerror="window.__xss=1">,Conta 4', await p.locator('.pill .lbl').allInnerTexts());
  ok('a name with HTML in it is shown as text, not run', (await p.evaluate(() => window.__xss)) === undefined);

  // ---- start: the four game screens, nothing else
  ok('start: Simple off, Panel off: only the 4 game screens', !(await dashVisible()) && !(await p.evaluate(() => document.body.className)).includes('simple'), await p.evaluate(() => document.body.className));

  // ---- the iframe fills the stage in every mode (it was once only 150 px tall)
  const fills = async () => p.evaluate(() => { const d = document.getElementById('dash').getBoundingClientRect(), s = document.getElementById('stage').getBoundingClientRect(); return Math.abs(d.height - s.height) < 2; });
  await p.click('#btnPanel'); await p.waitForTimeout(120); ok('Panel only: the summary column is as tall as the window', await fills()); await p.click('#btnPanel'); await p.waitForTimeout(120);
  await p.click('#btnSimple'); await p.waitForTimeout(120); ok('Simple: the dashboard is as tall as the window', await fills()); await p.click('#btnSimple'); await p.waitForTimeout(120);

  // ---- Simple: toggles the dashboard
  await p.click('#btnSimple'); await p.waitForTimeout(120);
  ok('Simple on: the dashboard shows (full size) and the button lights up', (await dashVisible()) && (await css('#dash', 'width')) === '1600px' && (await p.evaluate(() => document.getElementById('btnSimple').classList.contains('on'))));
  ok('Simple on, Panel off: the dashboard hides its summary and shows the main area', (await dashBody()).includes('no-summary') && !(await dashBody()).includes('no-main'), await dashBody());
  await p.click('#btnPanel'); await p.waitForTimeout(120);
  ok('Simple on + Panel on: summary AND main area', !(await dashBody()).includes('no-summary') && !(await dashBody()).includes('no-main'), await dashBody());
  await p.click('#btnPanel'); await p.waitForTimeout(120);
  await p.click('#btnSimple'); await p.waitForTimeout(120);
  ok('Simple off again: the dashboard is hidden and the 4 game screens are back', !(await dashVisible()));

  // ---- Panel: the summary, also next to the game screens
  await p.click('#btnPanel'); await p.waitForTimeout(120);
  ok('Panel on (Simple off): the summary appears as a column on the left', (await dashVisible()) && (await css('#dash', 'width')) === '336px', await css('#dash', 'width'));
  ok('...and only the summary (no main area) is drawn in it', (await dashBody()).includes('no-main') && !(await dashBody()).includes('no-summary'), await dashBody());
  ok('...and the game screens move to the right of it', (await css('#grid', 'left')) === '336px', await css('#grid', 'left'));
  await p.click('#btnPanel'); await p.waitForTimeout(120);
  ok('Panel off again: back to just the game screens', !(await dashVisible()) && (await css('#grid', 'left')) === '0px');

  // ---- History (Where to hunt is not part of the app any more)
  ok('there is no Where to hunt button in the top bar and no view for it in the dashboard', (await p.locator('#btnHunt').count()) === 0 && (await p.frameLocator('#dash').locator('#view-hunt, #huntHost').count()) === 0);
  await p.click('#btnSettings'); await p.waitForTimeout(200);
  ok('History: it is a section of Settings now (with its card inside), and Settings has no "Open history" button', await p.evaluate(() => !!document.querySelector('#settingsModal #historyHost .card') && !document.getElementById('btnHistory')));
  await p.click('#setClose');
  const tabs = await p.frameLocator('#dash').locator('#topTabs .vt').allInnerTexts();
  ok('the dashboard has only the Overview tab: no Where to hunt tab and no History tab or view', tabs.length === 1 && tabs[0] === 'Overview' && !tabs.some(x => /history|hunt/i.test(x)) && (await p.frameLocator('#dash').locator('#view-history').count()) === 0, tabs);

  // ---- pills: show / hide a screen
  await p.click('.pill[data-panel="2"]');
  ok('clicking a pill hides that game screen', (await css('#panel2', 'display')) === 'none' && (await css('#panel1', 'display')) !== 'none');
  ok('...the grid adapts (3 left = 2 columns x 2 rows)', (await css('#grid', 'gridTemplateColumns')).split(' ').length === 2);
  await p.click('.pill[data-panel="3"]'); await p.click('.pill[data-panel="4"]');
  ok('only one screen left: the grid is 1 x 1', (await css('#grid', 'gridTemplateColumns')).split(' ').length === 1 && (await css('#grid', 'gridTemplateRows')).split(' ').length === 1);
  ok('a hidden pill looks dimmed', (await css('.pill[data-panel="2"]', 'opacity')) === '0.5');
  await p.click('.pill[data-panel="2"]'); await p.click('.pill[data-panel="3"]'); await p.click('.pill[data-panel="4"]');
  ok('all back: 2 x 2', (await css('#grid', 'gridTemplateColumns')).split(' ').length === 2 && (await css('#grid', 'gridTemplateRows')).split(' ').length === 2);

  // ---- names from the game
  await p.evaluate(() => window.__stats(2, { name: 'trainer2', live: true }));
  await p.evaluate(() => window.__stats(1, { name: 'GameNameOne' }));
  ok('a character name from the game names the pill (trainer2), but a saved name wins (trainer1)', (await p.locator('.pill .lbl').allInnerTexts()).slice(0, 2).join() === 'trainer1,trainer2', await p.locator('.pill .lbl').allInnerTexts());

  // ---- Reload all, Log in all
  await p.click('#btnReloadAll');
  ok('Reload all reloads the four game panels', (await p.evaluate(() => window.__reloads)).join() === 'p1,p2,p3,p4', await p.evaluate(() => window.__reloads));
  await p.click('#btnLoginAll');
  await p.waitForTimeout(200);
  const toastText = await p.locator('#toast').innerText();
  ok('Log in all asks for all panels', JSON.stringify((await p.evaluate(() => window.__calls)).filter(c => c[0] === 'login')) === '[["login","all"]]');
  ok('...and says what happened per panel, in words', toastText.includes('trainer1: login sent') && toastText.includes('no saved login') && toastText.includes('already signed in') && toastText.includes('panel not ready'), toastText);

  // ---- the Accounts window
  await p.click('#btnAccounts');
  ok('Accounts opens the Saved accounts window with 4 rows', await p.locator('#modal').isVisible() && (await p.locator('.arow').count()) === 4);
  ok('saved values are shown; a saved password is NOT (only a "saved" hint)', (await p.inputValue('.arow[data-n="1"] .f-user')) === 'trainer1@example.com' && (await p.inputValue('.arow[data-n="1"] .f-pass')) === '' && (await p.getAttribute('.arow[data-n="1"] .f-pass', 'placeholder')).includes('saved'));
  ok('the "no encryption" warning is hidden when encryption works', await p.locator('#noCrypt').isHidden());
  await p.click('.arow[data-n="1"] .clr');
  await p.waitForTimeout(100);
  ok('Clear cache is asked for that panel', JSON.stringify((await p.evaluate(() => window.__calls)).filter(c => c[0] === 'cache')) === '[["cache",1]]');

  // fill row 2, leave row 1 untouched, remove row 3, switch on auto login, save
  await p.fill('.arow[data-n="2"] .f-name', 'trainer2'); await p.fill('.arow[data-n="2"] .f-user', 'v2@example.com'); await p.fill('.arow[data-n="2"] .f-pass', 'TypedSecret-2');
  await p.click('.arow[data-n="3"] .trash');
  await p.check('#autoLogin');
  await p.click('#aSave');
  await p.waitForTimeout(150);
  const save = (await p.evaluate(() => window.__calls)).filter(c => c[0] === 'save').pop()[1];
  const row = n => save.rows.find(r => r.n === n);
  ok('Save sends the typed password for row 2 only', row(2).password === 'TypedSecret-2' && row(1).password === undefined && row(3).password === undefined && row(4).password === undefined, save.rows);
  ok('...an untouched saved password is not sent (so it stays as it is)', !('password' in row(1)) && !('clearAll' in row(1)), row(1));
  ok('...the trash button sends "remove this account"', row(3).clearAll === true, row(3));
  ok('...auto login switch is sent', save.autoLogin === true);
  ok('the window closes, the password box is emptied, a message confirms', await p.locator('#modal').isHidden() && (await p.locator('#toast').innerText()) === 'Saved');
  ok('the pill takes the new saved name', (await p.locator('.pill .lbl').allInnerTexts())[1] === 'trainer2');
  ok('the typed password is not left sitting in the page', (await p.evaluate(() => Array.from(document.querySelectorAll('input')).some(i => i.value === 'TypedSecret-2'))) === false);

  // cancel / escape change nothing
  const callsBefore = (await p.evaluate(() => window.__calls)).length;
  await p.click('#btnAccounts'); await p.fill('.arow[data-n="4"] .f-user', 'should-not-save'); await p.click('#aCancel');
  await p.click('#btnAccounts'); await p.keyboard.press('Escape');
  ok('Cancel and Escape close the window without saving', await p.locator('#modal').isHidden() && (await p.evaluate(() => window.__calls)).filter(c => c[0] === 'save').length === 1 && (await p.evaluate(() => window.__calls)).length === callsBefore);

  // no encryption: warning
  await p.evaluate(() => { window.__saved.encryption = false; window.__saveAnswer = { ok: true, warning: 'no-encryption' }; });
  await p.click('#btnAccounts');
  ok('without encryption the window says so', await p.locator('#noCrypt').isVisible());
  await p.fill('.arow[data-n="4"] .f-pass', 'x'); await p.click('#aSave'); await p.waitForTimeout(100);
  ok('...and after saving it warns that the password was NOT stored', (await p.locator('#toast').innerText()).includes('NOT saved'), await p.locator('#toast').innerText());

  // ---- it remembers its state
  await p.click('#btnPanel'); await p.waitForTimeout(120); await p.click('#btnSimple'); await p.waitForTimeout(120);
  await p.reload(); await p.waitForTimeout(500);
  ok('after a restart: Simple and Panel are as they were left', (await p.evaluate(() => [document.getElementById('btnSimple').classList.contains('on'), document.getElementById('btnPanel').classList.contains('on')])).join() === 'true,true');
  ok('...and the dashboard got the same layout', !(await dashBody()).includes('no-summary') && !(await dashBody()).includes('no-main'), await dashBody());
  ok('no JavaScript errors', errors.length === 0, errors);
  console.log(res.join('\n'));
  await b.close();
})().catch(e => { console.log('FAILED: ' + e.message); process.exit(1); });
