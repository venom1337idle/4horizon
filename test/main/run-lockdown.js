// run-lockdown.js: lockdown.js (lang-48): the game panels get no permission except the clipboard and full screen, and every panel is forced to safe
// settings before it starts (only the game, only the four account storages); the PANEL LOCKDOWN section of the report. With a stand-in for Electron.
const Module = require('module');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 600))); c ? pass++ : fail++; };

// ---- a stand-in for Electron: an app, sessions, web contents
const APPON = {}, sessions = {}, contents = [];
const mkSession = name => { const h = { name, req: null, check: null, dev: null, on: {} }; return Object.assign(h, { setPermissionRequestHandler(f) { h.req = f; }, setPermissionCheckHandler(f) { h.check = f; }, setDevicePermissionHandler(f) { h.dev = f; }, on(ev, f) { h.on[ev] = f; } }); };
const mkContents = (type, failRtc) => { const h = { type, on: {}, rtc: null }; return Object.assign(h, { getType: () => type, on(ev, f) { h.on[ev] = f; }, setWebRTCIPHandlingPolicy(p) { if (failRtc) throw new Error('no'); h.rtc = p; } }); };
let ready = false, readyCb = null;
const electron = { app: { on: (ev, f) => { APPON[ev] = f; }, isReady: () => ready, whenReady: () => ({ then: f => { readyCb = f; } }) },
  session: { get defaultSession() { return sessions.default || (sessions.default = mkSession('default')); }, fromPartition: p => sessions[p] || (sessions[p] = mkSession(p)) },
  webContents: { getAllWebContents: () => contents } };
const realLoad = Module._load;
Module._load = function (req, parent, isMain) { if (req === 'electron') return electron; return realLoad.apply(this, arguments); };
const L = require('./lockdown');
Module._load = realLoad;

// ---- init: before the app is ready, then ready
const early = mkContents('window'); contents.push(early);
L.init();
ok('it starts before the window exists: every new web contents is watched (web-contents-created)', typeof APPON['web-contents-created'] === 'function');
ok('...and waits for the app to be ready to lock the storages', typeof readyCb === 'function' && Object.keys(sessions).length === 0);
ready = true; readyCb();
ok('ready: the app window\u2019s storage and the four account storages are locked (permission requests, checks, devices)', ['default', 'persist:conta1', 'persist:conta2', 'persist:conta3', 'persist:conta4'].every(k => sessions[k] && sessions[k].req && sessions[k].check && sessions[k].dev), Object.keys(sessions));
ok('...a window made before it ran is watched too', typeof early.on['will-attach-webview'] === 'function');
const win = mkContents('window'), guest = mkContents('webview');
APPON['web-contents-created']({}, win); APPON['web-contents-created']({}, guest); APPON['web-contents-created']({}, win);
ok('a new window is watched for panels; a panel (webview) itself is not a place panels are attached to; each once', typeof win.on['will-attach-webview'] === 'function' && !guest.on['will-attach-webview'] && L.info().windows === 2, L.info());
ok('lang-51: a game panel gets the WebRTC policy "disable_non_proxied_udp" (no network address found through WebRTC, no STUN look-ups); the app window does not need it', guest.rtc === 'disable_non_proxied_udp' && win.rtc === null && L.info().webrtc.set === 1 && L.info().webrtc.policy === 'disable_non_proxied_udp', [guest.rtc, win.rtc, L.info().webrtc]);
const badGuest = mkContents('webview', true); APPON['web-contents-created']({}, badGuest);
ok('...if Electron refuses it, that is counted (and nothing breaks)', L.info().webrtc.failed === 1);

// ---- permissions
const ask = (ses, perm) => new Promise(r => ses.req({}, perm, r, {}));
(async () => {
  const s1 = sessions['persist:conta1'], s0 = sessions.default;
  const res = {};
  for (const p of ['media', 'geolocation', 'notifications', 'midi', 'midiSysex', 'pointerLock', 'openExternal', 'clipboard-read', 'display-capture', 'idle-detection', 'storage-access', 'window-management', 'clipboard-sanitized-write', 'fullscreen']) res[p] = await ask(s1, p);
  ok('panel 1 asks for camera/microphone, location, notifications, MIDI, pointer lock, opening programs, reading the clipboard, screen capture...: all refused', ['media', 'geolocation', 'notifications', 'midi', 'midiSysex', 'pointerLock', 'openExternal', 'clipboard-read', 'display-capture', 'idle-detection', 'storage-access', 'window-management'].every(p => res[p] === false), res);
  ok('...writing to the clipboard (the game\u2019s copy buttons) and full screen are allowed', res['clipboard-sanitized-write'] === true && res.fullscreen === true, res);
  ok('the checks (navigator.permissions.query and the like) give the same answers', s1.check({}, 'geolocation') === false && s1.check({}, 'notifications') === false && s1.check({}, 'clipboard-sanitized-write') === true);
  ok('USB, HID and serial devices: never', s1.dev({}) === false);
  let prevented = false, cbArgs = 'none'; s1.on['select-hid-device']({ preventDefault() { prevented = true; } }, {}, (...a) => { cbArgs = a; });
  ok('...a request to choose a HID device is cancelled (nothing chosen)', prevented && Array.isArray(cbArgs) && cbArgs.length === 0);
  ok('the app\u2019s own window: the clipboard ("Copy report") works, the rest is refused too', (await ask(s0, 'clipboard-sanitized-write')) === true && (await ask(s0, 'media')) === false);
  // ---- the panels
  const guard = (src, partition, prefs) => { let prevented = false; const wp = Object.assign({ preload: 'file:///evil.js', nodeIntegration: true, contextIsolation: false, sandbox: false, webSecurity: false, allowRunningInsecureContent: true }, prefs || {}); const r = win.on['will-attach-webview']({ preventDefault() { prevented = true; } }, wp, { src, partition }); return { r, prevented, wp }; };
  let g = guard('https://pokehorizonidle.com', 'persist:conta1');
  ok('a game panel: created, with the safe settings forced (no preload, no Node, isolated, sandboxed, web security, no insecure content)', g.r === true && !g.prevented && !('preload' in g.wp) && g.wp.nodeIntegration === false && g.wp.nodeIntegrationInSubFrames === false && g.wp.contextIsolation === true && g.wp.sandbox === true && g.wp.webSecurity === true && g.wp.allowRunningInsecureContent === false, g);
  ok('...also with a path on the game\u2019s site', guard('https://pokehorizonidle.com/jogo?x=1', 'persist:conta4').r === true);
  const bad = [['https://evil.example', 'persist:conta1'], ['https://pokehorizonidle.com.evil.example', 'persist:conta2'], ['http://pokehorizonidle.com', 'persist:conta1'], ['file:///C:/x.html', 'persist:conta1'], ['javascript:alert(1)', 'persist:conta1'],
    ['https://pokehorizonidle.com', 'persist:conta5'], ['https://pokehorizonidle.com', ''], ['https://pokehorizonidle.com', 'conta1'], ['', 'persist:conta1']];
  const out = bad.map(([s, p]) => { const x = guard(s, p); return x.r === false && x.prevented; });
  ok('not created: another site, a look-alike address, plain http, a local file, javascript:, a storage that is not one of the four accounts, no address', out.every(Boolean), out);
  // ---- the report
  const inf = L.info();
  ok('the report data: panels created and refused, refusals per permission and per panel (names and counts only)', inf.sessions === 5 && inf.panels.attached === 2 + bad.length && inf.panels.fixed === 2 && inf.panels.refused.length === bad.length && inf.denied.media.total === 2 && inf.denied.media.panels[1] === 1 && inf.denied.media.panels[0] === 1 && inf.allowed['clipboard-sanitized-write'].total === 2, inf);
  const D = require('./diag-core');
  const rep = D.analyse({ main: { meta: {}, lockdown: inf }, dash: { accounts: [{ n: 1, name: 'trainer1', nameKnown: true }] }, ui: {} }).report;
  const sec = rep.slice(rep.indexOf('PANEL LOCKDOWN'), rep.indexOf('\n\n', rep.indexOf('PANEL LOCKDOWN')));
  ok('report: PANEL LOCKDOWN, panels created / forced / refused, storages locked 5 of 5, WebRTC off on the panels (and where it failed)', /^PANEL LOCKDOWN \(/.test(sec) && /\n  panels: 11 created, 2 with safe settings forced, 9 REFUSED \(not the game, or not an account storage\): /.test(sec) && /locked storages: 5 of 5 · WebRTC address discovery off on 1 panels \(COULD NOT be set on 1\)\n/.test(sec), sec);
  ok('...what was refused, how often and for which panel (the app window too); what was allowed; what to do if the game misses something', /\n  refused: media ×2 \(the app window, Account 1 \(trainer\d\)\)/.test(sec) && /geolocation \(check\) ×1 \(Account 1 \(trainer\d\)\)/.test(sec) && /\n  allowed: clipboard-sanitized-write ×2 · fullscreen ×1/.test(sec) && /tell me its name/.test(sec), sec);
  const rep2 = D.analyse({ main: { meta: {}, lockdown: { sessions: 3, panels: { attached: 4, fixed: 4, refused: [] }, denied: {}, allowed: {} } }, ui: {} }).report;
  ok('...nothing asked for yet: says so; fewer than 5 storages locked: "NOT ALL"', /refused: nothing was asked for since the app started/.test(rep2) && /locked storages: 3 of 5 \(NOT ALL\)/.test(rep2) && /none refused/.test(rep2));
  ok('an older app without lockdown.js: no section, no error', D.analyse({ main: { meta: {} }, ui: {} }).report.indexOf('PANEL LOCKDOWN') < 0);
  // ---- diag.js starts it first, and the self-check knows it
  const dsrc = require('fs').readFileSync('diag.js', 'utf8');
  ok('diag.js starts it first of all (before any window or panel), and its self-check lists it', /takePrints\(\); \} catch \(e\) \{\}\n  try \{ require\('\.\/lockdown'\)\.init\(\);/.test(dsrc) && /\['lockdown\.js', 'game panels locked down/.test(dsrc) && /'lockdown\.js'[,\]]/.test(dsrc));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
