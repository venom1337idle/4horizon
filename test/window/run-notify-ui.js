// run-notify-ui.js: the notifications section of the Settings window
const { chromium } = require('./pw');
const { open } = require('./scen');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const STUB = `
  window.__n = { cfg: { enabled: true, startupNotice: true, sound: true, events: { shiny: true, goodCatch: true, rareDrop: true, suppliesLow: true, stopped: true, huntUnlocked: true },
    goodCatch: { minIV: 175, minQuality: 1.7, mode: 'or' }, rareDrop: { minValue: 10000 }, suppliesLow: { minRunwayHours: 1, minSampleMinutes: 10 }, stopped: { noKillsSeconds: 180, silentSeconds: 120 }, quietHours: { enabled: false, from: '23:00', to: '07:00', allowShiny: false } }, calls: [], tests: 0, saved: true };
  window.__s = { cfg: { supported: true, enabled: false, hidden: false, hiddenReady: true, packaged: false, toTray: false }, calls: [], saved: true };
  const LIM = { 'goodCatch.minIV': [0, 200, 0], 'goodCatch.minQuality': [0, 5, 2], 'rareDrop.minValue': [0, 1e9, 0], 'suppliesLow.minRunwayHours': [0.25, 48, 2], 'suppliesLow.minSampleMinutes': [1, 240, 0], 'stopped.noKillsSeconds': [30, 7200, 0], 'stopped.silentSeconds': [30, 7200, 0] };
  __bridgeObject.notifyGet = async () => JSON.parse(JSON.stringify(window.__n.cfg));
  __bridgeObject.notifySet = async p => {                      // what the main process does: checks the numbers and keeps them
    window.__n.calls.push(JSON.parse(JSON.stringify(p))); const c = window.__n.cfg;
    ['enabled', 'sound', 'startupNotice'].forEach(k => { if (typeof p[k] === 'boolean') c[k] = p[k]; });
    if (p.events) Object.keys(p.events).forEach(k => { if (typeof p.events[k] === 'boolean') c.events[k] = p.events[k]; });
    if (p.goodCatch && (p.goodCatch.mode === 'and' || p.goodCatch.mode === 'or')) c.goodCatch.mode = p.goodCatch.mode;
    if (p.quietHours) { ['enabled', 'allowShiny'].forEach(k => { if (typeof p.quietHours[k] === 'boolean') c.quietHours[k] = p.quietHours[k]; }); ['from', 'to'].forEach(k => { if (typeof p.quietHours[k] === 'string' && /^([01]\\d|2[0-3]):[0-5]\\d$/.test(p.quietHours[k])) c.quietHours[k] = p.quietHours[k]; }); }
    Object.keys(LIM).forEach(key => { const [g, f] = key.split('.'); if (p[g] && typeof p[g][f] === 'number') { const l = LIM[key], m = Math.pow(10, l[2]); c[g][f] = Math.round(Math.min(l[1], Math.max(l[0], p[g][f])) * m) / m; } });
    return Object.assign(JSON.parse(JSON.stringify(c)), { saved: window.__n.saved });
  };
  __bridgeObject.notifyTest = async () => { window.__n.tests++; return true; };
  __bridgeObject.startupGet = async () => JSON.parse(JSON.stringify(window.__s.cfg));
  __bridgeObject.startupSet = async p => { window.__s.calls.push(JSON.parse(JSON.stringify(p))); const c = window.__s.cfg; if (typeof p.toTray === 'boolean') { c.toTray = p.toTray; return Object.assign(JSON.parse(JSON.stringify(c)), { saved: window.__s.saved }); }
    if (typeof p.enabled === 'boolean') c.enabled = p.enabled; if (typeof p.hidden === 'boolean' && c.enabled && c.hiddenReady) c.hidden = p.hidden; if (!c.enabled) c.hidden = false;
    return Object.assign(JSON.parse(JSON.stringify(c)), { saved: window.__s.saved }); };`;
const calls = p => p.evaluate(() => window.__n.calls);
const setNum = async (p, id, v) => { await p.fill('#' + id, String(v)); await p.press('#' + id, 'Tab'); await p.waitForTimeout(80); };      // typed, then left the box: the browser sends one change
(async () => {
  const b = await chromium.launch();
  let p = await open(b, { extraInit: STUB, w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const vals = await p.evaluate(() => { const v = id => document.getElementById(id).value; return { iv: v('nIV'), q: v('nQuality'), drop: v('nDrop'), run: v('nRunway'), samp: v('nSample'), nk: v('nNoKills'), si: v('nSilent'),
    en: document.getElementById('nEnabled').checked, snd: document.getElementById('nSound').checked, st: document.getElementById('nStartup').checked, evs: Array.from(document.querySelectorAll('[data-ev]')).map(x => x.dataset.ev + ':' + x.checked) }; });
  ok('the Settings dialog shows the saved numbers (IV 175, quality 1.7, drop 10000, 1 h, 10 min, 180 s, 120 s)', vals.iv === '175' && vals.q === '1.7' && vals.drop === '10000' && vals.run === '1' && vals.samp === '10' && vals.nk === '180' && vals.si === '120', vals);
  ok('...and the switches: Enabled, sound, start notice, and the 9 alerts all ticked', vals.en && vals.snd && vals.st && vals.evs.length === 9 && vals.evs.every(x => /:true$/.test(x)), vals);
  ok('the install note is hidden when the bridge is there', await p.evaluate(() => document.getElementById('nNeedInstall').classList.contains('hidden')));

  await setNum(p, 'nIV', 180);
  ok('changing the IV asks for exactly that one change', JSON.stringify((await calls(p)).slice(-1)[0]) === '{"goodCatch":{"minIV":180}}', await calls(p));
  ok('"Saved" shows beside the section title', await p.evaluate(() => document.getElementById('nSaved').classList.contains('on')));
  await setNum(p, 'nQuality', 1.9); await setNum(p, 'nDrop', 25000); await setNum(p, 'nRunway', 2.5); await setNum(p, 'nSample', 20); await setNum(p, 'nNoKills', 240); await setNum(p, 'nSilent', 90);
  const c1 = await calls(p).then(a => a.slice(-6));
  ok('each of the other six numbers asks for its own change', JSON.stringify(c1) === JSON.stringify([{ goodCatch: { minQuality: 1.9 } }, { rareDrop: { minValue: 25000 } }, { suppliesLow: { minRunwayHours: 2.5 } }, { suppliesLow: { minSampleMinutes: 20 } }, { stopped: { noKillsSeconds: 240 } }, { stopped: { silentSeconds: 90 } }]), c1);

  await p.uncheck('[data-ev="shiny"]'); await p.waitForTimeout(80);
  ok('unticking "A shiny is captured" asks for events.shiny = false', JSON.stringify((await calls(p)).slice(-1)[0]) === '{"events":{"shiny":false}}', await calls(p));
  await p.uncheck('#nSound'); await p.uncheck('#nStartup'); await p.waitForTimeout(80);
  ok('sound and the start notice are their own switches', JSON.stringify((await calls(p)).slice(-2)) === '[{"sound":false},{"startupNotice":false}]', await calls(p));
  await p.uncheck('#nEnabled'); await p.waitForTimeout(100);
  ok('turning Notifications off asks for enabled = false and dims the rest', JSON.stringify((await calls(p)).slice(-1)[0]) === '{"enabled":false}' && await p.evaluate(() => document.getElementById('notifBody').classList.contains('off')));
  await p.check('#nEnabled'); await p.waitForTimeout(100);
  ok('turning it back on lights the rest again', await p.evaluate(() => !document.getElementById('notifBody').classList.contains('off')));

  // the answer of the main process is what the field shows
  await setNum(p, 'nIV', 999);
  ok('a number outside the limits: the main process holds it (999 becomes 200) and the box shows 200', (await p.inputValue('#nIV')) === '200', await p.inputValue('#nIV'));
  await setNum(p, 'nQuality', 1.2345);
  ok('the quality keeps 2 decimals (1.23)', (await p.inputValue('#nQuality')) === '1.23', await p.inputValue('#nQuality'));
  const n0 = (await calls(p)).length;
  await p.fill('#nDrop', ''); await p.press('#nDrop', 'Tab'); await p.waitForTimeout(80);
  ok('an empty box asks for nothing and goes back to the number it had', (await calls(p)).length === n0 && (await p.inputValue('#nDrop')) === '25000', [(await calls(p)).length, n0, await p.inputValue('#nDrop')]);

  await p.click('#nTest'); await p.waitForTimeout(100);
  ok('"Send test notification" asks the main process for one test and says so', (await p.evaluate(() => window.__n.tests)) === 1 && /Test notification sent/.test(await p.locator('#toast').innerText()));
  await p.evaluate(() => { window.__n.saved = false; }); await setNum(p, 'nIV', 170);
  ok('when the main process could not save the file, the window says so', /Could not save the notification settings/.test(await p.locator('#toast').innerText()), await p.locator('#toast').innerText());

  // closing and opening again reads the settings again
  await p.evaluate(() => { window.__n.saved = true; window.__n.cfg.goodCatch.minIV = 150; });
  await p.click('#setClose'); await p.click('#btnSettings'); await p.waitForTimeout(200);
  ok('opening Settings again reads what the main process has (the tray or the file may have changed it)', (await p.inputValue('#nIV')) === '150', await p.inputValue('#nIV'));
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // Portuguese
  p = await open(b, { extraInit: STUB, lang: 'pt-BR', w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const txt = await p.locator('#settingsModal').innerText();
  ok('in Portuguese the section is in Portuguese (title, switches, hints, button)', /Notificações do Windows/.test(txt) && /Avise-me quando/.test(txt) && /IV mínimo/.test(txt) && /Qualidade mínima/.test(txt) && /Enviar notificação de teste/.test(txt), txt.slice(0, 400));
  ok('...and no English line is left in the dialog', !/\b(Tell me when|Untick|at least|Play the sound|Try it|Supplies running low|Valuable drop)\b/.test(txt), txt);
  await p.click('#nTest'); await p.waitForTimeout(100);
  ok('the toast is in Portuguese too', /Notificação de teste enviada/.test(await p.locator('#toast').innerText()));
  await p.context().close();


  // ===== great catch: AND / OR
  p = await open(b, { extraInit: STUB, w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(300);
  const m0 = await p.evaluate(() => ({ words: Array.from(document.querySelectorAll('#nMode label')).map(l => l.textContent.trim()), checked: Array.from(document.querySelectorAll('#nMode input')).filter(r => r.checked).map(r => r.value) }));
  ok('Great catch has the choice AND | OR, and OR is the one selected (what the app always did)', JSON.stringify(m0.words) === '["AND","OR"]' && JSON.stringify(m0.checked) === '["or"]', m0);
  const gcbox = await p.evaluate(() => ['nIV', 'nMode', 'nQuality'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return { id: id, x: Math.round(r.left), cy: Math.round(r.top + r.height / 2), h: Math.round(r.height) }; }));
  ok('the three are on one line, in this order: IV at least, AND | OR, Quality at least', gcbox[0].x < gcbox[1].x && gcbox[1].x < gcbox[2].x && Math.abs(gcbox[0].cy - gcbox[1].cy) <= 2 && Math.abs(gcbox[1].cy - gcbox[2].cy) <= 2 && gcbox[1].h === gcbox[0].h, gcbox);
  await p.click('#nMode label:has(input[value="and"])'); await p.waitForTimeout(100);
  ok('choosing AND asks for exactly goodCatch.mode = "and" and AND is the one selected', JSON.stringify((await calls(p)).slice(-1)[0]) === '{"goodCatch":{"mode":"and"}}' && JSON.stringify(await p.evaluate(() => Array.from(document.querySelectorAll('#nMode input')).filter(r => r.checked).map(r => r.value))) === '["and"]', await calls(p));
  const nAnd = (await calls(p)).length;
  await p.click('#nMode label:has(input[value="and"])'); await p.waitForTimeout(80);
  ok('choosing the one that is already selected asks for nothing', (await calls(p)).length === nAnd);
  await p.click('#nMode label:has(input[value="or"])'); await p.waitForTimeout(100);
  ok('choosing OR asks for goodCatch.mode = "or"', JSON.stringify((await calls(p)).slice(-1)[0]) === '{"goodCatch":{"mode":"or"}}' && await p.evaluate(() => document.querySelector('#nMode input[value="or"]').checked), await calls(p));
  const sel = await p.evaluate(() => { const on = document.querySelector('#nMode input:checked').closest('label'), off = document.querySelector('#nMode input:not(:checked)').closest('label'); return { onBg: getComputedStyle(on).backgroundImage.slice(0, 15), offBg: getComputedStyle(off).backgroundImage.slice(0, 15) }; });
  ok('the selected one is the gold one (the other is not)', /linear-gradient/.test(sel.onBg) && sel.offBg === 'none', sel);
  await p.focus('#nIV'); await p.keyboard.press('Tab'); await p.waitForTimeout(50);
  const t1 = await p.evaluate(() => document.activeElement.name + ':' + document.activeElement.value);
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(100);
  ok('with the keyboard: Tab goes from the IV box to the choice (the selected one), and the arrow keys change it', t1 === 'gcMode:or' && JSON.stringify((await calls(p)).slice(-1)[0]) === '{"goodCatch":{"mode":"and"}}', [t1, await calls(p)]);
  await p.keyboard.press('Tab'); await p.waitForTimeout(50);
  ok('...and the next Tab goes to the Quality box', (await p.evaluate(() => document.activeElement.id)) === 'nQuality');
  await p.evaluate(() => { window.__n.cfg.goodCatch.mode = 'and'; });
  await p.click('#setClose'); await p.click('#btnSettings'); await p.waitForTimeout(250);
  ok('opening Settings again shows what the main process has (AND)', await p.evaluate(() => document.querySelector('#nMode input[value="and"]').checked));
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  p = await open(b, { extraInit: STUB, lang: 'pt-BR', w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(300);
  ok('in Portuguese the choice is E | OU', JSON.stringify(await p.evaluate(() => Array.from(document.querySelectorAll('#nMode label')).map(l => l.textContent.trim()))) === '["E","OU"]');
  await p.evaluate(() => I18N.setLang('en')); await p.waitForTimeout(150);
  ok('...and AND | OR again when the language is changed while Settings is open', JSON.stringify(await p.evaluate(() => Array.from(document.querySelectorAll('#nMode label')).map(l => l.textContent.trim()))) === '["AND","OR"]');
  await p.context().close();
  p = await open(b, { w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  ok('without the bridge (installer not run) the choice is off like the rest', await p.evaluate(() => Array.from(document.querySelectorAll('#nMode input')).every(r => r.disabled)));
  await p.context().close();

  // ===== quiet hours
  p = await open(b, { extraInit: STUB, w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const q0 = await p.evaluate(() => ({ on: document.getElementById('nQuiet').checked, from: document.getElementById('nQFrom').value, to: document.getElementById('nQTo').value, shiny: document.getElementById('nQShiny').checked, dim: document.getElementById('nQuietBox').classList.contains('off') }));
  ok('quiet hours show as saved: off, 23:00 to 07:00, shinies not excepted, and the times are dimmed while it is off', !q0.on && q0.from === '23:00' && q0.to === '07:00' && !q0.shiny && q0.dim, q0);
  await p.check('#nQuiet'); await p.waitForTimeout(80);
  ok('ticking it asks for quietHours.enabled = true and lights the times', JSON.stringify((await calls(p)).slice(-1)[0]) === '{"quietHours":{"enabled":true}}' && await p.evaluate(() => !document.getElementById('nQuietBox').classList.contains('off')), await calls(p));
  await p.fill('#nQFrom', '22:30'); await p.press('#nQFrom', 'Tab'); await p.waitForTimeout(80);
  await p.fill('#nQTo', '06:15'); await p.press('#nQTo', 'Tab'); await p.waitForTimeout(80);
  ok('the two times ask for their own change, as HH:MM', JSON.stringify((await calls(p)).slice(-2)) === '[{"quietHours":{"from":"22:30"}},{"quietHours":{"to":"06:15"}}]', await calls(p));
  await p.check('#nQShiny'); await p.waitForTimeout(80);
  ok('"Shinies still notify" asks for allowShiny = true', JSON.stringify((await calls(p)).slice(-1)[0]) === '{"quietHours":{"allowShiny":true}}', await calls(p));
  const nq = (await calls(p)).length;
  await p.fill('#nQFrom', ''); await p.press('#nQFrom', 'Tab'); await p.waitForTimeout(80);
  ok('a time that was cleared asks for nothing and goes back to 22:30', (await calls(p)).length === nq && (await p.inputValue('#nQFrom')) === '22:30', [(await calls(p)).length, nq, await p.inputValue('#nQFrom')]);
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  // ===== start with the PC
  p = await open(b, { extraInit: STUB, w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const sCalls = () => p.evaluate(() => window.__s.calls);
  const st0 = await p.evaluate(() => ({ on: document.getElementById('sStartup').checked, onDis: document.getElementById('sStartup').disabled, hid: document.getElementById('sHidden').checked, hidDis: document.getElementById('sHidden').disabled, note: document.getElementById('sNote').classList.contains('hidden') }));
  ok('start with the PC shows as Windows has it: off, and "hidden" cannot be ticked while it is off; no note', !st0.on && !st0.onDis && !st0.hid && st0.hidDis && st0.note, st0);
  await p.check('#sStartup'); await p.waitForTimeout(100);
  ok('ticking it asks for enabled = true, and "hidden" becomes available', JSON.stringify((await sCalls()).slice(-1)[0]) === '{"enabled":true}' && await p.evaluate(() => !document.getElementById('sHidden').disabled && document.getElementById('sStartup').checked), await sCalls());
  await p.check('#sHidden'); await p.waitForTimeout(100);
  ok('ticking "hidden in the tray" asks for hidden = true', JSON.stringify((await sCalls()).slice(-1)[0]) === '{"hidden":true}' && await p.evaluate(() => document.getElementById('sHidden').checked), await sCalls());
  await p.uncheck('#sStartup'); await p.waitForTimeout(100);
  ok('unticking it again asks for enabled = false and "hidden" is cleared and locked', JSON.stringify((await sCalls()).slice(-1)[0]) === '{"enabled":false}' && await p.evaluate(() => !document.getElementById('sHidden').checked && document.getElementById('sHidden').disabled), await sCalls());
  await p.evaluate(() => { window.__s.saved = false; }); await p.check('#sStartup'); await p.waitForTimeout(100);
  ok('when Windows refuses, the window says so', /Could not change the start with the PC/.test(await p.locator('#toast').innerText()), await p.locator('#toast').innerText());
  ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();

  p = await open(b, { extraInit: STUB + "window.__s.cfg.enabled = true; window.__s.cfg.hiddenReady = false;", w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const st1 = await p.evaluate(() => ({ on: document.getElementById('sStartup').checked, hidDis: document.getElementById('sHidden').disabled, note: document.getElementById('sNote').textContent }));
  ok('a main.js that does not know --hidden: the start switch works, "hidden" is locked and the note says to run install-diagnostics.js', st1.on && st1.hidDis && /needs install-diagnostics\.js/.test(st1.note), st1);
  await p.context().close();
  p = await open(b, { extraInit: STUB + "window.__s.cfg.supported = false;", w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const st2 = await p.evaluate(() => ({ dis: document.getElementById('sStartup').disabled && document.getElementById('sHidden').disabled, note: document.getElementById('sNote').textContent }));
  ok('not Windows: both are off and the note says it works on Windows only', st2.dis && /Windows only/.test(st2.note), st2);
  await p.context().close();
  p = await open(b, { w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const st3 = await p.evaluate(() => ({ dis: document.getElementById('sStartup').disabled && document.getElementById('sHidden').disabled, note: document.getElementById('sNote').textContent }));
  ok('without the bridge (installer not run): the switch is off and the note says to run install-diagnostics.js', st3.dis && /needs install-diagnostics\.js/.test(st3.note), st3);
  await p.context().close();

  // in Portuguese
  p = await open(b, { extraInit: STUB, lang: 'pt-BR', w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const ptx = await p.locator('#settingsModal').innerText();
  ok('in Portuguese: Iniciar com o PC, Iniciar oculto na bandeja, Horário de silêncio, Ficar em silêncio entre, Shinies ainda avisam', /Iniciar com o PC/.test(ptx) && /Iniciar oculto na bandeja/.test(ptx) && /Horário de silêncio/.test(ptx) && /Ficar em silêncio entre/.test(ptx) && /Shinies ainda avisam/.test(ptx), ptx.slice(0, 300));
  ok('...and none of the new English lines is left', !/\b(Start with the PC|Start hidden|Quiet hours|Keep quiet|Shinies still)\b/.test(ptx));
  await p.context().close();

  // ===== the six alerts in two columns of three
  for (const size of [[1400, 900], [1100, 640]]) {
    p = await open(b, { extraInit: STUB, w: size[0], h: size[1] });
    await p.click('#btnSettings'); await p.waitForTimeout(300);
    const L = await p.evaluate(() => { const dlg = document.querySelector('#settingsModal .dlg').getBoundingClientRect();
      return { dlgL: dlg.left, dlgR: dlg.right, boxes: Array.from(document.querySelectorAll('#evChecks label')).map(l => { const r = l.getBoundingClientRect(); return { ev: l.querySelector('input').dataset.ev, x: Math.round(r.left), y: Math.round(r.top), r: Math.round(r.right), h: Math.round(r.height) }; }) }; });
    const [a, b2, c, d2, e, f] = [L.boxes[0], L.boxes[2], L.boxes[4], L.boxes[5], L.boxes[6], L.boxes[8]];
    ok('at ' + size[0] + ' x ' + size[1] + ': the nine alerts are in two columns (five on the left, four on the right), each column straight', L.boxes.slice(0, 5).every(x => x.x === a.x) && L.boxes.slice(5).every(x => x.x === d2.x) && d2.x > a.x + 200 && L.boxes.slice(0, 5).every((x, i, arr) => i === 0 || x.y > arr[i - 1].y) && L.boxes.slice(5).every((x, i, arr) => i === 0 || x.y > arr[i - 1].y) && a.y < b2.y && b2.y < c.y && d2.y < e.y && e.y < f.y && Math.abs(a.y - d2.y) <= 2, L.boxes);
    ok('...in this order: shiny, great catch, valuable drop, supplies low, stopped | new hunt, battle pass, daily mission, egg', L.boxes.map(x => x.ev).join() === 'shiny,goodCatch,rareDrop,suppliesLow,stopped,huntUnlocked,battlePass,dailyQuest,eggReady', L.boxes.map(x => x.ev));
    ok('...and all of them are inside the dialog', L.boxes.every(x => x.x >= L.dlgL && x.r <= L.dlgR), [L.dlgL, L.dlgR, L.boxes.map(x => x.r)]);
    if (size[0] === 1400) await p.screenshot({ path: 'notif-cols.png' });
    ok('no JavaScript errors', p.errors.length === 0, p.errors); await p.context().close();
  }

  // a small window: the dialog scrolls inside and Close stays in view
  p = await open(b, { extraInit: STUB, w: 1100, h: 640 });
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const fit = await p.evaluate(() => { const d = document.querySelector('#settingsModal .dlg').getBoundingClientRect(), s = document.querySelector('#settingsModal .sbody'), c = document.getElementById('setClose').getBoundingClientRect();
    return { dlgBottom: Math.round(d.bottom), h: innerHeight, scrolls: s.scrollHeight > s.clientHeight + 1, closeVisible: c.bottom <= innerHeight && c.top >= 0 }; });
  ok('in a window of 1100 x 640 the dialog fits, the rows scroll inside it and Close stays in view', fit.dlgBottom <= fit.h && fit.scrolls && fit.closeVisible, fit);
  await p.screenshot({ path: 'notif-small.png' });
  await p.context().close();

  // without the bridge (the installer was not run): a note, and nothing to click
  p = await open(b, { w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const nb = await p.evaluate(() => ({ note: !document.getElementById('nNeedInstall').classList.contains('hidden'), disabled: Array.from(document.querySelectorAll('#nEnabled, #notifBody input, #notifBody button')).every(e => e.disabled) }));
  ok('without the bridge functions the dialog says to run install-diagnostics.js and the controls are off', nb.note && nb.disabled, nb);
  ok('...and nothing throws', p.errors.length === 0, p.errors); await p.context().close();

  // ---- lang-41: the three new notifications and "Minimize to tray"
  p = await open(b, { extraInit: STUB, w: 1400, h: 900 });
  await p.click('#btnSettings'); await p.waitForTimeout(300);
  const nw = await p.evaluate(() => ['battlePass', 'dailyQuest', 'eggReady'].map(k => { const e = document.querySelector('#notifBody [data-ev="' + k + '"]'); return e ? e.parentNode.textContent.trim() + '|' + e.checked : null; }));
  ok('three new notifications in Settings, on at first: a battle pass mission, a daily mission, an egg ready to hatch', nw.join() === 'A battle pass mission is completed|true,A daily mission is completed|true,An egg is ready to hatch|true', nw);
  await p.click('#notifBody [data-ev="eggReady"]'); await p.waitForTimeout(250);
  ok('...turning one off is sent and saved like the others ({ events: { eggReady: false } })', JSON.stringify((await calls(p)).slice(-1)) === '[{"events":{"eggReady":false}}]' && await p.evaluate(() => window.__n.cfg.events.eggReady === false), await calls(p));
  let tr = await p.evaluate(() => ({ row: document.getElementById('sTray').closest('.srow').querySelector('b').textContent, label: document.getElementById('sTray').parentNode.textContent.trim(), on: document.getElementById('sTray').checked, dis: document.getElementById('sTray').disabled }));
  ok('"Minimize to tray": its own row, off at first, can be changed', tr.row === 'Minimize to tray' && tr.label === 'Hide in the tray when minimized' && !tr.on && !tr.dis, tr);
  await p.click('#sTray'); await p.waitForTimeout(250);
  tr = await p.evaluate(() => ({ on: document.getElementById('sTray').checked, last: window.__s.calls.slice(-1)[0], toast: document.getElementById('toast').textContent, startup: document.getElementById('sStartup').checked }));
  ok('...ticking it asks for { toTray: true } and says it was saved; the start with the PC is not touched', tr.on && JSON.stringify(tr.last) === '{"toTray":true}' && /Saved/.test(tr.toast) && !tr.startup, tr);
  await p.evaluate(() => { window.__s.saved = false; }); await p.click('#sTray'); await p.waitForTimeout(250);
  ok('...a save that fails says so (its own words, not the start-with-the-PC message)', /Could not save the setting/.test(await p.evaluate(() => document.getElementById('toast').textContent)));
  ok('no JavaScript errors (lang-41)', p.errors.length === 0, p.errors); await p.context().close();
  p = await open(b, { extraInit: STUB.replace(', toTray: false }', ' }'), w: 1400, h: 900 }); await p.click('#btnSettings'); await p.waitForTimeout(300);
  ok('an older settings.js that does not know it: the box is greyed out', await p.evaluate(() => document.getElementById('sTray').disabled));
  await p.context().close();
  p = await open(b, { extraInit: STUB, w: 1400, h: 900, lang: 'pt-BR' }); await p.click('#btnSettings'); await p.waitForTimeout(300);
  const ptw = await p.evaluate(() => [document.querySelector('#notifBody [data-ev="dailyQuest"]').parentNode.textContent.trim(), document.getElementById('sTray').closest('.srow').querySelector('b').textContent]);
  ok('in Portuguese: "Uma missão diária é concluída", "Minimizar para a bandeja"', ptw.join('|') === 'Uma missão diária é concluída|Minimizar para a bandeja', ptw);
  await p.context().close();

  // a look at it in English at a normal size
  p = await open(b, { extraInit: STUB, w: 1500, h: 1000 }); await p.click('#btnSettings'); await p.waitForTimeout(250); await p.screenshot({ path: 'notif-en.png' }); await p.context().close();
  await b.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
