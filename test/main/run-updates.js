// run-updates.js (lang-58): is a newer 4horizon out? GitHub's latest published release against this version; the Update button opens only this
// repository's release page; only the app's own window is answered; the report says what was found.
const electron = require('electron');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 400))); c ? pass++ : fail++; };
const opened = []; electron.shell = Object.assign(electron.shell || {}, { openExternal: u => { opened.push(u); return Promise.resolve(); } });
const U = require('./updates');
const answer = r => U._setFetch(() => (r instanceof Error ? Promise.reject(r) : Promise.resolve(r)));
(async () => {
  // ---- comparing versions
  ok('newer: 1.0.3 > 1.0.2, 1.1.0 > 1.0.9, 2.0.0 > 1.9.9, v1.0.10 > 1.0.9 (numbers, not text)', U.newer('1.0.3', '1.0.2') && U.newer('1.1.0', '1.0.9') && U.newer('2.0.0', '1.9.9') && U.newer('v1.0.10', '1.0.9'));
  ok('...not newer: the same, older, or not a version', !U.newer('1.0.2', '1.0.2') && !U.newer('1.0.1', '1.0.2') && !U.newer('banana', '1.0.0') && !U.newer('1.0.3', ''));
  const v = U.info().version;
  ok('this version is the app\u2019s own (here the stand-in\u2019s ' + v + ')', /^\d+\.\d+\.\d+$/.test(v));
  // ---- what GitHub answers
  U._reset(); answer({ tag_name: 'v9.9.9', html_url: 'https://github.com/venom1337idle/4horizon/releases/tag/v9.9.9', draft: false, prerelease: false });
  let i = await U.check();
  ok('a newer release (v9.9.9): available, with its version and its page', i.available === true && i.latest === '9.9.9' && i.url === 'https://github.com/venom1337idle/4horizon/releases/tag/v9.9.9' && i.error === null && i.checkedSec === 0, i);
  U._reset(); answer({ tag_name: 'v' + v, html_url: 'https://github.com/venom1337idle/4horizon/releases/tag/v' + v });
  i = await U.check();
  ok('the same version: up to date (no button)', i.available === false && i.latest === v, i);
  U._reset(); answer({ tag_name: 'v0.0.1' });
  ok('an older one: up to date', (await U.check()).available === false);
  U._reset(); answer({ tag_name: 'v9.9.9', draft: true });
  i = await U.check();
  ok('a draft or a pre-release is never offered', i.available === false && /no published release/.test(i.error) && (U._reset(), answer({ tag_name: 'v9.9.9', prerelease: true }), (await U.check()).available === false), i);
  U._reset(); answer(new Error('getaddrinfo ENOTFOUND api.github.com'));
  i = await U.check();
  ok('GitHub cannot be reached: nothing offered, the reason kept for the report, no crash', i.available === false && /ENOTFOUND/.test(i.error) && i.checks === 1, i);
  U._reset(); answer({ tag_name: 'v9.9.9', html_url: 'https://evil.example/download' });
  i = await U.check();
  ok('a page address that is not this repository\u2019s is never used: its releases page instead', i.available && i.url === 'https://github.com/venom1337idle/4horizon/releases/latest', i);
  U._reset(); answer({ tag_name: 'v9.9.9', html_url: 'https://github.com/venom1337idle/4horizon/releases/tag/v9.9.9" onerror="x' });
  ok('...nor one with quotes or spaces in it', (await U.check()).url === 'https://github.com/venom1337idle/4horizon/releases/latest');
  ok('the address asked is GitHub\u2019s latest release of venom1337idle/4horizon', U.API === 'https://api.github.com/repos/venom1337idle/4horizon/releases/latest');
  // ---- opening the page
  U._reset(); answer({ tag_name: 'v9.9.9', html_url: 'https://github.com/venom1337idle/4horizon/releases/tag/v9.9.9' }); await U.check();
  let r = U.open();
  ok('Update pressed: the release page opens in the browser', r.ok === true && opened[opened.length - 1] === 'https://github.com/venom1337idle/4horizon/releases/tag/v9.9.9', [r, opened]);
  U._reset(); answer({ tag_name: 'v0.0.1' }); await U.check(); const before = opened.length;
  r = U.open();
  ok('...with no newer version, nothing opens', r.ok === false && opened.length === before, r);
  // ---- only the app's own window
  U.init();
  const H = electron._handlers, WIN = { sender: electron._WINDOW }, PANEL = { sender: { id: 'panel' } };
  ok('update:get and update:open answer the app window, never a game panel', H['update:get'](WIN) && H['update:get'](WIN).version === v && H['update:get'](PANEL) === null && H['update:open'](PANEL) === null);
  // ---- the report
  const D = require('./diag-core');
  const rep = o => D.analyse({ main: { meta: {}, updates: o }, ui: {} }).report;
  ok('report: UPDATES, this version and the latest, "a NEWER version is out" when there is one', /UPDATES \(GitHub is asked for the latest release shortly after the start and every 6 hours\)\n  this version 1\.0\.2 · latest release 1\.0\.3 · a NEWER version is out \(the Update button shows\) · checked 5 s ago/.test(rep({ version: '1.0.2', latest: '1.0.3', available: true, checkedSec: 5 })));
  ok('...up to date; not checked yet; a failed check with its reason', /latest release 1\.0\.2 · up to date/.test(rep({ version: '1.0.2', latest: '1.0.2', available: false, checkedSec: 60 })) && /latest release not known yet · up to date · checked not yet/.test(rep({ version: '1.0.2', latest: null, available: false, checkedSec: null })) && /last check failed: no answer in 10 s/.test(rep({ version: '1.0.2', latest: null, available: false, checkedSec: 30, error: 'no answer in 10 s' })));
  ok('an older app without updates.js: no UPDATES section', rep(undefined).indexOf('UPDATES') < 0);
  const dsrc = require('fs').readFileSync('diag.js', 'utf8');
  ok('diag.js starts it and its self-check knows it (and the bridge in preload.js)', /require\('\.\/updates'\)\.init\(\)/.test(dsrc) && /\['updates\.js', 'checks GitHub/.test(dsrc) && /\['preload\.js', 'update button bridge', 'updateGet'\]/.test(dsrc) && /updateGet: \(\) => ipcRenderer\.invoke\('update:get'\)/.test(require('fs').readFileSync('preload.js', 'utf8')));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
