// run-iv-colors.js: the colour of the IV, in every place of the app that writes one (the ladder of the game, with red above 180)
const { chromium } = require('./pw');
const { open, feedAll } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const rgb = h => { const n = parseInt(h.slice(1), 16); return 'rgb(' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', ') + ')'; };
const L = { gray: rgb('#d3d3d3'), green: rgb('#88e788'), blue: rgb('#0f52ba'), purple: rgb('#8a00c4'), orange: rgb('#ffa500'), red: rgb('#95101b') };
const expect = iv => iv > 180 ? L.red : iv >= 168 ? L.orange : iv >= 144 ? L.purple : iv >= 113 ? L.blue : iv >= 90 ? L.green : L.gray;
const IVS = [60, 89, 90, 112, 113, 143, 144, 166, 167, 168, 174, 180, 181, 185, 190, 192];
const cat = (iv, i) => ({ catchEvent: { name: 'Mon' + iv, iv: iv, max: 192, quality: 1.2, rarity: 'Rara \u00d71.2', shiny: false }, catchSeq: 500 + i });
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { w: 1700, h: 1000 }); await feedAll(p);
  const fr = p.dash();
  // ---- the function itself
  const f = await fr.evaluate(([ivs]) => ivs.map(iv => [iv, window.HG_IV(iv)]), [IVS.concat([0, 191, 179, 182])]);
  const bad = f.filter(([iv, c]) => { const col = c; const hex = { '#d3d3d3': 'gray', '#88e788': 'green', '#0f52ba': 'blue', '#8a00c4': 'purple', '#ffa500': 'orange', '#95101b': 'red' }[col]; const want = iv > 180 ? 'red' : iv >= 168 ? 'orange' : iv >= 144 ? 'purple' : iv >= 113 ? 'blue' : iv >= 90 ? 'green' : 'gray'; return hex !== want; });
  ok('the ladder: gray below 90, green from 90, blue from 113, purple from 144, orange from 168, red above 180 (181 and up to 192), at every limit', bad.length === 0, bad);
  ok('the red is the dark red of the game (#95101b), measured on its badge (#950f1c)', (await fr.evaluate(() => window.HG_IV(181))) === '#95101b');
  ok('what the screenshot of the game shows: 181 red, 174 orange, 168 orange, 166 purple', (await fr.evaluate(() => [181, 174, 168, 166].map(window.HG_IV).join())) === '#95101b,#ffa500,#ffa500,#8a00c4');
  ok('190 and 192 are red as well (the pale yellow that was only a guess for them is gone)', (await fr.evaluate(() => [190, 191, 192].map(window.HG_IV).join())) === '#95101b,#95101b,#95101b');
  // ---- the catches (two batches, so that every tier is in the list of the latest captures)
  const readCaps = async () => (await fr.evaluate(() => Array.from(document.querySelectorAll('#view-overview .cap .iv')).map(e => [e.textContent.trim(), getComputedStyle(e).color]))).filter(c => /^\d+\/192$/.test(c[0]));
  const feed = async ivs => { for (let i = 0; i < ivs.length; i++) await p.s(3, cat(ivs[i], i)); await p.waitForTimeout(300); await fr.evaluate(() => renderAll()); await p.waitForTimeout(200); };
  await feed([166, 167, 168, 174, 180, 181, 185, 192]);
  let seen = await readCaps(), wrong = seen.filter(c => c[1] !== expect(parseInt(c[0])));
  ok('Latest captures (166 to 192): ' + seen.length + ' rows, each IV in the colour of its tier; 181, 185 and 192 are red, 168, 174 and 180 orange, 166 and 167 purple', seen.length >= 8 && wrong.length === 0 && seen.filter(c => /^(181|185|192)\//.test(c[0])).every(c => c[1] === L.red) && seen.filter(c => /^(168|174|180)\//.test(c[0])).every(c => c[1] === L.orange) && seen.filter(c => /^(166|167)\//.test(c[0])).every(c => c[1] === L.purple), [seen.length, wrong]);
  await feed([60, 89, 90, 112, 113, 143, 144, 190]);
  seen = await readCaps(); wrong = seen.filter(c => c[1] !== expect(parseInt(c[0])));
  ok('Latest captures (60 to 190): gray below 90, green 90 to 112, blue 113 to 143, purple from 144, and 190 red', seen.length >= 8 && wrong.length === 0 && seen.some(c => c[0] === '89/192' && c[1] === L.gray) && seen.some(c => c[0] === '90/192' && c[1] === L.green) && seen.some(c => c[0] === '113/192' && c[1] === L.blue) && seen.some(c => c[0] === '144/192' && c[1] === L.purple) && seen.some(c => c[0] === '190/192' && c[1] === L.red), [seen, wrong]);
  // the table of the accounts: the best catch and the last catch
  await p.s(2, { bestIV: { name: 'Exeggcute', iv: 181, max: 192, rarity: 'Rara \u00d71.5', quality: 1.5, shiny: false }, lastCaught: { name: 'Magikarp', iv: 174, max: 192, rarity: 'Lend\u00e1ria \u00d71.8', quality: 1.8, shiny: false, time: '11:59' } });
  await p.s(4, { bestIV: { name: 'Gengar', iv: 192, max: 192, rarity: 'Lend\u00e1ria \u00d71.9', quality: 1.9, shiny: false }, lastCaught: { name: 'Seel', iv: 166, max: 192, rarity: 'Rara \u00d71.4', quality: 1.4, shiny: false, time: '11:58' } });
  await p.waitForTimeout(300); await fr.evaluate(() => renderAll()); await p.waitForTimeout(200);
  const cells = await fr.evaluate(() => { const out = []; document.querySelectorAll('#view-overview table td span').forEach(e => { const t = e.textContent.trim(); if (e.children.length === 0 && /^\d+\/192$/.test(t)) out.push([t, getComputedStyle(e).color]); }); return out; });
  ok('Best catch and Last catch in the table of the accounts: 181/192 and 192/192 are red, 174/192 orange, 166/192 purple', ['181', '192'].every(n => cells.some(c => c[0] === n + '/192' && c[1] === L.red)) && cells.some(c => c[0] === '174/192' && c[1] === L.orange) && cells.some(c => c[0] === '166/192' && c[1] === L.purple) && cells.every(c => c[1] === expect(parseInt(c[0]))), cells);
  // the Summary of one account: Last catch, with its tier and IV in colour
  await fr.evaluate(() => { selected = 1; renderAll(); }); await p.waitForTimeout(250);
  const side = await fr.evaluate(() => { const row = Array.from(document.querySelectorAll('#sideBody .row')).find(r => /Best catch/.test(r.textContent)); return row ? { text: row.querySelector('.v').innerText.replace(/\s+/g, ' ').trim(), ivs: Array.from(row.querySelectorAll('span')).filter(e => e.children.length === 0 && /^\d+\/192$/.test(e.textContent.trim())).map(e => [e.textContent.trim(), getComputedStyle(e).color]) } : null; });
  ok('the Summary of an account, row Best catch: the name, the tier and the IV (181/192, red), as in the table', side && /^Exeggcute .*181\/192$/.test(side.text) && side.ivs.length === 1 && side.ivs[0][0] === '181/192' && side.ivs[0][1] === L.red, side);
  await fr.evaluate(() => { selected = 3; renderAll(); }); await p.waitForTimeout(250);
  const side4 = await fr.evaluate(() => { const row = Array.from(document.querySelectorAll('#sideBody .row')).find(r => /Best catch/.test(r.textContent)); return row ? Array.from(row.querySelectorAll('span')).filter(e => e.children.length === 0 && /^\d+\/192$/.test(e.textContent.trim())).map(e => [e.textContent.trim(), getComputedStyle(e).color]) : null; });
  ok('...another account (best catch Gengar 192/192): red too', side4 && side4.length === 1 && side4[0][0] === '192/192' && side4[0][1] === L.red, side4);
  const all = await fr.evaluate(() => { const out = []; document.querySelectorAll('span').forEach(e => { if (e.children.length === 0 && /^\d{1,3}\/192$/.test(e.textContent.trim()) && !e.closest('#view-history')) out.push([e.textContent.trim(), getComputedStyle(e).color]); }); return out; });
  ok('anywhere in the dashboard: all ' + all.length + ' IV numbers written as N/192 have the colour of their tier', all.length >= 20 && all.every(c => c[1] === expect(parseInt(c[0]))), all.filter(c => c[1] !== expect(parseInt(c[0]))));
  ok('no JavaScript errors', p.errors.length === 0, p.errors);
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
