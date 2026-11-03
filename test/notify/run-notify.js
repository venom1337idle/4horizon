// run-notify.js: every notification of notify.js, in English (must equal the old file) and in Portuguese (no English left, nothing unfilled)
const Module = require('module'), fs = require('fs'), path = require('path');
let SHOWN = [];
const electronStub = { app: { whenReady: () => Promise.resolve() }, BrowserWindow: { getAllWindows: () => [] }, shell: { openPath: () => Promise.resolve() },
  Notification: class { static isSupported() { return true; } constructor(o) { SHOWN.push({ title: o.title, body: o.body }); } on() {} show() {} } };
const origLoad = Module._load; Module._load = function (req, ...a) { return req === 'electron' ? electronStub : origLoad.call(this, req, ...a); };
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };

async function scenario(file, lang) {
  SHOWN = [];
  const settingsFile = path.join(__dirname, 'notify-settings.json');
  fs.writeFileSync(settingsFile, JSON.stringify({ suppliesLow: { minRunwayHours: 5, minSampleMinutes: 10 }, accountNames: { 3: 'Main' } }));
  Object.keys(require.cache).filter(k => /notify|i18n/.test(k) && !/run-notify/.test(k)).forEach(k => delete require.cache[k]);
  const i18n = require('./i18n'); require('./i18n-pt'); i18n.setLang(lang);
  const N = require('./' + file);
  await new Promise(r => setTimeout(r, 20));                       // the startup notice
  N.test();
  N.handle(1, { name: 'trainer2', level: 50 }); N.handle(1, { level: 60 });                                   // a trainer level that opens hunts
  N.handle(2, { name: 'trainer3', level: 1 }); N.handle(2, { level: 200 });                                 // ... and more than four hunts
  N.handle(1, { catchEvent: { name: 'Gengar', iv: 190, max: 192, quality: 1.78, rarity: 'Lendária ×1.78', shiny: true }, catchSeq: 1 });
  N.handle(1, { catchEvent: { name: 'Horsea', iv: 180, max: 192, quality: 1.2, rarity: 'Rara ×1.37', shiny: false }, catchSeq: 2 });
  N.handle(1, { startedAt: 1, active: true, elapsedMs: 3600000, drops: [{ name: 'Venom stone', qty: 1, value: 50000 }], balls: 400, ballsUsed: 100, potions: 0, healsUsed: 5, defeated: 10 });
  N.handle(1, { startedAt: 1, active: true, drops: [{ name: 'Venom stone', qty: 4, value: 200000 }], defeated: 10 });
  N.handle(3, { name: 'x', startedAt: 7, active: true, defeated: 5, elapsedMs: 3600000, balls: 3, ballsUsed: 500 });
  const st = N._state; st[3].lastMsg = Date.now() - 200000; st[1].killsAt = Date.now() - 400000; st[1].lastMsg = Date.now();
  N.handle(4, { name: 'trainer4', startedAt: 9, active: true, defeated: 1 }); N.handle(4, { startedAt: 9, active: false }); st[4].pendingStop = Date.now() - 200000;          // (lang-54: left the hunt longer ago than the "No kills" time, 180 s by default)
  N._watch();
  return SHOWN.slice();
}
(async () => {
  const oldEn = await scenario('notify.before.js', 'en'), newEn = await scenario('notify.js', 'en'), pt = await scenario('notify.js', 'pt-BR');
  console.log('\n' + newEn.length + ' notifications in English:'); newEn.forEach(n => console.log('   ' + n.title + ' | ' + n.body));
  ok('the English notifications are exactly the ones of the old file', JSON.stringify(oldEn) === JSON.stringify(newEn));
  ok('every kind of alert was exercised (startup, test, hunts opened x2, shiny, great catch, rare drop, supplies low, no data, no kills, stopped)', newEn.length >= 12, newEn.length);
  console.log('\n' + pt.length + ' notifications in Portuguese:'); pt.forEach(n => console.log('   ' + n.title + ' | ' + n.body));
  ok('as many notifications in Portuguese as in English', pt.length === newEn.length, [pt.length, newEn.length]);
  ok('no placeholder is left unfilled', pt.every(n => !/\{\w+\}/.test(n.title + n.body)), pt.filter(n => /\{\w+\}/.test(n.title + n.body)));
  const EN = /\b(the|and|is|are|with|your|when|while|from|nothing|received|running|left|working|alert|hidden|reached|level|got|worth|each|more|Stopped|Great|captured|panel|disconnected)\b/;
  const leaks = pt.filter(n => EN.test(n.title.replace('Rare drop', '') + ' ' + n.body.replace(/Hunts?: [^|]*/, '')));
  ok('no English word is left in the Portuguese ones', leaks.length === 0, leaks);
  ok('numbers follow the language (1.234 and not 1,234)', !pt.some(n => /\d,\d{3}\b/.test(n.body)), pt.map(n => n.body));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
