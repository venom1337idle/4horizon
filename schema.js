// schema.js
// An OPT-IN logger that records the STRUCTURE of the messages the game sends and receives: which message types exist,
// and which field names they have. It never stores values: no names, no chat text, no numbers, no ids, no tokens.
// It is used to find out which data the game offers (for example for a breeding / eggs box).
//
// It is off unless you start the app like this (PowerShell):
//     $env:HORIZON_SCHEMA = "1"; npm start
// The result is written to ws-schema.json (lang-50: in the user-data folder, see datadir.js; an older one in the app folder is moved there once) (every 20 seconds and when you quit). Open it in Notepad to see what is in it.

const fs = require('fs');
const path = require('path');

const enabled = process.env.HORIZON_SCHEMA === '1' || String(process.env.HORIZON_SCHEMA).toLowerCase() === 'true';
let FILE; try { FILE = require('./datadir').file('ws-schema.json'); } catch (e) { FILE = path.join(__dirname, 'ws-schema.json'); }

const MAX_PARSE_BYTES = 400 * 1024;     // a bigger message is counted, but not looked into
const FIRST_ALL = 30;                   // the first messages of each type are all looked at...
const THEN_EVERY = 25;                  // ...after that only every 25th (the structure of a type does not change)
const MAX_FIELDS = 500;                 // per message type
const MAP_KEYS = 8;                     // a bigger object whose values are all the same simple kind is treated as a map (its keys are data)

const kinds = {};                       // "received:character" -> { count, bytes, accounts, fields }
let dirty = false;

const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
// A key is kept only when it looks like a field NAME (camelCase letters, like "leaderId" or "withParty").
// Anything else (ids, uuids, player names with capitals or digits, "ultra-ball") is data, not structure: it becomes {id}.
function safeKey(k) {
  return /^[a-z][a-zA-Z]{0,30}$/.test(k) ? k : '{id}';
}

function stringShape(s) {
  if (uuidLike.test(s)) return 'string(uuid)';
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return 'string(iso-date)';
  if (/^-?\d+(\.\d+)?$/.test(s)) return 'string(number)';
  return 'string';
}

// the short strings that appear as VALUES in a message (names, ids...). A key that equals one of them is data, not a field name.
function stringValues(root) {
  const set = {};
  const stack = [root];
  let budget = 8000;
  while (stack.length && budget-- > 0) {
    const v = stack.pop();
    if (typeof v === 'string') { if (v.length >= 2 && v.length <= 40) set[v.toLowerCase()] = true; }
    else if (Array.isArray(v)) { for (let i = 0; i < Math.min(v.length, 50); i++) stack.push(v[i]); }
    else if (v && typeof v === 'object') { Object.keys(v).slice(0, 80).forEach(k => stack.push(v[k])); }
  }
  return set;
}

function describe(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'number(int)' : 'number(decimal)';
  if (typeof v === 'string') return stringShape(v);
  return typeof v;                       // boolean, object
}

function note(fields, p, desc, extra) {
  let f = fields[p];
  if (!f) {
    if (Object.keys(fields).length >= MAX_FIELDS) return null;
    f = fields[p] = { types: {}, len: null, keys: null };
  }
  f.types[desc] = true;
  if (extra && extra.len !== undefined) f.len = f.len ? [Math.min(f.len[0], extra.len), Math.max(f.len[1], extra.len)] : [extra.len, extra.len];
  if (extra && extra.keys !== undefined) f.keys = f.keys ? [Math.min(f.keys[0], extra.keys), Math.max(f.keys[1], extra.keys)] : [extra.keys, extra.keys];
  return f;
}

function walk(v, p, fields, depth, names) {
  if (depth > 8) return;
  const d = describe(v);
  if (Array.isArray(v)) {
    note(fields, p, 'array', { len: v.length });
    for (let i = 0; i < Math.min(v.length, 5); i++) walk(v[i], p + '[]', fields, depth + 1, names);
  } else if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    // many keys, or three or more values that are records of exactly the same shape (a ranking, a friend list...):
    // the keys are data (ids, names), so they are not written down
    const records = keys.length >= 3 && keys.every(k => v[k] && typeof v[k] === 'object' && !Array.isArray(v[k])) &&
      new Set(keys.map(k => Object.keys(v[k]).sort().join(','))).size === 1;
    // a big object is a MAP (keys are data) when all its values are the same simple kind, like { itemId: amount };
    // with mixed values it is a RECORD whose keys are field names (character, pokemon, session...)
    const vals = keys.map(k => v[k]);
    const uniform = vals.every(x => x === null || typeof x !== 'object') && new Set(vals.map(describe)).size === 1;
    if (records || (keys.length > MAP_KEYS && uniform) || keys.length > 80) {
      note(fields, p, 'map', { keys: keys.length });
      for (let i = 0; i < Math.min(keys.length, 5); i++) walk(v[keys[i]], p + '.{*}', fields, depth + 1, names);
    } else {
      note(fields, p, 'object', { keys: keys.length });
      keys.forEach(k => walk(v[k], p + '.' + (names[k.toLowerCase()] ? '{id}' : safeKey(k)), fields, depth + 1, names));
    }
  } else {
    note(fields, p, d);
  }
}

function record(account, direction, text) {
  if (!enabled || typeof text !== 'string') return;
  const m = /^\{"type":"([^"]{1,60})"/.exec(text);
  const type = m ? m[1].replace(/[^A-Za-z0-9_-]/g, '?') : '(no type)';
  const key = direction + ':' + type;
  const k = kinds[key] || (kinds[key] = { count: 0, bytes: 0, accounts: {}, parsed: 0, tooBig: 0, fields: {} });
  k.count++;
  k.bytes += text.length;
  k.accounts[account] = true;
  dirty = true;

  if (text.length > MAX_PARSE_BYTES) { k.tooBig++; return; }
  if (k.count > FIRST_ALL && k.count % THEN_EVERY !== 0) return;
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return; }
  k.parsed++;
  const names = stringValues(obj);
  if (obj && typeof obj.type === 'string') delete names[obj.type.toLowerCase()];     // {"type":"character","character":{...}}: that key is a real field name
  walk(obj, '$', k.fields, 0, names);
}

function build() {
  const messages = {};
  Object.keys(kinds).sort().forEach(key => {
    const k = kinds[key];
    const fields = {};
    Object.keys(k.fields).sort().forEach(p => {
      const f = k.fields[p];
      let s = Object.keys(f.types).join(' | ');
      if (f.len) s += '  [length ' + f.len[0] + (f.len[1] !== f.len[0] ? '-' + f.len[1] : '') + ']';
      if (f.keys && f.types.map) s += '  [' + f.keys[0] + (f.keys[1] !== f.keys[0] ? '-' + f.keys[1] : '') + ' keys]';
      fields[p] = s;
    });
    messages[key] = {
      count: k.count, averageBytes: Math.round(k.bytes / k.count), accounts: Object.keys(k.accounts).map(Number).sort(),
      inspected: k.parsed, tooBigToInspect: k.tooBig || undefined, fields: fields
    };
  });
  return {
    note: 'Structure only: message types and field names. No values were stored. Made by schema.js.',
    generatedAt: new Date().toISOString(),
    messages: messages
  };
}

function save() {
  if (!enabled || !dirty) return;
  try {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(build(), null, 2));
    fs.renameSync(tmp, FILE);
    dirty = false;
  } catch (e) { console.log('schema: could not save (' + e.message + ')'); }
}

if (enabled) {
  console.log('Schema logger is ON: field names of the game\u2019s messages are written to ws-schema.json (no values). Quit the app from the tray when you are done.');
  const t = setInterval(save, 20000);
  if (t.unref) t.unref();
  try { require('electron').app.on('before-quit', save); } catch (e) {}
  process.on('exit', save);
}

module.exports = { enabled, record, _build: build, _save: save };
