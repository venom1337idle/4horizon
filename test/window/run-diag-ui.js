const { chromium } = require('./pw');
const path = require('path'); const fs = require('fs');
const out = console.log.bind(console);
const res = []; const ok = (l, c, x) => res.push((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x)));
const BRIDGE = fs.readFileSync('run-index.js', 'utf8').match(/const BRIDGE = `([\s\S]*?)`;/)[1].replace("name: '<img src=x onerror=\\\"window.__xss=1\\\">'", "name: 'trainer3'");
const PREVIEW_FONTS = `@font-face{font-family:'Cinzel';src:local('Lora');font-weight:100 900}@font-face{font-family:'Inter';src:local('Poppins');font-weight:100 900}`;
const wiki = L => Math.round(50 / 3 * (L ** 3 - 6 * L ** 2 + 17 * L - 12));
const TEAM = [{ id: '1', speciesId: 7, name: 'Squirtle', level: 84, xp: wiki(84) + 1000, hp: 369, maxHp: 492, slot: 1, shiny: false }, { id: '2', speciesId: 62, name: 'Poliwrath', level: 120, xp: wiki(120) + 379200, hp: 2032, maxHp: 3156, slot: 2, shiny: false }];
const ACC = (n, nm) => ({ frames: 230, firstAgeSec: 400, lastAgeSec: 2, kb: 120, types: [{ type: 'hunt-session', n: 120, lastAgeSec: 2 }, { type: 'ready', n: 1, lastAgeSec: 200 }] });
const MAIN = () => ({ v: 1, staleFiles: [], meta: { app: '4horizon', version: '1.0.0', build: 'lang-55', electron: '31.0.0', chrome: '126', node: '20', os: 'Windows_NT 10.0', platform: 'win32', arch: 'x64', locale: 'pt-BR', uptimeSec: 900, rssMB: 300 },
  files: [{ name: 'diag.js', size: 9000, ageDays: 0.1, sha8: 'abcd1234' }], features: [{ file: 'x.js', label: 'a part', ok: true, missingFile: false }],
  accounts: { 1: ACC(1), 2: ACC(2), 3: ACC(3), 4: ACC(4) }, fields: { ready: ['pokemon', 'pokemon[].teamSlot'] }, panels: [1, 2, 3, 4].map(n => ({ n: n, url: 'https://pokehorizonidle.com/', loading: false, crashed: false })),
  settings: { notify: { enabled: true, events: { shiny: true } }, tidy: { enabled: true }, accounts: { file: true, saved: 2, withPassword: 2, autoLogin: false, encryption: true }, history: { file: true, days: 2 }, species: { names: 493 } },
  errors: [], logs: [{ ageSec: 50, level: 'log', text: 'tidy (panel 1): closed the announcement popup' }] });
async function open(b, { w = 1500, h = 900, bridge = 'full', main = MAIN(), huntFile = null, noToast = false, clipboard = 'ok', loginResults = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (huntFile) await ctx.route('**/hunt-data.js', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(huntFile, 'utf8') }));
  const extra = `
    window.__diag = { main: ${JSON.stringify(main)}, probeAnswer: [{ n: 2, signedIn: false }, { n: 3, signedIn: true }], copied: null, saved: null, copyAnswer: true, saveAnswer: '${'C:\\\\\\\\Users\\\\\\\\x\\\\\\\\diag.txt'}', gets: 0 };
    ${bridge === 'none' ? '' : `__bridgeObject.diagGet = async () => { window.__diag.gets++; if (window.__diag.reject) throw new Error('nope'); return JSON.parse(JSON.stringify(window.__diag.main)); };`}
    ${bridge === 'full' ? `__bridgeObject.diagCopy = async t => { window.__diag.copied = t; return window.__diag.copyAnswer; };
    __bridgeObject.diagSave = async t => { window.__diag.saved = t; return window.__diag.saveAnswer; };
    __bridgeObject.diagProbe = async () => { window.__diag.probes = (window.__diag.probes || 0) + 1; if (window.__diag.probeReject) throw new Error('probe broke'); return window.__diag.probeAnswer; };` : ''}
    ${clipboard === 'ok' ? `Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__diag.clip = t; } }, configurable: true });` : `Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } }, configurable: true });`}
    ${loginResults ? `__bridgeObject.accountsLogin = async () => ({ results: ${JSON.stringify(loginResults)} });` : ''}
    HTMLUnknownElement.prototype.setZoomFactor = function () {};
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(PREVIEW_FONTS)}; document.head.appendChild(s); });`;
  await ctx.addInitScript(BRIDGE + extra);
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
  await p.goto('file://' + path.resolve('index.html')); await p.waitForTimeout(600);
  p.s = (n, d) => p.evaluate(([n, d]) => window.__stats(n, d), [n, d]);
  return p;
}
const feed = async p => {
  for (const n of [1, 2, 3, 4]) await p.s(n, { live: true, active: true, name: ['trainer1', 'trainer2', 'trainer3', 'trainer4'][n - 1], level: 130, startedAt: n, huntId: 'rock-60', defeated: 900, killsH: 600, captures: 20, catchesSeen: 6, combat: { hits: 240, kills: 120, counterKills: 120, messageKills: 120, gapMs: 1700, gapN: 100, spawnMs: 1900, spawnN: 100, startedAt: 1, size: 1, since: 1 }, lead: { speciesId: 2, level: 100 }, teamList: TEAM, teamActiveId: '2', bestIV: { name: 'Onix', iv: 120, max: 192, rarity: '\u00d71.1' }, lastCaught: { name: 'Onix', iv: 100, max: 192, rarity: '\u00d71.0', time: '10:00' } });
  await p.waitForTimeout(1300);
};
const rows = p => p.evaluate(() => Array.from(document.querySelectorAll('#diagCheck .ditem')).map(r => ({ id: r.className.replace('ditem s-', ''), title: r.querySelector('b').textContent, detail: r.querySelector('.dd').textContent, lines: Array.from(r.querySelectorAll('li')).map(l => l.textContent), todo: (r.querySelector('.dtodo') || {}).textContent || '' })));
const openDiag = async p => { await p.click('#btnSettings'); await p.click('#btnDiag'); await p.waitForSelector('#diagCheck .ditem', { timeout: 4000 }); };
const row = (rs, title) => rs.find(r => r.title === title);
(async () => {
  const b = await chromium.launch();
  // ============================================================== the healthy app, with the real dashboard answering
  let p = await open(b, { huntFile: 'hunt-data.full.js' }); await feed(p);
  ok('Diagnostics is no longer in the top bar: the Settings button is, after Accounts, and Diagnostics is inside Settings', await p.evaluate(() => { const ids = Array.from(document.querySelectorAll('#bar > button')).map(x => x.id); return ids.indexOf('btnDiag') < 0 && ids.indexOf('btnSettings') === ids.indexOf('btnAccounts') + 1 && !!document.querySelector('#settingsModal #btnDiag'); }));
  ok('the window is closed until the button is pressed', await p.evaluate(() => document.getElementById('diagModal').classList.contains('hidden')));
  await openDiag(p);
  ok('pressing it opens the window with the Self-check tab, a title, and the privacy sentence', await p.evaluate(() => !document.getElementById('diagModal').classList.contains('hidden') && document.getElementById('dtCheck').classList.contains('on') && /never passwords, e-mails or numbers from the game/.test(document.getElementById('diagIntro').textContent)));
  let rs = await rows(p);
  ok('12 checks are listed, each with a status badge', rs.length === 12 && rs.every(r => ['ok', 'warn', 'fail', 'unknown'].indexOf(r.id) >= 0), rs.map(r => r.title + ':' + r.id));
  ok('what the REAL dashboard sees reaches the checks: the team of 2 per account is found, and the XP is read as the TOTAL (the xp the stand-in game sends)', row(rs, 'Team (roster at login)').id === 'ok' && row(rs, 'XP bars').id === 'ok' && /TOTAL xp/.test(row(rs, 'XP bars').detail), [row(rs, 'Team (roster at login)'), row(rs, 'XP bars')]);
  ok('the best and last catch of the accounts are seen', row(rs, 'Best and last catch').id === 'ok', row(rs, 'Best and last catch'));
  ok('the five "only you can judge" items are shown under the checks', await p.evaluate(() => document.querySelectorAll('#diagCheck .dman li').length === 5 && /ONLY YOU CAN JUDGE THESE/.test(document.querySelector('#diagCheck .dman h3').textContent)));
  ok('the summary line counts the verdicts', /\d+ fine \u00b7 \d+ to look at \u00b7 \d+ failed \u00b7 \d+ cannot tell yet/.test(await p.locator('.dsum').first().innerText()));

  // ============================================================== the report tab, copy, save
  ok('lang-55: "Hide character names" is ticked at first (a report is often pasted somewhere public)', await p.evaluate(() => document.getElementById('diagHide').checked === true));
  await p.evaluate(() => { const c = document.getElementById('diagHide'); c.checked = false; c.dispatchEvent(new Event('change')); }); await p.waitForTimeout(150);          // (the checks below start with the names shown, then hide them)
  await p.click('#dtReport');
  ok('the Report tab shows the text, and hides the self-check', await p.evaluate(() => !document.getElementById('diagRepWrap').classList.contains('hidden') && document.getElementById('diagCheck').classList.contains('hidden') && /^4HORIZON DIAGNOSTICS/.test(document.getElementById('diagReport').textContent)));
  const reportText = await p.evaluate(() => document.getElementById('diagReport').textContent);
  ok('the report names the accounts as the dashboard sees them, with the team readings ("Lv 84 total")', /Account 2 \(trainer2\)/.test(reportText) && /Lv 120 total/.test(reportText) && /Lv 84 total/.test(reportText), reportText.slice(reportText.indexOf('ACCOUNTS AS'), reportText.indexOf('ACCOUNTS AS') + 500));
  await p.click('#diagCopy'); await p.waitForTimeout(200);
  ok('Copy puts exactly the report text on the clipboard (through the app) and says so', (await p.evaluate(() => window.__diag.copied)) === reportText && /Report copied/.test(await p.locator('#toast').innerText()));
  await p.evaluate(() => { window.__diag.copyAnswer = false; }); await p.click('#diagCopy'); await p.waitForTimeout(200);
  ok('if the app cannot copy, the browser clipboard is tried next, with the same text', (await p.evaluate(() => window.__diag.clip)) === reportText);
  await p.click('#diagSave'); await p.waitForTimeout(200);
  ok('Save as file hands the report to the app and says "Saved"', (await p.evaluate(() => window.__diag.saved)) === reportText && /Saved/.test(await p.locator('#toast').innerText()));
  await p.evaluate(() => { window.__diag.saveAnswer = null; }); await p.click('#diagSave'); await p.waitForTimeout(200);
  ok('cancelling the save dialog says "Not saved"', /Not saved/.test(await p.locator('#toast').innerText()));

  // ============================================================== hiding the names
  await p.click('#diagHide'); await p.waitForTimeout(150);
  const hiddenText = await p.evaluate(() => document.getElementById('diagReport').textContent);
  ok('"Hide character names": not one character name is left in the report, the accounts are Account 1..4', !/trainer\d/i.test(hiddenText) && /Account 2/.test(hiddenText) && /Character names: hidden/.test(hiddenText));
  await p.click('#dtCheck');
  ok('...also in the self-check the window shows', !/trainer\d/i.test(await p.locator('#diagCheck').innerText()));
  await p.click('#diagCopy'); await p.waitForTimeout(150);
  ok('...and the copied text is the hidden one', !/trainer\d/i.test(await p.evaluate(() => window.__diag.copied)));
  await p.click('#diagHide');

  // ============================================================== refresh, closing
  const before = await p.evaluate(() => window.__diag.gets);
  await p.evaluate(() => { window.__diag.main.errors = [{ ageSec: 3, src: 'team', msg: 'TypeError: boom' }]; });
  await p.click('#diagRefresh'); await p.waitForSelector('#diagCheck .ditem'); await p.waitForTimeout(100);
  rs = await rows(p);
  ok('Refresh asks the app again and shows the new state (an error appeared)', (await p.evaluate(() => window.__diag.gets)) === before + 1 && row(rs, 'Errors').id === 'warn' && /TypeError: boom/.test(row(rs, 'Errors').lines[0]), row(rs, 'Errors'));
  await p.click('#diagClose');
  ok('Close closes it', await p.evaluate(() => document.getElementById('diagModal').classList.contains('hidden')));
  await openDiag(p); await p.keyboard.press('Escape');
  ok('Escape closes it', await p.evaluate(() => document.getElementById('diagModal').classList.contains('hidden')));
  await openDiag(p); await p.mouse.click(5, 5);
  ok('a click on the dark background closes it', await p.evaluate(() => document.getElementById('diagModal').classList.contains('hidden')));
  await openDiag(p); await p.click('.dlg.wide h2');
  ok('a click inside the window does NOT close it', await p.evaluate(() => !document.getElementById('diagModal').classList.contains('hidden')));
  await p.keyboard.press('Escape');

  // ============================================================== things the window itself remembers: the last Log in all, errors
  await p.click('#btnLoginAll'); await p.waitForTimeout(400);
  await p.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { message: 'window boom', filename: 'file:///x/index.html', lineno: 12 })));
  await openDiag(p); rs = await rows(p);
  ok('the last "Log in all" shows up: "login sent" and "already signed in" are read from what the app answered', /Log in all, Account 1/.test(row(rs, 'Saved logins and Log in all').lines.join(' ')) && /already signed in/.test(row(rs, 'Saved logins and Log in all').lines.join(' ')), row(rs, 'Saved logins and Log in all'));
  ok('an error of the window itself is listed: "[window, ...] window boom (index.html:12)"', row(rs, 'Errors').id !== 'ok' && /\[window, .*window boom \(index\.html:12\)/.test(row(rs, 'Errors').lines.join(' ')), row(rs, 'Errors'));
  await p.keyboard.press('Escape');
  ok('no JavaScript errors from all of this', p.errors.length === 0, p.errors);
  await p.context().close();

  // ============================================================== the login-page look (new)
  p = await open(b, { huntFile: 'hunt-data.full.js' }); await feed(p); await openDiag(p);
  ok('there is a "Look at login pages" button in the window, with an explanation as its hover text', await p.evaluate(() => { const b = document.getElementById('diagProbe'); return !!b && /never what is typed/.test(b.title) && /Look at login pages/.test(b.textContent); }));
  const gets0 = await p.evaluate(() => window.__diag.gets);
  await p.click('#diagProbe'); await p.waitForTimeout(500);
  ok('pressing it asks the app to look (once), then refreshes the report (one more request), and says how many panels it looked at and how many were not sending data', (await p.evaluate(() => window.__diag.probes)) === 1 && (await p.evaluate(() => window.__diag.gets)) === gets0 + 1 && /Looked at 2 panels \(1 not sending data\)\. It is in the Report tab/.test(await p.locator('#toast').innerText()), [await p.evaluate(() => window.__diag.probes), await p.locator('#toast').innerText()]);
  await p.evaluate(() => { window.__diag.probeAnswer = [{ n: 1, signedIn: false }, { n: 2, signedIn: false }]; }); await p.click('#diagProbe'); await p.waitForTimeout(500);
  ok('two panels, both not sending data: "Looked at 2 panels (2 not sending data)"', /Looked at 2 panels \(2 not sending data\)/.test(await p.locator('#toast').innerText()));
  await p.evaluate(() => { window.__diag.probeAnswer = [{ n: 2, signedIn: true }]; }); await p.click('#diagProbe'); await p.waitForTimeout(500);
  ok('one panel, sending data: "Looked at 1 panel (0 not sending data)" (it is looked at anyway: it could be showing the login page while its connection is still alive)', /Looked at 1 panel \(0 not sending data\)/.test(await p.locator('#toast').innerText()));
  await p.evaluate(() => { window.__diag.probeAnswer = []; }); await p.click('#diagProbe'); await p.waitForTimeout(400);
  ok('no panel to look at yet: it says so, as a warning', /no game panel to look at yet/.test(await p.locator('#toast').innerText()));
  await p.evaluate(() => { window.__diag.probeAnswer = [{ n: 2, signedIn: false }, { n: 3, signedIn: true }]; });
  await p.evaluate(() => { window.__diag.probeReject = true; }); await p.click('#diagProbe'); await p.waitForTimeout(400);
  ok('if the app fails while looking, the error is shown and the window stays usable', /Could not look: probe broke/.test(await p.locator('#toast').innerText()) && await p.evaluate(() => !document.getElementById('diagModal').classList.contains('hidden')));
  await p.evaluate(() => { window.__diag.probeReject = false; window.__diag.main.loginPages = [{ n: 2, ageSec: 5, silentSec: 45, error: null, page: { url: 'https://pokehorizonidle.com/', title: 'Poke Horizon', ready: 'complete', forms: 0, passwordBoxes: 0, textBoxes: 0, canvas: 1, shadowRoots: 0, inputs: [], buttons: [{ text: 'Entrar com Google', type: '', visible: true, disabled: false, where: 'page' }], links: [], headings: [], frames: [], text: '' } }]; });
  await p.click('#diagProbe'); await p.waitForTimeout(500); await p.click('#dtReport');
  ok('after a look, the Report tab has the LOGIN PAGES section with what the app saw', /LOGIN PAGES/.test(await p.locator('#diagReport').innerText()) && /button: "Entrar com Google"/.test(await p.locator('#diagReport').innerText()));
  await p.click('#dtCheck'); const rs2 = await rows(p);
  ok('...and the self-check line about logins shows the page: "Panel 2 page ... 0 password boxes ... buttons: "Entrar com Google""', /Panel 2 page .*0 password boxes.*Entrar com Google/.test(row(rs2, 'Saved logins and Log in all').lines.join(' ')), row(rs2, 'Saved logins and Log in all'));
  // Log in all on a signed-out panel with no password box: what the person sees right after pressing the button
  p = await open(b, { huntFile: 'hunt-data.full.js', loginResults: [{ n: 1, ok: false, reason: 'no-saved-login' }, { n: 2, ok: false, reason: 'login-form-not-found' }, { n: 3, ok: false, reason: 'no-login-form' }, { n: 4, ok: true }] });
  await feed(p); await p.click('#btnLoginAll'); await p.waitForTimeout(400);
  const tt = await p.locator('#toast').innerText();
  ok('the toast after Log in all says it plainly: "signed out, but no password box was found" for the signed-out panel, "already signed in" only for the one that really is', /trainer2: signed out, but no password box was found/.test(tt) && /: already signed in \(no login form\)/.test(tt) && /trainer4: login sent/.test(tt) && !/trainer2: already signed in/.test(tt) && tt.indexOf('no password box') < tt.indexOf('already signed in'), tt);
  await p.context().close();

  // ============================================================== the build, and an app that runs old code (new)
  p = await open(b, { huntFile: 'hunt-data.full.js' }); await feed(p); await openDiag(p); rs = await rows(p);
  ok('the title shows both builds: "window lang-55 \u00b7 app lang-55", and "Parts" is OK', /window lang-55 \u00b7 app lang-55/.test(await p.locator('#diagBuild').innerText()) && row(rs, 'Parts of the app').id === 'ok', [await p.locator('#diagBuild').innerText(), row(rs, 'Parts of the app')]);
  await p.evaluate(() => { window.__diag.main.staleFiles = ['accounts.js', 'ws-reader.js']; }); await p.click('#diagRefresh'); await p.waitForSelector('#diagCheck .ditem'); await p.waitForTimeout(100); rs = await rows(p);
  ok('files changed after the app started: the FIRST row says so in red: "2 files changed after the app started ... OLD version", lists them, and says to quit from the tray', rs[0].title === 'Parts of the app' && rs[0].id === 'fail' && /OLD version/.test(rs[0].detail) && rs[0].lines.join() === 'accounts.js,ws-reader.js' && /Quit the app from the tray/.test(rs[0].todo), rs[0]);
  await p.click('#dtReport');
  ok('...and the report starts with it ("FILES CHANGED AFTER THE APP STARTED")', /FILES CHANGED AFTER THE APP STARTED \(still running the old version\): accounts\.js, ws-reader\.js/.test(await p.locator('#diagReport').innerText()));
  await p.click('#dtCheck');
  await p.evaluate(() => { window.__diag.main.staleFiles = []; window.__diag.main.meta.build = 'login-fix-1'; }); await p.click('#diagRefresh'); await p.waitForSelector('#diagCheck .ditem'); await p.waitForTimeout(100); rs = await rows(p);
  ok('the app behind the window is another build: FAIL, "window lang-55 but the app ... login-fix-1"', row(rs, 'Parts of the app').id === 'fail' && /build "lang-55" but the app behind it is build "login-fix-1"/.test(row(rs, 'Parts of the app').detail) && /app login-fix-1/.test(await p.locator('#diagBuild').innerText()), row(rs, 'Parts of the app'));
  await p.evaluate(() => { delete window.__diag.main.meta.build; }); await p.click('#diagRefresh'); await p.waitForSelector('#diagCheck .ditem'); await p.waitForTimeout(100);
  ok('an app from before the build marker: the title says "app old (no build)" and nothing breaks', /app old \(no build\)/.test(await p.locator('#diagBuild').innerText()) && p.errors.length === 0, p.errors);
  await p.context().close();

  // ============================================================== "already signed in" comes with its proof (new)
  p = await open(b, { huntFile: 'hunt-data.full.js', loginResults: [{ n: 2, ok: false, reason: 'no-login-form', lastMsgSec: 3 }, { n: 3, ok: false, reason: 'no-login-form', lastMsgSec: null }, { n: 4, ok: false, reason: 'login-form-not-found', lastMsgSec: 40 }] });
  await feed(p); await p.click('#btnLoginAll'); await p.waitForTimeout(400);
  const t3 = await p.locator('#toast').innerText();
  ok('the toast gives the evidence: "already signed in (it sent game data 3 s ago)"; without a number the old wording; a silent panel gets the other message', /trainer2: already signed in \(it sent game data 3 s ago\)/.test(t3) && /already signed in \(no login form\)/.test(t3) && /trainer4: signed out, but no password box was found/.test(t3), t3);
  await openDiag(p); rs = await rows(p);
  ok('...and the same evidence is in the self-check: "no login form on the page, and it sent game data 3 s ago"', /Account 2.*already signed in: no login form on the page, and it sent game data 3 s ago/.test(row(rs, 'Saved logins and Log in all').lines.join('\n')), row(rs, 'Saved logins and Log in all').lines);
  await p.context().close();

  // ============================================================== the Cloudflare outcome and the Accounts window (new)
  p = await open(b, { huntFile: 'hunt-data.full.js', loginResults: [{ n: 2, ok: false, reason: 'captcha-not-solved' }, { n: 3, ok: true, opened: true }, { n: 4, ok: true }] });
  await feed(p); await p.click('#btnLoginAll'); await p.waitForTimeout(400);
  const tc = await p.locator('#toast').innerText();
  ok('the toast for a Cloudflare check that did not pass says what to do: "click it once, then press Log in all again"; the others say "login sent"', /trainer2: the Cloudflare check did not pass by itself: click it once, then press Log in all again/.test(tc) && /login sent/.test(tc), tc);
  await p.click('#btnAccounts'); await p.waitForTimeout(300);
  const acc = await p.locator('#modal p').first().innerText();
  ok('the Accounts window says what Log in all does now: it presses "Entrar" to open the login window, waits for the Cloudflare check (never touching it), leaves signed-in panels alone', /presses "Entrar" to open the login window/.test(acc) && /Cloudflare check to pass by itself \(it never touches that box\)/.test(acc) && /signed in is left alone/.test(acc), acc);
  await p.context().close();

  // ============================================================== eggs, panels not in use, the trainer's EXP (new)
  const withEgg = MAIN();
  withEgg.eggs = [{ n: 3, ageSec: 12, path: 'breeding.eggs', count: 1, items: [{ id: 'text "egg-91"', readyAt: 'number(whole, 13 digits)', doubled: 'true', bonus: 'text "adupoke"' }] }];
  delete withEgg.accounts[1]; withEgg.settings.accounts.panels = { 1: { user: false, pass: true }, 2: { user: true, pass: true }, 3: { user: true, pass: true }, 4: { user: true, pass: true } };
  p = await open(b, { huntFile: 'hunt-data.full.js', main: withEgg }); await feed(p); await openDiag(p); rs = await rows(p);
  ok('a panel with no saved login that sent nothing is "not in use": the connection check is OK ("All 3 panels in use ... (1 not in use)"), not a warning', row(rs, 'Game connection').id === 'ok' && /All 3 panels in use are sending data \(1 not in use\)/.test(row(rs, 'Game connection').detail), row(rs, 'Game connection'));
  await p.click('#dtReport'); const rep = await p.locator('#diagReport').innerText();
  ok('the Report tab has the EGGS SEEN section with the egg: the path, one egg, and the kinds of its values (a 13-digit time, true, the label "adupoke")', /EGGS SEEN/.test(rep) && /breeding\.eggs \u00b7 1 egg/.test(rep) && /readyAt = number\(whole, 13 digits\) \u00b7 doubled = true \u00b7 bonus = text "adupoke"/.test(rep), rep.slice(rep.indexOf('EGGS SEEN'), rep.indexOf('EGGS SEEN') + 400));
  ok('...each account\u2019s line carries the trainer\u2019s xp reading and the captures seen ("trainer xp none ... captures seen 20")', /trainer xp \w+ \u00b7 combat [^\n]* \u00b7 captures seen \d+/.test(rep), rep.match(/.*trainer xp.*/g));
  await p.click('#dtCheck');
  await p.evaluate(() => { window.__diag.main.eggs = []; }); await p.click('#diagRefresh'); await p.waitForSelector('#diagCheck .ditem'); await p.waitForTimeout(100); await p.click('#dtReport');
  ok('with no egg seen the report says so', /EGGS SEEN: no incubating egg was seen on any connected account/.test(await p.locator('#diagReport').innerText()));
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();

  // ============================================================== the build in the title (new)
  p = await open(b, { huntFile: 'hunt-data.full.js' }); await feed(p);
  await openDiag(p); rs = await rows(p);
  ok('the title shows the new build on both sides: "window lang-55 \u00b7 app lang-55"', /window lang-55 \u00b7 app lang-55/.test(await p.locator('#diagBuild').innerText()), await p.locator('#diagBuild').innerText());
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();

  // ============================================================== hits per kill (new)
  p = await open(b, { huntFile: 'hunt-data.full.js' }); await feed(p); await openDiag(p); rs = await rows(p);
  const cr = row(rs, 'Hits per kill');
  ok('the window lists "Hits per kill" and it is OK: counted on the accounts that send data, the kill messages match the game\u2019s counter', cr && cr.id === 'ok' && /Counted on \d accounts; the kill messages match the game.s own kill counter/.test(cr.detail), cr);
  ok('...with a line per account: "2.00 hits per kill over 120 kills \u00b7 1.70 s between hits \u00b7 1.90 s from a kill to the first hit"', /2\.00 hits per kill over 120 kills \u00b7 1\.70 s between hits \u00b7 1\.90 s from a kill to the first hit \u00b7 kill messages 120 vs the game.s counter 120/.test(cr.lines.join('\n')), cr.lines);
  await p.click('#dtReport'); const crep = await p.locator('#diagReport').innerText();
  ok('the report has "combat hits 240, kills 120 (2.00 hits per kill)" on the account lines', /combat hits 240, kills 120 \(2\.00 hits per kill\) \u00b7 the game.s counter \+120 vs 120 kill messages \u00b7 1\.70 s between hits \(100\) \u00b7 1\.90 s from a kill to the first hit \(100\)/.test(crep), crep.match(/.*combat.*/g));
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();

  // ============================================================== an older install: the main-process part is not there
  p = await open(b, { bridge: 'none', huntFile: 'hunt-data.full.js' }); await feed(p);
  await openDiag(p); rs = await rows(p);
  ok('an older install (no bridge function): the window still opens, "Parts" says what to run, the checks that need the main process say "cannot tell"', row(rs, 'Parts of the app').id === 'warn' && /install-diagnostics\.js/.test(row(rs, 'Parts of the app').todo) && row(rs, 'Game connection').id === 'unknown', row(rs, 'Parts of the app'));
  ok('...the dashboard part still works there (XP is read)', row(rs, 'XP bars').id === 'ok');
  await p.click('#dtReport'); await p.click('#diagCopy'); await p.waitForTimeout(150);
  ok('...and the report can still be copied (through the browser clipboard when the app cannot), it says "NOT INSTALLED"', /NOT INSTALLED/.test(await p.evaluate(() => window.__diag.clip || '')), null);
  await p.click('#diagSave'); await p.waitForTimeout(150);
  ok('...saving says what is needed instead of failing', /Saving needs install-diagnostics\.js/.test(await p.locator('#toast').innerText()));
  await p.click('#diagProbe'); await p.waitForTimeout(200);
  ok('...and the login-page look says the same, instead of doing nothing', /Looking at login pages needs install-diagnostics\.js/.test(await p.locator('#toast').innerText()));
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();

  // ============================================================== things going wrong: the app refuses, the clipboard is denied
  p = await open(b, { huntFile: 'hunt-data.full.js', clipboard: 'denied' }); await feed(p);
  await p.evaluate(() => { window.__diag.reject = true; }); await openDiag(p); rs = await rows(p);
  ok('the app throwing when asked: handled like "not installed", no crash', row(rs, 'Parts of the app').id === 'warn' && p.errors.length === 0, p.errors);
  await p.evaluate(() => { window.__diag.reject = false; window.__diag.copyAnswer = false; }); await p.click('#diagRefresh'); await p.waitForSelector('#diagCheck .ditem'); await p.waitForTimeout(100);
  await p.click('#diagCopy'); await p.waitForTimeout(200);
  ok('when copying fails everywhere it says so and points to Save as file', /Could not copy\. Use Save as file/.test(await p.locator('#toast').innerText()));
  await p.context().close();

  // ============================================================== the dashboard does not answer
  p = await open(b, { huntFile: 'hunt-data.full.js' }); await feed(p);
  await p.evaluate(() => { document.getElementById('dash').src = 'about:blank'; }); await p.waitForTimeout(500);
  const t0 = Date.now(); await openDiag(p); const took = Date.now() - t0; rs = await rows(p);
  ok('a dashboard that does not answer is waited for 1.5 s, then the window carries on with "cannot tell" for what only the dashboard knows', took >= 1400 && took < 4000 && ['Team (roster at login)', 'XP bars'].every(t => row(rs, t).id === 'unknown') && row(rs, 'Game connection').id !== 'unknown', [took, rs.map(r => r.title + ':' + r.id)]);
  await p.context().close();

  // ============================================================== hostile text in the data is shown as text
  const hostile = MAIN(); hostile.logs.push({ ageSec: 1, level: 'log', text: 'tidy (panel 1): <img src=x onerror="window.__xss=1"> closed' }); hostile.errors = [{ ageSec: 1, src: '<b>team</b>', msg: '<img src=x onerror="window.__xss=2">' }];
  hostile.features = [{ file: '<i>x</i>.js', label: '<img src=x onerror="window.__xss=3">', ok: false, missingFile: false }];
  p = await open(b, { huntFile: 'hunt-data.full.js', main: hostile }); await feed(p); await openDiag(p);
  ok('HTML inside the collected data (log lines, errors, part names) is shown as plain text and runs nothing', (await p.evaluate(() => window.__xss)) === undefined && (await p.evaluate(() => document.querySelectorAll('#diagModal img, #diagModal .ditem b b, #diagModal .ditem li b, #diagModal .ditem li i').length)) === 0 && /<img src=x/.test(await p.locator('#diagCheck').innerText()));
  await p.context().close();

  // ============================================================== a small window
  p = await open(b, { w: 1100, h: 640, huntFile: 'hunt-data.full.js' }); await feed(p); await openDiag(p);
  const lay = await p.evaluate(() => { const d = document.querySelector('.dlg.wide').getBoundingClientRect(), body = document.getElementById('diagCheck'); const foot = document.querySelector('.dlg.wide .foot').getBoundingClientRect(); return { top: d.top, bottom: d.bottom, vh: innerHeight, footIn: foot.bottom <= innerHeight && foot.top >= 0, scrolls: body.scrollHeight > body.clientHeight, hOverflow: body.scrollWidth > body.clientWidth + 1, w: d.width, vw: innerWidth }; });
  ok('in a small window (1100 x 640) the dialog fits, the list scrolls inside it and the buttons stay in view', lay.top >= 0 && lay.bottom <= lay.vh && lay.footIn && lay.scrolls && !lay.hOverflow && lay.w <= lay.vw, lay);
  const bar = await p.evaluate(() => { const b = document.getElementById('bar'); return { over: b.scrollWidth > b.clientWidth + 1, diag: document.getElementById('btnSettings').getBoundingClientRect().right <= innerWidth }; });
  ok('the top bar still fits at 1100 px with the new button', !bar.over && bar.diag, bar);
  await p.screenshot({ path: 'diag-small.png' });
  await p.context().close();

  // ============================================================== pictures
  p = await open(b, { huntFile: 'hunt-data.full.js' }); await feed(p); await openDiag(p);
  await p.screenshot({ path: 'diag-check.png' }); await p.click('#dtReport'); await p.screenshot({ path: 'diag-report.png' });
  await p.context().close();
  out(res.join('\n')); await b.close();
})().catch(e => { out('FAILED: ' + e.message + '\n' + e.stack); process.exit(1); });
