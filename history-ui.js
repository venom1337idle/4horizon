// history-ui.js (loaded by index.html, inside the Settings window)
// The History card: daily totals per account from history.json (kept by history.js in the main process).
// In the app window it asks the main process through the bridge (window.bridge, from preload.js). A page that has no bridge but sits inside a window asks that window (postMessage).
(function () {
  const main = document.getElementById('historyHost') || document.getElementById('main');
  if (!main) return;
  const t = (en, p) => I18N.t(en, p);
  const tt = s => s;                                    // the text written in the card is translated afterwards, by I18N.dom
  const bridge = (window.bridge && window.bridge.getHistory) ? window.bridge : null;
  // numbers as the dashboard writes them: 1.2K, 3.4M
  function fmtLocal(n) {
    n = Number(n) || 0;
    const a = Math.abs(n);
    if (a < 10000) return Math.round(n).toLocaleString(I18N.locale());
    const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (let i = 0; i < units.length; i++) {
      if (a >= units[i][0]) {
        const x = n / units[i][0];
        let s = Math.abs(x) >= 100 ? x.toFixed(0) : (Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2));
        if (s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
        return I18N.dec(s) + units[i][1];
      }
    }
    return String(n);
  }
  const fmt = (typeof globalThis !== 'undefined' && typeof globalThis.fmt === 'function') ? globalThis.fmt : fmtLocal;

  const state = { range: '7', account: 'all', data: null, note: '' };

  const sel = '';        // fields are styled by theme.css
  const compact = !!(main.dataset && main.dataset.compact);      // inside Settings: no heading of its own, the tables sit in a dropdown, the note about the numbers is a tooltip
  const OPEN_KEY = '4h.histOpen';
  const readOpen = () => { try { return window.localStorage && window.localStorage.getItem(OPEN_KEY) === '1'; } catch (e) { return false; } };
  const card = document.createElement('div');
  card.className = 'card';
  card.style.marginTop = '0';
  card.innerHTML =
    (main.dataset && main.dataset.compact ? '' : '<h2>' + tt('HISTORY \u00b7 DAILY TOTALS, SAVED ON THIS COMPUTER') + '</h2>') +
    '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:10px;font-size:12px;color:var(--dim)">' +
      '<label>' + tt('Period') + ' <select id="hxRange" style="' + sel + '">' +
        '<option value="1">' + tt('Today') + '</option><option value="7" selected>' + tt('Last 7 days') + '</option><option value="30">' + tt('Last 30 days') + '</option><option value="all">' + tt('All time') + '</option></select></label>' +
      '<label>' + tt('Account') + ' <select id="hxAcc" style="' + sel + '"><option value="all">' + tt('All accounts') + '</option></select></label>' +
      '<button id="hxCsv" class="btn">' + tt('Export CSV') + '</button>' +
      '<span id="hxMsg" style="color:var(--dim2)"></span>' +
    '</div>' +
    (compact ? '<button type="button" id="hxToggle" class="hxToggle" aria-expanded="false"><span class="chev" aria-hidden="true"></span><span class="lbl">' + tt('Daily totals') + '</span><span id="hxSummary" class="sum"></span></button>' : '') +
    '<div id="hxOut"></div>' +
    (compact ? '' : '<div style="margin-top:10px;font-size:11px;color:var(--dim2);line-height:1.6">' +
      tt('Gold is loot + captures sold \u2212 balls and potions, the same balance the game shows. Only what this app saw is counted: the first session of an account is not counted (the app does not know when it started), and gaps of more than 10 minutes (app closed, PC asleep) are skipped. In a party, kills are this account\u2019s share of the shared counter. A day runs from midnight to midnight, local time.')  + '</div>');
  main.appendChild(card);
  try { if (I18N.dom) I18N.dom(card); } catch (e) {}          // the card is built after the page was translated

  const rangeSel = card.querySelector('#hxRange');
  const accSel = card.querySelector('#hxAcc');
  const csvBtn = card.querySelector('#hxCsv');
  const msgEl = card.querySelector('#hxMsg');
  const out = card.querySelector('#hxOut');
  const toggle = card.querySelector('#hxToggle'), sumEl = card.querySelector('#hxSummary');
  function setOpen(v, keep) {
    card.classList.toggle('open', v); if (toggle) toggle.setAttribute('aria-expanded', v ? 'true' : 'false');
    if (!keep) { try { window.localStorage && window.localStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch (e) {} }
  }
  if (compact) { card.classList.add('compact'); setOpen(readOpen(), true); toggle.onclick = function () { setOpen(!card.classList.contains('open')); }; }

  // ---------- numbers ----------
  const pad = n => (n < 10 ? '0' : '') + n;
  const keyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const zero = () => ({ kills: 0, xp: 0, captures: 0, shiny: 0, loot: 0, capture: 0, supplies: 0, ms: 0 });
  function addTo(t, r) { for (const k in t) t[k] += (r[k] || 0); return t; }
  const gold = t => t.loot + t.capture - t.supplies;
  const hoursOf = t => t.ms / 3600000;
  const sgn = n => (n < 0 ? '-' : '+') + fmt(Math.round(Math.abs(n)));
  function hm(ms) {
    const m = Math.round(ms / 60000);
    return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm';
  }

  function rangeKeys() {
    const d = state.data;
    if (state.range === 'all') return Object.keys(d.days).sort().reverse();
    const parts = d.today.split('-').map(Number);
    const keys = [];
    for (let i = 0; i < Number(state.range); i++) keys.push(keyOf(new Date(parts[0], parts[1] - 1, parts[2] - i)));
    return keys;
  }

  function names() {
    const set = {};
    Object.keys(state.data.days).forEach(k => Object.keys(state.data.days[k]).forEach(n => { set[n] = true; }));
    return Object.keys(set).sort();
  }

  // rows for the chosen period and account: [{ day, name, t }]
  function collect() {
    const rows = [];
    rangeKeys().forEach(day => {
      const d = state.data.days[day];
      if (!d) return;
      Object.keys(d).forEach(n => {
        if (state.account !== 'all' && n !== state.account) return;
        rows.push({ day: day, name: n, t: Object.assign(zero(), d[n]) });
      });
    });
    return rows;
  }

  function cells(t) {
    const h = hoursOf(t), g = gold(t), ok = h >= 0.05;
    return '<td style="color:' + (g < 0 ? 'var(--red)' : 'var(--green)') + '">' + sgn(g) + '</td>' +
      '<td class="xp">' + fmt(Math.round(t.xp)) + '</td>' +
      '<td>' + fmt(Math.round(t.kills)) + '</td>' +
      '<td>' + fmt(Math.round(t.captures)) + '</td>' +
      '<td>' + (t.shiny ? '<span style="color:var(--gold)">\u2726 ' + t.shiny + '</span>' : '0') + '</td>' +
      '<td>' + hm(t.ms) + '</td>' +
      '<td>' + (ok ? sgn(g / h) : '\u2014') + '</td>' +
      '<td>' + (ok ? fmt(Math.round(t.xp / h)) : '\u2014') + '</td>';
  }
  const HEAD = () => '<th>' + t('GOLD') + '</th><th>XP</th><th>' + t('KILLS') + '</th><th>' + t('CAPTURES') + '</th><th>' + t('SHINY') + '</th><th>' + t('HUNTED') + '</th><th>' + t('GOLD/H') + '</th><th>' + t('XP/H') + '</th>';

  function dayLabel(key) {
    const p = key.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(I18N.getLang() === 'en' ? 'en-GB' : I18N.locale(), { weekday: 'short' }) + ' ' + key;
  }

  // ---------- drawing ----------
  function refreshAccounts() {
    const list = names();
    const key = list.join('|');
    if (accSel.dataset.key === key) return;
    accSel.dataset.key = key;
    accSel.innerHTML = '<option value="all">' + t('All accounts') + '</option>' + list.map(n => '<option value="' + n.replace(/"/g, '&quot;') + '">' + n + '</option>').join('');
    accSel.value = list.indexOf(state.account) >= 0 ? state.account : 'all';
    if (accSel.value !== state.account) state.account = 'all';
  }

  function render() {
    msgEl.textContent = state.note;
    if (sumEl) sumEl.textContent = '';
    if (!state.data) {
      out.innerHTML = '<div style="color:var(--dim);font-size:12px">' + (!bridge && window.parent === window
        ? t('History is only available inside the app window.') : t('Loading\u2026')) + '</div>';
      return;
    }
    refreshAccounts();
    const rows = collect();
    if (!rows.length) {
      out.innerHTML = '<div style="color:var(--dim);font-size:12px;line-height:1.7">' + t('Nothing saved for this period yet. History starts counting once the app has seen an account hunt, and fills in as you play.') + '</div>';
      return;
    }

    const total = zero();
    rows.forEach(r => addTo(total, r.t));
    if (sumEl) sumEl.textContent = t('{gold} gold \u00b7 {xp} XP \u00b7 {kills} kills', { gold: sgn(gold(total)), xp: fmt(Math.round(total.xp)), kills: fmt(Math.round(total.kills)) });

    const byDay = {};
    rows.forEach(r => { addTo(byDay[r.day] || (byDay[r.day] = zero()), r.t); });
    const dayRows = Object.keys(byDay).sort().reverse().map(k =>
      '<tr><td>' + dayLabel(k) + (k === state.data.today ? ' <span style="color:var(--blue)">\u25c0 ' + t('today') + '</span>' : '') + '</td>' + cells(byDay[k]) + '</tr>').join('');

    let accTable = '';
    if (state.account === 'all') {
      const byAcc = {};
      rows.forEach(r => { addTo(byAcc[r.name] || (byAcc[r.name] = zero()), r.t); });
      const accNames = Object.keys(byAcc).sort((a, b) => gold(byAcc[b]) - gold(byAcc[a]));
      if (accNames.length > 1) {
        accTable =
          '<div style="font-size:11px;letter-spacing:1px;color:var(--dim);margin:16px 0 6px">' + t('BY ACCOUNT') + '</div>' +
          '<table><thead><tr><th>' + t('ACCOUNT') + '</th>' + HEAD() + '</tr></thead><tbody>' +
          accNames.map(n => '<tr><td>' + n + '</td>' + cells(byAcc[n]) + '</tr>').join('') + '</tbody></table>';
      }
    }

    out.innerHTML =
      '<div style="font-size:11px;letter-spacing:1px;color:var(--dim);margin:4px 0 6px">' + t('BY DAY') + '</div>' +
      '<table><thead><tr><th>' + t('DAY') + '</th>' + HEAD() + '</tr></thead><tbody>' +
      '<tr style="font-weight:600;background:rgba(227,192,107,.10)"><td>' + t('Total') + '</td>' + cells(total) + '</tr>' + dayRows + '</tbody></table>' + accTable;
  }

  // ---------- CSV ----------
  const q = s => '"' + String(s).replace(/"/g, '""') + '"';
  function csv() {
    const lines = ['date,account,gold_net,loot,captures_sold,supplies,xp,kills,captures,shiny,hours_hunted,gold_per_hour,xp_per_hour'];
    collect().sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : (a.name < b.name ? -1 : 1))).forEach(r => {
      const t = r.t, h = hoursOf(t);
      lines.push([r.day, q(r.name), Math.round(gold(t)), Math.round(t.loot), Math.round(t.capture), Math.round(t.supplies),
        Math.round(t.xp), Math.round(t.kills), Math.round(t.captures), t.shiny, h.toFixed(2),
        h >= 0.05 ? Math.round(gold(t) / h) : '', h >= 0.05 ? Math.round(t.xp / h) : ''].join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }

  // ---------- talking to index.html ----------
  function request() {
    if (bridge) {
      Promise.resolve().then(() => bridge.getHistory()).then(d => { state.data = d; render(); })
        .catch(e => { state.note = t('History error: {msg}', { msg: String(e && e.message || e) }); render(); });
      return;
    }
    if (window.parent !== window) window.parent.postMessage({ type: 'history-get' }, '*');
  }

  window.addEventListener('message', function (e) {
    const m = e.data;
    if (!m || typeof m.type !== 'string') return;
    if (m.type === 'history-data') { state.data = m.data; render(); }
    else if (m.type === 'history-saved') {
      state.note = m.result && m.result.ok ? t('Saved to {path}', { path: m.result.path }) : (m.result && m.result.canceled ? '' : t('Could not save'));
      render();
    } else if (m.type === 'history-error') { state.note = t('History error: {msg}', { msg: m.message }); render(); }
  });

  rangeSel.onchange = function () { state.range = rangeSel.value; render(); };
  accSel.onchange = function () { state.account = accSel.value; render(); };
  csvBtn.onclick = function () {
    if (!state.data || (!bridge && window.parent === window)) return;
    const label = state.range === 'all' ? 'all' : (state.range === '1' ? 'today' : state.range + 'd');
    const name = 'horizon-history-' + label + '-' + state.data.today + '.csv';
    if (bridge && bridge.exportCsv) {
      Promise.resolve().then(() => bridge.exportCsv(csv(), name))
        .then(res => { state.note = res && res.ok ? t('Saved to {path}', { path: res.path }) : (res && res.canceled ? '' : t('Could not save')); render(); })
        .catch(() => { state.note = t('Could not save'); render(); });
      return;
    }
    window.parent.postMessage({ type: 'history-csv', text: csv(), name: name }, '*');
  };

  I18N.onChange(() => render());                        // the texts that are written by render() follow the language
  window.HistoryUI = { refresh: request };              // Settings asks for fresh numbers each time it is opened
  render();
  request();
  setInterval(function () { if (!bridge || main.offsetParent !== null) request(); }, 20000);        // in the window: only while Settings is open
})();
