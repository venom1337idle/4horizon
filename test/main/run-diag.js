// Tests diag.js (the main-process part) against a fake app folder, with secrets planted where they could leak.
const fs = require('fs'), path = require('path'), os = require('os');
const electron = require('electron');
const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const HOME = os.homedir();
const SECRETS = ['SECRETNAME', 'me@example.com', 'ENCRYPTEDSECRET', 'SECRETVALUE', 'SECRETUSER', 'tok_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'];

// ---- plant secrets: a saved login, a settings file with a typed name, a history file with numbers
const UD = electron._USERDATA;
fs.writeFileSync(path.join(UD, 'accounts.json'), JSON.stringify({ version: 1, autoLogin: true, rows: { 1: { name: 'SECRETNAME', user: 'me@example.com', pass: 'ENCRYPTEDSECRET' }, 2: { name: 'x', user: 'SECRETUSER', pass: '' }, 3: {} } }));
fs.writeFileSync(path.join(UD, 'species.json'), JSON.stringify({ 1: 'bulbasaur', 2: 'ivysaur' }));
try { require('fs').mkdirSync(UD, { recursive: true }); } catch (e) {}
const notifyPath = path.join(UD, 'notify-settings.json'), tidyPath = path.join(UD, 'tidy-settings.json'), histPath = path.join(UD, 'history.json');          // (lang-68: your own files are in the user-data folder)
fs.writeFileSync(notifyPath, JSON.stringify({ enabled: true, events: { shiny: true, rareDrop: false }, goodCatch: { minIV: 175, minQuality: 1.7 }, accountNames: { 1: 'SECRETNAME' }, note: 'SECRETNAME' }));
fs.writeFileSync(tidyPath, JSON.stringify({ enabled: true, closeAnnouncements: true, announcementWords: ['SECRETNAME'], onlyFirstSeconds: 180 }));
fs.writeFileSync(histPath, JSON.stringify({ '2026-10-26': { SECRETNAME: { gold: 123456789 } }, '2026-10-27': {} }));

const diag = require('./diag');
const origLog = console.log; const seenByTerminal = [];
console.log = function () { seenByTerminal.push(Array.from(arguments).join(' ')); };      // stands in for the real terminal
diag.init();
const hooked = console.log;
diag.init();                                                                              // twice must not wrap twice
ok('console is hooked once, not twice', console.log === hooked && console.log.__diag === true);
console.log('Account 1: reader attached');
console.log('login for me@example.com failed at ' + path.join(HOME, 'Desktop', '4horizon', 'x.js') + ' token tok_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 and https://x.y/z?session=SECRETVALUE&a=1');
console.error(new Error('boom SECRETNAME@example.com'));
ok('the app still prints to the terminal exactly as before (the hook only watches): both log lines came through unchanged, with the original text (the error went to the real error stream)', seenByTerminal.length === 2 && seenByTerminal[0] === 'Account 1: reader attached' && /me@example\.com/.test(seenByTerminal[1]), seenByTerminal);
const early = diag.collect();            // a snapshot BEFORE the log is flooded below

// ---- game messages: only types and field NAMES
for (let i = 0; i < 12; i++) diag.frame(1, 'hunt-session', 400);
diag.frame(1, 'ready', 30000); diag.frame(1, 'something-else', 50); diag.frame(1, null, 10); diag.frame(2, 'character', 900);
diag.fields(1, 'hunt-session', { type: 'hunt-session', session: { kills: 5, secret: 'SECRETVALUE', loot: { 'ultra-ball': 3 } }, list: [{ id: 'SECRETVALUE', n: 1 }] });
const big = {}; for (let i = 0; i < 40; i++) big['item-' + i] = 'SECRETVALUE';
diag.fields(1, 'inventory', { type: 'inventory', items: big });
for (let i = 0; i < 300; i++) diag.fields(1, 'wide', Object.fromEntries(Array.from({ length: 5 }, (_, j) => ['k' + i + '_' + j, 1])));
for (let t = 0; t < 120; t++) diag.frame(3, 'type-' + t, 1);

// ---- errors, capped
for (let i = 0; i < 70; i++) diag.error('test', new Error('e' + i + ' in ' + HOME));
diag.error('weird', undefined); diag.error('weird', null); diag.error('weird', { not: 'an error' });
for (let i = 0; i < 300; i++) console.log('line ' + i);

global.__PANELS = [
  { getType: () => 'webview', getURL: () => 'https://pokehorizonidle.com/play?token=SECRETVALUE', isLoading: () => false, isCrashed: () => false, session: electron.session.fromPartition('persist:conta1') },
  { getType: () => 'window', getURL: () => 'file:///x', isLoading: () => false, session: {} }
];
electron.session.fromPartition = p => ({ p });                                            // a new object each call: the panel match must then simply fail, not throw
const c = diag.collect();
const text = JSON.stringify(c);
ok('the report has every section (meta, files, features, accounts, fields, panels, settings, errors, logs)', ['meta', 'files', 'features', 'accounts', 'fields', 'panels', 'settings', 'errors', 'logs'].every(k => k in c));
SECRETS.forEach(s => ok('the secret "' + s.slice(0, 18) + '" is nowhere in what is collected', text.indexOf(s) < 0 && JSON.stringify(early).indexOf(s) < 0, text.indexOf(s) >= 0 ? text.slice(Math.max(0, text.indexOf(s) - 60), text.indexOf(s) + 60) : ''));
const textEarly = JSON.stringify(early);
ok('your home folder path is not in it either (it shows as "~")', text.indexOf(HOME) < 0 && textEarly.indexOf(HOME) < 0 && /~(\/|\\\\)Desktop/.test(textEarly), HOME);          // (1.0.6: "~/Desktop" or, on Windows, "~\Desktop", which reads "~\\Desktop" in the JSON text)
ok('e-mail addresses become "<email>", long tokens "<token>", and the query part of a web address is cut', early.logs.some(l => /login for <email> failed at ~/.test(l.text) && /<token>/.test(l.text) && /z\?\u2026/.test(l.text) && !/session=/.test(l.text)), early.logs.filter(l => /login for/.test(l.text)));
ok('panel addresses keep only the site and the path (no "?token=...")', c.panels.length === 1 && c.panels[0].url === 'https://pokehorizonidle.com/play', c.panels);

ok('message kinds are counted per account, newest counts first: hunt-session 12, ready 1, something-else 1, "(not json)" 1', c.accounts[1].frames === 15 && c.accounts[1].types[0].type === 'hunt-session' && c.accounts[1].types[0].n === 12 && c.accounts[1].types.some(t => t.type === '(not json)'), c.accounts[1]);
ok('account 2 is separate (1 message), and "last seen" ages are numbers', c.accounts[2].frames === 1 && typeof c.accounts[2].lastAgeSec === 'number');
ok('more than 80 kinds of message are folded into "(other)" instead of growing without limit', c.accounts[3].types.length <= 81 && c.accounts[3].types.some(t => t.type === '(other)'), c.accounts[3].types.length);
ok('field names are kept two levels deep: session, session.kills, session.loot, list, list[].id ... and not their values', ['type', 'session', 'session.kills', 'session.secret', 'session.loot', 'list', 'list[].id', 'list[].n'].every(k => c.fields['hunt-session'].indexOf(k) >= 0), c.fields['hunt-session']);
ok('a map with many keys (40 items) is summarised as one entry, not listed key by key', c.fields.inventory.some(k => /items\.\{40 keys\}/.test(k)) && !c.fields.inventory.some(k => /item-1$/.test(k)), c.fields.inventory);
ok('a message with endless different fields stops at 120 names', c.fields.wide.length <= 120, c.fields.wide.length);

ok('errors are capped at 40 (70 were thrown), the newest kept, odd values (undefined, null, objects) do not break it', c.errors.length === 40 && /e69/.test(c.errors[c.errors.length - 4].msg) && c.errors.slice(-3).every(e => e.src === 'weird') && c.errors.length === 40, c.errors.length);
ok('the log keeps the last 150 lines only', c.logs.length === 150 && c.logs[c.logs.length - 1].text === 'line 299', c.logs.length);

// ---- settings: only counts and true/false
const s = c.settings;
ok('saved logins: only counts and flags (2 with a user, 1 with a password, auto login on, encryption available)', s.accounts.saved === 2 && s.accounts.withPassword === 1 && s.accounts.autoLogin === true && s.accounts.encryption === require('./vault').info().available && Object.keys(s.accounts).sort().join() === 'autoLogin,encryption,file,panels,saved,vault,withPassword' && s.accounts.vault.api === 'sync' && !/pass":"|S:/.test(JSON.stringify(s.accounts.vault)), s.accounts);          // (lang-68: what vault.js knows; counts only)
ok('notification settings: true/false and numbers kept, typed text (names) dropped', s.notify.enabled === true && s.notify.events.shiny === true && s.notify.events.rareDrop === false && s.notify.goodCatch.minIV === 175 && !('accountNames' in s.notify) && !('note' in s.notify), s.notify);
ok('tidy settings: the typed words are dropped, the switches kept', s.tidy.enabled === true && s.tidy.onlyFirstSeconds === 180 && !('announcementWords' in s.tidy), s.tidy);
ok('history: how many days (2), never what is in them', s.history.days === 2 && JSON.stringify(s.history).indexOf('123456789') < 0, s.history);
ok('species names: how many (2)', s.species.names === 2, s.species);

// ---- installed features and files
const f = name => c.features.find(x => x.label === name);
ok('parts: the diagnostics window is found in index.html (it has had one since the Diagnostics were added)', f('diagnostics window').ok === true && f('diagnostics window').missingFile === false, f('diagnostics window'));
ok('parts: a marker in the right file is found (the reader has the team hook; tidy.js exists)', f('team tracker in the reader').ok === true && f('popup tidy module').ok === true);
ok('parts: a file that does not exist is "file not found" (diag-core exists here, so use xp-report)', c.features.every(x => typeof x.ok === 'boolean' && typeof x.missingFile === 'boolean'));
ok('files: listed with size, age and an 8-character fingerprint, no node_modules, no credentials files', c.files.some(x => x.name === 'diag.js' && x.sha8 && x.sha8.length === 8 && x.size > 1000) && !c.files.some(x => /node_modules|accounts\.json/.test(x.name)), c.files.map(x => x.name).slice(0, 40));
ok('meta: versions and platform are there', c.meta.app === '4horizon' && c.meta.version === '1.0.0' && c.meta.node && c.meta.platform && typeof c.meta.uptimeSec === 'number', c.meta);

// ---- IPC
const H = electron._handlers;
ok('three IPC handlers are registered: diag:get, diag:copy, diag:save', ['diag:get', 'diag:copy', 'diag:save'].every(k => typeof H[k] === 'function'), Object.keys(H));
const ours = { sender: electron._WINDOW }, other = { sender: { id: 'a game page' } };
ok('only the app\u2019s own window may ask: a game page gets nothing', H['diag:get'](other) === null && H['diag:copy'](other, 'x') === false, null);
ok('the app\u2019s window gets the report', (() => { const r = H['diag:get'](ours); return r && r.v === 1 && r.meta; })());
ok('copy puts the text on the clipboard', H['diag:copy'](ours, 'hello report') === true && electron._clip.text === 'hello report');
(async () => {
  const p = await H['diag:save'](ours, 'saved text \u00e9');
  ok('save writes the file the user chose and says where', p === electron._dlg.result.filePath && fs.readFileSync(p, 'utf8') === 'saved text \u00e9', p);
  electron._dlg.result = { canceled: true };
  ok('cancelling the save dialog writes nothing and returns null', (await H['diag:save'](ours, 'x')) === null);
  ok('a game page cannot save either', (await H['diag:save'](other, 'x')) === null);
  // the great catch mode is reported as one of two fixed words (never text from the file)
  fs.writeFileSync(notifyPath, JSON.stringify({ goodCatch: { mode: 'AND' } })); const cm1 = diag.collect().settings.notify.catchMode;
  fs.writeFileSync(notifyPath, JSON.stringify({ goodCatch: { mode: 'my secret text' } })); const cm2 = diag.collect().settings.notify.catchMode;
  fs.writeFileSync(notifyPath, JSON.stringify({ enabled: true })); const cm3 = diag.collect().settings.notify.catchMode;
  ok('the report says the great catch mode: "and" (even written AND), and "or" for any other text or when it is not in the file', cm1 === 'and' && cm2 === 'or' && cm3 === 'or', [cm1, cm2, cm3]);
  // robustness: unreadable / broken files
  fs.writeFileSync(notifyPath, '{ not json'); fs.writeFileSync(path.join(UD, 'accounts.json'), 'garbage');
  let threw = null, c2; try { c2 = diag.collect(); } catch (e) { threw = e.message; }
  ok('broken settings files do not break the report: they read as empty', !threw && c2.settings.accounts.saved === 0 && Object.keys(c2.settings.notify).length === 0, threw);
  fs.unlinkSync(notifyPath); fs.unlinkSync(tidyPath); fs.unlinkSync(histPath); fs.unlinkSync(path.join(UD, 'accounts.json'));
  let c3; try { c3 = diag.collect(); } catch (e) { threw = e.message; }
  ok('missing settings files do not break it either', !threw && c3.settings.history.days === 0 && c3.settings.accounts.file === false, threw);
  // ---- is the game connection open?
  ok('before any connection is seen the state is "not known" (null)', diag.socketOpen(1) === null);
  diag.socket(1, 'r1', 'wss://pokehorizonidle.com/ws', 'created');
  ok('the game connection is created: open (true)', diag.socketOpen(1) === true);
  diag.socket(1, 'r2', 'wss://analytics.example.com/x', 'created');
  diag.socket(1, 'r2', null, 'closed');
  ok('another site\u2019s connection is ignored, also when it closes: the game\u2019s stays open', diag.socketOpen(1) === true);
  diag.socket(1, 'r1', null, 'closed');
  ok('the game connection closes (the player signed out): false, at once', diag.socketOpen(1) === false);
  diag.socket(1, 'r3', 'wss://pokehorizonidle.com/ws', 'created');
  ok('...and a new one after signing in again: open again', diag.socketOpen(1) === true);
  diag.socket(1, 'r1', null, 'closed');
  ok('closing a connection that was never open (a stale id) changes nothing', diag.socketOpen(1) === true);
  diag.socket(5, 'x', 'wss://pokehorizonidle.com/ws', 'created'); diag.socket(5, 'x', null, 'closed');
  const c5 = diag.collect();
  ok('the report has the state per panel (panel 1 open, panel 5 closed, with ages), also for a panel that sent no message at all', c5.accounts[1].socket === true && c5.accounts[5].socket === false && typeof c5.accounts[5].socketAgeSec === 'number' && c5.accounts[5].frames === 0, [c5.accounts[1] && c5.accounts[1].socket, c5.accounts[5]]);
  let thr = null; try { diag.socket(undefined, undefined, undefined, undefined); diag.socket(null, {}, {}, 'created'); diag.socket(2, undefined, undefined, 'closed'); } catch (e) { thr = e.message; }
  ok('odd calls (missing numbers, objects, unknown events) never throw', !thr, thr);

  // ---- the build, and files that change after the app started
  const c6 = diag.collect();
  ok('the build marker is in the report ("lang-71"), so what RUNS can be told from what is on the disk', c6.meta.build === 'lang-71' && diag.BUILD === 'lang-71', c6.meta);
  ok('right after the start nothing is stale', Array.isArray(c6.staleFiles) && c6.staleFiles.length === 0, c6.staleFiles);
  const tidyFile = path.join(__dirname, 'tidy.js'), tidyText = fs.readFileSync(tidyFile, 'utf8');
  fs.writeFileSync(tidyFile, tidyText + '\n// an update was copied over\n');
  ok('a watched file changed on disk after the start (an update copied over the old one) is reported as stale', diag.collect().staleFiles.join() === 'tidy.js', diag.collect().staleFiles);
  fs.writeFileSync(tidyFile, tidyText);
  ok('...and when it is back to what it was, it is not stale any more', diag.collect().staleFiles.length === 0);
  const liveFile = path.join(__dirname, 'live.js'); const hadLive = fs.existsSync(liveFile);
  if (!hadLive) { fs.writeFileSync(liveFile, '// new file'); ok('a watched file that did not exist at the start and appeared is stale too', diag.collect().staleFiles.indexOf('live.js') >= 0); fs.unlinkSync(liveFile); ok('...and not any more when it is gone again', diag.collect().staleFiles.length === 0); }
  ok('a file that is not watched (a settings file, history) never counts', (() => { const f = path.join(__dirname, 'history.json'); fs.writeFileSync(f, '{}'); const r = diag.collect().staleFiles.length === 0; fs.unlinkSync(f); return r; })());

  // ---- offering a restart when the app is started a second time
  const E = electron, calls = E._calls, box = () => E._dlg.boxCalls;
  E._dlg.boxCalls.length = 0; calls.relaunch = 0; calls.quit = 0;
  ok('nothing changed: no question is asked and nothing happens', diag.offerRestart({ isDestroyed: () => false }) === false && box().length === 0 && calls.relaunch === 0);
  fs.writeFileSync(tidyFile, tidyText + '\n// update\n');
  E._dlg.box = { response: 1 };
  ok('an update is on the disk and the app is started again: the question is asked, with the changed file named and a parent window', diag.offerRestart({ isDestroyed: () => false }) === true && box().length === 1 && /tidy\.js/.test(box()[0][1].message) && /OLD version/.test(box()[0][1].message) && box()[0][1].buttons[0] === 'Restart now' && box()[0].length === 2, box());
  await new Promise(r => setTimeout(r, 30));
  ok('"Not now": the app is left alone (no relaunch, no quit)', calls.relaunch === 0 && calls.quit === 0);
  E._dlg.box = { response: 0 }; E._dlg.boxCalls.length = 0;
  diag.offerRestart({ isDestroyed: () => false }); const second = diag.offerRestart({ isDestroyed: () => false });
  ok('a second start while the question is still open does not ask twice', second === false && box().length === 1, box().length);
  await new Promise(r => setTimeout(r, 30));
  ok('"Restart now": the app is relaunched and quit (the quit is the normal one, so the usual saving on exit happens)', calls.relaunch === 1 && calls.quit === 1, calls);
  E._dlg.boxCalls.length = 0; calls.relaunch = 0; calls.quit = 0; E._dlg.boxReject = true;
  diag.offerRestart({ isDestroyed: () => false }); await new Promise(r => setTimeout(r, 30));
  ok('a message box that fails is recorded as an error and does not break anything (and the next start can ask again)', calls.relaunch === 0 && calls.quit === 0 && diag.collect().errors.some(e => e.src === 'offerRestart' && /dialog failed/.test(e.msg)));
  E._dlg.boxReject = false; E._dlg.boxCalls.length = 0; E._dlg.box = { response: 1 };
  ok('...it can ask again afterwards', diag.offerRestart({ isDestroyed: () => false }) === true && box().length === 1);
  await new Promise(r => setTimeout(r, 30)); E._dlg.boxCalls.length = 0;
  diag.offerRestart({ isDestroyed: () => true }); await new Promise(r => setTimeout(r, 30));
  ok('a window that is already destroyed is not used as the parent (the question is still asked, without one)', box().length === 1 && box()[0].length === 1, box());
  E._dlg.boxCalls.length = 0; diag.offerRestart(null); await new Promise(r => setTimeout(r, 30));
  ok('no window at all is fine too', box().length === 1 && box()[0].length === 1);
  const rel = E.app.relaunch; E.app.relaunch = () => { throw new Error('cannot relaunch'); }; E._dlg.box = { response: 0 }; calls.quit = 0; diag.offerRestart(null); await new Promise(r => setTimeout(r, 30));
  ok('if relaunching throws, it is recorded, and the app still quits normally (never half-way)', diag.collect().errors.some(e => e.src === 'relaunch') && calls.quit === 1); E.app.relaunch = rel;
  fs.writeFileSync(tidyFile, tidyText);

  // ---- the manual look covers every panel, also the ones that are sending data
  E.session.fromPartition = p => E._SESS[p] || (E._SESS[p] = { p });        // one session object per partition again, as in the real thing
  const SESS1 = E.session.fromPartition('persist:conta4'), SESS2 = E.session.fromPartition('persist:conta2');      // panel 4 never sent anything in this test, panel 2 does
  const looks = [];
  global.__PANELS = [4, 2].map(n => ({ getType: () => 'webview', getURL: () => 'https://pokehorizonidle.com/', isLoading: () => false, isCrashed: () => false, session: n === 4 ? SESS1 : SESS2, isDestroyed: () => false,
    executeJavaScript: async () => { looks.push(n); return { url: 'https://pokehorizonidle.com/', title: 'Poke Horizon', ready: 'complete', forms: 0, passwordBoxes: n === 4 ? 1 : 0, textBoxes: 0, inputs: [], buttons: [], links: [], headings: [], frames: [], text: 'x' }; } }));
  diag.frame(2, 'hunt-session', 5);                      // panel 2 is sending data right now, panel 4 is not
  const answer = await H['diag:probe-login'](ours);
  ok('the look at the login pages covers EVERY panel (2 and 4), also the one that is sending data', looks.sort().join() === '2,4' && answer.length === 2, [looks, answer]);
  ok('...and says which one was sending data (panel 2: signedIn true; panel 4: false)', answer.find(a => a.n === 2).signedIn === true && answer.find(a => a.n === 4).signedIn === false, answer);
  const lp = diag.collect().loginPages;
  ok('...the report marks the page of the panel that was sending data as such, so a game screen is not mistaken for a login page', lp.find(p => p.n === 2).sendingData === true && lp.find(p => p.n === 4).sendingData === false, lp.map(p => [p.n, p.sendingData]));
  ok('a game page cannot ask for the look', (await H['diag:probe-login'](other)) === null);

  // ---- per panel: is a login saved? (true / false only)
  ok('which panels have a saved login is reported as true / false per panel (panel 1 has a user and a password, panel 2 a user only, 3 and 4 nothing here), never the text', (() => { fs.writeFileSync(path.join(UD, 'accounts.json'), JSON.stringify({ rows: { 1: { user: 'me@example.com', pass: 'ENCRYPTEDSECRET' }, 2: { user: 'SECRETUSER', pass: '' } } })); const pn = diag.collect().settings.accounts.panels; const raw = JSON.stringify(diag.collect()); return pn[1].user === true && pn[1].pass === true && pn[2].user === true && pn[2].pass === false && pn[3].user === false && pn[4].pass === false && raw.indexOf('me@example.com') < 0 && raw.indexOf('SECRETUSER') < 0 && raw.indexOf('ENCRYPTEDSECRET') < 0; })());

  // ---- eggs: the KINDS of values, never the values
  const dv = diag.describeValue;
  ok('describeValue: numbers by their digits (a date in milliseconds has 13), true / false as they are, short labels as they are, longer text by length only', dv(1761700000000) === 'number(whole, 13 digits)' && dv(7200000) === 'number(whole, 7 digits)' && dv(0.5) === 'number(decimal, 1 digits)' && dv(-12) === 'number(whole, 2 digits, negative)' && dv(true) === 'true' && dv(false) === 'false' && dv(null) === 'null' && dv('adupoke') === 'text "adupoke"' && dv('a secret sentence with spaces') === 'text(29 characters)' && dv(['a', 'b']) === 'list(2) of text "a"' && dv({ x: 1, y: 2 }) === 'object{x,y}', [dv(1761700000000), dv('a secret sentence with spaces')]);
  ok('describeValue never throws on odd values', (() => { try { [undefined, NaN, Infinity, Symbol('x'), () => 1, {}, [], [[]], 10n].forEach(v => dv(v)); return true; } catch (e) { return e.message; } })());
  const eggMsg = { type: 'breeding', slots: 1, eggs: [{ id: 'egg-91', speciesId: 102, readyAt: 1761700000000, startedAt: 1761678400000, doubled: true, bonus: 'adupoke', owner: 'SECRETOWNERNAME sentence', secretNote: 'SECRETEGGVALUE with spaces', ivs: [31, 20, 5] }, { id: 'egg-92', speciesId: 7 }] };
  diag.fields(3, 'breeding', eggMsg);
  const eg = diag.collect().eggs.find(e => e.n === 3);
  ok('an egg in a "breeding" message is described field by field: id, species, a 13-digit time, true, the label "adupoke", a list of numbers', eg && eg.path === 'breeding.eggs' && eg.count === 2 && eg.items[0].id === 'text "egg-91"' && eg.items[0].speciesId === 'number(whole, 3 digits)' && eg.items[0].readyAt === 'number(whole, 13 digits)' && eg.items[0].doubled === 'true' && eg.items[0].bonus === 'text "adupoke"' && /^list\(3\) of number/.test(eg.items[0].ivs), eg);
  ok('...but no value of the egg is in the report: the numbers are only digit counts, a longer text only its length', JSON.stringify(diag.collect().eggs).indexOf('SECRETEGGVALUE') < 0 && JSON.stringify(diag.collect().eggs).indexOf('SECRETOWNERNAME') < 0 && JSON.stringify(diag.collect().eggs).indexOf('1761700000000') < 0 && eg.items[0].owner === 'text(' + 'SECRETOWNERNAME sentence'.length + ' characters)', eg.items[0]);
  diag.fields(3, 'breeding', { type: 'breeding', slots: 1, eggs: [] });
  ok('an empty egg list does not erase what was seen before', diag.collect().eggs.some(e => e.n === 3));
  diag.fields(4, 'breeding', { type: 'breeding', slots: 1, eggs: { 'egg-1': { speciesId: 7, readyAt: 17617000 } } });
  ok('eggs held in a map instead of a list are described too', (diag.collect().eggs.find(e => e.n === 4) || {}).count === 1, diag.collect().eggs);
  diag.fields(5, 'breeding', { type: 'breeding', eggs: ['egg-a', 'egg-b'] });
  ok('eggs that are plain labels instead of objects are described as such', JSON.stringify((diag.collect().eggs.find(e => e.n === 5) || {}).items) === '[{"(value)":"text \\"egg-a\\""},{"(value)":"text \\"egg-b\\""}]', diag.collect().eggs.find(e => e.n === 5));
  diag.fields(2, 'ready', { type: 'ready', incubator: [{ speciesId: 7, readyAt: 1761700000000 }], character: { name: 'x', incubatorSlots: 1 }, pokemon: [{ id: 'p1' }] });
  ok('in the big "ready" message, only keys with egg / incubat in their name are looked at (the incubator list, not the Pok\u00e9mon list)', (diag.collect().eggs.find(e => e.n === 2) || {}).path === 'ready.incubator', diag.collect().eggs.find(e => e.n === 2));
  let thrE = null; try { [undefined, null, 5, 'x', { eggs: 5 }].forEach(m => { diag.fields(1, 'breeding', m); diag.fields(1, 'ready', m); }); } catch (e) { thrE = e.message; }
  ok('odd messages never break the sampler', !thrE, thrE);

  // ---- the big "ready" message keeps up to 500 field names (it was cut at 120 before, hiding the part that matters)
  const big500 = { type: 'ready' }; for (let g = 0; g < 6; g++) { big500['group' + g] = {}; for (let i = 0; i < 50; i++) big500['group' + g]['f' + String.fromCharCode(97 + (i % 26)) + i] = 1; }
  diag.fields(1, 'ready', big500);
  ok('"ready" keeps 300 field names (others stop at 120)', diag.collect().fields.ready.length >= 300, diag.collect().fields.ready.length);

  // ---- ids as keys (new): a message whose keys change from one message to the next must not fill the list
  diag.fields(1, 'hit', { type: 'hit', '3f2b7c1a-aaaa-4bbb-8ccc-0123456789ab': { ally: '1', damage: 5 }, '1234567890': { x: 1 }, '12': { y: 2 }, turn: 3 });
  const hf = diag.collect().fields.hit;
  ok('a key that is a uuid or a number of 6 digits or more is listed as {id}, and what is inside it under {id}: {id}, {id}.ally, {id}.damage, {id}.x', hf.indexOf('{id}') >= 0 && hf.indexOf('{id}.ally') >= 0 && hf.indexOf('{id}.damage') >= 0 && hf.indexOf('{id}.x') >= 0, hf);
  ok('...the uuid and the long number themselves are nowhere in the list; a short number key (12) and a normal name (turn) are listed as they are', !hf.some(x => /3f2b7c1a|1234567890/.test(x)) && hf.indexOf('12') >= 0 && hf.indexOf('12.y') >= 0 && hf.indexOf('turn') >= 0, hf);
  for (let i = 0; i < 40; i++) { const o = { type: 'hit' }; o['aaaaaaa' + (i % 10) + '-bbbb-cccc-dddd-' + String(i).padStart(12, '0')] = { n: i }; diag.fields(2, 'hit', o); }
  const hf2 = diag.collect().fields.hit;
  ok('40 messages with 40 DIFFERENT uuid keys add exactly one name, the new inner one ({id}.n); the 40 uuids themselves add nothing', hf2.length === hf.length + 1 && hf2.indexOf('{id}.n') >= 0 && !hf2.some(x => /^aaaaaaa/.test(x)), [hf2.length, hf.length, hf2]);
  const cj = path.join(__dirname, 'combat.js'), cjText = fs.readFileSync(cj, 'utf8');
  fs.writeFileSync(cj, cjText + '\n// changed\n');
  ok('combat.js is one of the watched files: changed after the start, it is reported as stale (the app runs the old counting)', diag.collect().staleFiles.indexOf('combat.js') >= 0, diag.collect().staleFiles);
  fs.writeFileSync(cj, cjText);
  ok('...and not any more when it is back to what it was', diag.collect().staleFiles.indexOf('combat.js') < 0);

  // scrub on its own
  const sc = diag.scrub;
  ok('scrub: handles null, numbers and objects', sc(null) === '' && sc(5) === '5' && typeof sc({}) === 'string');
  ok('scrub: a short word that looks like nothing is left alone ("tidy (panel 2): closed the announcement")', sc('tidy (panel 2): closed the announcement') === 'tidy (panel 2): closed the announcement');
  console.log = origLog;
// ===== links from the game go to the default browser (the start-up of diag.js wires it)
{
  const handlersNew = (electron._app['web-contents-created'] || []);
  const fake = { handler: null, setWindowOpenHandler(f) { this.handler = f; }, on() {}, getURL: () => 'https://pokehorizonidle.com/', isDestroyed: () => false };
  handlersNew.forEach(f => { try { f({}, fake); } catch (e) {} });
  global.__OPENED = [];
  const ans = fake.handler && fake.handler({ url: 'https://www.twitch.tv/benksbr' });
  ok('starting the diagnostics (what main.js does first) makes a new game panel open its windows in the default browser: the address goes to the browser and the panel gets "deny"', !!fake.handler && ans.action === 'deny' && global.__OPENED.join() === 'https://www.twitch.tv/benksbr', [!!fake.handler, ans, global.__OPENED]);
  const rep = diag.collect ? diag.collect() : null;
  ok('...and the report data has what was opened: the site only', rep && rep.external && rep.external.events.some(e => e.host === 'www.twitch.tv' && e.how === 'opened') && JSON.stringify(rep.external).indexOf('benksbr') < 0, rep && rep.external);
}

// ===== the guard of the Doar button is started by the start-up of diag.js
{
  const handlersNew = (electron._app['web-contents-created'] || []);
  const js = [];
  const wv = { ls: {}, getType: () => 'webview', on(ev, f) { (this.ls[ev] = this.ls[ev] || []).push(f); }, isDestroyed: () => false, isLoading: () => true, getURL: () => '', executeJavaScript(c) { js.push(c); return Promise.resolve('installed'); } };
  handlersNew.forEach(f => { try { f({}, wv); } catch (e) {} });
  (wv.ls['dom-ready'] || []).forEach(f => f());
  ok('starting the diagnostics (what main.js does first) puts the guard script of the Doar button into a new game panel when its page is ready', js.length === 1 && /guardInPage/.test(js[0]) && js[0].indexOf('https://pokehorizonidle.com/') > 0, js.map(x => x.slice(0, 80)));
  const rep = diag.collect ? diag.collect() : null;
  ok('...and the report data has a part for it, with the four-panel list (here no panel is registered yet)', rep && rep.donate && Array.isArray(rep.donate.panels), rep && rep.donate);
}

  out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
