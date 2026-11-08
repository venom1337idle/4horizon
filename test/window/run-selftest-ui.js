// run-selftest-ui.js (lang-67): the "Check the game" button of the Diagnostics window: its short answer (all found / what is missing), in English and Portuguese
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 400))); c ? pass++ : fail++; };
const STUB = r => `__bridgeObject.diagGet = async () => ({ v: 1, meta: { app: '4horizon', version: '1.0.6' } }); __bridgeObject.diagSelfTest = async () => (${JSON.stringify(r)});`;
const press = async p => { await p.click('#btnSettings'); await p.waitForTimeout(200); await p.click('#btnDiag'); await p.waitForTimeout(600); await p.click('#diagSelfTest'); await p.waitForTimeout(700); return p.evaluate(() => document.getElementById('toast').textContent); };
(async () => {
  const b = await chromium.launch();
  let p = await open(b, { extraInit: STUB({ panels: 4, huntsSeen: false, problems: 0, list: [] }) });
  ok('the Diagnostics window has a "Check the game" button, next to "Look at login pages"', await p.evaluate(() => { const x = document.getElementById('diagSelfTest'); return !!x && x.textContent === 'Check the game' && x.previousElementSibling && x.previousElementSibling.id === 'diagProbe'; }));
  let t = await press(p);
  ok('everything found: "Everything 4horizon needs was found on 4 panels", with the hint to open the Hunts panel to have it checked too', /^Everything 4horizon needs was found on 4 panels \(Open the Hunts panel on one account first to have it checked too\.\)$/.test(t), t);
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await p.context().close();
  p = await open(b, { extraInit: STUB({ panels: 4, huntsSeen: true, problems: 2, list: [] }) });
  t = await press(p);
  ok('something missing: how many, and where to look (GAME CHECK in the Report tab); no hint when the Hunts panel was seen', t === '2 things 4horizon needs were not found. See the Report tab (GAME CHECK)', t);
  await p.context().close();
  p = await open(b, { extraInit: STUB({ panels: 4, huntsSeen: true, problems: 0, list: [] }), lang: 'pt-BR' });
  t = await press(p);
  ok('in Portuguese: "Verificar o jogo", "Tudo o que o 4horizon usa foi encontrado em 4 painéis"', (await p.evaluate(() => document.getElementById('diagSelfTest').textContent)) === 'Verificar o jogo' && t === 'Tudo o que o 4horizon usa foi encontrado em 4 painéis', t);
  await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
