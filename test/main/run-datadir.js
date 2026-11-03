// run-datadir.js (lang-50): the user's own files (history, notification and tidy settings, the schema log) live in the user-data folder, not the app folder;
// an older one in the app folder is moved there once (copied, checked, then removed). The FILES list of the report shows only the app's own files.
const fs = require('fs'), os = require('os'), path = require('path');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 600))); c ? pass++ : fail++; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-')), app = path.join(tmp, 'app'), ud = path.join(tmp, 'Users', 'someone', 'AppData', 'Roaming', '4horizon');
fs.mkdirSync(app, { recursive: true });
fs.copyFileSync(path.join(__dirname, 'datadir.js'), path.join(app, 'datadir.js'));
const load = getPath => { delete require.cache[path.join(app, 'datadir.js')]; const D = require(path.join(app, 'datadir.js')); D._reset(); D._setElectron(getPath === undefined ? null : { app: { getPath: k => (k === 'userData' ? getPath() : null) } }); return D; };
const W = (dir, n, t) => fs.writeFileSync(path.join(dir, n), t), R = (dir, n) => fs.readFileSync(path.join(dir, n), 'utf8'), E = (dir, n) => fs.existsSync(path.join(dir, n));

// ---- moving the old files once
W(app, 'history.json', '{"2026-11-02":{"1":{"gold":5}}}'); W(app, 'notify-settings.json', '{"enabled":false}');
let D = load(() => ud);
let p = D.file('history.json');
ok('history.json: the path is in the user-data folder (created if needed)', p === path.join(ud, 'history.json'), p);
ok('...the old one was moved there: same content, and no longer in the app folder', R(ud, 'history.json') === '{"2026-11-02":{"1":{"gold":5}}}' && !E(app, 'history.json'));
ok('notify-settings.json: moved too, with its content (your notification settings are kept)', D.file('notify-settings.json') === path.join(ud, 'notify-settings.json') && R(ud, 'notify-settings.json') === '{"enabled":false}' && !E(app, 'notify-settings.json'));
ok('a file that was not there (tidy-settings.json): only the new path, nothing made', D.file('tidy-settings.json') === path.join(ud, 'tidy-settings.json') && !E(ud, 'tidy-settings.json'));
W(app, 'history.json', 'OLD'); p = D.file('history.json');
ok('asking again later moves nothing more (once per start)', R(ud, 'history.json') !== 'OLD' && E(app, 'history.json'));
// ---- both there: the one in the user-data folder wins, the old one is left alone
D = load(() => ud); p = D.file('history.json');
ok('after a restart, with an old history.json back in the app folder (an older zip unpacked): the user-data one is used, the old one is not touched', p === path.join(ud, 'history.json') && R(ud, 'history.json') !== 'OLD' && R(app, 'history.json') === 'OLD');
let inf = D.info();
ok('...and the report says an old copy is still in the app folder', /^leftOld, an old copy is still in the app folder$/.test(inf.moves['history.json']), inf);
ok('the report: the folder without the Windows user name, the files there with their size', /Users[\\/]+~/.test(inf.folder) && /4horizon$/.test(inf.folder) && !/someone/.test(inf.folder) && inf.files.map(f => f.name).join() === 'history.json,notify-settings.json', inf);
fs.unlinkSync(path.join(app, 'history.json'));
// ---- no user-data folder (outside Electron): the app folder, as before
D = load(); W(app, 'tidy-settings.json', '{"enabled":true}');
ok('outside Electron (no user-data folder): the app folder is used, nothing is moved', D.file('tidy-settings.json') === path.join(app, 'tidy-settings.json') && E(app, 'tidy-settings.json') && D.info().inAppFolder === true);
// ---- the move fails: keep using the old file where it is
const ro = path.join(tmp, 'ro'); fs.mkdirSync(ro); fs.writeFileSync(path.join(ro, 'x'), '1');
D = load(() => path.join(ro, 'x'));                    // a "folder" that is a file: it cannot be made, so the app folder is used
ok('a user-data folder that cannot be made: the app folder is used (nothing is lost)', D.file('tidy-settings.json') === path.join(app, 'tidy-settings.json') && R(app, 'tidy-settings.json') === '{"enabled":true}');

// ---- the four modules and the Diagnostics use it
const src = n => fs.readFileSync(path.join(__dirname, n), 'utf8');
ok('history.js, tidy.js, schema.js and notify.js take their file from datadir.js (with the old place as a fallback)', /FILE = require\('\.\/datadir'\)\.file\('history\.json'\)/.test(src('history.js')) && /SETTINGS_FILE = require\('\.\/datadir'\)\.file\('tidy-settings\.json'\)/.test(src('tidy.js')) &&
  /FILE = require\('\.\/datadir'\)\.file\('ws-schema\.json'\)/.test(src('schema.js')) && /SETTINGS_FILE = require\('\.\/datadir'\)\.file\('notify-settings\.json'\)/.test(fs.readFileSync(path.join(__dirname, 'notify.js'), 'utf8')));
ok('diag.js reads the settings and the history from there too, lists datadir.js in its self-check, and sends what datadir.js knows', /readJson\(dataFile\('notify-settings\.json'\)\)/.test(src('diag.js')) && /readJson\(dataFile\('history\.json'\)\)/.test(src('diag.js')) && /\['datadir\.js', 'your own files/.test(src('diag.js')) && /out\.datadir = require\('\.\/datadir'\)\.info\(\)/.test(src('diag.js')));
// FILES: only the app's own files
const DG = fs.readFileSync(path.join(__dirname, 'diag.js'), 'utf8');
const lf = new Function('fs', 'path', 'crypto', 'APP_DIR', DG.slice(DG.indexOf('const WATCHED = '), DG.indexOf('const fingerprint')) + DG.slice(DG.indexOf('const FEATURES = ['), DG.indexOf('];', DG.indexOf('const FEATURES = [')) + 2) + DG.slice(DG.indexOf('const OWN_EXTRA'), DG.indexOf('\n}', DG.indexOf('if (others) out.push')) + 2) + ' return listFiles();');
['index.html', 'notify.js', 'icon.ico', 'notificacao de missao completada.png', 'my notes.txt', 'Green Leaf Bulb Icon.png'].forEach(n => W(app, n, 'x'));
const lst = lf(fs, path, require('crypto'), app);
ok('the FILES list of the report: the app\u2019s own files are listed, any other file of the folder is only counted (no names)', lst.some(f => f.name === 'index.html') && lst.some(f => f.name === 'notify.js') && lst.some(f => f.name === 'icon.ico') && !lst.some(f => /notificacao|notes|Green Leaf/.test(f.name || '')) && lst[lst.length - 1].others === 4, lst);
const Core = require('./diag-core');
const rep = Core.analyse({ main: { meta: {}, files: lst, datadir: { folder: '~\\AppData\\Roaming\\4horizon', inAppFolder: false, files: [{ name: 'history.json', kb: 3.8 }, { name: 'notify-settings.json', kb: 0.6 }], moves: { 'history.json': 'moved', 'tidy-settings.json': 'none' } } }, ui: {} }).report;
ok('report: "(and 4 other files of the folder, not the app\u2019s: not listed)"', /\(and 4 other files of the folder, not the app’s: not listed\)/.test(rep), rep.slice(rep.indexOf('FILES'), rep.indexOf('FILES') + 400));
ok('report: YOUR FILES, the folder, the files, what was moved now', /YOUR FILES \(history, settings: kept in the user-data folder, not in the app folder\)\n  folder: ~\\AppData\\Roaming\\4horizon\n  history\.json 3\.8 KB · notify-settings\.json 0\.6 KB\n  history\.json: moved from the app folder now/.test(rep), rep.slice(rep.indexOf('YOUR FILES'), rep.indexOf('YOUR FILES') + 300));
ok('an older app without datadir.js: no YOUR FILES section', Core.analyse({ main: { meta: {}, files: [] }, ui: {} }).report.indexOf('YOUR FILES') < 0);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
