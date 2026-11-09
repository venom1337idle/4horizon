// ===== Live data from the game connection (index.html sends it as type "live") =====

// The game only says "ground-10". Give each hunt a readable name here, one line each:
const HUNT_NAMES = {
  // 'ground-10': 'Name of the hunt',
};
const prettyId = id => String(id).split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// A third option for the Best catch dropdown
(function () {
  const sel = document.getElementById('bestMode');
  if (sel && !sel.querySelector('option[value="score"]')) {
    const o = document.createElement('option');
    o.value = 'score';
    o.textContent = 'IV \u00d7 Quality';
    sel.appendChild(o);
  }
})();

// Replaces the dashboard's old calculation of best catch, last catch and status
refreshDerived = function () {
  accounts.forEach(a => {
    const pick = { iv: a.bestIV, quality: a.bestQ, score: a.bestS }[bestMode] || a.bestIV;
    a.bestCatch = pick ? pick.name + ' ' + pick.iv + '/' + pick.max + ' ' + pick.rarity : '\u2014';
    const c = a.lastCaught;
    a.lastCatch = c ? c.name + ' ' + c.time + ' (' + minutesAgo(c.time) + 'm ago)' : '\u2014';
    if (a.live && a.active === false) a.status = 'Stopped';
    else if (a.lastProgress) a.status = (Date.now() - a.lastProgress < 180000) ? 'Hunting' : 'Stopped';
    else a.status = a.live ? 'Connected' : 'Waiting';
  });
};

// Redraw at most once per second, even if messages arrive faster (lang-70: every 5 s in Light mode; while the window is hidden only the records are kept, see renderAll)
let drawPending = false;
function renderSoon() {
  if (drawPending) return;
  drawPending = true;
  setTimeout(() => { drawPending = false; renderAll(); }, (typeof lightMode !== 'undefined' && lightMode) ? 5000 : 1000);
}

window.addEventListener('message', e => {
  const m = e.data;
  if (!m || m.type !== 'live') return;
  const a = accounts[m.account - 1];
  if (!a) return;
  const d = m.data;

  // A new hunt (or the analyzer was reset): clear the old hunt's numbers first
  if (d.startedAt !== undefined && a.startedAt !== undefined && d.startedAt !== a.startedAt) {
    resetSession(a);
    delete a.bestS;
    delete a.huntName;
  }
  if (['defeated', 'xpGained', 'captures'].some(k => d[k] !== undefined && d[k] !== a[k])) {
    a.lastProgress = Date.now();
  }

  for (const k in d) {
    const v = d[k];
    if (v === undefined || v === null || (typeof v === 'number' && isNaN(v))) continue;
    if (k === 'team') a.team = Object.assign({}, a.team, v);
    else a[k] = v;
  }
  if (a.huntId) a.hunt = HUNT_NAMES[a.huntId] || a.huntName || prettyId(a.huntId);
  renderSoon();
});

// "party of N" on the hunt name (the party size comes from the game, see ws-reader.js)
window.addEventListener('message', e => {
  const m = e.data;
  if (!m || m.type !== 'live') return;
  const a = accounts[m.account - 1];
  if (!a || !(a.partySize > 1) || !a.hunt) return;
  const tag = ' \u00b7 ' + (typeof t === 'function' ? t('party of {n}', { n: a.partySize }) : 'party of ' + a.partySize);      // in the chosen language (dashboard.html's t)
  if (a.hunt.indexOf(tag) < 0) a.hunt += tag;
});
