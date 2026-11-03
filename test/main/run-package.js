// run-package.js (lang-53): the installer (electron-builder, "build" in package.json). It cannot be built here, so what it would contain is checked instead:
// every file the app loads is in it (each require, each script and stylesheet of the pages, the pictures, the data), nothing of the tests, tools or
// documents is, the license is, and the app keeps its name (so the installed app uses the same user-data folder: settings, history, saved logins).
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 500))); c ? pass++ : fail++; };
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')), b = pkg.build || {};

// the "files" rules of electron-builder, for the simple patterns used here: "**/*" takes everything, "!x" leaves out (dir/**, *.ext, **/*.x-*, a name)
const rules = (b.files || []).filter(r => r.startsWith('!')).map(r => r.slice(1));
const toRx = g => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '\u0001').replace(/\*\*/g, '\u0002').replace(/\*/g, '[^/]*').replace(/\u0001/g, '(?:.*/)?').replace(/\u0002/g, '.*') + '$');          // (** first set aside, so that the * of its pattern is not changed again)
const excluded = f => rules.some(r => toRx(r).test(f));
const included = f => (b.files || []).includes('**/*') && !excluded(f);

ok('the build: a Windows installer (NSIS, 64-bit), with the app\u2019s icon, into dist/', b.win && b.win.target[0].target === 'nsis' && b.win.target[0].arch.join() === 'x64' && b.win.icon === 'icon.ico' && b.directories.output === 'dist' && fs.existsSync('icon.ico'), b.win);
ok('the app keeps its name "4horizon" (productName and name): the installed app uses the same user-data folder (%APPDATA%\\4horizon)', b.productName === '4horizon' && pkg.name === '4horizon');
ok('installed for the user only (no administrator), the folder can be chosen, Start menu and desktop shortcuts, the data is kept when it is uninstalled', b.nsis.oneClick === false && b.nsis.perMachine === false && b.nsis.allowToChangeInstallationDirectory === true && b.nsis.createDesktopShortcut && b.nsis.createStartMenuShortcut && b.nsis.deleteAppDataOnUninstall === false, b.nsis);
ok('scripts: npm run dist builds it, npm run pack makes the folder only', pkg.scripts.dist === 'electron-builder --win' && pkg.scripts.pack === 'electron-builder --win --dir');
ok('lang-58: before each build ("predist", run by npm by itself) the old installers in dist/ are removed, so it only holds the latest', pkg.scripts.predist === 'node tools/clean-dist.js');
ok('electron-builder and Electron are development packages (Electron is built into the installer, it is not a dependency of the app)', pkg.devDependencies && pkg.devDependencies['electron-builder'] && pkg.devDependencies.electron && !pkg.dependencies);
ok('releases go to GitHub as a DRAFT (checked by hand before they are published)', b.publish && b.publish.provider === 'github' && b.publish.owner === 'venom1337idle' && b.publish.repo === '4horizon' && b.publish.releaseType === 'draft', b.publish);

// what the app loads, starting from main.js
const need = new Set(['main.js', 'package.json', 'LICENSE']), seen = new Set(), queue = ['main.js'];
const refsOf = f => {
  const t = fs.readFileSync(f, 'utf8'), out = [];
  for (const m of t.matchAll(/require\('\.\/([\w.-]+?)(?:\.js)?'\)/g)) out.push(m[1].endsWith('.json') ? m[1] : m[1] + '.js');
  for (const m of t.matchAll(/(?:src|href)="([\w.-]+\.(?:js|css|html|png|ico))"/g)) out.push(m[1]);
  for (const m of t.matchAll(/['"]([\w.@-]+\.(?:png|ico|html|json))['"]/g)) out.push(m[1]);
  for (const m of t.matchAll(/path\.join\(__dirname, '([\w.@-]+\.(?:js|png|ico|html|json))'\)/g)) out.push(m[1]);
  return out;
};
['index.html', 'dashboard.html'].forEach(f => queue.push(f));
while (queue.length) {
  const f = queue.shift(); if (seen.has(f)) continue; seen.add(f);
  if (!fs.existsSync(f)) continue;
  need.add(f);
  if (/\.(js|html)$/.test(f)) refsOf(f).forEach(r => { if (fs.existsSync(r) && !seen.has(r)) queue.push(r); });
}
const appFiles = Array.from(need).filter(f => fs.existsSync(f)).sort();
const left = appFiles.filter(f => !included(f));
ok('every file the app loads is in the installer (' + appFiles.length + ' files, from main.js, the two pages and what they load)', appFiles.length > 35 && left.length === 0, left);
ok('...among them the modules of the latest steps, the data and the pictures', ['vault.js', 'lockdown.js', 'datadir.js', 'missions.js', 'economy.js', 'hunt-data.js', 'game-data.json', 'i18n-pt.js', 'theme.css', 'icon.ico', 'tray.png', 'brand.png', 'gem.png', 'logo.png', 'LICENSE'].every(f => need.has(f) && included(f)), ['vault.js', 'lockdown.js', 'datadir.js', 'missions.js', 'economy.js', 'hunt-data.js', 'game-data.json', 'i18n-pt.js', 'theme.css', 'icon.ico', 'tray.png', 'brand.png', 'gem.png', 'logo.png', 'LICENSE'].filter(f => !need.has(f) || !included(f)));
ok('left out: the tests, the tools, the documents, the zips, backups, the game\u2019s code, the built installers', ['test/main/run-vault.js', 'tools/build-data.mjs', 'README.md', 'README.en.md', 'SECURITY.md', 'SECURITY.txt', 'ComoUsar.txt', 'x.zip', 'main.js.bak-diag', 'game-data.mjs', 'dist/4horizon-Setup-1.0.0.exe', '.github/workflows/test.yml'].every(excluded));
// the GitHub workflow that builds a release
const wf = fs.existsSync('.github/workflows/release.yml') ? fs.readFileSync('.github/workflows/release.yml', 'utf8') : (fs.existsSync('../.github/workflows/release.yml') ? fs.readFileSync('../.github/workflows/release.yml', 'utf8') : null);
ok('the release workflow (when it is part of the folder): on a version tag, on Windows, publishes with GitHub\u2019s own token', wf === null || (/tags: \['v\*'\]/.test(wf) && /runs-on: windows-latest/.test(wf) && /electron-builder --win --publish always/.test(wf) && /GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/.test(wf)));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
