const H = require('./diag-core');
const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const clone = o => JSON.parse(JSON.stringify(o));
const types = (ready) => [{ type: 'hunt-session', n: 120, lastAgeSec: 2 }, { type: 'character', n: 20, lastAgeSec: 5 }, { type: 'pokemon-update', n: 90, lastAgeSec: 1 }].concat(ready ? [{ type: 'ready', n: 1, lastAgeSec: 200 }] : []);
const FEATS = ['team tracker', 'diagnostics', 'regions'].map(l => ({ file: 'x.js', label: l, ok: true, missingFile: false }));
const acct = n => ({ frames: 230, firstAgeSec: 400, lastAgeSec: 2, kb: 120, types: types(true) });
const HEALTHY = {
  main: { v: 1, meta: { app: '4horizon', version: '1.0.0', electron: '31.0.0', chrome: '126', node: '20', os: 'Windows_NT 10.0', platform: 'win32', arch: 'x64', locale: 'pt-BR', uptimeSec: 900, rssMB: 300 }, files: [{ name: 'diag.js', size: 9000, ageDays: 0.1, sha8: 'abcd1234' }], features: FEATS,
    accounts: { 1: acct(1), 2: acct(2), 3: acct(3), 4: acct(4) }, fields: { ready: ['a', 'b'], character: ['character', 'character.level'] },
    panels: [1, 2, 3, 4].map(n => ({ n: n, url: 'https://pokehorizonidle.com/', loading: false, crashed: false })),
    settings: { notify: { enabled: true, events: { shiny: true, rareDrop: true } }, tidy: { enabled: true }, accounts: { file: true, saved: 4, withPassword: 4, autoLogin: false, encryption: true }, history: { file: true, days: 3 }, species: { names: 493 } },
    errors: [], logs: [{ ageSec: 100, level: 'log', text: 'tidy (panel 1): closed the announcement popup' }, { ageSec: 99, level: 'log', text: 'tidy (panel 2): closed Hunt Analyzer' }] },
  dash: { v: 1, hunt: { hunts: 300, species: 400 },
    accounts: [1, 2, 3, 4].map(n => ({ n: n, name: ['trainer1', 'trainer2', 'trainer3', 'trainer4'][n - 1], nameKnown: true, level: 130, huntId: 'grass-60', huntKnown: true, active: true, defeated: 900, killsH: 600, captures: 50, lead: true, partySize: 1, combat: { hits: 240, kills: 120, counterKills: 120, messageKills: 120, gapMs: 1700, gapN: 100, spawnMs: 1900, spawnN: 100 }, shiny: { thrown: 4, caught: 1, throws: 120, matched: 119, dexBalls: 21, dexSpecies: 1, dexOpened: 3 },
      teamN: 3, teamActive: true, xp: { total: 3, inside: 0, full: 0, neither: 0, none: 0 }, team: [{ level: 84, reading: 'total' }, { level: 120, reading: 'total' }, { level: 1, reading: 'total' }], bestIV: true, lastCaught: true, ageSec: 2 })), errors: [] },
  ui: { bridge: { diagGet: true, diagCopy: true, accountsGet: true }, lastLogin: { ageSec: 60, results: [{ n: 1, ok: true }, { n: 2, ok: true }, { n: 3, ok: true }, { n: 4, ok: true }] }, errors: [], statsAgeSec: { 1: 2, 2: 2, 3: 2, 4: 2 }, names: {} }
};
const run = (mut, extra) => { const d = clone(HEALTHY); if (mut) mut(d); return H.analyse(Object.assign(d, extra || {})); };
const st = (r, id) => r.checks.find(c => c.id === id);

// ---------------------------------------------------------------- a healthy app
let r = run();
ok('a healthy app: every check is OK and the overall verdict is ok', r.checks.every(c => c.status === 'ok') && r.summary === 'ok', r.checks.map(c => c.id + ':' + c.status));
ok('12 checks are made, each with an id, a title and a verdict', r.checks.length === 12 && r.checks.every(c => c.id && c.title && ['ok', 'warn', 'fail', 'unknown'].indexOf(c.status) >= 0), r.checks.map(c => c.id));
ok('5 things are left for a person to judge, each says what to do and what to look for', r.manual.length === 5 && r.manual.every(m => m.title && m.how && m.look));
ok('the XP check says which way the game sends the xp (the TOTAL), so the open question is answered by the data', /TOTAL xp/.test(st(r, 'xp').detail), st(r, 'xp').detail);
ok('the report starts with the app and versions, and has the sections self-check, parts, files, messages, fields, accounts, settings, errors, log', ['4HORIZON DIAGNOSTICS', 'App 4horizon 1.0.0', 'SELF-CHECK', 'PARTS', 'FILES', 'GAME MESSAGES', 'FIELD NAMES', 'ACCOUNTS AS THE DASHBOARD SEES THEM', 'SETTINGS', 'ERRORS (0)', 'LOG (last 2 lines'].every(s => r.report.indexOf(s) >= 0), r.report.slice(0, 400));

// ---------------------------------------------------------------- the main-process part is missing
r = run(null, { main: null });
ok('without the main-process part: "Parts" warns and says how to install it; checks that need it say "cannot tell", the report says NOT INSTALLED', st(r, 'parts').status === 'warn' && /install-diagnostics\.js/.test(st(r, 'parts').todo) && ['conn', 'notify', 'tidy', 'panels'].every(i => st(r, i).status === 'unknown') && /NOT INSTALLED/.test(r.report), r.checks.map(c => c.id + ':' + c.status));
ok('...and checks that only need the dashboard still work (XP)', ['xp'].every(i => st(r, i).status === 'ok'));
r = run(null, { dash: null });
ok('without the dashboard: team / xp / catches say "cannot tell" instead of guessing', ['team', 'xp', 'catch'].every(i => st(r, i).status === 'unknown'), r.checks.map(c => c.id + ':' + c.status));
let threw = null; try { H.analyse(); H.analyse({}); H.analyse({ main: {}, dash: {}, ui: {} }); H.analyse({ main: { accounts: null, features: null, logs: null }, dash: { accounts: null }, ui: null }); } catch (e) { threw = e.message; }
ok('empty or half-empty input never throws', !threw, threw);

// ---------------------------------------------------------------- parts
r = run(d => { d.main.features[1].ok = false; d.main.features[2].ok = false; d.main.features[2].missingFile = true; });
ok('parts missing: FAIL, names each one, and tells what to do', st(r, 'parts').status === 'fail' && st(r, 'parts').lines.length === 2 && /file not found/.test(st(r, 'parts').lines[1]) && /not installed/.test(st(r, 'parts').lines[0]), st(r, 'parts'));

// ---------------------------------------------------------------- connection
r = run(d => { delete d.main.accounts[4]; d.main.accounts[3].lastAgeSec = 300; });
ok('one panel silent and one stale: WARN, "2 of 4 panels", and it says which and why', st(r, 'conn').status === 'warn' && /2 of 4/.test(st(r, 'conn').detail) && /no message from the game yet/.test(st(r, 'conn').lines[3]) && /last 5 min ago/.test(st(r, 'conn').lines[2]), st(r, 'conn'));
r = run(d => { d.main.accounts = {}; });
ok('no panel sending: FAIL', st(r, 'conn').status === 'fail' && /No panel/.test(st(r, 'conn').detail));
r = run(d => { d.dash.accounts[1].ageSec = 500; });
ok('messages reach the app but not the dashboard (500 s since its last update): FAIL, with that sentence', st(r, 'conn').status === 'fail' && /reach the app but not the dashboard/.test(st(r, 'conn').lines[1]), st(r, 'conn'));

// ---------------------------------------------------------------- team
r = run(d => { d.dash.accounts[0].teamN = 0; });
ok('a roster arrived but no team was found: FAIL, and the fields of the roster are listed so the cause can be seen', st(r, 'team').status === 'fail' && /Fields seen in it: a, b/.test(st(r, 'team').lines[0]), st(r, 'team'));
r = run(d => { d.main.accounts[2].types = types(false); d.dash.accounts[1].teamN = 0; });
ok('no roster message yet and no team: WARN, "use Reload all"', st(r, 'team').status === 'warn' && /Reload all/.test(st(r, 'team').lines[1]), st(r, 'team'));
r = run(d => { d.main.accounts[1].types = types(false); });
ok('a team known from updates although the roster message itself was not seen: still OK, and says so', st(r, 'team').status === 'ok' && /from updates/.test(st(r, 'team').lines[0]), st(r, 'team'));

// ---------------------------------------------------------------- xp
r = run(d => { d.dash.accounts[2].xp = { total: 0, inside: 0, full: 0, neither: 3, none: 0 }; d.dash.accounts[2].team[0].reading = 'neither (xp 5000000)'; });
ok('an xp that fits neither reading: FAIL, with the count, and the raw reading is in the report so it can be worked out', st(r, 'xp').status === 'fail' && /3 of 12/.test(st(r, 'xp').detail) && /neither \(xp 5000000\)/.test(r.report), st(r, 'xp'));
r = run(d => { d.dash.accounts.forEach(a => { a.xp = { total: 0, inside: 3, full: 0, neither: 0, none: 0 }; }); });
ok('all xp read as "inside the level": OK and it says that instead', st(r, 'xp').status === 'ok' && /INSIDE the level/.test(st(r, 'xp').detail), st(r, 'xp').detail);
r = run(d => { d.dash.accounts.forEach((a, i) => { a.xp = i ? { total: 3, inside: 0, full: 0, neither: 0, none: 0 } : { total: 0, inside: 3, full: 0, neither: 0, none: 0 }; }); });
ok('a mix of both readings is OK too and is called a mix', st(r, 'xp').status === 'ok' && /mix/.test(st(r, 'xp').detail));
r = run(d => { d.dash.accounts.forEach(a => { a.xp = { total: 0, inside: 0, full: 0, neither: 0, none: 3 }; }); });
ok('members with no xp at all: WARN', st(r, 'xp').status === 'warn');
r = run(d => { d.dash.accounts.forEach(a => { a.xp = { total: 0, inside: 0, full: 0, neither: 0, none: 0 }; a.teamN = 0; }); });
ok('no team members yet: "cannot tell"', st(r, 'xp').status === 'unknown');

// ---------------------------------------------------------------- catches
r = run(d => { d.dash.accounts[3].bestIV = false; d.dash.accounts[3].lastCaught = false; });
ok('captures made but no best/last catch: WARN, says which account', st(r, 'catch').status === 'warn' && /Account 4/.test(st(r, 'catch').lines[0]) && /best catch NO/.test(st(r, 'catch').lines[0]), st(r, 'catch'));
r = run(d => { d.dash.accounts.forEach(a => { a.captures = 0; }); });
ok('no captures yet: "cannot tell"', st(r, 'catch').status === 'unknown');

// ---------------------------------------------------------------- notifications and tidy
r = run(d => { d.main.settings.notify.enabled = false; });
ok('notifications off: WARN, and tells where to switch them on', st(r, 'notify').status === 'warn' && /tray/.test(st(r, 'notify').todo));
r = run(d => { d.main.logs = [{ ageSec: 5, level: 'log', text: 'tidy: could not attach to panel 3 (boom)' }]; });
ok('tidy could not attach to a panel: FAIL', st(r, 'tidy').status === 'fail' && /could not attach to panel 3/.test(st(r, 'tidy').lines[0]));
r = run(d => { d.main.logs = [{ ageSec: 5, level: 'log', text: 'tidy (panel 2): no close button found for the Hunt Analyzer' }]; });
ok('tidy found no close button: WARN, and the line is shown', st(r, 'tidy').status === 'warn' && /no close button/.test(st(r, 'tidy').lines[0]));
r = run(d => { d.main.logs = []; });
ok('nothing closed yet: "cannot tell", with what to do (Reload all)', st(r, 'tidy').status === 'unknown' && /Reload all/.test(st(r, 'tidy').todo));
r = run(d => { d.main.settings.tidy.enabled = false; d.main.logs = []; });
ok('tidy switched off in its settings: "cannot tell" and says so', st(r, 'tidy').status === 'unknown' && /Switched off/.test(st(r, 'tidy').detail));

// ---------------------------------------------------------------- saved logins and Log in all
r = run(d => { d.ui.lastLogin = null; });
ok('Log in all never tried: "cannot tell", with the steps', st(r, 'login').status === 'unknown' && /sign one panel out/.test(st(r, 'login').todo));
r = run(d => { d.ui.lastLogin.results = [{ n: 1, ok: true }, { n: 2, ok: false, reason: 'no-login-button' }, { n: 3, ok: false, reason: 'no-login-form' }]; });
ok('Log in all, one login button not found: FAIL, with the reason in words; "already signed in" is not a failure', st(r, 'login').status === 'fail' && /login button not found/.test(st(r, 'login').lines.join(' ')) && /already signed in/.test(st(r, 'login').lines.join(' ')) && /could not sign 1 panel/.test(st(r, 'login').detail), st(r, 'login'));
r = run(d => { d.ui.lastLogin.results = [{ n: 1, ok: false, reason: 'no-login-form' }, { n: 2, ok: false, reason: 'no-saved-login' }]; });
ok('everything already signed in or nothing saved: not a failure, "nothing to do"', st(r, 'login').status === 'unknown' && /nothing to do/.test(st(r, 'login').detail), st(r, 'login'));
r = run(d => { d.main.settings.accounts.saved = 0; d.ui.lastLogin = null; });
ok('no saved login: "cannot tell", says to use Accounts', st(r, 'login').status === 'unknown' && /Accounts/.test(st(r, 'login').todo));
r = run(d => { d.main.settings.accounts.encryption = false; });
ok('no password encryption on this PC is spelled out', /NOT available/.test(st(r, 'login').lines[0]));

// ---------------------------------------------------------------- panels, errors
r = run(d => { d.main.panels[1].crashed = true; d.main.panels[2].url = 'https://example.org/'; });
ok('a crashed panel and a panel on another site: WARN, 2 named', st(r, 'panels').status === 'warn' && /2 panels/.test(st(r, 'panels').detail) && /CRASHED/.test(st(r, 'panels').lines[1]));
r = run(d => { d.main.errors = [{ ageSec: 10, src: 'team', msg: 'TypeError: x is undefined' }]; });
ok('one ordinary error: WARN, shown with where and when', st(r, 'errors').status === 'warn' && /\[main, 10 s ago\] team: TypeError/.test(st(r, 'errors').lines[0]));
r = run(d => { d.main.errors = [{ ageSec: 3, src: 'render-process-gone', msg: 'crashed' }]; });
ok('a crashed page is serious: FAIL', st(r, 'errors').status === 'fail');
r = run(d => { d.dash.errors = [{ ageSec: 8, msg: 'ReferenceError: foo' }]; d.ui.errors = [{ ageSec: 9, msg: 'oops' }]; });
ok('errors of the dashboard and of the window are counted too (2)', /2 errors/.test(st(r, 'errors').detail));

// ---------------------------------------------------------------- hiding the names
const named = (hide) => run(d => { d.main.logs.push({ ageSec: 1, level: 'log', text: 'accounts: automatic login for panel 2 as trainer2 and trainer1' }); d.main.errors = [{ ageSec: 5, src: 'x', msg: 'failed for trainer4' }]; }, { hideNames: hide });
const shown = named(false), hidden = named(true);
ok('names shown: the report names the characters', /Account 2 \(trainer2\)/.test(shown.report) && /trainer4/.test(shown.report));
ok('names hidden: not one character name is left anywhere in the report, not even inside log lines and errors', !/trainer\d/i.test(hidden.report) && /Account 2/.test(hidden.report) && /failed for Account 4/.test(hidden.report) && /as Account 2 and Account 1/.test(hidden.report), hidden.report.match(/.*trainer\d.*/i));
ok('...and not in the self-check lines that the window shows either', !/trainer\d/i.test(JSON.stringify(hidden.checks)), JSON.stringify(hidden.checks).match(/.{20}trainer\d.{20}/i));

// ---------------------------------------------------------------- the report never says more than it was given
const probe = run(d => { d.main.settings.accounts = { file: true, saved: 2, withPassword: 1, autoLogin: true, encryption: true }; });
ok('the saved logins appear only as counts and flags in the report', /saved=2/.test(probe.report) && /withPassword=1/.test(probe.report) && /autoLogin=true/.test(probe.report) && !/@/.test(probe.report));
const big = run(d => { d.main.logs = Array.from({ length: 400 }, (_, i) => ({ ageSec: i, level: 'log', text: 'line ' + i + ' ' + 'x'.repeat(300) })); d.main.errors = Array.from({ length: 80 }, (_, i) => ({ ageSec: i, src: 'e', msg: 'm' + i })); });
ok('a huge log is cut: the report keeps the last 60 lines and 15 errors, and stays under 60,000 characters', /LOG \(last 60 lines/.test(big.report) && big.report.length < 60500 && /ERRORS \(80\)/.test(big.report), big.report.length);

// ---------------------------------------------------------------- the login pages (new)
const PAGE2 = { n: 2, ageSec: 180, silentSec: 45, error: null, page: { url: 'https://pokehorizonidle.com/', title: 'Poke Horizon', ready: 'complete', forms: 0, passwordBoxes: 0, textBoxes: 0, canvas: 1, shadowRoots: 0,
  inputs: [{ tag: 'input', type: 'text', name: 'q', id: 'search', placeholder: 'Buscar trainer2', autocomplete: '', label: '', visible: false, disabled: false, where: 'page', inForm: false }],
  buttons: [{ text: 'Entrar com Google', type: '', visible: true, disabled: false, where: 'page' }, { text: 'Entrar', type: '', visible: true, disabled: false, where: 'page' }, { text: 'Registrar', type: '', visible: false, disabled: false, where: 'frame' }],
  links: ['Termos', 'Ajuda trainer2'], headings: ['Poke Horizon Idle'], frames: [{ src: 'https://pokehorizonidle.com/embed', sameOrigin: true, visible: false }], text: 'Entrar com Google Entrar trainer2' } };
r = run(d => { d.main.loginPages = [PAGE2]; d.ui.lastLogin.results = [{ n: 1, ok: false, reason: 'no-saved-login' }, { n: 2, ok: false, reason: 'login-form-not-found' }, { n: 3, ok: false, reason: 'no-login-form' }]; });
ok('Log in all on a silent panel with no password box is a FAIL with its own words: "signed out, but no password box was found" (it is NOT "already signed in")', st(r, 'login').status === 'fail' && /signed out, but no password box was found/.test(st(r, 'login').lines.join(' ')) && /could not sign 1 panel in/.test(st(r, 'login').detail) && !st(r, 'login').lines.some(l => /Account 2/.test(l) && /already signed in/.test(l)) && st(r, 'login').lines.some(l => /Account 3/.test(l) && /already signed in/.test(l)), st(r, 'login'));
ok('...the check shows what the page looked like: "Panel 2 page (3 min ago, https://pokehorizonidle.com/): 0 password boxes, 0 text boxes ... buttons: "Entrar com Google", "Entrar""', /Panel 2 page \(3 min ago, https:\/\/pokehorizonidle\.com\/\): 0 password boxes, 0 text boxes, 0 forms, 1 frames, 0 shadow roots; buttons: "Entrar com Google", "Entrar"/.test(st(r, 'login').lines.join('\n')), st(r, 'login').lines);
ok('...hidden buttons are not listed in that summary (the hidden "Registrar" is left out), only in the full report', !/Registrar/.test(st(r, 'login').lines.join(' ')) && /button: "Registrar" hidden in frame/.test(r.report));
ok('the report has a LOGIN PAGES section with the page, the counts, a line per box and per button, the links, headings and text', ['LOGIN PAGES (', 'Panel 2 \u00b7 looked at 3 min ago \u00b7 silent for 45 s', 'forms 0 \u00b7 password boxes 0 \u00b7 text boxes 0 \u00b7 canvas 1', 'box: input[text] name=q id=search placeholder="Buscar trainer2" hidden not in a form', 'button: "Entrar com Google"', 'frame https://pokehorizonidle.com/embed (same site) (hidden)', 'links: "Termos"', 'headings: "Poke Horizon Idle"', 'text: "Entrar com Google Entrar trainer2"'].every(s => r.report.indexOf(s) >= 0), r.report.slice(r.report.indexOf('LOGIN PAGES'), r.report.indexOf('LOGIN PAGES') + 900));
const rh = run(d => { d.main.loginPages = [PAGE2]; d.ui.lastLogin.results = [{ n: 2, ok: false, reason: 'login-form-not-found' }]; }, { hideNames: true });
ok('"Hide character names" also cleans the names found inside the page description (placeholder, links, text)', !/trainer\d/i.test(rh.report) && !/trainer\d/i.test(JSON.stringify(rh.checks)) && /Buscar Account 2/.test(rh.report), rh.report.match(/.*trainer\d.*/i));
r = run(d => { d.main.loginPages = [{ n: 3, ageSec: 5, silentSec: null, error: 'panel not ready', page: null }]; });
ok('a page that could not be read says so, with the reason, and does not break the report', /Panel 3: the page could not be read \(panel not ready\)/.test(st(r, 'login').lines.join(' ')) && /the page could not be read: panel not ready/.test(r.report));
r = run(d => { d.main.loginPages = []; });
ok('with no look at any page there is no LOGIN PAGES section', r.report.indexOf('LOGIN PAGES') < 0);
r = run(d => { delete d.main.loginPages; });
ok('an older main-process part (no loginPages at all) is fine', r.report.indexOf('LOGIN PAGES') < 0 && st(r, 'login').status !== undefined);
r = run(d => { d.main.loginPages = [{ n: 2, ageSec: 5, silentSec: 5, error: null, page: Object.assign({}, PAGE2.page, { passwordBoxes: 1, textBoxes: 1 }) }]; d.ui.lastLogin.results = [{ n: 2, ok: true }]; });
ok('a page WITH a password box and a successful login is not an alarm', st(r, 'login').status === 'ok');

// ---------------------------------------------------------------- the catch check looks only at accounts that are sending data (new)
r = run(d => { d.dash.accounts[1].captures = 34; d.dash.accounts[1].bestIV = false; d.dash.accounts[1].lastCaught = false; d.dash.accounts[1].ageSec = 600; });
ok('an account that went silent 10 minutes ago, with captures but no best catch, is NOT blamed (this raised a false warning in the first real report)', st(r, 'catch').status === 'ok', st(r, 'catch'));
r = run(d => { d.dash.accounts.forEach(a => { a.ageSec = 900; a.bestIV = false; }); });
ok('if no account is sending data at all, the catch check says "cannot tell"', st(r, 'catch').status === 'unknown' && /sending data/.test(st(r, 'catch').detail), st(r, 'catch'));
r = run(d => { d.dash.accounts[0].ageSec = null; d.dash.accounts[0].bestIV = false; });
ok('an account that never sent anything (age unknown) is not blamed either', st(r, 'catch').status === 'ok');
r = run(d => { d.dash.accounts[2].ageSec = 100; d.dash.accounts[2].bestIV = false; d.dash.accounts[2].lastCaught = false; });
ok('...but one that IS sending (100 s ago) and has captures without a best catch still is', st(r, 'catch').status === 'warn' && /Account 3/.test(st(r, 'catch').lines[0]), st(r, 'catch'));

// ---------------------------------------------------------------- the connection state (new)
r = run(d => { d.main.accounts[2].socket = false; d.main.accounts[2].socketAgeSec = 40; d.main.accounts[2].lastAgeSec = 3; });
ok('a closed game connection is shown at once, even when the last message was only 3 s ago: "The connection to the game is CLOSED", and the panel does not count as sending data', /Account 2.*CLOSED \(signed out or disconnected\), 40 s ago/.test(st(r, 'conn').lines.join('\n')) && /3 of 4 panels are sending data/.test(st(r, 'conn').detail), st(r, 'conn'));
ok('...the report says it too, in the line of that account', /Account 2 \(trainer2\): .* connection CLOSED 40 s ago/.test(r.report), r.report.match(/.*connection.*/g));
r = run(d => { d.main.accounts[1].socket = true; d.main.accounts[1].socketAgeSec = 100; d.main.accounts[3].socket = null; });
ok('an open connection is reported as open, one that was never seen as "not seen"', /Account 1 \(trainer\d\): .* connection open/.test(r.report) && /Account 4 \(trainer4\): .* connection not seen/.test(r.report), r.report.match(/.*connection.*/g));
r = run(d => { d.main.accounts[1] = { frames: 0, firstAgeSec: null, lastAgeSec: null, kb: 0, socket: false, socketAgeSec: 5, types: [] }; });
ok('a panel that sent nothing since the app started but whose connection closed is listed with 0 messages and "CLOSED"', /Account 1 \(trainer\d\): 0 messages, last never.*CLOSED/.test(st(r, 'conn').lines.join('\n')), st(r, 'conn').lines);

// ---------------------------------------------------------------- an app that runs OLD code (new)
r = run(d => { d.main.staleFiles = ['accounts.js', 'ws-reader.js']; });
ok('files changed after the app started: "Parts" is a FAIL, says the app is still running the OLD version, names the files, and says how to restart it (the tray, not the X)', st(r, 'parts').status === 'fail' && /2 files changed after the app started/.test(st(r, 'parts').detail) && /OLD version/.test(st(r, 'parts').detail) && st(r, 'parts').lines.join() === 'accounts.js,ws-reader.js' && /Quit the app from the tray/.test(st(r, 'parts').todo) && /only hides it/.test(st(r, 'parts').todo), st(r, 'parts'));
ok('...and the report header says it in capitals, with the files', /FILES CHANGED AFTER THE APP STARTED \(still running the old version\): accounts\.js, ws-reader\.js/.test(r.report), r.report.split('\n').filter(l => /^Build/.test(l)));
r = run(d => { d.main.staleFiles = ['index.html']; });
ok('one file: "1 file changed ... running the OLD version of it"', /1 file changed after the app started, so the app is still running the OLD version of it/.test(st(r, 'parts').detail), st(r, 'parts').detail);
r = run(d => { d.main.meta.build = 'login-fix-1'; }, { ui: Object.assign(clone(HEALTHY.ui), { build: 'login-fix-2' }) });
ok('the window and the app behind it are different builds: FAIL, both builds named (they were not updated together)', st(r, 'parts').status === 'fail' && /build "login-fix-2" but the app behind it is build "login-fix-1"/.test(st(r, 'parts').detail), st(r, 'parts'));
r = run(d => { d.main.meta.build = 'login-fix-2'; }, { ui: Object.assign(clone(HEALTHY.ui), { build: 'login-fix-2' }) });
ok('the same build on both sides: OK, and the report header names it ("Build: app login-fix-2 \u00b7 window login-fix-2")', st(r, 'parts').status === 'ok' && /Build: app login-fix-2 \u00b7 window login-fix-2/.test(r.report), r.report.split('\n').filter(l => /^Build/.test(l)));
r = run(d => { delete d.main.meta.build; });
ok('an app from before the build marker: the header says "unknown (old)" and nothing is blamed', /Build: app unknown \(old\) \u00b7 window unknown \(old\)/.test(r.report) && st(r, 'parts').status === 'ok');
r = run(d => { d.main.staleFiles = ['accounts.js']; d.main.features[0].ok = false; });
ok('files changed AND a part missing: the changed files come first (restarting may fix both)', /changed after the app started/.test(st(r, 'parts').detail));

// ---------------------------------------------------------------- the evidence behind "already signed in" (new)
r = run(d => { d.ui.lastLogin.results = [{ n: 2, ok: false, reason: 'no-login-form', lastMsgSec: 3 }, { n: 3, ok: false, reason: 'no-login-form', lastMsgSec: null }, { n: 4, ok: false, reason: 'no-login-form' }]; });
const ll = st(r, 'login').lines.filter(l => /^Log in all/.test(l));
ok('"already signed in" now comes with its proof: "no login form on the page, and it sent game data 3 s ago"', /Account 2.*already signed in: no login form on the page, and it sent game data 3 s ago/.test(ll[0]), ll);
ok('...without a number (never, or an older app) it falls back to the plain wording', /Account 3.*already signed in \(no login form\)/.test(ll[1]) && /Account 4.*already signed in \(no login form\)/.test(ll[2]), ll);
r = run(d => { d.main.loginPages = [{ n: 2, ageSec: 4, silentSec: 2, sendingData: true, error: null, page: PAGE2.page }, { n: 3, ageSec: 4, silentSec: 80, sendingData: false, error: null, page: PAGE2.page }]; });
ok('the LOGIN PAGES section says for each page whether the panel was sending data: "it was SENDING game data (2 s ago)" or "silent for 80 s"', /Panel 2 \u00b7 looked at 4 s ago \u00b7 it was SENDING game data \(2 s ago\)/.test(r.report) && /Panel 3 \u00b7 looked at 4 s ago \u00b7 silent for 80 s/.test(r.report), r.report.split('\n').filter(l => /^  Panel/.test(l)));

// ---------------------------------------------------------------- the Cloudflare outcome and the start page (new)
r = run(d => { d.ui.lastLogin.results = [{ n: 2, ok: false, reason: 'captcha-not-solved' }, { n: 3, ok: true, opened: true }]; });
ok('a Cloudflare check that did not pass is a FAIL with its own words: "click it once, then press Log in all again"', st(r, 'login').status === 'fail' && /Account 2.*the Cloudflare check did not pass by itself: click it once, then press Log in all again/.test(st(r, 'login').lines.join('\n')) && /could not sign 1 panel in/.test(st(r, 'login').detail), st(r, 'login'));
ok('...and a login that had to open the login window first is simply "login sent"', /Account 3.*login sent/.test(st(r, 'login').lines.join('\n')));
ok('the manual list describes the new behaviour: "Log in all from the start page ... opens the login window by itself (it presses Entrar), waits for the Cloudflare check"', r.manual.some(m => m.title === 'Log in all from the start page' && /presses "Entrar"/.test(m.look) && /Cloudflare/.test(m.look)) && r.manual.length === 5, r.manual.map(m => m.title));

// ---------------------------------------------------------------- a panel that is not in use (new)
const PANELS = { 1: { user: false, pass: true }, 2: { user: true, pass: true }, 3: { user: true, pass: true }, 4: { user: true, pass: true } };
r = run(d => { delete d.main.accounts[1]; d.main.settings.accounts.panels = PANELS; });
ok('panel 1 has no saved login and has sent nothing: "not in use", not a warning; the check says "All 3 panels in use are sending data (1 not in use)" and is OK', st(r, 'conn').status === 'ok' && /All 3 panels in use are sending data \(1 not in use\)/.test(st(r, 'conn').detail) && /Account 1.*not in use \(no saved login, and nothing received\)/.test(st(r, 'conn').lines.join('\n')), st(r, 'conn'));
r = run(d => { delete d.main.accounts[1]; delete d.main.accounts[2]; d.main.settings.accounts.panels = PANELS; });
ok('...but a panel that HAS a saved login and sends nothing is still a warning ("2 of 3 panels in use")', st(r, 'conn').status === 'warn' && /2 of 3 panels in use are sending data/.test(st(r, 'conn').detail), st(r, 'conn'));
r = run(d => { d.main.accounts[1] = { frames: 0, firstAgeSec: null, lastAgeSec: null, kb: 0, socket: false, socketAgeSec: 5, types: [] }; d.main.settings.accounts.panels = PANELS; });
ok('...and a panel with no saved login whose connection CLOSED (it was in use by hand) is not called "not in use"', !/not in use/.test(st(r, 'conn').lines.join('\n')) && /CLOSED/.test(st(r, 'conn').lines.join('\n')), st(r, 'conn').lines);
r = run(d => { d.main.accounts = {}; d.main.settings.accounts.panels = { 1: { user: false }, 2: { user: false }, 3: { user: false }, 4: { user: false } }; });
ok('nothing in use and nothing sent: FAIL (not "all in use are fine")', st(r, 'conn').status === 'fail', st(r, 'conn'));
r = run(d => { d.main.settings.accounts.panels = undefined; delete d.main.accounts[1]; });
ok('an older main-process part with no per-panel flags behaves as before ("3 of 4")', /3 of 4 panels are sending data/.test(st(r, 'conn').detail), st(r, 'conn').detail);

// ---------------------------------------------------------------- only a capture SEEN since the start can fill the best catch (new)
r = run(d => { d.dash.accounts[1].captures = 69; d.dash.accounts[1].capturesSeen = 0; d.dash.accounts[1].bestIV = false; d.dash.accounts[1].lastCaught = false; d.dash.accounts[2].captures = 4; d.dash.accounts[2].capturesSeen = 0; d.dash.accounts[2].bestIV = false; });
ok('captures counted by the game before the app started (69, 4) but none SEEN since: no warning (the second real report raised this false alarm)', st(r, 'catch').status === 'ok', st(r, 'catch'));
r = run(d => { d.dash.accounts[1].capturesSeen = 3; d.dash.accounts[1].bestIV = false; d.dash.accounts[1].lastCaught = false; });
ok('...but 3 captures SEEN with no best catch is a real warning, and says "3 captures seen"', st(r, 'catch').status === 'warn' && /Account 2.*3 captures seen, best catch NO/.test(st(r, 'catch').lines.join('\n')), st(r, 'catch'));
r = run(d => { d.dash.accounts.forEach(a => { a.capturesSeen = 0; }); });
ok('no capture seen on any account: "cannot tell", with the reason', st(r, 'catch').status === 'unknown' && /since the app started/.test(st(r, 'catch').detail), st(r, 'catch'));

// ---------------------------------------------------------------- the trainer's EXP (new)
r = run(d => { d.dash.accounts.forEach((a, i) => { a.trainerXp = ['total', 'total', 'total', 'none'][i]; }); });
ok('the XP check also says how the trainer\u2019s EXP reads: "3 as total xp, 1 no xp number yet", and stays OK', st(r, 'xp').status === 'ok' && /Trainer EXP.*3 as total xp, 1 no xp number yet/.test(st(r, 'xp').lines.join('\n')), st(r, 'xp'));
r = run(d => { d.dash.accounts[0].trainerXp = 'neither'; });
ok('a trainer xp that fits neither reading: the check is a WARN, says "NO bar", and asks to send the report', st(r, 'xp').status === 'warn' && /trainer.s own EXP does not fit either reading/.test(st(r, 'xp').detail) && /fits neither, so NO bar/.test(st(r, 'xp').lines.join('\n')), st(r, 'xp'));
r = run(d => { d.dash.accounts.forEach(a => { delete a.trainerXp; }); });
ok('an older dashboard that says nothing about the trainer: no trainer line, no error', !/Trainer EXP/.test(st(r, 'xp').lines.join('\n')) && st(r, 'xp').status === 'ok');
r = run(d => { d.dash.accounts[2].trainerXp = 'total'; d.dash.accounts[2].capturesSeen = 4; });
ok('the report has "trainer xp total" and "captures seen 4" on that account\u2019s line', /Account 3 \(trainer3\).*trainer xp total.*captures seen 4/.test(r.report), r.report.match(/.*Account 3 \(trainer3\): trainer level.*/));

// ---------------------------------------------------------------- the eggs in the report (new)
const EGGS = [{ n: 3, ageSec: 20, path: 'breeding.eggs', count: 1, items: [{ id: 'text "egg-91"', speciesId: 'number(whole, 3 digits)', readyAt: 'number(whole, 13 digits)', doubled: 'true', bonus: 'text "adupoke"' }] }];
r = run(d => { d.main.eggs = EGGS; });
ok('an egg that was seen is described in the report: where it came from, how many, and every field with its kind of value', /EGGS SEEN/.test(r.report) && /Account 3 \(trainer3\) \u00b7 breeding\.eggs \u00b7 1 egg \u00b7 seen 20 s ago/.test(r.report) && /egg 1: id = text "egg-91" \u00b7 speciesId = number\(whole, 3 digits\) \u00b7 readyAt = number\(whole, 13 digits\) \u00b7 doubled = true \u00b7 bonus = text "adupoke"/.test(r.report), r.report.slice(r.report.indexOf('EGGS SEEN'), r.report.indexOf('EGGS SEEN') + 500));
r = run(d => { d.main.eggs = []; });
ok('no egg seen: the report says so, and that a panel that is not connected cannot be seen', /EGGS SEEN: no incubating egg was seen on any connected account since the app started \(a panel that is not connected cannot be seen\)/.test(r.report));
r = run(d => { delete d.main.eggs; });
ok('an older main-process part with no egg list does not break the report', /EGGS SEEN/.test(r.report));
r = run(d => { d.main.fields.ready = Array.from({ length: 450 }, (_, i) => 'field' + i); });
ok('the "ready" field list shows up to 400 names (other messages 60)', /field399/.test(r.report) && !/field400/.test(r.report) && /, \.\.\./.test(r.report.slice(r.report.indexOf('ready: field0'), r.report.indexOf('ready: field0') + 6000)), null);
ok('the top of the report says that eggs are described by the KINDS of their values', /for an incubating egg only the KINDS of its values/.test(r.report));

// ---------------------------------------------------------------- hits per kill (new)
const cmb = (r2, n) => r2.checks.find(c => c.id === 'combat');
r = run(() => {});
ok('healthy: the check is OK, says on how many accounts it counted, and lists each account\u2019s hits per kill, the gap between hits and from a kill to the first hit, and the two kill counts', cmb(r).status === 'ok' && /Counted on 4 accounts; the kill messages match the game.s own kill counter/.test(cmb(r).detail) && /Account 2 \(trainer2\): 2\.00 hits per kill over 120 kills \u00b7 1\.70 s between hits \u00b7 1\.90 s from a kill to the first hit \u00b7 kill messages 120 vs the game.s counter 120/.test(cmb(r).lines.join('\n')), cmb(r));
r = run(d => { d.dash.accounts[1].combat = Object.assign({}, d.dash.accounts[1].combat, { messageKills: 100 }); d.dash.accounts[2].combat = Object.assign({}, d.dash.accounts[2].combat, { messageKills: 114 }); });
ok('the kill messages 20 of 120 short of the game\u2019s counter (17%) is a WARN naming the account and the numbers; 6 short (5%) is still fine', cmb(r).status === 'warn' && /On 1 account the number of kill messages is not the number of kills the game counts/.test(cmb(r).detail) && /Account 2 \(trainer2\).*kill messages 100 vs the game.s counter 120/.test(cmb(r).lines.join('\n')) && /Account 3 \(trainer3\).*kill messages 114 vs/.test(cmb(r).lines.join('\n')), cmb(r));
r = run(d => { d.dash.accounts.forEach(a => { a.combat = { hits: 30, kills: 12, counterKills: 12, messageKills: 12, gapMs: null, gapN: 4, spawnMs: null, spawnN: 3 }; }); });
ok('fewer than 20 kills seen on every account: "cannot tell", with what is needed (20 kills on an account that is sending data)', cmb(r).status === 'unknown' && /needs 20 kills/.test(cmb(r).detail), cmb(r));
r = run(d => { d.dash.accounts.forEach(a => { delete a.combat; }); });
ok('a reader that does not count yet (no "combat" at all): "cannot tell", and the todo says to run the installer and restart from the tray', cmb(r).status === 'unknown' && /does not count hits and kills yet/.test(cmb(r).detail) && /node install-diagnostics\.js/.test(cmb(r).todo), cmb(r));
r = run(d => { d.dash.accounts.forEach(a => { a.combat = null; }); });
ok('"combat: null" (the dashboard has the field but nothing counted yet) is the same as having none counted: "not enough yet", and nothing throws', cmb(r).status === 'unknown' && /20 kills/.test(cmb(r).detail), cmb(r));
r = run(d => { d.dash.accounts[1].ageSec = 400; });
ok('an account that is not sending data now (400 s) is left out of the count (3 accounts, not 4)', /Counted on 3 accounts/.test(cmb(r).detail) && !/Account 2 \(trainer2\):/.test(cmb(r).lines.join('\n')), cmb(r));
r = run(d => { d.dash.accounts[1].combat = { hits: 500, kills: 100, counterKills: 5, messageKills: 100, gapMs: 1000, gapN: 50, spawnMs: 1000, spawnN: 50 }; });
ok('a game counter that has barely moved (5) is too small to judge against: no warning from it', cmb(r).status === 'ok', cmb(r));
r = run(d => {});
const acctLine = r.report.split('\n').find(l => /Account 2 \(trainer2\): trainer level/.test(l));
ok('the report line of each account carries "combat": hits and kills, hits per kill, the game\u2019s counter against the kill messages, the two gaps', /combat hits 240, kills 120 \(2\.00 hits per kill\) \u00b7 the game.s counter \+120 vs 120 kill messages \u00b7 1\.70 s between hits \(100\) \u00b7 1\.90 s from a kill to the first hit \(100\)/.test(acctLine || ''), acctLine);
r = run(d => { d.dash.accounts[1].combat = null; });
ok('...and "combat n/a" for an account with none', /Account 2 \(trainer2\): trainer level.*combat n\/a/.test(r.report.split('\n').find(l => /Account 2 \(trainer2\): trainer level/.test(l)) || ''));
r = run(d => { d.dash.accounts[1].name = 'trainer2'; }, { hideNames: true });
ok('"Hide character names" does not leave a name in the combat lines either', !/trainer\d/i.test(r.report) && /^Account 2: 2\.00 hits per kill over 120 kills/m.test(r.checks.find(c => c.id === 'combat').lines.join('\n')), r.checks.find(c => c.id === 'combat').lines);
// ===== balls thrown at shinies
{
  const sh = run();
  const c = sh.checks.find(x => x.id === 'shiny');
  ok('shinies: with the throws matched (119 of 120) the check is OK, says how many accounts, and gives a line for each', c && c.status === 'ok' && /Counted on 4 accounts; 476 of 480 throws were matched/.test(c.detail) && c.lines.length === 4, c);
  ok('...the line of an account has the balls at shinies, the shinies caught, the throws, those matched, and the Pokédex numbers', /Account 2 \(trainer2\): 4 balls at shinies since the app started \(1 shinies caught\), 120 throws, 119 matched with a wild Pokémon · Pokédex: 21 balls at shinies in 1 of 3 species opened/.test(c.lines[1]), c.lines[1]);
  const low = run(d => { d.dash.accounts[1].shiny.matched = 60; });
  const cl = low.checks.find(x => x.id === 'shiny');
  ok('shinies: when fewer than 9 in 10 throws are matched with a wild Pokémon the check WARNS (throws at shinies may be missing) and asks for the report', cl.status === 'warn' && /On 1 account fewer than 9 in 10 throws/.test(cl.detail) && /send it/.test(cl.todo), cl);
  const few = run(d => { d.dash.accounts.forEach(a => { a.shiny.throws = 10; a.shiny.matched = 2; }); });
  ok('shinies: with fewer than 20 throws it does not judge (unknown, "not enough yet"), even when none matched', few.checks.find(x => x.id === 'shiny').status === 'unknown' && /needs 20 throws/.test(few.checks.find(x => x.id === 'shiny').detail), few.checks.find(x => x.id === 'shiny'));
  const none = run(d => { d.dash.accounts.forEach(a => { a.shiny = null; }); });
  ok('shinies: when the reader sends no counts at all (the installer step was not run) it says so and tells what to run (unknown, not a failure)', none.checks.find(x => x.id === 'shiny').status === 'unknown' && /Run  node install-diagnostics\.js/.test(none.checks.find(x => x.id === 'shiny').todo), none.checks.find(x => x.id === 'shiny'));
  const old = run(d => { d.dash.accounts.forEach(a => { delete a.shiny; }); });
  ok('shinies: an older dashboard (no field at all) does not break the report', !!old.checks.find(x => x.id === 'shiny') && /balls at shinies n\/a/.test(old.report), old.checks.find(x => x.id === 'shiny'));
  ok('the report has the balls at shinies of every account (thrown, caught, throws, matched, Pokédex)', /balls at shinies 4 thrown at shinies \(1 caught; 120 throws, 119 matched with a wild Pokémon\) · Pokédex: 21 over 1 of 3 species opened/.test(sh.report), sh.report.slice(sh.report.indexOf('ACCOUNTS AS THE DASHBOARD'), sh.report.indexOf('ACCOUNTS AS THE DASHBOARD') + 600));
  const stale = run(d => { d.dash.accounts[1].ageSec = 900; d.dash.accounts[2].ageSec = 900; d.dash.accounts[3].ageSec = 900; d.dash.accounts[0].ageSec = 900; });
  ok('shinies: accounts that are not sending data now are left out of the judgement (unknown, no numbers invented)', stale.checks.find(x => x.id === 'shiny').status === 'unknown', stale.checks.find(x => x.id === 'shiny'));
}

// ===== the Analyzer button in the report
{
  let ra = run(d => { d.main.analyzer = null; });
  ok('analyzer button: not pressed yet: the report says so', /ANALYZER BUTTON[^\n]*\n  not pressed since the app started/.test(ra.report), ra.report.slice(ra.report.indexOf('ANALYZER BUTTON'), ra.report.indexOf('ANALYZER BUTTON') + 300));
  ra = run(d => { d.main.analyzer = { ageSec: 40, action: 'open', results: [{ n: 2, ok: true, skipped: false, reason: '', labels: [] }, { n: 3, ok: true, skipped: true, reason: '', labels: [] }, { n: 4, ok: true, skipped: false, reason: '', labels: [] }] }; });
  ok('analyzer button: pressed: when, what it did and what happened on each account', /last press 40 s ago: opened\n\s+Account 2 \(trainer2\): done\n\s+Account 3 \(trainer3\): nothing to do\n\s+Account 4 \(trainer4\): done/.test(ra.report), ra.report.slice(ra.report.indexOf('ANALYZER BUTTON'), ra.report.indexOf('ANALYZER BUTTON') + 500));
  ra = run(d => { d.main.analyzer = { ageSec: 5, action: 'open', results: [{ n: 2, ok: false, skipped: false, reason: 'button not found', labels: ['perfil', 'wiki', 'rank', 'centro'] }, { n: 3, ok: false, skipped: false, reason: 'not signed in', labels: [] }] }; });
  ok('analyzer button: when it did not work the report says NOT DONE with the reason and, if the button was not found, the words of the top of the page (so that it can be fixed)', /Account 2 \(trainer2\): NOT DONE \(button not found\) · words at the top of its page: perfil, wiki, rank, centro/.test(ra.report) && /Account 3 \(trainer3\): NOT DONE \(not signed in\)\n/.test(ra.report), ra.report.slice(ra.report.indexOf('ANALYZER BUTTON'), ra.report.indexOf('ANALYZER BUTTON') + 600));
  ra = run(d => { d.main.analyzer = { ageSec: 1, action: 'none', results: [] }; });
  ok('analyzer button: pressed with no game panel ready: says so', /last press 1 s ago: no game panel was ready/.test(ra.report));
  ra = run(d => { delete d.main.analyzer; });
  ok('analyzer button: an older main-process part with no information does not break the report (no section, no "undefined")', ra.report.indexOf('ANALYZER BUTTON') < 0 && !/undefined|NaN/.test(ra.report));
  ra = run(d => { d.main.analyzer = { ageSec: 5, action: 'open', results: [{ n: 3, ok: true, skipped: false, reason: '', labels: [] }] }; d.dash.accounts[2].name = 'trainer3'; }, { hideNames: true });
  ok('analyzer button: "Hide character names" shows "Account 3" with no name in that section', /Account 3: done/.test(ra.report) && !/trainer\d/i.test(ra.report), ra.report.slice(ra.report.indexOf('ANALYZER BUTTON'), ra.report.indexOf('ANALYZER BUTTON') + 300));
}

// ===== the kinds of balls and potions in the report
{
  let rk = run(d => { d.dash.accounts.forEach(a => { a.kinds = { balls: 4, potions: 3 }; }); });
  ok('supplies: the report says how many kinds of balls and potions the dashboard has for each account', /kinds of supplies 4 balls, 3 potions/.test(rk.report), rk.report.slice(rk.report.indexOf('ACCOUNTS AS THE DASHBOARD'), rk.report.indexOf('ACCOUNTS AS THE DASHBOARD') + 700));
  rk = run(d => { d.dash.accounts.forEach(a => { a.kinds = null; }); });
  ok('supplies: when the reader does not send the kinds the report says n/a (so that it is seen at once that the installer step is missing)', /kinds of supplies n\/a/.test(rk.report) && !/undefined|NaN/.test(rk.report));
  rk = run(d => { d.dash.accounts.forEach(a => { delete a.kinds; }); });
  ok('supplies: an older dashboard (no field at all) does not break the report', /kinds of supplies n\/a/.test(rk.report) && !/undefined|NaN/.test(rk.report));
}

// ===== the items that end with "-ball" and are not counted
{
  let rs = run(d => { d.main.supplies = { ignoredBalls: ['earth-ball', 'shadow-ball'] }; });
  ok('supply kinds: the report lists the items that end with "-ball" and are not counted as balls, and asks to be told of a real ball among them', /SUPPLY KINDS[^\n]*\n  items that end with "-ball" and are not counted as balls \(things Pokémon drop\): earth-ball, shadow-ball\n  \(if one of them is a real Poké Ball, tell me its name/.test(rs.report), rs.report.slice(rs.report.indexOf('SUPPLY KINDS'), rs.report.indexOf('SUPPLY KINDS') + 400));
  rs = run(d => { d.main.supplies = { ignoredBalls: [], boundSeen: { 'luxury-ball': 233, 'super-potion': 1200 } }; });
  ok('supply kinds: what the game\u2019s bound list had is listed (not counted), with its amounts', /balls and potions also in the game\u2019s bound list \(not counted, as the game\u2019s own counters do not; the last amount seen, any account\): luxury-ball 233, super-potion 1,200\n/.test(rs.report), rs.report.slice(rs.report.indexOf('SUPPLY KINDS'), rs.report.indexOf('SUPPLY KINDS') + 600));
  rs = run(d => { d.main.supplies = { ignoredBalls: [], boundSeen: {} }; });
  ok('...an empty bound list says "none"; an older app that does not send it has no such line', /bound list[^\n]*: none\n/.test(rs.report) && run(d => { d.main.supplies = { ignoredBalls: [] }; }).report.indexOf('bound list') < 0);
  rs = run(d => { d.main.supplies = { ignoredBalls: [] }; });
  ok('supply kinds: nothing left out: "none seen"', /not counted as balls \(things Pokémon drop\): none seen/.test(rs.report));
  rs = run(d => { delete d.main.supplies; });
  ok('supply kinds: an older main-process part with no information does not break the report (no section, no "undefined")', rs.report.indexOf('SUPPLY KINDS') < 0 && !/undefined|NaN/.test(rs.report));
  rs = run(d => { d.main.supplies = null; });
  ok('supply kinds: an empty answer (null) is "none seen" and breaks nothing', /none seen/.test(rs.report) && !/undefined|NaN/.test(rs.report));
}

// ===== the navigation buttons in the report
{
  let rn = run(d => { d.main.nav = null; });
  ok('navigation buttons: not pressed yet: the report says so', /NAVIGATION BUTTONS[^\n]*\n  not pressed since the app started/.test(rn.report), rn.report.slice(rn.report.indexOf('NAVIGATION BUTTONS'), rn.report.indexOf('NAVIGATION BUTTONS') + 300));
  rn = run(d => { d.main.nav = { ageSec: 12, what: 'market', n: 3, ok: true, reason: '', labels: [] }; });
  ok('navigation buttons: pressed: when, which button, which panel and that it was done', /last press 12 s ago: Market on Account 3 \(trainer3\): done/.test(rn.report), rn.report.slice(rn.report.indexOf('NAVIGATION BUTTONS'), rn.report.indexOf('NAVIGATION BUTTONS') + 400));
  rn = run(d => { d.main.nav = { ageSec: 4, what: 'bag', n: 2, ok: false, reason: 'button not found', labels: ['sair', 'loja', 'grupo'] }; });
  ok('navigation buttons: when it did not work the report says NOT DONE with the reason and the buttons of the page (so that it can be fixed)', /Mochila on Account 2 \(trainer2\): NOT DONE \(button not found\) · buttons of its page: sair, loja, grupo/.test(rn.report), rn.report.slice(rn.report.indexOf('NAVIGATION BUTTONS'), rn.report.indexOf('NAVIGATION BUTTONS') + 400));
  rn = run(d => { d.main.nav = { ageSec: 1, what: 'center', n: 1, ok: false, reason: 'not signed in', labels: [] }; });
  ok('navigation buttons: "not signed in" has no list of buttons after it', /Centro on Account 1 \(trainer\d\): NOT DONE \(not signed in\)\n/.test(rn.report));
  rn = run(d => { d.main.nav = { ageSec: 6, what: 'hunts', n: 2, ok: false, reason: 'button not found', labels: ['sair', 'loja'] }; });
  ok('navigation buttons: the Hunts button is named in the report, and when it is not found the buttons of the page are listed', /Hunts on Account 2 \(trainer2\): NOT DONE \(button not found\) · buttons of its page: sair, loja/.test(rn.report), rn.report.slice(rn.report.indexOf('NAVIGATION BUTTONS'), rn.report.indexOf('NAVIGATION BUTTONS') + 400));
  rn = run(d => { delete d.main.nav; });
  ok('navigation buttons: an older main-process part with no information does not break the report (no section, no "undefined")', rn.report.indexOf('NAVIGATION BUTTONS') < 0 && !/undefined|NaN/.test(rn.report));
  rn = run(d => { d.main.nav = { ageSec: 5, what: 'market', n: 3, ok: true, reason: '', labels: [] }; d.dash.accounts[2].name = 'trainer3'; }, { hideNames: true });
  ok('navigation buttons: "Hide character names" shows "Account 3" with no name in that section', /Market on Account 3: done/.test(rn.report) && !/trainer\d/i.test(rn.report), rn.report.slice(rn.report.indexOf('NAVIGATION BUTTONS'), rn.report.indexOf('NAVIGATION BUTTONS') + 300));
}



// ===== the Back to last hunt button in the report
{
  let rb = run(d => { d.main.nav = { ageSec: 9, what: 'lasthunt', n: 2, ok: true, reason: '', labels: [], hunt: 'Cratera dos Torchic' }; });
  ok('back to last hunt: the report names the button, the hunt, the panel and that it was done', /last press 9 s ago: Back to last hunt \(Cratera dos Torchic\) on Account 2 \(trainer2\): done/.test(rb.report), rb.report.slice(rb.report.indexOf('NAVIGATION BUTTONS'), rb.report.indexOf('NAVIGATION BUTTONS') + 400));
  rb = run(d => { d.main.nav = { ageSec: 3, what: 'lasthunt', n: 1, ok: true, reason: '', labels: [], hunt: 'Cratera dos Torchic', already: true }; });
  ok('back to last hunt: "it was the hunt in progress" is in the report when the game said "Caçando"', /done \(it was the hunt in progress\)/.test(rb.report), rb.report.slice(rb.report.indexOf('NAVIGATION BUTTONS'), rb.report.indexOf('NAVIGATION BUTTONS') + 400));
  rb = run(d => { d.main.nav = { ageSec: 3, what: 'lasthunt', n: 1, ok: false, reason: 'hunt not found', labels: ['todos', 'cacar'], hunt: 'Cratera dos Torchic', probe: { input: '648x42', box: '1072x754', term: 'Torchic', texts: 7 } }; });
  ok('back to last hunt: when it fails the report gives the reason, the buttons of the page and what was looked at (search box, panel, what was searched)', /Back to last hunt \(Cratera dos Torchic\) on Account 1 \(trainer\d\): NOT DONE \(hunt not found\) · buttons of its page: todos, cacar\n\s+what was looked at: search box 648x42, panel 1072x754, searched "Torchic"/.test(rb.report), rb.report.slice(rb.report.indexOf('NAVIGATION BUTTONS'), rb.report.indexOf('NAVIGATION BUTTONS') + 600));
  rb = run(d => { d.main.nav = { ageSec: 3, what: 'lasthunt', n: 3, ok: false, reason: 'hunt did not open', labels: [], hunt: 'Mina de Ferro dos Aron' }; d.dash.accounts[2].name = 'trainer3'; }, { hideNames: true });
  ok('back to last hunt: "Hide character names" shows "Account 3" with no name in that section', /on Account 3: NOT DONE \(hunt did not open\)/.test(rb.report) && !/trainer\d/i.test(rb.report), rb.report.slice(rb.report.indexOf('NAVIGATION BUTTONS'), rb.report.indexOf('NAVIGATION BUTTONS') + 400));
}

// ===== the links from the game in the report
{
  let re = run(d => { d.main.external = { events: [] }; });
  ok('links from the game: none yet: the report says so', /LINKS FROM THE GAME[^\n]*\n  none since the app started/.test(re.report), re.report.slice(re.report.indexOf('LINKS FROM THE GAME'), re.report.indexOf('LINKS FROM THE GAME') + 300));
  re = run(d => { d.main.external = { events: [{ ageSec: 12, host: 'www.twitch.tv', how: 'opened', ok: true, n: 2 }, { ageSec: 5, host: 'javascript:', how: 'refused', ok: false, n: 0 }, { ageSec: 2, host: 'topidle.example', how: 'opened', ok: true, n: 3 }] }; });
  ok('links from the game: each line has how long ago, the site only, what happened and which panel (or the window of the app)', /12 s ago: www\.twitch\.tv · opened · Account 2 \(trainer2\)\n\s+5 s ago: javascript: · refused · the window of the app\n\s+2 s ago: topidle\.example · opened · Account 3 \(trainer3\)/.test(re.report), re.report.slice(re.report.indexOf('LINKS FROM THE GAME'), re.report.indexOf('LINKS FROM THE GAME') + 500));
  re = run(d => { d.main.external = { events: Array.from({ length: 12 }, (_, i) => ({ ageSec: 100 - i, host: 'site' + i + '.example', how: 'opened', ok: true, n: 1 })) }; });
  ok('links from the game: only the latest 8 lines are listed', (re.report.match(/site\d+\.example · opened/g) || []).length === 8 && /site11\.example/.test(re.report) && !/site3\.example/.test(re.report), (re.report.match(/site\d+\.example/g) || []));
  re = run(d => { delete d.main.external; });
  ok('links from the game: an older main-process part with no information does not break the report (no section, no "undefined")', re.report.indexOf('LINKS FROM THE GAME') < 0 && !/undefined|NaN/.test(re.report));
  re = run(d => { d.main.external = { events: [{ ageSec: 4, host: 'www.twitch.tv', how: 'the page itself went there', ok: true, n: 3 }] }; d.dash.accounts[2].name = 'trainer3'; }, { hideNames: true });
  ok('links from the game: "Hide character names" shows "Account 3" with no name, and a page that went to another site by itself is listed too', /www\.twitch\.tv · the page itself went there · Account 3/.test(re.report) && !/trainer\d/i.test(re.report), re.report.slice(re.report.indexOf('LINKS FROM THE GAME'), re.report.indexOf('LINKS FROM THE GAME') + 400));
}

// ===== the guard of the donation buttons in the report
{
  let rg = run(d => { d.main.donate = { panels: [{ n: 1, loads: 3, ageSec: 12, error: '', seenAgeSec: 40, tabAgeSec: 40, payAgeSec: 30, blocked: 2 }, { n: 2, loads: 1, ageSec: 700, error: '', seenAgeSec: null, tabAgeSec: null, payAgeSec: null, blocked: 0 }, { n: 3, loads: 0, ageSec: null, error: 'Script failed to execute', seenAgeSec: null, tabAgeSec: null, payAgeSec: null, blocked: 0 }, { n: 4, loads: 0, ageSec: null, error: '', seenAgeSec: null, tabAgeSec: null, payAgeSec: null, blocked: 0 }] }; });
  const sec = rg.report.slice(rg.report.indexOf('DONATE BUTTONS GUARD'), rg.report.indexOf('DONATE BUTTONS GUARD') + 1800);
  ok('the guard: every panel has a line: the script in the page, and when each of the three buttons ("+ Doar", the "Diamantes" tab, the pay button) was last found and hidden, and how many presses were stopped', /Account 1 \(trainer\d\): script in the page: yes \(put in 3 times, last 12 s ago\) · Doar button seen: 40 s ago · Diamantes tab hidden: 40 s ago · pay button hidden: 30 s ago · presses stopped: 2/.test(rg.report), sec);
  ok('the guard: a panel where nothing was found yet says so for each of them (and where to open them)', /Account 2 \(trainer2\): script in the page: yes \(put in 1 time, last [^)]*\) · Doar button seen: not yet \(open the shop of diamonds in that panel\) · Diamantes tab hidden: not yet · pay button hidden: not yet \(it exists only on the donation page\) · presses stopped: 0/.test(rg.report), sec);
  ok('the guard: a panel where the script could not be put in says NO and why; one that has not loaded says "not put in yet"', /Account 3 \(trainer3\): script in the page: NO \(Script failed to execute\)/.test(rg.report) && /Account 4 \(trainer4\): script in the page: NO \(not put in yet\)/.test(rg.report), sec);
  rg = run(d => { d.main.donate = { panels: [] }; });
  ok('the guard: no game panel yet is said so', /DONATE BUTTONS GUARD[^\n]*\n  no game panel yet/.test(rg.report));
  rg = run(d => { d.main.donate = { panels: [{ n: 1, loads: 1, ageSec: 3, error: '', seenAgeSec: 1 }] }; });
  ok('the guard: an older main-process part without the tab and pay information does not break the line (it says "not yet" and no "undefined")', /Diamantes tab hidden: not yet · pay button hidden: not yet/.test(rg.report) && !/undefined|NaN/.test(rg.report), rg.report.slice(rg.report.indexOf('DONATE BUTTONS GUARD'), rg.report.indexOf('DONATE BUTTONS GUARD') + 500));
  rg = run(d => { delete d.main.donate; });
  ok('the guard: an older main-process part with no information does not break the report (no section, no "undefined")', rg.report.indexOf('DONATE BUTTONS GUARD') < 0 && !/undefined|NaN/.test(rg.report));
  rg = run(d => { d.main.donate = { panels: [{ n: 3, loads: 1, ageSec: 5, error: '', seenAgeSec: 1, tabAgeSec: 1, payAgeSec: null, blocked: 1 }] }; d.dash.accounts[2].name = 'trainer3'; }, { hideNames: true });
  ok('the guard: "Hide character names" shows "Account 3" with no name', /Account 3: script in the page: yes/.test(rg.report) && !/trainer\d/i.test(rg.report), rg.report.slice(rg.report.indexOf('DONATE BUTTONS GUARD'), rg.report.indexOf('DONATE BUTTONS GUARD') + 300));
}

// ===== what the Summary shows, and its lock, in the report
{
  let rs = run(d => { d.dash.view = { selected: 'sum', locked: false }; });
  ok('the Summary line: all accounts together, lock off (it follows the expanded screen)', /The Summary shows: all accounts together · lock off \(it follows the expanded screen\)/.test(rs.report), rs.report.slice(rs.report.indexOf('The Summary shows') - 20, rs.report.indexOf('The Summary shows') + 160));
  rs = run(d => { d.dash.view = { selected: 2, locked: true }; });
  ok('the Summary line: an account (with its name), lock ON (it does not follow the expanded screen)', /The Summary shows: Account 2 \(trainer2\) · lock ON \(it does not follow the expanded screen\)/.test(rs.report), rs.report.slice(rs.report.indexOf('The Summary shows') - 20, rs.report.indexOf('The Summary shows') + 160));
  rs = run(d => { d.dash.view = { selected: 3, locked: true }; d.dash.accounts[2].name = 'trainer3'; }, { hideNames: true });
  ok('the Summary line: "Hide character names" shows "Account 3" with no name', /The Summary shows: Account 3 · lock ON/.test(rs.report) && !/trainer\d/i.test(rs.report), rs.report.slice(rs.report.indexOf('The Summary shows') - 20, rs.report.indexOf('The Summary shows') + 120));
  rs = run(d => { d.dash.huntLog = { accounts: [{ n: 1, sessions: 12, hunts: 5 }, { n: 2, sessions: 0, hunts: 0 }, { n: 3, sessions: 3, hunts: 1 }, { n: 4, sessions: 1, hunts: 1 }], rank: 'both', saveError: false }; });
  ok('the hunts kept for the comparison: sessions and hunts of each account, and how they are ranked ($+XP); no failure noted', /Hunts kept for the comparison \(on this computer\): Account 1 \(trainer\d\) 12 sessions, 5 hunts · Account 2 \(trainer2\) 0 sessions, 0 hunts · Account 3[^·]* 3 sessions, 1 hunts · Account 4[^·]* 1 sessions, 1 hunts · ranked by \$\+XP\n/.test(rs.report) && !/SAVING FAILED/.test(rs.report), rs.report.slice(rs.report.indexOf('Hunts kept') - 10, rs.report.indexOf('Hunts kept') + 260));
  rs = run(d => { d.dash.huntLog = { accounts: [{ n: 1, sessions: -3, hunts: 'x' }], rank: 'weird', saveError: true }; });
  ok('...a failed save is said plainly, and odd values become 0 and "?" (no NaN, no undefined)', /Account 1[^·]* 0 sessions, 0 hunts · ranked by \? · SAVING FAILED/.test(rs.report) && !/undefined|NaN/.test(rs.report), rs.report.slice(rs.report.indexOf('Hunts kept') - 10, rs.report.indexOf('Hunts kept') + 200));
  rs = run(d => { d.dash.huntLog = { accounts: [{ n: 1, sessions: 2, hunts: 1 }], rank: 'gold', saveError: false }; d.dash.accounts[0].name = 'trainer1'; }, { hideNames: true });
  ok('..."Hide character names" shows "Account 1" with no name', /Hunts kept for the comparison \(on this computer\): Account 1 2 sessions, 1 hunts · ranked by \$\n/.test(rs.report) && !/trainer\d/i.test(rs.report), rs.report.slice(rs.report.indexOf('Hunts kept') - 10, rs.report.indexOf('Hunts kept') + 200));
  rs = run(d => { delete d.dash.view; });
  ok('the Summary line: an older dashboard that does not send it does not break the report (no line, no "undefined")', rs.report.indexOf('The Summary shows') < 0 && !/undefined|NaN/.test(rs.report));
  ok('...nor the line of the hunts kept (an older dashboard does not send it either: no line)', rs.report.indexOf('Hunts kept') < 0);
}

console.log = out; out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
