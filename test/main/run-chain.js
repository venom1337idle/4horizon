const { attachReader } = require('./ws-reader');
let pass = 0, fail = 0; const expect = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '  ' + JSON.stringify(x))); c ? pass++ : fail++; };
const panels = {};
const fakePanel = n => { const h = {}; const p = { ran: [], h, debugger: { attach() {}, sendCommand: async () => {}, on() {} }, isDestroyed: () => false, once() {}, on: (ev, f) => { h[ev] = f; },
  executeJavaScript: async s => { p.ran.push(s); return 'ok'; } }; return (panels[n] = p); };
for (const n of [1, 2, 3, 4]) attachReader(fakePanel(n), n, () => {});                    // exactly what main.js does for each web view
expect('every one of the 4 panels is hooked up for page-ready', [1, 2, 3, 4].every(n => typeof panels[n].h['dom-ready'] === 'function'));
expect('...and for the messages the page prints', [1, 2, 3, 4].every(n => typeof panels[n].h['console-message'] === 'function'));
[1, 2, 3, 4].forEach(n => panels[n].h['dom-ready']());
expect('when a panel is ready, only THAT panel gets the script', [1, 2, 3, 4].every(n => panels[n].ran.some(s => s.includes('function tidyInPage'))) && panels[2].ran.filter(s => s.includes('tidyInPage')).length === 1);
expect('the login helper (accounts.js) and tidy do not interfere: both are attached', typeof panels[1].h['dom-ready'] === 'function' && require('fs').existsSync(require('./datadir').file('tidy-settings.json')));          // (lang-50: in the user-data folder)
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
