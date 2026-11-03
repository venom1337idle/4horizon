// run-all.js: runs every test of 4horizon against the app files of this project.
//
//   npm test                          all groups (window, main, notify) and the checks of the texts
//   node test/run-all.js main         one group (window | main | notify)
//   node test/run-all.js window run-today run-eggs     some suites of a group
//   node test/run-all.js window texts                  only the checks of the texts (Portuguese dictionary, English parity)
//   node test/run-all.js --keep       keep the work folders (their place is printed)
//
// Each group runs in a work folder of its own, made fresh in the system's temp folder: the app files of the project (the real ones), then the files of
// test/<group> on top (the suites, and the stand-ins they need: a small hunt list, a fake Electron for the main process...). Nothing is written in the project.
// The window tests need Playwright and its Chromium: "npm install" then "npx playwright install chromium". The text checks need Python 3 (skipped without it).

const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const GROUPS = ['window', 'main', 'notify'];
const SKIP_ROOT = new Set(['test', 'tools', 'node_modules', 'dist', 'out', '.git', '.github', 'README.md', 'README.pt-BR.md', 'LICENSE', 'SECURITY.md', 'SECURITY.txt', 'ComoUsar.txt', '.gitignore', '.gitattributes']);
const SUITE_MS = 300000;

const args = process.argv.slice(2), keep = args.includes('--keep'), words = args.filter(a => !a.startsWith('--'));
const groups = words.length && GROUPS.includes(words[0]) ? [words[0]] : GROUPS;
const only = words.length && GROUPS.includes(words[0]) ? words.slice(1).map(w => w.replace(/\.js$/, '')) : [];

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}
function workFolder(group) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '4horizon-test-' + group + '-'));
  for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) if (e.isFile() && !SKIP_ROOT.has(e.name)) fs.copyFileSync(path.join(ROOT, e.name), path.join(dir, e.name));
  copyDir(path.join(__dirname, group), dir);                                           // the suites and their stand-ins (these win over the app's own data)
  fs.copyFileSync(path.join(__dirname, 'pw.js'), path.join(dir, 'pw.js'));
  const stub = path.join(dir, 'stubs', 'electron');                                    // the fake Electron of the main-process tests
  if (fs.existsSync(stub)) copyDir(stub, path.join(dir, 'node_modules', 'electron'));
  return dir;
}
const env = Object.assign({}, process.env, { NODE_PATH: path.join(ROOT, 'node_modules') + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : '') });
function run(cmd, argv, cwd) {
  const t0 = Date.now(), r = cp.spawnSync(cmd, argv, { cwd, env, encoding: 'utf8', timeout: SUITE_MS, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, stdout: r.stdout || '', out: (r.stdout || '') + (r.stderr || ''), sec: Math.round((Date.now() - t0) / 100) / 10, timedOut: !!(r.error && r.error.code === 'ETIMEDOUT') };
}
const python = (() => { for (const p of ['python3', 'python']) { try { if (cp.spawnSync(p, ['--version']).status === 0) return p; } catch (e) {} } return null; })();

const results = [];
for (const group of groups) {
  const dir = workFolder(group);
  const suites = fs.readdirSync(path.join(__dirname, group)).filter(f => /^run-.*\.js$/.test(f) && (!only.length || only.includes(f.replace(/\.js$/, '')))).sort();
  console.log('\n== ' + group + ' (' + suites.length + ' suites)' + (keep ? '   work folder: ' + dir : ''));
  for (const s of suites) {
    const r = run(process.execPath, [s], dir);
    const all = [...r.stdout.matchAll(/^(\d+) passed, (\d+) failed\s*$/gm)];
    let m = all.length ? all[all.length - 1] : null;                                  // the suite's own summary: its last one, in its normal output
    if (!m && r.code === 0 && !r.timedOut) {                                           // (two older suites print no summary: their PASS and FAIL lines are counted)
      const p = (r.stdout.match(/^  PASS  /gm) || []).length, f = (r.stdout.match(/^  FAIL  /gm) || []).length;
      if (p + f > 0) m = [null, String(p), String(f)];
    }
    const ok = r.code === 0 && !!m && m[2] === '0';
    results.push({ group, name: s.replace(/\.js$/, ''), ok, pass: m ? +m[1] : 0, fail: m ? +m[2] : null });
    console.log((ok ? '  ok    ' : '  FAIL  ') + s.replace(/\.js$/, '').padEnd(26) + (m ? (m[1] + ' passed, ' + m[2] + ' failed') : (r.timedOut ? 'stopped after ' + SUITE_MS / 1000 + ' s' : 'did not finish')) + '  (' + r.sec + ' s)');
    if (!ok) r.out.split('\n').filter(l => /^\s*FAIL|^FAILED|Error/.test(l)).slice(0, 6).forEach(l => console.log('          ' + l.trim().slice(0, 220)));
  }
  // the texts: the Portuguese dictionary, the English text against the reference, and Portuguese left in English
  if (group === 'window' && (!only.length || only.includes('texts'))) {
    if (!python) console.log('  skip  the text checks: Python 3 was not found');
    else {
      const b = run(python, ['build.py', 'check'], dir), mm = /missing \(asked for, no translation\): (\d+)[\s\S]*unused \(translated, nobody asks\): (\d+)/.exec(b.out);
      const okB = b.code === 0 && !!mm && mm[1] === '0' && mm[2] === '0';
      results.push({ group, name: 'portuguese-dictionary', ok: okB }); console.log((okB ? '  ok    ' : '  FAIL  ') + 'portuguese-dictionary'.padEnd(26) + (mm ? mm[1] + ' missing, ' + mm[2] + ' unused' : 'could not run'));
      const en = path.join(dir, 'out-en.json'); run(process.execPath, ['scen.js', 'en', en], dir);
      const c = run(python, ['compare.py', 'golden-en.json', en], dir), cm = /compared (\d+) parts of (\d+) states: (\d+) different/.exec(c.out);
      const okC = !!cm && cm[3] === '0';
      results.push({ group, name: 'english-parity', ok: okC }); console.log((okC ? '  ok    ' : '  FAIL  ') + 'english-parity'.padEnd(26) + (cm ? cm[3] + ' different (of ' + cm[1] + ' parts)' : 'could not run'));
      if (!okC) c.out.split('\n').filter(l => /^DIFF/.test(l)).slice(0, 6).forEach(l => console.log('          ' + l.slice(0, 220)));
      const pt = path.join(dir, 'out-pt.json'); run(process.execPath, ['scen.js', 'pt-BR', pt], dir);
      const l = run(python, ['leak.py', pt, '4'], dir), lm = /(\d+) texts? that still read as English/.exec(l.out);
      console.log('  info  ' + 'portuguese-left-english'.padEnd(26) + (lm ? lm[1] + ' (2 are known: a log line of popup tidy, and the Diagnostics report, which is English on purpose)' : 'could not run'));
    }
  }
  if (!keep) fs.rmSync(dir, { recursive: true, force: true });
}
const bad = results.filter(r => !r.ok), checks = results.reduce((n, r) => n + (r.pass || 0), 0);
console.log('\n' + (bad.length ? bad.length + ' FAILED: ' + bad.map(r => r.group + '/' + r.name).join(', ') : 'all ' + results.length + ' passed') + ' · ' + checks + ' checks');
process.exit(bad.length ? 1 : 0);
