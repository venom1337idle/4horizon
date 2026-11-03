// run-vault.js (lang-52): the saved passwords with the async safeStorage of newer Electron, the old one of older Electron, and the move from one to the other
// (a password saved the old way is read, then saved again the new way, once). With stand-ins for safeStorage; the real accounts.js on top.
const fs = require('fs'), path = require('path');
const electron = require('electron');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 400))); c ? pass++ : fail++; };
const V = require('./vault');
// stand-ins: the old functions write "S:" + text, the async ones "A:" + text (in the real thing both are DPAPI, here they must be told apart)
const oldFns = { isEncryptionAvailable: () => true, encryptString: s => Buffer.from('S:' + s), decryptString: b => { const t = b.toString(); if (!t.startsWith('S:')) throw new Error('bad data'); return t.slice(2); } };
const asyncFns = (shape) => ({ isAsyncEncryptionAvailable: async () => true, encryptStringAsync: async s => Buffer.from('A:' + s),
  decryptStringAsync: async b => { const t = b.toString(); if (!/^[AS]:/.test(t)) throw new Error('bad data'); return shape === 'string' ? t.slice(2) : { result: t.slice(2), shouldReEncrypt: t.startsWith('S:') }; } });
const use = s => { V._set(s); V._reset(); };

(async () => {
  // ---- newer Electron: both sets
  use(Object.assign({}, oldFns, asyncFns('object')));
  ok('newer Electron: encryption available, through the async functions', (await V.available()) === true && V.info().api === 'async');
  const e1 = await V.encrypt('hunter2');
  ok('...a password is saved the new way ("a1:" + base64), and the old function is not used', e1.startsWith('a1:') && Buffer.from(e1.slice(3), 'base64').toString() === 'A:hunter2', e1);
  let d = await V.decrypt(e1);
  ok('...and read back with decryptStringAsync (its { result } answer), nothing to move', d && d.text === 'hunter2' && d.migrate === false, d);
  const old = Buffer.from('S:oldpass').toString('base64');
  d = await V.decrypt(old);
  ok('a password saved by an older version (plain base64): read with the old function, and marked to be saved again the new way', d && d.text === 'oldpass' && d.migrate === true, d);
  // ---- the async answer as plain text
  use(Object.assign({}, oldFns, asyncFns('string')));
  d = await V.decrypt(await V.encrypt('x1'));
  ok('decryptStringAsync answering the text itself (the other shape it may have) works too', d && d.text === 'x1', d);
  // ---- a future Electron: the old functions are gone
  use(asyncFns('object'));
  d = await V.decrypt(old);
  ok('a future Electron without the old functions: an old password is read with decryptStringAsync and marked to move', d && d.text === 'oldpass' && d.migrate === true, d);
  // ---- an older Electron: only the old functions
  use(oldFns);
  ok('an older Electron (no async functions): the old functions, as before', (await V.available()) === true && V.info().api === 'sync');
  const e2 = await V.encrypt('legacy');
  d = await V.decrypt(e2);
  ok('...saved as before (plain base64) and read back, nothing to move', !e2.startsWith('a1:') && d && d.text === 'legacy' && d.migrate === false, [e2, d]);
  ok('...a password saved the new way cannot be read there: null (no crash)', (await V.decrypt(e1)) === null && V.info().failed === 1);
  // ---- no encryption
  use(null);
  ok('no safeStorage at all: not available, and nothing can be saved', (await V.available()) === false && V.info().api === 'none' && await V.encrypt('x').then(() => false, () => true));
  use({ isAsyncEncryptionAvailable: async () => false, encryptStringAsync: async () => Buffer.from('x'), decryptStringAsync: async () => 'x' });
  ok('the system says encryption is not available: not available', (await V.available()) === false);
  use(Object.assign({}, oldFns, asyncFns('object')));
  ok('damaged or empty data: null, counted, no crash', (await V.decrypt('a1:%%%')) === null && (await V.decrypt('')) === null && (await V.decrypt(null)) === null && V.info().failed === 1, V.info());

  // ---- through the real accounts.js
  const UD = electron._USERDATA; fs.mkdirSync(UD, { recursive: true });
  const file = path.join(UD, 'accounts.json'); try { fs.unlinkSync(file); } catch (e) {}
  use(Object.assign({}, oldFns, asyncFns('object')));
  const A = require('./accounts'); A._setStagger && A._setStagger(0); A._setRetry && A._setRetry(0); A._setWaits && A._setWaits({ captcha: 0, step: 0, form: 0, settle: 0 });
  const H = electron._handlers, WIN = { sender: electron._WINDOW };
  let r = await H['accounts:save'](WIN, { rows: [{ n: 1, name: 'one', user: 'u1', password: 'newpass' }], autoLogin: false });
  let saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok('Accounts › Save: the password is stored the new way (a1:...), never in plain text', r && r.ok === true && saved.rows[1].pass.startsWith('a1:') && !JSON.stringify(saved).includes('newpass'), [r, saved.rows[1]]);
  const desc = await H['accounts:get'](WIN);
  ok('Accounts window: "encryption available" and "has a password", never the password itself', desc && desc.encryption === true && desc.rows[0].hasPassword === true && !JSON.stringify(desc).includes('newpass'), desc);
  // a password saved by an older version, then a login: read, used, and saved again the new way
  saved.rows[2] = { name: 'two', user: 'u2', pass: Buffer.from('S:oldsecret').toString('base64') }; fs.writeFileSync(file, JSON.stringify(saved));
  const typed = [];
  A.registerGuest(2, { isDestroyed: () => false, executeJavaScript: async code => { typed.push(code); return { ok: true }; }, once() {}, on() {}, getURL: () => 'https://pokehorizonidle.com/' });
  const res = await A.loginOne(2);
  saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok('Log in with a password saved the old way: it is typed into the game\u2019s form', res && res.ok !== false && typed.some(c => c.includes('"oldsecret"')), [res, typed.length]);
  ok('...and saved again the new way, once (a1:...), the rest of the file untouched', saved.rows[2].pass.startsWith('a1:') && saved.rows[2].user === 'u2' && saved.rows[1].pass.startsWith('a1:') && V.info().migrated === 1 && !JSON.stringify(saved).includes('oldsecret'), [saved.rows[2], V.info()]);
  await A.loginOne(2);
  ok('...a second login reads the new form, nothing to move again', V.info().migrated === 1);
  use(Object.assign({}, oldFns, { isAsyncEncryptionAvailable: async () => false }));
  r = await H['accounts:save'](WIN, { rows: [{ n: 3, name: 'three', user: 'u3', password: 'p3' }], autoLogin: false });
  saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok('no encryption: the password is NOT saved (the rest is), and the window is told', r && r.warning === 'no-encryption' && saved.rows[3] && !saved.rows[3].pass && !JSON.stringify(saved).includes('p3"'), [r, saved.rows[3]]);
  const dsrc = fs.readFileSync('diag.js', 'utf8'), asrc = fs.readFileSync('accounts.js', 'utf8');
  ok('nothing calls the old functions directly any more (only vault.js chooses), and the Diagnostics know vault.js', !/safeStorage\.(isEncryptionAvailable|encryptString|decryptString)\(/.test(asrc + dsrc) && /\['vault\.js', 'password encryption/.test(dsrc));
  const Core = require('./diag-core');
  const self = vv => { const r = Core.analyse({ main: { meta: {}, settings: { accounts: { saved: 2, withPassword: 2, autoLogin: true, encryption: true, vault: vv } } }, ui: {} }); return r.report; };
  ok('Diagnostics: the self-check says which functions keep the passwords, and how many moved to the new form', /password encryption: Electron’s new functions · 3 moved to the new form/.test(self({ api: 'async', migrated: 3, failed: 0 })));
  ok('...and when some could not be read, to type them again in Accounts', /password encryption: Electron’s old functions · 1 could not be read \(type them again in Accounts\)/.test(self({ api: 'sync', migrated: 0, failed: 1 })));
  try { fs.unlinkSync(file); } catch (e) {}
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
