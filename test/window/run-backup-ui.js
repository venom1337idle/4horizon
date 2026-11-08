// run-backup-ui.js (lang-67): Settings › Settings backup in the window: what is sent when saving (the window's part and the Summary's), what is
// applied when loading (only values that make sense), the window loaded again; the reasons in Portuguese.
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 500))); c ? pass++ : fail++; };
const STUB = imp => `window.__sent = null;
  __bridgeObject.settingsExport = async part => { window.__sent = part; return { ok: true, file: '4horizon-settings.json' }; };
  __bridgeObject.settingsImport = async () => (${JSON.stringify(imp)});`;
(async () => {
  const b = await chromium.launch();
  let p = await open(b, { extraInit: STUB({ ok: true, done: [], window: {}, summary: {} }) });
  await p.evaluate(() => { localStorage.setItem('hg.panels', '3'); localStorage.setItem('hg.simple', 'true'); });
  await p.dash().evaluate(() => { localStorage.setItem('4h.capSort', 'iv'); });
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const row = await p.evaluate(() => { const r = document.getElementById('btnSetExport').closest('.srow'); return { title: r.querySelector('b').textContent, prev: r.previousElementSibling.querySelector('b').textContent, buttons: [document.getElementById('btnSetExport').textContent, document.getElementById('btnSetImport').textContent] }; });
  ok('Settings: "Settings backup" right under Accounts, with "Save to a file" and "Load from a file"', row.title === 'Settings backup' && row.prev === 'Accounts' && row.buttons.join('|') === 'Save to a file|Load from a file', row);
  await p.click('#btnSetExport'); await p.waitForTimeout(1800);
  const sent = await p.evaluate(() => window.__sent), toast1 = await p.evaluate(() => document.getElementById('toast').textContent);
  ok('saving sends the window\u2019s part (3 panels, Simple) and the Summary\u2019s (asked by message: the capture sort)', sent && sent.window.panels === 3 && sent.window.simple === true && sent.summary && sent.summary.capSort === 'iv' && !('huntMemo' in sent.window), sent);
  ok('...and says where it was saved', toast1 === 'Settings saved to 4horizon-settings.json', toast1);
  await p.context().close();
  // loading: good values applied, bad ones not, the window loaded again
  p = await open(b, { extraInit: STUB({ ok: true, done: ['notifications'], window: { panels: 2, simple: false, zoom: { 1: 0.8, 9: 5 }, hidden: [7] }, summary: { capSort: 'quality', sum: { locked: true } } }) });
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  await p.click('#btnSetImport'); await p.waitForTimeout(400);
  const st = await p.evaluate(() => ({ panels: localStorage.getItem('hg.panels'), simple: localStorage.getItem('hg.simple'), zoom: localStorage.getItem('hg.zoom'), hidden: localStorage.getItem('hg.hidden'), toast: document.getElementById('toast').textContent }));
  const dsum = await p.dash().evaluate(() => ({ cap: localStorage.getItem('4h.capSort'), sum: localStorage.getItem('4h.summary') }));
  ok('loading: the values that make sense are applied (2 panels, Simple off); a zoom for panel 9 and a hidden panel 7 are not', st.panels === '2' && st.simple === 'false' && st.zoom === null && st.hidden !== '[7]', st);          // (the app itself may write an empty list of hidden panels)
  ok('...the Summary\u2019s part goes to the Summary (capture sort, its settings)', dsum.cap === 'quality' && /"locked":true/.test(dsum.sum || ''), dsum);
  ok('...and the window says it loads again', st.toast === 'Settings loaded: the window is loading again\u2026', st.toast);
  await p.waitForTimeout(1500);
  ok('...and does (2 panels now)', (await p.evaluate(() => document.querySelectorAll('#accBtns .pill').length)) === 2);
  await p.context().close();
  p = await open(b, { extraInit: STUB({ ok: false, reason: 'not a 4horizon settings file' }), lang: 'pt-BR' });
  await p.click('#btnSettings'); await p.waitForTimeout(250); await p.click('#btnSetImport'); await p.waitForTimeout(400);
  const t = await p.evaluate(() => document.getElementById('toast').textContent);
  ok('a refused file, in Portuguese: "Não carregado: não é um arquivo de configurações do 4horizon"', t === 'Não carregado: não é um arquivo de configurações do 4horizon', t);
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
