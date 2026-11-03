// run-donate-guard.js: the main-process part: which web contents get the guard script, when, in which language, and what is heard back from the page
const Module = require('module');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const created = []; let existing = [];
const stub = { app: { on: (ev, fn) => { if (ev === 'web-contents-created') created.push(fn); }, whenReady: () => new Promise(() => {}), getAppPath: () => __dirname, getLocale: () => 'en-US', getPath: () => __dirname }, webContents: { getAllWebContents: () => existing }, BrowserWindow: { fromWebContents: () => null }, ipcMain: { handle: () => {} } };
const orig = Module._load; Module._load = function (req) { return req === 'electron' ? stub : orig.apply(this, arguments); };
Object.keys(require.cache).filter(k => /donate-guard\.js|accounts\.js|i18n\.js/.test(k)).forEach(k => delete require.cache[k]);
const DG = require('./donate-guard'), accounts = require('./accounts'), i18n = require('./i18n');
Module._load = orig;
let T = 5000000; DG._setClock(() => T);
const fake = (type, o) => { o = o || {}; const w = { type, listeners: {}, js: [], failJs: false, destroyed: false, loading: !!o.loading, url: o.url === undefined ? 'https://pokehorizonidle.com/' : o.url,
  getType() { return this.type; }, on(ev, f) { (this.listeners[ev] = this.listeners[ev] || []).push(f); }, isDestroyed() { return this.destroyed; }, isLoading() { return this.loading; }, getURL() { return this.url; },
  executeJavaScript(code) { this.js.push(code); return this.failJs ? Promise.reject(new Error('Script failed to execute')) : Promise.resolve('installed'); }, emit(ev, ...a) { (this.listeners[ev] || []).forEach(f => f(...a)); } }; return w; };
const reset = () => { DG._reset(); created.length = 0; existing = []; Object.keys(accounts._guests).forEach(k => delete accounts._guests[k]); i18n.setLang('en'); };
const tick = () => new Promise(r => setTimeout(r, 15));

(async () => {
  // ---- who gets it
  reset(); DG.init();
  ok('starting it asks to be told about every new web contents', created.length === 1 && typeof created[0] === 'function', created.length);
  const wv = fake('webview', { loading: true }), win = fake('window'), bg = fake('backgroundPage'), rem = fake('remote');
  [wv, win, bg, rem].forEach(w => created[0]({}, w));
  ok('only the game panels (webview) are hooked: the window of the app and the other kinds get no listener and no script', Object.keys(wv.listeners).length >= 3 && [win, bg, rem].every(w => Object.keys(w.listeners).length === 0), [wv, win, bg, rem].map(w => Object.keys(w.listeners)));
  ok('a panel that is still loading gets nothing until its page is ready', wv.js.length === 0);
  wv.emit('dom-ready'); await tick();
  ok('when its page is ready (dom-ready) the guard script is put in the page, once', wv.js.length === 1 && /guardInPage/.test(wv.js[0]) && /\(\{"url":"https:\/\/pokehorizonidle\.com\/","before":"Visit the official ","link":"webpage","after":" to donate"\}\)$/.test(wv.js[0]), wv.js.map(x => x.slice(-140)));
  wv.emit('did-finish-load'); await tick();
  ok('it is put in again when the load finishes (a script that is already there only updates)', wv.js.length === 2);
  wv.emit('dom-ready'); await tick();
  ok('and again for a page that loads again (a reload, the game going to its own address)', wv.js.length === 3);
  let threw = false; try { new Function(wv.js[0]); } catch (e) { threw = true; }
  ok('the script is valid JavaScript', !threw);
  ok('the script carries only the words and the official address (nothing of the user, nothing of any account)', !/trainer\d|password|token|@/i.test(wv.js[0].replace(/@/g, '') ) && wv.js[0].indexOf('https://pokehorizonidle.com/') > 0);
  // ---- contents that were there before
  reset(); const done = fake('webview', { loading: false }), busy = fake('webview', { loading: true }), blank = fake('webview', { loading: false, url: '' }); existing = [done, busy, blank, fake('window')]; DG.init(); await tick();
  ok('panels that were already there when it started: a loaded one gets the script at once, one that is loading waits for its page, one with no page yet gets nothing', done.js.length === 1 && busy.js.length === 0 && blank.js.length === 0, [done.js.length, busy.js.length, blank.js.length]);
  // ---- hooked once
  reset(); const one = fake('webview', { loading: true }); existing = [one]; DG.init(); created[0]({}, one); DG.init(); await tick();
  ok('the same panel seen twice (already there, and announced) and the start called twice: one set of listeners', created.length === 1 && (one.listeners['dom-ready'] || []).length === 1 && (one.listeners['console-message'] || []).length === 1, [created.length, one.listeners['dom-ready'].length]);
  // ---- language
  reset(); i18n.setLang('pt-BR'); const pt = fake('webview', { loading: true }); DG.init(); created[0]({}, pt); pt.emit('dom-ready'); await tick();
  ok('with the app in Portuguese the words are in Portuguese: "Visite a [página] oficial para doar"', /"before":"Visite a ","link":"página","after":" oficial para doar"/.test(pt.js[0]), pt.js[0].slice(-150));
  const live1 = fake('webview', { loading: true }), live2 = fake('webview', { loading: true }); created[0]({}, live1); created[0]({}, live2); live1.emit('dom-ready'); live2.emit('dom-ready'); await tick(); const n1 = live1.js.length;
  i18n.setLang('en'); await tick();
  ok('when the language of the app is changed, every panel is told at once (no reload needed) and gets the words in the new language', live1.js.length === n1 + 1 && /"link":"webpage"/.test(live1.js[live1.js.length - 1]) && /"link":"webpage"/.test(live2.js[live2.js.length - 1]) && /"link":"webpage"/.test(pt.js[pt.js.length - 1]), [live1.js.length, n1]);
  live2.destroyed = true; live2.emit('destroyed'); const cnt = live1.js.length, cnt2 = live2.js.length; i18n.setLang('pt-BR'); await tick();
  ok('a panel that is gone is not asked again (and nothing breaks), while the others still are', live1.js.length === cnt + 1 && live2.js.length === cnt2, [live1.js.length, cnt, live2.js.length, cnt2]);
  ok('texts(): English for anything that is not Portuguese', DG.texts('en').link === 'webpage' && DG.texts('fr-FR').link === 'webpage' && DG.texts(undefined).link === 'webpage' && DG.texts('pt-BR').link === 'página' && DG.texts('pt').link === 'página');
  // ---- failures
  reset(); const bad = fake('webview', { loading: true }); bad.failJs = true; created.length = 0; DG.init(); created[0]({}, bad); let t2 = false; try { bad.emit('dom-ready'); await tick(); } catch (e) { t2 = true; }
  ok('a page that does not take the script (an error from the browser) breaks nothing: no exception comes out', !t2, t2);
  accounts._guests[1] = bad; const inf1 = DG.info();
  ok('the report data for that panel: loads 0 and the error text', inf1.panels.length === 1 && inf1.panels[0].n === 1 && inf1.panels[0].loads === 0 && /Script failed/.test(inf1.panels[0].error), inf1);
  bad.failJs = false; bad.emit('dom-ready'); await tick();
  ok('...and when it works again the error is cleared', DG.info().panels[0].loads === 1 && DG.info().panels[0].error === '' && DG.info().panels[0].ageSec === 0, DG.info());
  const gone = fake('webview', { loading: true }); gone.destroyed = true; created[0]({}, gone); gone.emit('dom-ready'); await tick();
  ok('a panel that is already destroyed gets nothing', gone.js.length === 0);
  // ---- what the page says
  reset(); const lw = fake('webview', { loading: true }); DG.init(); created[0]({}, lw); accounts._guests[2] = lw; lw.emit('dom-ready'); await tick();
  lw.emit('console-message', {}, 1, '4h-donate:seen', 1, '');
  ok('the line "4h-donate:seen" is noted (older form of the event: the message as the third argument)', DG.info().panels[0].seenAgeSec === 0, DG.info());
  T += 9000; lw.emit('console-message', { message: '4h-donate:blocked', level: 'info' });
  lw.emit('console-message', { message: '4h-donate:blocked' });
  const inf = DG.info().panels[0];
  ok('"4h-donate:blocked" is counted (newer form of the event: the message in the event); the time of "seen" is kept', inf.blocked === 2 && inf.seenAgeSec === 9, inf);
  lw.emit('console-message', {}, 1, '4h-donate:tab', 1, ''); T += 3000; lw.emit('console-message', { message: '4h-donate:pay' });
  ok('the lines "4h-donate:tab" and "4h-donate:pay" are noted with their own times (both forms of the event): the tab 3 s older than the pay button', DG.info().panels[0].tabAgeSec === 3 && DG.info().panels[0].payAgeSec === 0, DG.info().panels[0]);
  for (const spoof of ['4h-donate:blocked ', '4h-donate:blocked:99', 'x 4h-donate:blocked', '4H-DONATE:BLOCKED', '4h-donate:seen\n4h-donate:blocked', '4h-donate:tab ', '4h-donate:pay:1', '4h-donate:TAB', '', null, undefined, 42, '4h-donate:']) lw.emit('console-message', { message: spoof }, 1, spoof);
  ok('anything that is not exactly one of the four lines is ignored (the game writes in the same console): nothing changed', DG.info().panels[0].blocked === 2 && DG.info().panels[0].tabAgeSec === 3 && DG.info().panels[0].payAgeSec === 0, DG.info().panels[0]);
  lw.emit('console-message'); lw.emit('console-message', null, null, null);
  ok('odd events never break it', true);
  for (let i = 0; i < 12000; i++) lw.emit('console-message', { message: '4h-donate:blocked' });
  ok('the count has a ceiling (9,999)', DG.info().panels[0].blocked === 9999, DG.info().panels[0].blocked);
  // ---- the report data
  reset(); accounts._guests[1] = fake('webview'); accounts._guests[3] = fake('webview'); const none = DG.info();
  ok('panels that never loaded the script are listed with 0 loads, no age, no error (and only panels 1 to 4 that exist)', none.panels.length === 2 && none.panels.every(x => x.loads === 0 && x.ageSec === null && x.seenAgeSec === null && x.tabAgeSec === null && x.payAgeSec === null && x.error === ''), none);
  ok('no personal data in the report data', !/trainer\d|@|password/i.test(JSON.stringify(none)));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
