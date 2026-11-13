// run-topbar-key.js (lang-71): main.js: Ctrl+B shows or hides the top bar wherever the keyboard is (the window and every game panel), and the tray menu has "Show the top bar".
// Only Ctrl+B itself is taken from the page; any other key (Ctrl+Shift+B, Alt, B alone, Ctrl+C...) goes on to the page or the game as before.
const fs = require('fs');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const src = fs.readFileSync('main.js', 'utf8');
const i = src.indexOf('const barKey = '), j = src.indexOf('\n  };', i) + 5;
ok('main.js has the Ctrl+B handler, on the window and on every game panel', i > 0 && /win\.webContents\.on\('before-input-event', barKey\)/.test(src) && /guest\.on\('before-input-event', barKey\)/.test(src));
const sent = [];
let full = false; const win = { isDestroyed: () => false, webContents: { send: (ch, what) => sent.push([ch, what]) }, isFullScreen: () => full, setFullScreen: v => { full = v; } };
const barKey = new Function('win', src.slice(i, j) + '\nreturn barKey;')(win);
const press = input => { const ev = { prevented: false, preventDefault() { this.prevented = true; } }; barKey(ev, Object.assign({ type: 'keyDown', control: false, alt: false, shift: false, meta: false }, input)); return ev.prevented; };
ok('Ctrl+B: the window is told to toggle the bar, and the key does not reach the page', press({ control: true, key: 'b' }) === true && JSON.stringify(sent.slice(-1)[0]) === '["bar","toggle"]');
ok('...with Caps Lock (Ctrl+B as "B") too', press({ control: true, key: 'B' }) === true && sent.length === 2);
const n = sent.length;
const others = [{ key: 'b' }, { control: true, shift: true, key: 'B' }, { control: true, alt: true, key: 'b' }, { control: true, key: 'c' }, { control: true, key: 'v' }, { control: true, key: 'x' }, { control: true, key: 'a' }, { control: true, key: 'r' }, { control: true, meta: true, key: 'b' }, { control: true, key: 'b', type: 'keyUp' }, { key: 'F11', control: true }, { key: 'F11', shift: true }, { key: 'F11', type: 'keyUp' }, { key: 'F5' }];
ok('any other key goes on to the page as before (B alone, Ctrl+Shift+B, Ctrl+Alt+B, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+R, Ctrl+F11, the keys going up, F5)', others.every(o => press(o) === false) && sent.length === n && full === false, [sent.length - n, full]);
ok('F11: full screen on, and the key does not reach the page; F11 again: off (it came with the menu that is removed, so 4horizon keeps it)', press({ key: 'F11' }) === true && full === true && press({ key: 'F11' }) === true && full === false && sent.length === n);
ok('the File / Edit / View / Window menu is removed when the app starts (Menu.setApplicationMenu(null))', /app\.whenReady\(\)\.then\(\(\) => \{[\s\S]{0,600}Menu\.setApplicationMenu\(null\)/.test(src));
ok('the tray menu has "Show the top bar", which shows the window and the bar', /label: i18n\.t\('Show the top bar'\), click: \(\) => \{[^\n]*win\.show\(\);[^\n]*win\.webContents\.send\('bar', 'show'\)/.test(src));
const pre = fs.readFileSync('preload.js', 'utf8');
ok('the bridge passes only "show" or "toggle" to the window', /onBar: \(callback\) => ipcRenderer\.on\('bar', \(event, what\) => callback\(what === 'show' \? 'show' : 'toggle'\)\)/.test(pre));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
