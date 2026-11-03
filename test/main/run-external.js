// run-external.js: links that a game page opens in a new window go to the default browser
const Module = require('module');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const opened = []; let openResult = () => Promise.resolve(); const created = []; let existing = [];
const stub = {
  app: { on: (ev, fn) => { if (ev === 'web-contents-created') created.push(fn); }, whenReady: () => new Promise(() => {}), getAppPath: () => __dirname, getLocale: () => 'en-US', getPath: () => __dirname },
  shell: { openExternal: url => { opened.push(url); return openResult(url); } },
  webContents: { getAllWebContents: () => existing },
  BrowserWindow: { fromWebContents: () => null },
  ipcMain: { handle: () => {} }
};
const orig = Module._load; Module._load = function (req) { return req === 'electron' ? stub : orig.apply(this, arguments); };
Object.keys(require.cache).filter(k => /external\.js|accounts\.js/.test(k)).forEach(k => delete require.cache[k]);
const X = require('./external'), accounts = require('./accounts');
Module._load = orig;
const fakeWc = (url) => { const w = { handler: null, listeners: {}, setWindowOpenHandler(f) { this.handler = f; }, on(ev, f) { (this.listeners[ev] = this.listeners[ev] || []).push(f); }, getURL: () => url || 'https://pokehorizonidle.com/', isDestroyed: () => false }; return w; };
let T = 1000000; X._setClock(() => T);
const reset = () => { opened.length = 0; X._reset(); X._setClock(() => T); openResult = () => Promise.resolve(); created.length = 0; existing = []; };
const ask = (w, url) => w.handler({ url, frameName: '', features: '', disposition: 'foreground-tab' });

// ---- the basics
reset(); X.init();
ok('starting it asks to be told about every new web contents (the game panels and the window)', created.length === 1, created.length);
const w1 = fakeWc(); created[0]({}, w1);
ok('a new web contents gets a handler for the windows it asks for', typeof w1.handler === 'function');
let r = ask(w1, 'https://www.twitch.tv/benksbr');
ok('the game asks for a window for a Twitch stream: the address goes to the default browser, once, and the panel gets "deny" (no window of the app, the game stays where it is)', JSON.stringify(opened) === '["https://www.twitch.tv/benksbr"]' && r.action === 'deny', [opened, r]);
T += 6000; opened.length = 0;
r = ask(w1, 'https://pokehorizonidle.com/wiki?page=itens#cartas');
ok('the Wiki (any page of it, with a query and a fragment) goes to the browser as it is', opened.length === 1 && opened[0] === 'https://pokehorizonidle.com/wiki?page=itens#cartas' && r.action === 'deny', opened);
T += 6000; opened.length = 0;
r = ask(w1, 'https://topidle.example/vote?trainer=trainer2&token=abc');
ok('a vote link (it carries the name of the trainer) goes to the browser with its whole address', opened[0] === 'https://topidle.example/vote?trainer=trainer2&token=abc', opened);
T += 6000; opened.length = 0;
r = ask(w1, 'http://kick.com/canal');
ok('http works as well as https', opened[0] === 'http://kick.com/canal', opened);
// ---- contents that already existed when it started
reset(); const old = fakeWc(); existing = [old]; X.init();
ok('web contents that already exist when it starts are hooked too', typeof old.handler === 'function');
reset(); const dup = fakeWc(); existing = [dup]; X.init(); created[0]({}, dup); X.init(); const h0 = dup.handler;
ok('hooking is done once: the same contents seen twice (and the start called twice) keep one handler and one listener', dup.handler === h0 && (dup.listeners['will-navigate'] || []).length === 1 && created.length === 1, [created.length, (dup.listeners['will-navigate'] || []).length]);
// ---- what is refused
reset(); X.init(); const w2 = fakeWc(); created[0]({}, w2);
for (const bad of ['javascript:alert(1)', 'file:///C:/Windows/System32/calc.exe', 'data:text/html,<script>alert(1)</script>', 'chrome://settings', 'ms-msdt:/id PCWDiagnostic', 'steam://run/1', 'mailto:a@b.com', 'ftp://x.com/y', 'about:blank', '', null, undefined, 'not an address', 'https://', 'http://', '//evil.com/x']) { r = ask(w2, bad); T += 6000; }
ok('anything that is not a web address is refused (javascript:, file:, data:, chrome:, other programs, mail, ftp, blank, broken ones) and never reaches the browser, and the panel still gets "deny"', opened.length === 0 && r.action === 'deny', opened);
r = ask(w2, 'https://example.com/' + 'a'.repeat(2100)); T += 6000;
ok('an address longer than 2,048 characters is refused', opened.length === 0 && r.action === 'deny');
r = ask(w2, 'https://user:pass@example.com/x'); T += 6000;
ok('an address with a user name and password still opens (the browser decides), and the report keeps only the site', opened.length === 1 && X.info().events.slice(-1)[0].host === 'example.com', [opened, X.info().events.slice(-1)[0]]);
// ---- many at once
reset(); X.init(); const w3 = fakeWc(); created[0]({}, w3);
for (let i = 0; i < 8; i++) ask(w3, 'https://ads.example/' + i);
ok('a page that asks for 8 windows at once gets 3 (the browser is not flooded) and every request is still answered "deny"', opened.length === 3 && ask(w3, 'https://ads.example/x').action === 'deny', opened);
ok('...the ones that were not opened are noted in the report as "too many at once"', X.info().events.filter(e => e.how === 'too many at once').length === 6, X.info().events.map(e => e.how));
T += 5200; opened.length = 0; ask(w3, 'https://twitch.tv/again');
ok('after 5 seconds a link opens again', opened.length === 1, opened);
// ---- the browser cannot be started
reset(); X.init(); const w4 = fakeWc(); created[0]({}, w4); openResult = () => Promise.reject(new Error('no browser'));
r = ask(w4, 'https://twitch.tv/x');
(async () => {
  await new Promise(r => setTimeout(r, 30));
  ok('if the computer cannot start a browser nothing is thrown, the panel gets "deny", and the report says the browser could not be started', r.action === 'deny' && X.info().events.slice(-1)[0].ok === false && /could not be started/.test(X.info().events.slice(-1)[0].how), X.info().events);
  reset(); X.init(); const w5 = fakeWc(); created[0]({}, w5); stub.shell.openExternal = () => { throw new Error('boom'); };
  let threw = false, rr; try { rr = ask(w5, 'https://twitch.tv/x'); } catch (e) { threw = true; }
  ok('a browser start that throws at once is not thrown at the game either', !threw && rr.action === 'deny' && X.info().events.slice(-1)[0].ok === false);
  stub.shell.openExternal = url => { opened.push(url); return openResult(url); };
  // ---- what is watched (never stopped)
  reset(); X.init(); const w6 = fakeWc('https://pokehorizonidle.com/'); created[0]({}, w6);
  let prevented = false; const ev = { url: 'https://www.twitch.tv/benksbr', preventDefault: () => { prevented = true; } };
  w6.listeners['will-navigate'][0](ev);
  ok('when the page itself goes to another site (not a new window) the site is noted for the report, and nothing is stopped (the login and the other flows of the game work as they did)', X.info().events.length === 1 && X.info().events[0].host === 'www.twitch.tv' && X.info().events[0].how === 'the page itself went there' && !prevented, X.info().events);
  w6.listeners['will-navigate'][0]({ preventDefault() {} }, 'https://id.twitch.tv/oauth2/x');
  ok('the older form of the event (the address as a second argument) is read too', X.info().events.length === 2 && X.info().events[1].host === 'id.twitch.tv', X.info().events);
  w6.listeners['will-navigate'][0]({ url: 'https://pokehorizonidle.com/other' }); w6.listeners['will-navigate'][0]({ url: 'javascript:1' }); w6.listeners['will-navigate'][0]({ url: 'file:///x' }); w6.listeners['will-navigate'][0]({});
  ok('a move inside the game site, and addresses that are not web addresses, are not noted', X.info().events.length === 2, X.info().events.length);
  // ---- the report
  reset(); X.init(); const w7 = fakeWc(); created[0]({}, w7); ask(w7, 'https://topidle.example/vote?trainer=trainer2&token=SECRET');
  const inf = X.info();
  ok('the report has only the site, never the rest of the address (no trainer name, no token), how long ago, and what happened', JSON.stringify(inf).indexOf('SECRET') < 0 && JSON.stringify(inf).indexOf('trainer2') < 0 && inf.events[0].host === 'topidle.example' && inf.events[0].how === 'opened' && inf.events[0].ageSec === 0, inf);
  for (let i = 0; i < 40; i++) { T += 6000; ask(w7, 'https://site' + i + '.example/'); }
  ok('only the latest 20 events are kept', X.info().events.length === 20 && X.info().events[19].host === 'site39.example', X.info().events.length);
  // which panel asked
  reset(); X.init(); const w8 = fakeWc(); created[0]({}, w8); accounts._guests[3] = w8; ask(w8, 'https://twitch.tv/x'); T += 6000; const w9 = fakeWc(); created[0]({}, w9); ask(w9, 'https://twitch.tv/y');
  ok('the report says which panel asked (panel 3 for a game panel, 0 for the window of the app)', X.info().events[0].n === 3 && X.info().events[1].n === 0, X.info().events);
  delete accounts._guests[3];
  // a web contents without the newer functions does not break anything
  reset(); X.init(); let threw2 = false; try { created[0]({}, {}); created[0]({}, null); created[0]({}, { setWindowOpenHandler() { throw new Error('x'); }, on() { throw new Error('y'); } }); } catch (e) { threw2 = true; }
  ok('odd web contents (nothing, null, functions that throw) never break the start-up', !threw2);
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
