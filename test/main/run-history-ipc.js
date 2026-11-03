// run-history-ipc.js (lang-51): the history's two requests (history:get, history:export) answer only the app's own window, never a game panel
const electron = require('electron');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 400))); c ? pass++ : fail++; };
require('./history');
const H = electron._handlers, WIN = { sender: electron._WINDOW }, PANEL = { sender: { id: 'a game panel' } };
(async () => {
  ok('both requests are there', typeof H['history:get'] === 'function' && typeof H['history:export'] === 'function');
  const g = H['history:get'](WIN);
  ok('the app window gets the history (days, today, now)', g && typeof g.days === 'object' && typeof g.today === 'string' && typeof g.now === 'number', g);
  ok('a game panel gets nothing', H['history:get'](PANEL) === null && H['history:get']({}) === null && H['history:get'](undefined) === null);
  const before = electron._dlg.calls;
  const r = await H['history:export'](PANEL, 'a,b\n1,2', 'x.csv');
  ok('a game panel cannot export (no save dialog opens, nothing written)', r && r.ok === false && r.error === 'not-allowed' && electron._dlg.calls === before, r);
  const r2 = await H['history:export'](WIN, 'a,b\n1,2', 'history.csv');
  ok('the app window can export (the save dialog opens)', electron._dlg.calls === before + 1 && r2 && r2.ok !== false, r2);
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message); process.exit(1); });
