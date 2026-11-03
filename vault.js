// vault.js: the encryption of the saved passwords (lang-52), with Electron's safeStorage (on Windows: DPAPI, tied to your Windows user).
//
// Newer Electron replaces isEncryptionAvailable / encryptString / decryptString by async functions (isAsyncEncryptionAvailable, encryptStringAsync,
// decryptStringAsync). This module uses the async ones when they are there, and the old ones otherwise.
//   - a password saved with the async functions is stored as  "a1:" + base64;  one saved by an older version of the app is plain base64.
//   - an old one is read with the old function while it exists (or with the async one, if the old one is gone), and the caller is told to save it again
//     the new way ("migrate"): so every password moves to the new form the first time it is used, without the user doing anything.
//   - what the async decrypt answers is read in both shapes it may have (the text itself, or { result, shouldReEncrypt }).
// Nothing here ever writes, logs or returns a password anywhere but to its caller.

let safeStorage = null;
try { safeStorage = require('electron').safeStorage || null; } catch (e) {}

const PREFIX = 'a1:';
const has = name => !!(safeStorage && typeof safeStorage[name] === 'function');
const stats = { api: null, available: null, decrypted: 0, migrated: 0, failed: 0, lastError: '' };
const api = () => (has('encryptStringAsync') && has('decryptStringAsync') ? 'async' : has('encryptString') && has('decryptString') ? 'sync' : 'none');
const note = e => { stats.lastError = String(e && (e.code || e.message) || e).slice(0, 80); };

// can a password be saved now? (never without encryption)
async function available() {
  let ok = false;
  try {
    if (has('isAsyncEncryptionAvailable')) ok = !!(await safeStorage.isAsyncEncryptionAvailable());
    else if (has('isEncryptionAvailable')) ok = !!safeStorage.isEncryptionAvailable();
  } catch (e) { note(e); ok = false; }
  stats.api = api(); stats.available = ok && stats.api !== 'none';
  return stats.available;
}

// a password -> what is stored
async function encrypt(plain) {
  if (api() === 'async') return PREFIX + Buffer.from(await safeStorage.encryptStringAsync(String(plain))).toString('base64');
  if (api() === 'sync') return safeStorage.encryptString(String(plain)).toString('base64');
  throw new Error('encryption is not available');
}

// what is stored -> { text, migrate } (migrate: save it again with encrypt()), or null when it cannot be read
const textOf = r => (typeof r === 'string' ? r : r && typeof r.result === 'string' ? r.result : null);
async function decrypt(stored) {
  if (typeof stored !== 'string' || !stored) return null;
  const isNew = stored.startsWith(PREFIX), buf = Buffer.from(isNew ? stored.slice(PREFIX.length) : stored, 'base64');
  try {
    if (isNew) {
      if (!has('decryptStringAsync')) throw new Error('this Electron has no decryptStringAsync');
      const r = await safeStorage.decryptStringAsync(buf), text = textOf(r);
      if (text === null) throw new Error('nothing was decrypted');
      stats.decrypted++;
      return { text: text, migrate: !!(r && r.shouldReEncrypt) };
    }
    // saved by an older version of the app (encryptString)
    let text = null;
    if (has('decryptString')) text = safeStorage.decryptString(buf);
    else if (has('decryptStringAsync')) text = textOf(await safeStorage.decryptStringAsync(buf));
    if (typeof text !== 'string') throw new Error('nothing was decrypted');
    stats.decrypted++;
    return { text: text, migrate: api() === 'async' };
  } catch (e) { stats.failed++; note(e); return null; }
}

// for the Diagnostics: which functions are used, and what happened (counts only)
function info() { return { api: stats.api || api(), available: stats.available, decrypted: stats.decrypted, migrated: stats.migrated, failed: stats.failed, lastError: stats.lastError }; }
const migrated = () => { stats.migrated++; };

module.exports = { available, encrypt, decrypt, info, migrated, PREFIX,
  _set: s => { safeStorage = s; }, _reset: () => { stats.api = null; stats.available = null; stats.decrypted = stats.migrated = stats.failed = 0; stats.lastError = ''; } };
