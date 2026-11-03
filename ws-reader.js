const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const notifier = require('./notify');
const history = require('./history');
const schema = require('./schema');
const savedAccounts = require('./accounts');
const tidy = require('./tidy');
const team = require('./team');
const diag = require('./diag');
let combat; try { combat = require('./combat'); } catch (e) { combat = { frame() {}, session() {}, summary() { return null; }, sample() { return false; } }; }
let supplies; try { supplies = require('./supplies'); } catch (e) { supplies = { types() {} }; }
let shinyballs; try { shinyballs = require('./shinyballs'); } catch (e) { shinyballs = { handle() {} }; }
let missions; try { missions = require('./missions'); } catch (e) { missions = { handle() {} }; }

// ---------- Pokémon names: Pokédex number -> name ----------
// The game sends only numbers (speciesId 50). We download the names once and keep them on disk.
let species = {};
const cacheFile = () => path.join(app.getPath('userData'), 'species.json');

async function loadSpecies() {
  if (Object.keys(species).length) return;
  try { species = JSON.parse(fs.readFileSync(cacheFile(), 'utf8')); return; } catch (e) {}
  try {
    const res = await fetch('https://pokeapi.co/api/v2/pokemon-species?limit=2000');
    const json = await res.json();
    for (const s of json.results) {
      species[Number(s.url.split('/').filter(Boolean).pop())] = s.name;
    }
    fs.writeFileSync(cacheFile(), JSON.stringify(species));
    console.log('Pokemon names downloaded: ' + Object.keys(species).length);
  } catch (e) {
    console.log('Could not download Pokemon names (' + e.message + '). Numbers will be shown instead.');
  }
}

const pretty = id => String(id).split('-').filter(Boolean)
  .map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const nameOf = id => species[id] ? pretty(species[id]) : '#' + id;
const sum = obj => Object.values(obj || {}).reduce((a, n) => a + (Number(n) || 0), 0);
const isPotion = id => /(^|-)potion$/.test(id);
const hhmm = ms => new Date(ms).toTimeString().slice(0, 5);

// ---------- Hunt names: from hunts.txt (the Wiki table), found by the species of the monsters ----------
let huntBySpecies = {}, fishingBySpecies = {};

function loadHunts() {
  let text;
  try { text = fs.readFileSync(path.join(__dirname, 'hunts.txt'), 'utf8').replace(/^\uFEFF/, ''); }
  catch (e) { console.log('hunts.txt not found: hunts will be shown by their game id'); return; }

  const REGION = /^(Kanto|Johto|Hoenn|Sinnoh|Unova|Kalos|Alola|Galar|Paldea)\s+\d/;
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  let header = null, expectHeader = true;

  for (const line of lines) {
    if (/^Hunt\s/.test(line)) continue;                          // the title row of the table
    if (REGION.test(line)) { expectHeader = true; header = null; continue; }   // end of one hunt's block
    if (expectHeader) { header = line; expectHeader = false; continue; }       // first line of a block = the hunt name
    const m = line.match(/^#(\d+)$/);
    if (m && header) {
      const map = /^Pesca/i.test(header) ? fishingBySpecies : huntBySpecies;
      if (!map[Number(m[1])]) map[Number(m[1])] = header;
    }
  }
  console.log('Hunts loaded: ' + Object.keys(huntBySpecies).length + ' normal, ' +
              Object.keys(fishingBySpecies).length + ' fishing');
}

// ---------- Item names, prices and quality words ----------
// items.txt: the Wiki's item table (Portuguese name, type, NPC price).
// item-ids.txt: lines like  earth-ball = Bola de Terra  (the game's id = the Wiki's name).
const keyOf = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const brNum = s => {                      // "$1.000.000" -> 1000000,  "$1,3" -> 1.3
  s = String(s).replace(/[^\d.,]/g, '');
  return s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s.replace(/\./g, ''));
};
let itemPrice = {};        // Wiki name -> price when sold to an NPC
let itemName = { 'earth-ball': 'Bola de Terra', 'sandbag': 'Saco de Areia', 'piece-of-diglett': 'Peda\u00e7o de Diglett' };
const warnedItems = new Set();

// evolution stones follow a pattern: "earth-stone" -> "Pedra da Terra"
const STONES = {
  fire: 'Pedra do Fogo', water: 'Pedra da \u00c1gua', fairy: 'Pedra da Fada', leaf: 'Pedra da Folha',
  feather: 'Pedra da Pena', earth: 'Pedra da Terra', dark: 'Pedra das Trevas', ice: 'Pedra de Gelo',
  metal: 'Pedra de Metal', rock: 'Pedra de Rocha', cocoon: 'Pedra do Casulo',
  heart: 'Pedra do Cora\u00e7\u00e3o', fist: 'Pedra do Punho', thunder: 'Pedra do Trov\u00e3o',
  enigma: 'Pedra Enigma', poison: 'Pedra Venenosa', crystal: 'Pedra de Cristal', ancient: 'Pedra Ancestral'
};

function loadItems() {
  const read = f => {
    try { return fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/^\uFEFF/, ''); }
    catch (e) { return null; }
  };

  const table = read('items.txt');
  if (table === null) console.log('items.txt not found: item prices will be missing');
  else {
    // the table is: a line with the name, then a line "Type <tab> $price <tab> shop"
    let last = '';
    for (const line of table.split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
      const parts = line.split(/\t| {2,}/).map(s => s.trim());
      if (parts.length >= 2) {
        if (/^Item$/i.test(parts[0])) { last = ''; continue; }          // the title row
        if (last) itemPrice[keyOf(last)] = /^\$/.test(parts[1]) ? brNum(parts[1]) : 0;   // "N\u00e3o vende" = 0
        last = '';
      } else {
        last = parts[0];
      }
    }
  }

  const ids = read('item-ids.txt');
  if (ids) {
    for (const line of ids.split(/\r?\n/)) {
      if (line.trim().startsWith('#')) continue;
      const m = line.match(/^\s*([a-z0-9-]+)\s*=\s*(.+?)\s*$/i);
      if (m) itemName[m[1].toLowerCase()] = m[2];
    }
  }
  console.log('Items loaded: ' + Object.keys(itemPrice).length + ' prices, ' + Object.keys(itemName).length + ' ids');
}

function itemInfo(id) {
  const it = gameData.items[id];
  if (it) return { name: it.name, price: it.price > 0 ? it.price : null };
  return itemInfoOld(id);
}

function itemInfoOld(id) {
  let name = itemName[id];
  if (!name) {
    const m = /^(.+)-stone$/.exec(id);
    if (m && STONES[m[1]]) name = STONES[m[1]];
  }
  if (!name) {
    if (!warnedItems.has(id)) {
      warnedItems.add(id);
      console.log('Unknown item id "' + id + '": add a line to item-ids.txt  (' + id + ' = Name)');
    }
    return { name: pretty(id), price: null };
  }
  const price = itemPrice[keyOf(name)];
  return { name: name, price: price === undefined ? null : price };
}

// quality number -> the game's quality word (shiny is always Mítica)
const RARITY_STEPS = [['Fraca', 0], ['Comum', 1.0], ['Incomum', 1.1], ['Rara', 1.3], ['\u00c9pica', 1.5],
  ['Lend\u00e1ria', 1.7], ['M\u00edtica', 2.0], ['Anci\u00e3', 3.0], ['Divina', 4.0]];
function rarityWord(q, shiny) {
  if (shiny) return 'M\u00edtica';
  let word = RARITY_STEPS[0][0];
  for (const step of RARITY_STEPS) if (q >= step[1]) word = step[0];
  return word;
}

// ---------- Names, prices and hunts straight from the game's own data ----------
let gameData = { items: {}, hunts: {}, species: {} };
try {
  gameData = JSON.parse(fs.readFileSync(path.join(__dirname, 'game-data.json'), 'utf8'));
  species = gameData.species;
  console.log('game-data.json loaded: ' + Object.keys(gameData.items).length + ' items, ' +
              Object.keys(gameData.hunts).length + ' hunts, ' + Object.keys(species).length + ' species');
} catch (e) {
  console.log('game-data.json not found: run  node build-data.mjs  first');
}

// Starts listening to one game panel. "send(account, data)" passes numbers on to the app.
function attachReader(wc, account, send) {
  try { tidy.attach(account, wc); } catch (e) { diag.error('tidy', e); }
  try { savedAccounts.registerGuest(account, wc); } catch (e) { diag.error('savedAccounts', e); }
  const sendToApp = send;
  send = (acc, data) => { try { notifier.handle(acc, data); } catch (e) { diag.error('notifier', e); } try { history.handle(acc, data); } catch (e) { diag.error('history', e); } sendToApp(acc, data); };
  try { wc.debugger.attach('1.3'); }
  catch (e) { console.log('Account ' + account + ': could not start the reader: ' + e.message); return; }
  wc.debugger.sendCommand('Network.enable').catch(() => {});
  console.log('Account ' + account + ': reader attached');

  // the page changes after a sign-out and a sign-in: listen again; and if the debugger lets go, attach again
  const listenAgain = () => { try { wc.debugger.sendCommand('Network.enable').catch(() => {}); } catch (e) {} };
  try { wc.on('did-navigate', listenAgain); wc.on('did-navigate-in-page', listenAgain); wc.on('did-finish-load', listenAgain); } catch (e) {}
  wc.debugger.on('detach', (event, reason) => {
    console.log('Account ' + account + ': the reader was detached (' + reason + ')');
    if (wc.isDestroyed()) return;
    setTimeout(() => {
      try { if (!wc.isDestroyed()) { if (!wc.debugger.isAttached()) wc.debugger.attach('1.3'); listenAgain(); console.log('Account ' + account + ': reader attached again'); } }
      catch (e) { console.log('Account ' + account + ': could not attach again (' + e.message + ')'); }
    }, 1000);
  });

  // what this reader remembers about its account
  const ballIds = ['poke-ball', 'great-ball', 'ultra-ball', 'master-ball'];
  let activePokemonId = null;
  let startedAt = null;
  let catchSeq = 0;
  let autoBallId = null, shinyBallId = null, lastItems = null;
  const stockOf = id => (id && lastItems) ? (Number(lastItems[id]) || 0) : undefined;
  let partySize = 1;       // members in this account's party (the game's kill counter is shared by all of them)
  const huntNames = {};      // game hunt id -> readable name

  // "field" messages arrive about 4 times a second, so we only look until the hunt is known
  function noteHunt(text) {
    const h = /"huntId":"([^"]+)"/.exec(text);
    if (!h || huntNames[h[1]]) return;                     // not a hunt message, or already known
    const s = /"mobs":\[\{.*?"speciesId":(\d+)/.exec(text);
    if (!s) return;                                        // no monster on the field yet
    const id = Number(s[1]);
    const fishing = /fish|pesc/i.test(h[1]);
    const name = (fishing ? fishingBySpecies : huntBySpecies)[id] || huntBySpecies[id] || fishingBySpecies[id];
    if (!name) return;
    huntNames[h[1]] = name;
    send(account, { huntId: h[1], huntName: name, live: true });
    console.log('Account ' + account + ': hunt ' + h[1] + ' = ' + name);
  }
  let recent = [];            // successful captures seen since the app started, newest first
  let best = { iv: null, q: null, s: null }, shinyTotal = 0, catchTotal = 0;   // the best catch, the shinies and the captures of the WHOLE hunt (recent keeps only 60)
  let announced = false;

  function catchSummary() {
    const top = score => recent.reduce((b, c) => (!b || score(c) > score(b)) ? c : b, null);
    return {
      lastCaught: recent[0],
      recentCatches: recent.slice(0, 12),
      bestIV: best.iv,
      bestQ: best.q,                                       // multiplier first, IV breaks ties
      bestS: best.s,                                       // IV x quality
      shinyCaptured: shinyTotal,
      catchesSeen: catchTotal
    };
  }

  // Turns one game message into the fields our dashboard understands
  function convert(type, msg) {
    if (type === 'character') {
      const c = msg.character || {};
      if (c.activePokemonId != null) activePokemonId = String(c.activePokemonId);
      const ac = c.autoCatch || {};
      autoBallId = ac.ballId; shinyBallId = ac.shinyBallId;
      [ac.ballId, ac.shinyBallId].forEach(id => { if (id && !ballIds.includes(id)) ballIds.push(id); });
      const until = c.vipUntil ? (c.vipUntil > 1e12 ? c.vipUntil : c.vipUntil * 1000) : 0;
      return { name: c.name, level: c.level, trainerXp: c.xp, money: c.gold, diamonds: c.diamonds, vip: until > Date.now(), autoBall: ac.ballId, autoBalls: stockOf(ac.ballId), shinyBalls: stockOf(ac.shinyBallId) };
    }

    if (type === 'party' || type === 'party-leave') {
      const p = type === 'party' ? msg.party : null;
      const mem = p ? (p.members || []).filter(m => m.withParty !== false) : [];
      partySize = Math.max(1, mem.length);
      return { partySize: partySize, partyNames: mem.map(m => m.name) };
    }

    if (type === 'breeding') {
      // The game sends { slots, eggs: [...] }. What one egg looks like was not known when this was written, so every egg is
      // passed on with its simple fields (names kept) and the dashboard shows what it recognises.
      const flat = (o, prefix, out, depth) => {
        Object.keys(o).slice(0, 40).forEach(k => {
          const v = o[k], key = prefix + k;
          if (v === null || typeof v === 'number' || typeof v === 'boolean') out[key] = v;
          else if (typeof v === 'string') out[key] = v.slice(0, 60);
          else if (v && typeof v === 'object' && !Array.isArray(v) && depth < 1) flat(v, key + '.', out, depth + 1);
        });
        return out;
      };
      const eggs = (Array.isArray(msg.eggs) ? msg.eggs : []).slice(0, 12).map(e => {
        const f = (e && typeof e === 'object' && !Array.isArray(e)) ? flat(e, '', {}, 0) : { value: String(e).slice(0, 60) };
        if (typeof f.speciesId === 'number') f.speciesName = nameOf(f.speciesId);
        return f;
      });
      return { breedSlots: Number(msg.slots) || 0, eggs: eggs };
    }

    if (type === 'inventory') {
      let balls = 0, potions = 0;
      const items = msg.items || {};
      lastItems = items;
      for (const id in items) {
        if (ballIds.includes(id)) balls += Number(items[id]) || 0;
        else if (isPotion(id)) potions += Number(items[id]) || 0;
      }
      return { balls, potions, ballTypes: supplies.types(items, msg.boundItems, 'ball', ballIds), potionTypes: supplies.types(items, msg.boundItems, 'potion'), autoBalls: stockOf(autoBallId), shinyBalls: stockOf(shinyBallId) };
    }

    if (type === 'hunt-session') {
      const s = msg.session || {};
      if (startedAt !== null && s.startedAt !== startedAt) { recent = []; best = { iv: null, q: null, s: null }; shinyTotal = 0; catchTotal = 0; }   // a new hunt: forget old captures
      startedAt = s.startedAt;
      const secs = Math.floor((s.elapsedMs || 0) / 1000);
      const hours = (s.elapsedMs || 0) / 3600000;
      const supplies = (s.ballCost || 0) + (s.potionCost || 0);
      const profit = (s.lootValue || 0) + (s.captureValue || 0) - supplies;
      const out = {
        huntId: s.huntId, huntName: (gameData.hunts[s.huntId] && gameData.hunts[s.huntId].name) || huntNames[s.huntId], startedAt: s.startedAt, active: !!s.active, elapsedMs: s.elapsedMs,
        defeated: Math.round((s.kills || 0) / partySize), partyKills: s.kills, partySize: partySize, xpGained: s.xp, captures: s.captures,
        lootSell: s.lootValue, captureSell: s.captureValue, suppliesCost: supplies,
        ballsUsed: sum(s.balls), healsUsed: sum(s.potions), profit: profit, ballCost: s.ballCost, potionCost: s.potionCost,
        minutes: Math.floor(secs / 60),
        sessionTime: (secs >= 3600 ? Math.floor(secs / 3600) + 'h ' : '') +
                     Math.floor((secs % 3600) / 60) + 'm ' + (secs % 60) + 's',
        // the game sends item ids and amounts, but no names or prices
        drops: Object.entries(s.loot || {})
          .map(([id, qty]) => { const it = itemInfo(id); return { name: it.name, qty: qty, value: it.price === null ? null : Math.round(it.price * qty * 10) / 10 }; })
          .sort((a, b) => ((b.value === null ? -1 : b.value) - (a.value === null ? -1 : a.value)) || (b.qty - a.qty))
      };
      if (hours > 0.002) {       // not in the very first seconds, to avoid dividing by almost zero
        out.goldH = Math.round(profit / hours);
        out.xpH = Math.round((s.xp || 0) / hours);
        out.killsH = Math.round((s.kills || 0) / hours / partySize);
      }
      return out;
    }

    if (type === 'pokemon-update') {
      const p = msg.pokemon;
      if (!p || String(p.id) !== activePokemonId) return null;    // only the team leader
      return {
        pokemon: nameOf(p.speciesId) + ' Lv' + p.level,
        lead: { speciesId: p.speciesId, level: p.level, quality: p.quality, growth: p.growth, shiny: !!p.shiny },
        team: { name: nameOf(p.speciesId), level: p.level, hp: p.hp, hpMax: p.maxHp || p.hp }
      };
    }

    if (type === 'catch-result') {
      if (!msg.success || !msg.pokemon) return null;
      const p = msg.pokemon;
      const iv = sum(p.growth);
      const quality = Number(p.quality) || 1;
      recent.unshift({
        name: nameOf(p.speciesId), iv: iv, max: 192, quality: quality,
        rarity: rarityWord(quality, p.shiny) + ' \u00d7' + quality.toFixed(2),
        score: Math.round(iv * quality * 10) / 10,
        shiny: !!p.shiny, time: hhmm(Date.now())
      });
      if (recent.length > 60) recent.pop();
      const c = recent[0];                                   // the capture just made
      catchTotal++; if (c.shiny) shinyTotal++;
      if (!best.iv || c.iv > best.iv.iv) best.iv = c;
      if (!best.q || c.quality * 1000 + c.iv / 1000 > best.q.quality * 1000 + best.q.iv / 1000) best.q = c;
      if (!best.s || c.score > best.s.score) best.s = c;
      return Object.assign(catchSummary(), { catchEvent: recent[0], catchSeq: ++catchSeq });
    }
    return null;
  }

  const WANTED = new Set(['character', 'inventory', 'hunt-session', 'pokemon-update', 'catch-result', 'party', 'party-leave', 'breeding', 'ready', 'pending', 'dex-stats', 'battle-pass']);

  wc.debugger.on('message', (event, method, params) => {
    if (schema.enabled && (method === 'Network.webSocketFrameReceived' || method === 'Network.webSocketFrameSent')) {
      try { schema.record(account, method === 'Network.webSocketFrameSent' ? 'sent' : 'received', params.response && params.response.payloadData); } catch (e) { diag.error('schema', e); }
    }
    if (method === 'Network.webSocketCreated' || method === 'Network.webSocketClosed') { try { diag.socket(account, params && params.requestId, params && params.url, method === 'Network.webSocketCreated' ? 'created' : 'closed'); } catch (e) {} return; }
    if (method !== 'Network.webSocketFrameReceived') return;
    const text = params.response && params.response.payloadData;
    if (typeof text !== 'string') return;
    const m = /^\{"type":"([a-z-]+)"/.exec(text);
    try { diag.frame(account, m ? m[1] : null, text.length); } catch (e) {}
    try { combat.frame(account, m ? m[1] : null); if (m && (m[1] === 'hit' || m[1] === 'kill') && combat.sample(account, m[1])) diag.fields(account, m[1], JSON.parse(text)); } catch (e) {}
    if (m && m[1] === 'field') { noteHunt(text); return; }
    if (!m || !WANTED.has(m[1])) return;         // most messages stop here, before any parsing
    let msg;
    try { msg = JSON.parse(text); } catch (e) { return; }
    try { diag.fields(account, m[1], msg); } catch (e) {}
    const out = convert(m[1], msg);
    try { if (out && m[1] === 'hunt-session') combat.session(account, out.startedAt, out.partySize, out.partyKills); } catch (e) {}
    try { team.handle(account, m[1], msg, send, nameOf); } catch (e) { diag.error('team', e); }
    try { shinyballs.handle(account, m[1], msg, send); } catch (e) { diag.error('shinyballs', e); }
    try { if (m[1] === 'battle-pass' || m[1] === 'ready' || m[1] === 'character' || m[1] === 'breeding' || m[1] === 'hunt-session') missions.handle(account, m[1], msg, nameOf); } catch (e) { diag.error('missions', e); }
    if (out) {
      out.live = true;
      try { out.combat = combat.summary(account); } catch (e) {}
      send(account, out);
      if (!announced) { announced = true; console.log('Account ' + account + ': receiving game data'); }
    }
  });
}

module.exports = { attachReader, loadItems, loadSpecies, loadHunts };




















