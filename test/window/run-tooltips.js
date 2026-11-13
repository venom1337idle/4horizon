// run-tooltips.js: the description of a setting is a tooltip that shows only from the small "i" after the name of the setting, when the pointer has stayed on it for a moment
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const STUB = `window.__n = { cfg: { enabled: true, startupNotice: true, sound: true, events: { shiny: true, goodCatch: true, rareDrop: true, suppliesLow: true, stopped: true, huntUnlocked: true }, goodCatch: { minIV: 175, minQuality: 1.7 }, goodCatch2: { enabled: false, minIV: 170, minQuality: 5, mode: 'or' }, rareDrop: { minValue: 10000 }, suppliesLow: { minRunwayHours: 1, minSampleMinutes: 10 }, stopped: { noKillsSeconds: 180, silentSeconds: 120 }, quietHours: { enabled: false, from: '23:00', to: '07:00', allowShiny: false } } };
  __bridgeObject.notifyGet = async () => JSON.parse(JSON.stringify(window.__n.cfg)); __bridgeObject.notifySet = async () => Object.assign(JSON.parse(JSON.stringify(window.__n.cfg)), { saved: true }); __bridgeObject.notifyTest = async () => true;
  window.__s = { cfg: { supported: true, enabled: false, hidden: false, hiddenReady: true } }; __bridgeObject.startupGet = async () => JSON.parse(JSON.stringify(window.__s.cfg)); __bridgeObject.startupSet = async () => JSON.parse(JSON.stringify(window.__s.cfg)); __bridgeObject.lightGet = async () => ({ on: false }); __bridgeObject.lightSet = async v => ({ on: v === true, saved: true }); __bridgeObject.streamerGet = async () => ({ on: false, atStart: false, needsRestart: false }); __bridgeObject.streamerSet = async v => ({ on: v === true, saved: true, atStart: false, needsRestart: v === true });`;
const tipState = p => p.evaluate(() => { const t = document.getElementById('tip'), r = t.getBoundingClientRect(); return { shown: !t.classList.contains('hidden'), text: t.textContent, l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), W: innerWidth, H: innerHeight }; });
const rowOf = (p, sel) => p.locator('#settingsModal .srow', { has: p.locator(sel) }).first();
const infoOf = (p, sel) => rowOf(p, sel).locator('.info').first();
const descOf = (p, sel) => p.evaluate(s => document.querySelector(s).closest('.srow').querySelector(':scope > div > .sd').textContent.trim(), sel);
const moveTo = async (p, box, dx, dy) => { await p.mouse.move(box.x + box.width / 2 + (dx || 0), box.y + box.height / 2 + (dy || 0)); await p.mouse.move(box.x + box.width / 2 + (dx || 0) + 1, box.y + box.height / 2 + (dy || 0) + 1); };
const hoverInfo = async (p, sel) => { await infoOf(p, sel).scrollIntoViewIfNeeded(); const b = await infoOf(p, sel).boundingBox();          // (lang-67: the list is longer: scrolled to it, as a person would)
   await moveTo(p, b); return b; };
(async () => {
  const b = await chromium.launch();
  let p = await open(b, { extraInit: STUB, w: 1500, h: 1000 });
  await p.click('#btnSettings'); await p.waitForTimeout(400);
  await p.mouse.move(5, 5); await p.waitForTimeout(100);
  ok('nothing is shown when Settings opens', !(await tipState(p)).shown);
  const vis = await p.evaluate(() => Array.from(document.querySelectorAll('#settingsModal .sd')).filter(e => e.offsetParent !== null).length);
  ok('the descriptions are not written under the settings (none of the 21 is visible)', vis === 0 && (await p.locator('#settingsModal .sd').count()) === 21, vis);
  const infos = await p.evaluate(() => Array.from(document.querySelectorAll('#settingsModal .info')).map(e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), glyph: getComputedStyle(e, '::before').content, vis: !!e.offsetParent }; }));
  ok('every setting that has a description has its own small "i": 21 of them (lang-41: Minimize to tray; lang-49: Game panels; lang-58: Accounts; lang-67: Settings backup; 1.0.6: Disable GPU acceleration; lang-70: Great catch, 2nd rule, Light mode; lang-71: Streamer mode), all visible and 17 x 17 px', infos.length === 21 && infos.every(i => i.vis && i.w === 17 && i.h === 17 && i.glyph === '"i"'), infos.slice(0, 2));

  // the bug: the tooltip must not show for anything else in the settings
  const tr = await p.locator('#settingsModal .srow', { has: p.locator('#langSel') }).first().boundingBox();
  const title = await rowOf(p, '#langSel').locator('b').first().boundingBox(), sel = await p.locator('#langSel').boundingBox(), cb = await p.locator('#nEnabled').boundingBox(), drop = await p.locator('#nDrop').boundingBox();
  const places = [['the name of a setting', title, -10, 0], ['the free space of a setting', tr, 0, 0], ['a drop-down list', sel, 0, 0], ['a tick box', cb, 0, 0], ['a number box', drop, 0, 0]];
  for (const pl of places) {
    await p.mouse.move(5, 5); await p.waitForTimeout(60); await moveTo(p, pl[1], pl[2], pl[3]); await p.waitForTimeout(1200);
    ok('resting 1.2 s on ' + pl[0] + ' shows nothing', !(await tipState(p)).shown, [pl[0], await tipState(p)]);
  }
  await p.mouse.move(5, 5); await p.waitForTimeout(60);
  const hd = await p.locator('#settingsModal .shead[data-tip-from] > span').first().boundingBox();
  await moveTo(p, hd, -30, 0); await p.waitForTimeout(1200);
  ok('...nor on the words of the History heading', !(await tipState(p)).shown);

  // the "i": a short rest shows nothing, then it shows
  await p.mouse.move(5, 5); await p.waitForTimeout(60);
  await hoverInfo(p, '#langSel'); await p.waitForTimeout(200);
  ok('on the "i" of Language, after 0.2 s, nothing yet', !(await tipState(p)).shown);
  await p.waitForTimeout(550);
  const t1 = await tipState(p), d1 = await descOf(p, '#langSel');
  ok('after about 0.7 s the tooltip shows the description of Language', t1.shown && t1.text === d1 && /The language of the whole app/.test(t1.text), [t1.text, d1]);
  ok('...and it is inside the window', t1.l >= 0 && t1.t >= 0 && t1.r <= t1.W && t1.b <= t1.H, t1);
  const ib = await infoOf(p, '#langSel').boundingBox(); await p.mouse.move(ib.x + ib.width + 40, ib.y + 4); await p.waitForTimeout(80);
  ok('moving off the "i" (even along the same setting) hides it at once', !(await tipState(p)).shown);
  await hoverInfo(p, '#nIV'); await p.waitForTimeout(150);
  ok('moving to the "i" of another setting: the first is gone and the second has not appeared yet', !(await tipState(p)).shown);
  await p.waitForTimeout(600);
  const t2 = await tipState(p);
  ok('...then it shows Great catch', t2.shown && /OR: it notifies when a catch reaches at least one/.test(t2.text) && t2.text === await descOf(p, '#nIV'), t2.text);
  await p.mouse.move(5, 5); await p.waitForTimeout(100);
  ok('leaving the dialog hides it', !(await tipState(p)).shown);
  await hoverInfo(p, '#nDrop'); await p.waitForTimeout(700);
  ok('Valuable drop shows its tooltip', (await tipState(p)).shown && /price of ONE item/.test((await tipState(p)).text));
  await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(80);
  ok('a click hides it', !(await tipState(p)).shown);
  await hoverInfo(p, '#nSample'); await p.waitForTimeout(700); await p.mouse.wheel(0, 200); await p.waitForTimeout(100);
  ok('scrolling hides it', !(await tipState(p)).shown);

  // the History heading has an "i"; the dropdown header and the numbers do not
  await p.evaluate(() => document.querySelector('#settingsModal .shead[data-tip-from]').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  const hi = await p.locator('#settingsModal .shead[data-tip-from] .info').boundingBox(); await moveTo(p, hi); await p.waitForTimeout(700);
  ok('the "i" of the History heading shows how the numbers are counted', (await tipState(p)).shown && /^Gold is loot \+ captures sold/.test((await tipState(p)).text), (await tipState(p)).text.slice(0, 60));
  await p.mouse.move(5, 5); await p.waitForTimeout(100);
  const tb = await p.locator('#hxToggle').boundingBox(); await moveTo(p, tb, -100, 0); await p.waitForTimeout(1000);
  ok('the dropdown header has no tooltip of its own (it is a button for opening the totals)', !(await tipState(p)).shown);
  await p.click('#hxToggle'); await p.waitForTimeout(150); await p.mouse.move(5, 5);
  const cell = await p.locator('#hxOut td').first().boundingBox(); await moveTo(p, cell, 4, 0); await p.waitForTimeout(1000);
  ok('over the numbers of the tables there is no tooltip', !(await tipState(p)).shown, await tipState(p));

  // keyboard: the "i" can be reached with Tab and shows the same text
  await p.mouse.move(5, 5); await p.keyboard.press('Shift');
  await p.evaluate(() => document.querySelector('#nDrop').closest('.srow').querySelector('.info').focus()); await p.waitForTimeout(700);
  ok('an "i" that gets the keyboard focus shows its tooltip', (await tipState(p)).shown && /price of ONE item/.test((await tipState(p)).text), await tipState(p));
  await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(100);
  ok('pressing a key hides it', !(await tipState(p)).shown);
  await p.context().close();

  // warnings are not descriptions: they stay written
  p = await open(b, { w: 1500, h: 1000 });
  await p.click('#btnSettings'); await p.waitForTimeout(300);
  const notes = await p.evaluate(() => ['nNeedInstall', 'sNote'].map(id => { const e = document.getElementById(id); return !!e.offsetParent && e.textContent.length > 20; }));
  ok('the "run install-diagnostics.js" notes stay written on the page (they are warnings, not descriptions)', notes[0] && notes[1], notes);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // Portuguese
  p = await open(b, { extraInit: STUB, lang: 'pt-BR', w: 1500, h: 1000 });
  await p.click('#btnSettings'); await p.waitForTimeout(400);
  await hoverInfo(p, '#nIV'); await p.waitForTimeout(700);
  const tp = await tipState(p);
  ok('in Portuguese the tooltip is in Portuguese (IV OU qualidade, Rara ×1,37)', tp.shown && /OU: avisa quando a captura chega a pelo menos um/.test(tp.text) && /Rara ×1,37/.test(tp.text), tp.text);
  await p.evaluate(() => I18N.setLang('en')); await p.waitForTimeout(150); await p.mouse.move(5, 5); await hoverInfo(p, '#nIV'); await p.waitForTimeout(700);
  ok('...and in English again after the language is changed while Settings is open', /OR: it notifies when a catch reaches at least one/.test((await tipState(p)).text), (await tipState(p)).text.slice(0, 50));
  await p.context().close();

  // the bottom row in a small window: the tooltip stays inside the window
  p = await open(b, { extraInit: STUB, w: 1100, h: 640 });
  await p.click('#btnSettings'); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('#settingsModal .sbody').scrollTo(0, 99999)); await p.waitForTimeout(150);
  await hoverInfo(p, '#btnDiag'); await p.waitForTimeout(700);
  const tl = await tipState(p);
  ok('the last setting in a window of 1100 x 640: the tooltip shows and stays inside the window', tl.shown && /Check that everything works/.test(tl.text) && tl.t >= 0 && tl.b <= tl.H && tl.r <= tl.W, tl);
  await p.screenshot({ path: 'tooltip-bottom.png' }); await p.context().close();

  p = await open(b, { extraInit: STUB, w: 1500, h: 1000 });
  await p.click('#btnSettings'); await p.waitForTimeout(400); await hoverInfo(p, '#nQuiet'); await p.waitForTimeout(700); await p.screenshot({ path: 'tooltip-quiet.png' });
  await p.click('#setClose'); await p.waitForTimeout(100);
  ok('closing Settings hides a tooltip that is showing', !(await tipState(p)).shown);
  await p.context().close(); await b.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
