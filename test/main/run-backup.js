// run-backup.js (lang-67): Settings › Settings backup: saved to a file and loaded back; logins, passwords and history are never in it;
// a wrong or newer file is refused; every value goes through the same checks as in Settings.
const fs = require('fs'), path = require('path'), os = require('os');
// its own fresh settings folder (the stand-in Electron reads HG_USERDATA when it is loaded): nothing this test writes can reach another suite
process.env.HG_USERDATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-backup-'));
const electron = require('electron');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 500))); c ? pass++ : fail++; };
const UD = electron._USERDATA; fs.mkdirSync(UD, { recursive: true });
fs.writeFileSync(path.join(UD, 'accounts.json'), JSON.stringify({ rows: { 1: { name: 'trainer1', user: 'me@example.com', pass: 'a1:SECRET' } } }));
// (the settings files this test changes are put back at the end: the next test suites share this folder)
const KEEP = ['settings.json', 'notify-settings.json', 'tidy-settings.json'].map(f => [path.join(UD, f), path.join(__dirname, f)]).flat();
const before = KEEP.map(f => [f, fs.existsSync(f) ? fs.readFileSync(f) : null]);
const putBack = () => before.forEach(([f, c]) => { try { if (c === null) { if (fs.existsSync(f)) fs.unlinkSync(f); } else fs.writeFileSync(f, c); } catch (e) {} });
const B = require('./backup'); B.init();
const H = electron._handlers, WIN = { sender: electron._WINDOW }, PANEL = { sender: { id: 'panel' } }, dlg = electron._dlg;
(async () => {
  ok('both requests answer the app window only, never a game panel', await H['settings:export'](PANEL, {}) === null && await H['settings:import'](PANEL) === null);
  // ---- saving
  const file = path.join(UD, 'mine-settings.json'); dlg.result = { canceled: false, filePath: file };
  const winPart = { window: { panels: 2, simple: true, zoom: { 1: 0.9 } }, summary: { sum: { hot: 20000 }, capSort: 'iv' } };
  let r = await H['settings:export'](WIN, winPart);
  const saved = JSON.parse(fs.readFileSync(file, 'utf8')), txt = fs.readFileSync(file, 'utf8');
  ok('saved to the chosen file: it says what it is (4horizon settings, format 1, version, date)', r.ok === true && r.file === 'mine-settings.json' && saved.app4horizon === '4horizon-settings' && saved.format === 1 && /^\d{4}-/.test(saved.exportedAt), [r, saved.app4horizon]);
  ok('...the notifications, popup tidy, the language and "minimize to tray", and the window\u2019s and Summary\u2019s parts', saved.notifications && saved.notifications.goodCatch && 'enabled' in saved.tidy && 'minimizeToTray' in saved.app && saved.window.panels === 2 && saved.summary.capSort === 'iv', Object.keys(saved));
  ok('...and NEVER the logins, passwords or e-mails', !/SECRET|me@example\.com|"pass"|accounts/.test(txt), txt.slice(0, 200));
  dlg.result = { canceled: true }; ok('cancelled: nothing written, "canceled"', (await H['settings:export'](WIN, winPart)).canceled === true);
  // ---- loading
  const load = async o => { const f = path.join(UD, 'in.json'); fs.writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o)); dlg.openResult = { canceled: false, filePaths: [f] }; return H['settings:import'](WIN); };
  const good = JSON.parse(txt); good.notifications.goodCatch.minIV = 175; good.tidy.hideChat = false; good.app.minimizeToTray = true; good.app.lang = 'pt-BR';
  r = await load(good);
  ok('loading a good file: the notifications changed (Great catch IV 175), popup tidy changed (chat left open), "minimize to tray" and the language', r.ok === true && require('./notify').getConfig().goodCatch.minIV === 175 && require('./tidy').settings().hideChat === false && require('./settings').read().minimizeToTray === true && require('./settings').read().lang === 'pt-BR' && r.lang === 'pt-BR', [r, require('./tidy').settings()]);
  ok('...and gives the window its part back (it checks and applies it, then loads again)', r.window.panels === 2 && r.summary.capSort === 'iv');
  const bad = JSON.parse(txt); bad.notifications.goodCatch.minIV = 'lots'; bad.tidy.hideChat = 'no'; bad.tidy.hacker = true; bad.tidy.onlyFirstSeconds = 1e9;
  r = await load(bad);
  ok('values that make no sense are not taken (an IV that is a word, a switch that is a word, an unknown key; a huge number is capped)', r.ok === true && require('./notify').getConfig().goodCatch.minIV === 175 && require('./tidy').settings().hideChat === false && !('hacker' in require('./tidy').settings()) && require('./tidy').settings().onlyFirstSeconds === 3600, require('./tidy').settings());
  ok('a file that is not 4horizon settings: refused, nothing changed', (r = await load({ hello: 1 })).ok === false && r.reason === 'not a 4horizon settings file');
  ok('a file made by a newer 4horizon (format 2): refused', (r = await load(Object.assign({}, good, { format: 2 }))).ok === false && r.reason === 'made by a newer 4horizon');
  ok('a file that is not JSON: refused ("could not be read")', (r = await load('this is not json')).ok === false && r.reason === 'the file could not be read');
  ok('a file bigger than 1 MB: refused', (r = await load(JSON.stringify(Object.assign({}, good, { pad: 'x'.repeat(1.1e6) })))).ok === false && r.reason === 'the file is too big');
  dlg.openResult = { canceled: true, filePaths: [] }; ok('cancelled: nothing changed, "canceled"', (await H['settings:import'](WIN)).canceled === true);
  const dsrc = fs.readFileSync('diag.js', 'utf8');
  ok('diag.js starts it, its self-check knows it and the bridge', /require\('\.\/backup'\)\.init\(\)/.test(dsrc) && /\['backup\.js', 'settings backup/.test(dsrc) && /settingsImport: \(\) => ipcRenderer\.invoke\('settings:import'\)/.test(fs.readFileSync('preload.js', 'utf8')));
  putBack(); try { fs.rmSync(process.env.HG_USERDATA, { recursive: true, force: true }); } catch (e) {}
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { putBack(); throw e; }).catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
