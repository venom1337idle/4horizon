// run-history-settings.js: History as a section of the Settings window (no longer a tab of the dashboard)
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const CSVSTUB = `window.__csv = []; window.__csvAnswer = { ok: true, path: 'C:/x/' }; __bridgeObject.exportCsv = async (t, n) => { window.__csv.push({ t: t, n: n }); const a = window.__csvAnswer; return a.ok ? { ok: true, path: a.path + n } : a; };`;
const out = p => p.locator('#hxOut').innerText();
const total = async p => { const row = await p.locator('#hxOut table').first().locator('tbody tr').first().innerText(); return row.replace(/\s+/g, ' ').trim(); };
(async () => {
  const b = await chromium.launch();
  let p = await open(b, { extraInit: CSVSTUB, w: 1500, h: 1000 });
  ok('History is not on the top bar and not a tab of the dashboard', await p.evaluate(() => !document.getElementById('btnHistory')) && (await p.frameLocator('#dash').locator('#view-history, #historyHost').count()) === 0);
  await p.click('#btnSettings'); await p.waitForTimeout(400);
  ok('Settings has the section "HISTORY · DAILY TOTALS, SAVED ON THIS COMPUTER" with the real middle dot', /HISTORY · DAILY TOTALS, SAVED ON THIS COMPUTER/.test(await p.locator('#settingsModal .shead').allInnerTexts().then(a => a.join('|'))), await p.locator('#settingsModal .shead').allInnerTexts());
  // the totals are in a dropdown
  const dd = () => p.evaluate(() => { const t = document.getElementById('hxToggle'), o = document.getElementById('hxOut'); return { exp: t.getAttribute('aria-expanded'), shown: !!(o && o.offsetParent), sum: document.getElementById('hxSummary').textContent, lbl: t.querySelector('.lbl').textContent, noteInCard: !!document.querySelector('#historyHost .card > div:last-child:not(#hxOut):not(.hxToggle)') && /Gold is loot/.test(document.getElementById('historyHost').innerText) }; });
  const d0 = await dd();
  ok('the totals are in a dropdown that is closed at first: "Daily totals", a one-line summary (+1.34M gold · 10M XP · 19.3K kills), and no tables', d0.exp === 'false' && !d0.shown && d0.lbl === 'Daily totals' && d0.sum === '+1.34M gold · 10M XP · 19.3K kills', d0);
  ok('the long note about how the numbers are counted is not under the card any more (it is a tooltip)', !/Gold is loot \+ captures sold/.test(await p.locator('#historyHost').innerText()));
  await p.selectOption('#hxRange', '1'); await p.waitForTimeout(80);
  ok('the summary follows the period (Today: +510K gold · 3M XP · 7,500 kills)', (await dd()).sum === '+510K gold · 3M XP · 7,500 kills', await dd());
  await p.selectOption('#hxRange', '7'); await p.waitForTimeout(80);
  await p.click('#hxCsv'); await p.waitForTimeout(150);
  ok('Export CSV works while the dropdown is closed', (await p.evaluate(() => window.__csv)).length === 1 && /Saved to/.test(await p.locator('#hxMsg').innerText()));
  await p.evaluate(() => { window.__csv = []; });
  await p.click('#hxToggle'); await p.waitForTimeout(100);
  const d1 = await dd();
  ok('clicking the header opens it: the tables show and the arrow turns (aria-expanded true)', d1.exp === 'true' && d1.shown, d1);
  await p.click('#hxToggle'); await p.waitForTimeout(100);
  ok('clicking again closes it', (await dd()).exp === 'false' && !(await dd()).shown);
  await p.click('#hxToggle'); await p.waitForTimeout(100);
  const o = await out(p);
  ok('it is not stuck on "Loading…": the totals of the saved days are there', !/Loading/.test(o) && /BY DAY/.test(o) && /BY ACCOUNT/.test(o), o.slice(0, 200));
  const t0 = await total(p);
  ok('the last 7 days: total 19.3K kills, +1.34M gold, 10M xp', /Total \+1\.34M 10M 19\.3K/.test(t0), t0);
  ok('three days are listed, today marked, and the accounts by gold: trainer2, trainer4, trainer3', (await p.locator('#hxOut table').first().locator('tbody tr').count()) === 4 && /today/.test(o) && /trainer2[\s\S]*trainer4[\s\S]*trainer3/.test(o.slice(o.indexOf('BY ACCOUNT'))), o.slice(0, 700));
  await p.selectOption('#hxRange', '1'); await p.waitForTimeout(80);
  const t1 = await total(p);
  ok('"Today": 7,500 kills and +510K gold', /Total \+510K [\d.]+M 7,500/.test(t1), t1);
  const accs = await p.locator('#hxAcc option').allInnerTexts();
  ok('the account list has All accounts and the three that have history', JSON.stringify(accs) === '["All accounts","trainer2","trainer3","trainer4"]', accs);
  await p.selectOption('#hxRange', 'all'); await p.selectOption('#hxAcc', 'trainer3'); await p.waitForTimeout(80);
  ok('one account (trainer3): 800 kills', /Total [+\-]\d+K [\d.]+K 800/.test(await total(p)), await total(p));
  await p.selectOption('#hxAcc', 'all'); await p.waitForTimeout(80);
  await p.click('#hxCsv'); await p.waitForTimeout(150);
  const csv = await p.evaluate(() => window.__csv);
  ok('Export CSV sends the file name and the text to the main process, once', csv.length === 1 && csv[0].n === 'horizon-history-all-2026-10-29.csv', csv.map(x => x.n));
  ok('...the text has the header and one line per day and account (5), with the right gold of the first (trainer2, 28 Oct: 650000)', csv[0].t.split('\r\n').filter(Boolean).length === 6 && /^date,account,gold_net,/.test(csv[0].t) && /2026-10-28,"trainer2",650000,/.test(csv[0].t), csv[0].t.slice(0, 300));
  ok('...and the answer shows next to the buttons: Saved to C:/x/horizon-history-all-2026-10-29.csv', /Saved to C:\/x\/horizon-history-all-2026-10-29\.csv/.test(await p.locator('#hxMsg').innerText()), await p.locator('#hxMsg').innerText());
  await p.evaluate(() => { window.__csvAnswer = { canceled: true }; }); await p.click('#hxCsv'); await p.waitForTimeout(150);
  ok('a cancelled save dialog says nothing', (await p.locator('#hxMsg').innerText()) === '', await p.locator('#hxMsg').innerText());
  await p.evaluate(() => { window.__csvAnswer = { ok: false }; }); await p.click('#hxCsv'); await p.waitForTimeout(150);
  ok('a save that failed says "Could not save"', /Could not save/.test(await p.locator('#hxMsg').innerText()));

  // fresh numbers every time Settings is opened
  await p.evaluate(() => { window.bridge.getHistory = async () => ({ today: '2026-10-29', now: 0, days: { '2026-10-29': { trainer2: { kills: 5, xp: 10, captures: 1, shiny: 0, loot: 100, capture: 0, supplies: 0, ms: 3600000 } } } }); });
  await p.click('#setClose'); await p.click('#btnSettings'); await p.waitForTimeout(300);
  ok('opening Settings again keeps the dropdown as it was left (open)', (await dd()).exp === 'true' && (await dd()).shown);
  await p.selectOption('#hxRange', '7'); await p.waitForTimeout(80);
  ok('opening Settings again asks for the numbers again (5 kills now)', /Total \+100 10 5 /.test(await total(p)), await total(p));
  await p.evaluate(() => { window.bridge.getHistory = async () => { throw new Error('boom'); }; });
  await p.click('#setClose'); await p.click('#btnSettings'); await p.waitForTimeout(300);
  ok('when the main process cannot give it, the card says "History error: boom"', /History error: boom/.test(await p.locator('#hxMsg').innerText()), await p.locator('#hxMsg').innerText());
  await p.reload(); await p.waitForTimeout(700); await p.click('#btnSettings'); await p.waitForTimeout(400);
  ok('the choice is remembered after the app is started again (open)', (await dd()).exp === 'true', await dd());
  ok('no JavaScript errors in the window or in the dashboard', p.errors.length === 0, p.errors); await p.context().close();

  // Portuguese
  p = await open(b, { extraInit: CSVSTUB, lang: 'pt-BR', w: 1500, h: 1000 });
  await p.click('#btnSettings'); await p.waitForTimeout(400);
  const ptSum = await p.locator('#hxSummary').innerText(); const ptLbl = await p.locator('#hxToggle .lbl').innerText();
  ok('in Portuguese the dropdown says Totais diários and the summary +1,34M dinheiro · 10M XP · 19,3K kills', ptLbl === 'Totais diários' && ptSum === '+1,34M dinheiro · 10M XP · 19,3K kills', [ptLbl, ptSum]);
  await p.click('#hxToggle'); await p.waitForTimeout(100);
  const ptHead = (await p.locator('#settingsModal .shead').allInnerTexts()).join('|'), pto = await out(p), ptBar = await p.locator('#historyHost').innerText();
  ok('in Portuguese the section is in Portuguese: title, period, account, Export, table heads', /HISTÓRICO/.test(ptHead) && /Período/.test(ptBar) && /Conta/.test(ptBar) && /Exportar CSV/.test(ptBar) && /POR DIA/.test(pto) && /POR CONTA/.test(pto), [ptHead, ptBar.slice(0, 120)]);
  ok('...with the numbers of the language: 19,3K kills and +1,34M gold', /Total \+1,34M 10M 19,3K/.test(await total(p)), await total(p));
  ok('...and no English line is left in the History section', !/\b(Last 7 days|All accounts|Export CSV|BY DAY|BY ACCOUNT|Nothing saved|Loading|Gold is loot)\b/.test(ptBar + ' ' + pto), ptBar + pto);
  await p.selectOption('#hxRange', '1'); await p.waitForTimeout(80);
  ok('...and the period list is in Portuguese (Hoje)', /Hoje/.test(await p.locator('#hxRange').innerText()));
  await p.evaluate(() => I18N.setLang('en')); await p.waitForTimeout(150);
  ok('changing the language while it is open writes the card again in English', /Export CSV/.test(await p.locator('#historyHost').innerText()) && /BY DAY/.test(await out(p)));
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // a small window: the table scrolls inside the section, the dialog does not grow sideways, Close stays in view
  p = await open(b, { extraInit: CSVSTUB, w: 1100, h: 640 });
  await p.click('#btnSettings'); await p.waitForTimeout(400); await p.click('#hxToggle'); await p.waitForTimeout(100);
  const fit = await p.evaluate(() => { const s = document.querySelector('#settingsModal .sbody'), d = document.querySelector('#settingsModal .dlg').getBoundingClientRect(), c = document.getElementById('setClose').getBoundingClientRect();
    return { sideways: s.scrollWidth > s.clientWidth + 1, dlgRight: Math.round(d.right), w: innerWidth, closeVisible: c.bottom <= innerHeight }; });
  ok('at 1100 x 640 the dialog stays inside the window, nothing scrolls sideways except the table, and Close is in view', !fit.sideways && fit.dlgRight <= fit.w && fit.closeVisible, fit);
  await p.evaluate(() => document.getElementById('historyHost').scrollIntoView()); await p.waitForTimeout(100); await p.screenshot({ path: 'history-settings-small.png' });
  await p.context().close();

  // no bridge: a plain message, not "Loading…" for ever
  p = await open(b, { extraInit: 'delete __bridgeObject.getHistory;', w: 1500, h: 1000 });
  await p.click('#btnSettings'); await p.waitForTimeout(300); await p.click('#hxToggle'); await p.waitForTimeout(100);
  ok('without the history function of the bridge the card says it is only available inside the app window', /only available inside the app window/.test(await out(p)) && !/Loading/.test(await out(p)), await out(p));
  await p.context().close();

  p = await open(b, { extraInit: CSVSTUB, w: 1500, h: 1000 }); await p.click('#btnSettings'); await p.waitForTimeout(400); await p.click('#hxToggle'); await p.waitForTimeout(100);
  await p.evaluate(() => document.getElementById('historyHost').scrollIntoView()); await p.waitForTimeout(100); await p.screenshot({ path: 'history-settings.png' }); await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
