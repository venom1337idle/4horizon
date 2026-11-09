// diag-core.js
// The brain of the Diagnostics window: it takes the facts collected by the main process (diag.js), by the dashboard and by the window itself,
// and turns them into (1) a list of self-checks with a verdict each and (2) one block of text to copy and send.
// It has no page or Electron in it, so it can be tested on its own. It runs in the window as  window.HGDiag.
//
// Input:  { main, dash, ui, hideNames }   (any of main / dash / ui may be missing; the checks then say "unknown" instead of guessing)

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HGDiag = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // the language core: in the window it is window.I18N (i18n.js is loaded first), in a test it is ./i18n
  const LANGCORE = (function () { try { if (typeof I18N !== 'undefined') return I18N; } catch (e) {} try { return require('./i18n'); } catch (e) {} return null; })();
  const fillEn = (s, p) => String(s).replace(/\{(\w+)\}/g, (m, k) => (p && p[k] !== undefined && p[k] !== null ? String(p[k]) : m));
  const trFor = lang => (LANGCORE && lang && lang !== 'en') ? LANGCORE.tFor(lang) : fillEn;

  const ACCOUNTS = [1, 2, 3, 4];
  const REGIONS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh'];
  const FRESH = 45;                                              // seconds: a panel that sent something within this time is "flowing"
  const WHY = { 'no-saved-login': 'no saved login', 'no-login-form': 'already signed in (no login form)', 'login-form-not-found': 'signed out, but no password box was found (the report describes the page)', 'captcha-not-solved': 'the Cloudflare check did not pass by itself: click it once, then press Log in all again', 'panel-not-ready': 'panel not ready',
    'no-username-field': 'login form not understood', 'no-login-button': 'login button not found', 'looks-like-register': 'the form looks like a sign-up form',
    'script-error': 'could not run in the panel', 'cannot-decrypt': 'saved password cannot be read' };

  const ago = s => (s === null || s === undefined) ? 'never' : s < 90 ? s + ' s ago' : s < 5400 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago';
  const kb = n => n >= 1024 ? (n / 1024).toFixed(1) + ' MB' : n + ' KB';
  const bytes = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' B';
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const RANK = { fail: 3, warn: 2, unknown: 1, ok: 0 };

  // 1.0.7: one line about the graphics cards (from gpu.js): "Graphics: acceleration ON · NVIDIA GeForce RTX 5070 Laptop GPU, driver 32.0.15.6214, IN USE · ..."
  const GPU_FEATURES = ['gpu_compositing', 'rasterization', 'webgl'];
  function gpuLine(g) {
    const parts = ['Graphics: acceleration ' + (g.disabledAtStart ? 'OFF (Settings \u203a Disable GPU acceleration)' : 'ON')];
    if (g.restartNeeded) parts.push('CHANGED IN SETTINGS: restart 4horizon to apply it');
    const devs = Array.isArray(g.devices) ? g.devices : null;
    if (devs && devs.length) devs.slice(0, 4).forEach(d => parts.push(String(d.name || ((d.vendor || '?') + ' ' + (d.deviceId || ''))).slice(0, 80) + (d.name && d.vendor && String(d.name).indexOf(String(d.vendor).split(' ')[0]) < 0 ? ' (' + d.vendor + ')' : '') + (d.driver ? ', driver ' + String(d.driver).slice(0, 40) : '') + (d.active ? ', IN USE' : '')));
    else parts.push('cards: ' + (g.error ? 'not known (' + String(g.error).slice(0, 80) + ')' : g.asked ? 'none reported' : 'not read yet'));
    const f = g.features && typeof g.features === 'object' ? g.features : null;
    if (f) { const fs = GPU_FEATURES.filter(k => typeof f[k] === 'string').map(k => k.replace('gpu_', '') + ' ' + f[k]); if (fs.length) parts.push(fs.join(', ')); }
    return parts.join(' \u00b7 ');
  }

  // 1.0.7: the section CPU AND MEMORY (from perf.js): CPU is 4horizon's share of the whole PC, as in Windows' Task Manager
  function perfSection(Q) {
    const L = [], fn = v => typeof v === 'number' && isFinite(v);
    const pct = v => (fn(v) ? Math.round(v) : '?') + '%';
    const mb = v => (fn(v) ? (v >= 1024 ? (Math.round(v / 102.4) / 10) + ' GB' : Math.round(v) + ' MB') : '?');
    const dur = m => { m = Math.round(fn(m) ? m : 0); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm'; };
    const agoMin = m => ago(fn(m) ? m * 60 : null);
    const who = k => ({ main: 'main process', win: 'window', gpu: 'graphics', other: 'other' })[k] || (/^p\d$/.test(k || '') ? 'panel ' + String(k).slice(1) : '?');
    Q = Q && typeof Q === 'object' ? Q : {};
    const H = Q.history && typeof Q.history === 'object' ? Q.history : {}, th = Q.thresholds || {};
    L.push('CPU AND MEMORY (one sample a minute, last 24 hours; CPU = the share of the whole PC used by 4horizon, as in Task Manager; ' + (fn(H.cores) ? H.cores : '?') + ' logical processors)');
    if (Q.error) L.push('  could not be worked out: ' + String(Q.error).slice(0, 120));
    else if (!H.samples || !H.now) L.push('  nothing measured yet (the first sample is taken 2 minutes after the start)');
    else {
      const N = H.now, A = H.avg || {}, K = H.peak || {};
      // memory: the private memory when there is one (each process's own, like Task Manager); otherwise the working sets, which count shared memory in each process
      const memNow = fn(N.priv) ? mb(N.priv) + ' private (' + mb(N.mem) + ' with shared memory counted in each process)' : mb(N.mem) + ' (shared memory counted in each process: Task Manager shows less)';
      const memAvg = fn(A.priv) ? mb(A.priv) + ' private' : mb(A.mem) + ' with shared memory';
      L.push('  Now (the sample of ' + ago(fn(N.ageSec) ? N.ageSec : null) + (fn(N.ageSec) && N.ageSec > 150 ? ', OLDER THAN USUAL: the app was started again or the PC slept; the next one comes 2 minutes after a start' : '') + '): 4horizon ' + pct(N.pc) + (fn(N.sys) ? ' (whole PC ' + pct(N.sys) + ')' : '') + ' \u00b7 memory ' + memNow + (Array.isArray(N.by) && N.by.length ? ' \u00b7 ' + N.by.map(x => who(x.k) + ' ' + pct(x.pc)).join(', ') : ''));
      L.push('  Last ' + dur(H.spanMin) + ' (' + H.samples + ' samples): average ' + pct(A.pc) + (fn(A.sys) ? ' (whole PC ' + pct(A.sys) + ')' : '') + ' \u00b7 highest ' + pct(K.pc) + ' ' + agoMin(K.ageMin) + (K.top ? ', mostly ' + who(K.top) : '') +
        ' \u00b7 memory ' + (H.memory ? mb(H.memory.from) + ' in the first hour \u2192 ' + mb(H.memory.to) + ' in the last hour (' + (H.memory.kind === 'private' ? 'private' : 'with shared memory') + ')' : 'average ' + memAvg));
      const eps = Array.isArray(H.high) ? H.high : [];
      L.push('  High CPU (' + (th.highPc || H.highPc || 50) + '% or more for ' + (th.highMin || H.highMin || 5) + ' minutes or more): ' + (H.highCount ? H.highCount + (H.highCount === 1 ? ' time' : ' times') + (H.highCount > eps.length ? ' (the last ' + eps.length + ')' : '') + ': ' +
        eps.map(e => agoMin(e.startAgoMin) + ' for ' + dur(e.min) + ', average ' + pct(e.avgPc) + ', highest ' + pct(e.peakPc) + (e.top ? ', mostly ' + who(e.top) : '')).join('; ') : 'none'));
      const al = Array.isArray(Q.alerts) ? Q.alerts : [];
      L.push('  Warnings: ' + (al.length ? al.map(a => agoMin(a.ageMin) + ' (' + pct(a.pc) + ' for ' + a.min + ' min' + (a.top ? ', mostly ' + who(a.top) : '') + '; ' + (a.shown ? 'shown' : 'NOT shown: notifications off, quiet hours, or not supported') + ')').join('; ') : 'none'));
      if (Array.isArray(H.timeline)) L.push('  Last 2 hours, 10-minute averages, newest first: ' + H.timeline.map(v => (fn(v) ? Math.round(v) : '-')).join(' \u00b7 ') + ' (%)');
    }
    L.push('');
    return L;
  }
  const worst = list => list.reduce((w, s) => RANK[s] > RANK[w] ? s : w, 'ok');

  // The self-checks are built twice when the language is not English: once in the language of the person (what the window shows) and once in English (the report, which is
  // meant to be read by whoever gets it and so does not change with the language).
  function analyse(input) {
    const en = build(input, 'en');
    const lang = input && input.lang;
    if (!lang || lang === 'en' || !LANGCORE) return en;
    const loc = build(input, lang);
    return { checks: loc.checks, manual: loc.manual, report: en.report, summary: en.summary };
  }

  function build(input, lang) {
    const T = trFor(lang);
    const D = v => (lang === 'en' ? String(v) : String(v).replace(/(\d)\.(\d)/g, '$1,$2'));   // a number written with a point, in the decimal sign of the language
    const ago = s => (s === null || s === undefined) ? T('never') : s < 90 ? T('{n} s ago', { n: s }) : s < 5400 ? T('{n} min ago', { n: Math.round(s / 60) }) : T('{n} h ago', { n: Math.round(s / 3600) });
    const plural = (n, w) => { const k = '{n} ' + w + (n === 1 ? '' : 's'); return T(k, { n: n }); };   // the texts '{n} file', '{n} files' ... are in the dictionary
    const whyText = k => WHY[k] ? T(WHY[k]) : null;
    const main = input && input.main || null, dash = input && input.dash || null, ui = input && input.ui || {};
    const hide = !!(input && input.hideNames);

    // ---- names of the accounts, and how to show them
    const names = {};
    ACCOUNTS.forEach(n => {
      const d = dash && dash.accounts && dash.accounts.find(a => a.n === n);
      const nm = (d && d.nameKnown && d.name) || (ui.names && ui.names[n]) || '';
      if (nm) names[n] = String(nm);
    });
    const shinyText = x => !x ? 'n/a' : x.thrown + ' thrown at shinies (' + x.caught + ' caught; ' + x.throws + ' throws, ' + x.matched + ' matched with a wild Pok\u00e9mon) \u00b7 Pok\u00e9dex: ' + x.dexBalls + ' over ' + x.dexSpecies + ' of ' + x.dexOpened + ' species opened';
    const combatText = c => !c ? 'n/a' : 'hits ' + c.hits + ', kills ' + c.kills + (c.kills >= 20 ? ' (' + (c.hits / c.kills).toFixed(2) + ' hits per kill)' : '') + (c.counterKills === null || c.counterKills === undefined ? '' : ' \u00b7 the game\u2019s counter +' + c.counterKills + ' vs ' + c.messageKills + ' kill messages') + (c.gapMs === null || c.gapMs === undefined ? '' : ' \u00b7 ' + (c.gapMs / 1000).toFixed(2) + ' s between hits (' + c.gapN + ')') + (c.spawnMs === null || c.spawnMs === undefined ? '' : ' \u00b7 ' + (c.spawnMs / 1000).toFixed(2) + ' s from a kill to the first hit (' + c.spawnN + ')');
    const hitsText = m => m.hitsPerKill === null || m.hitsPerKill === undefined ? '' : ' \u00b7 ' + m.hitsPerKill + ' hits per kill over ' + m.hitKills + ' kills' + (m.hitGapMs === null || m.hitGapMs === undefined ? '' : ' \u00b7 ' + (m.hitGapMs / 1000).toFixed(2) + ' s between hits') + (m.spawnMs === null || m.spawnMs === undefined ? '' : ' \u00b7 ' + (m.spawnMs / 1000).toFixed(2) + ' s from a kill to the first hit');
    const lab = n => T('Account {n}', { n: n }) + (!hide && names[n] ? ' (' + names[n] + ')' : '');
    const mask = text => {
      let s = String(text === undefined || text === null ? '' : text);
      if (!hide) return s;
      Object.keys(names).sort((a, b) => names[b].length - names[a].length).forEach(n => {
        s = s.replace(new RegExp('\\b' + names[n].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), T('Account {n}', { n: n }));
      });
      return s;
    };

    const dashAcc = n => (dash && dash.accounts && dash.accounts.find(a => a.n === n)) || null;
    const mainAcc = n => (main && main.accounts && main.accounts[n]) || null;
    const logs = (main && main.logs) || [];
    const checks = [];
    const add = (id, title, status, detail, lines, todo) => checks.push({ id: id, title: title, status: status, detail: detail, lines: lines || [], todo: todo || '' });

    // ===================================================================== 1. the parts of the app
    if (!main) {
      add('parts', T('Parts of the app'), 'warn', T('The part of diagnostics that runs in the main process is not installed, so the file list, the message counts and the log are missing.'), [],
        T('Run  node install-diagnostics.js  in the project folder, then restart the app.'));
    } else {
      const missing = (main.features || []).filter(f => !f.ok);
      const stale = main.staleFiles || [];
      const winBuild = ui && ui.build, appBuild = main.meta && main.meta.build;
      if (stale.length) add('parts', T('Parts of the app'), 'fail', T(stale.length === 1 ? '{files} changed after the app started, so the app is still running the OLD version of it.' : '{files} changed after the app started, so the app is still running the OLD version of them.', { files: plural(stale.length, 'file') }),
        stale.slice(0, 10), T('Quit the app from the tray (right-click its icon, Quit: the X of the window only hides it) and start it again. Starting it a second time offers to restart it.'));
      else if (winBuild && appBuild && winBuild !== appBuild) add('parts', T('Parts of the app'), 'fail', T('The window is build "{w}" but the app behind it is build "{a}": they were not updated together.', { w: winBuild, a: appBuild }), [],
        T('Quit the app from the tray (the X of the window only hides it) and start it again.'));
      else if (!missing.length) add('parts', T('Parts of the app'), 'ok', (main.features || []).length === 1 ? T('The one part is in place.') : T('All {n} parts are in place.', { n: (main.features || []).length }));
      else add('parts', T('Parts of the app'), 'fail', T('{parts} missing or out of date.', { parts: plural(missing.length, 'part') }), missing.map(f => f.label + ' (' + f.file + ')' + (f.missingFile ? ': ' + T('file not found') : ': ' + T('not installed'))),
        T('Install the missing parts (the update zips and install-*.js scripts), then restart the app.'));
    }

    // ===================================================================== 2. the game connection of each account
    if (!main) add('conn', T('Game connection'), 'unknown', T('Needs the main-process part of diagnostics.'));
    else {
      const lines = [], st = [];
      ACCOUNTS.forEach(n => {
        const a = mainAcc(n), d = dashAcc(n);
        if (ui && typeof ui.panels === 'number' && n > ui.panels) { lines.push(T('{acc}: not in use (Settings: {n} game panels)', { acc: lab(n), n: ui.panels })); st.push('unused'); return; }
        const flags = main.settings && main.settings.accounts && main.settings.accounts.panels && main.settings.accounts.panels[n];
        if ((!a || a.frames === 0) && flags && !flags.user && !(a && a.socket === false)) { lines.push(T('{acc}: not in use (no saved login, and nothing received)', { acc: lab(n) })); st.push('unused'); return; }
        if (!a) { lines.push(T('{acc}: no message from the game yet (not logged in, or the panel is not loaded)', { acc: lab(n) })); st.push('none'); return; }
        const closed = a.socket === false;                       // the game closed the connection: signed out, or disconnected
        const fresh = !closed && a.lastAgeSec !== null && a.lastAgeSec <= FRESH;
        let line = T('{acc}: {msgs}, last {ago}, {kinds}', { acc: lab(n), msgs: plural(a.frames, 'message'), ago: ago(a.lastAgeSec), kinds: plural((a.types || []).length, 'kind') }) + (closed ? '. ' + T('The connection to the game is CLOSED (signed out or disconnected), {ago}', { ago: ago(a.socketAgeSec) }) : '');
        if (fresh && d && d.ageSec !== null && d.ageSec !== undefined && d.ageSec > 120) { line += '. ' + T('WARNING: they reach the app but not the dashboard (last dashboard update {ago})', { ago: ago(d.ageSec) }); st.push('broken'); }
        else st.push(fresh ? 'ok' : 'stale');
        lines.push(line);
      });
      const flowing = st.filter(s => s === 'ok').length, unused = st.filter(s => s === 'unused').length, inUse = 4 - unused;
      const status = st.indexOf('broken') >= 0 ? 'fail' : (flowing === inUse && inUse > 0) ? 'ok' : flowing > 0 ? 'warn' : 'fail';
      add('conn', T('Game connection'), status, (flowing === inUse && inUse > 0) ? (unused ? T('All {n} panels in use are sending data ({u} not in use).', { n: inUse, u: unused }) : T('All four panels are sending data.')) : flowing > 0 ? (unused ? T('{f} of {n} panels in use are sending data.', { f: flowing, n: inUse }) : T('{f} of {n} panels are sending data.', { f: flowing, n: inUse })) : T('No panel is sending data.'), lines,
        (flowing === inUse && inUse > 0) ? '' : T('A panel that is not logged in sends nothing. Log in (or press Log in all), wait 30 seconds, and open Diagnostics again.'));
    }

    // ===================================================================== 3. the team
    if (!main || !dash) add('team', T('Team (roster at login)'), 'unknown', T('Needs both the main-process part and the dashboard.'));
    else {
      const lines = [], st = [];
      ACCOUNTS.forEach(n => {
        const a = mainAcc(n), d = dashAcc(n);
        if (!a || (ui && typeof ui.panels === 'number' && n > ui.panels)) return;          // (a panel not in use: Settings › Game panels)
        const ready = (a.types || []).find(t => t.type === 'ready');
        const teamN = d ? d.teamN || 0 : 0;
        if (ready && teamN > 0) { lines.push(T('{acc}: roster received {ago}, {n} of 6 in the team', { acc: lab(n), ago: ago(ready.lastAgeSec), n: teamN })); st.push('ok'); }
        else if (ready) { lines.push(T('{acc}: the roster arrived but no team was found in it. Fields seen in it: {fields}', { acc: lab(n), fields: ((main.fields || {}).ready || []).slice(0, 14).join(', ') || T('none recorded') })); st.push('fail'); }
        else if (teamN > 0) { lines.push(T('{acc}: {n} in the team (from updates; the roster message itself was not seen since the app started)', { acc: lab(n), n: teamN })); st.push('ok'); }
        else { lines.push(T('{acc}: no roster yet. It is sent once when the game loads: use Reload all', { acc: lab(n) })); st.push('warn'); }
      });
      if (!st.length) add('team', T('Team (roster at login)'), 'unknown', T('No account is sending data yet.'));
      else add('team', T('Team (roster at login)'), worst(st), st.every(s => s === 'ok') ? T('The team of every connected account was read.') : st.indexOf('fail') >= 0 ? T('A roster arrived without a team in it.') : T('Some accounts have no team yet.'), lines,
        st.indexOf('fail') >= 0 ? T('Copy the report and send it: the field names above show what the game sends.') : st.indexOf('warn') >= 0 ? T('Press Reload all, wait 30 seconds, and open Diagnostics again.') : '');
    }

    // ===================================================================== 4. XP bars (the team's, and the trainer's own)
    if (!dash) add('xp', T('XP bars'), 'unknown', T('Needs the dashboard.'));
    else {
      const t = { total: 0, inside: 0, full: 0, neither: 0, none: 0 };
      (dash.accounts || []).forEach(a => { const x = a.xp || {}; Object.keys(t).forEach(k => { t[k] += x[k] || 0; }); });
      const all = t.total + t.inside + t.full + t.neither + t.none;
      // the trainer's EXP bar (under the name in the summary): how the trainer's xp reads, per account
      const tr = { total: 0, inside: 0, full: 0, neither: 0, none: 0 };
      (dash.accounts || []).forEach(a => { if (a.trainerXp && tr[a.trainerXp] !== undefined) tr[a.trainerXp]++; });
      const trParts = [['total', '{n} as total xp'], ['inside', '{n} as xp inside the level'], ['full', '{n} as a full bar'], ['neither', '{n} fits neither, so NO bar'], ['none', '{n} no xp number yet']].filter(x => tr[x[0]]).map(x => T(x[1], { n: tr[x[0]] }));
      const trLines = trParts.length ? [T('Trainer EXP (the bar under the name in the summary): {parts}', { parts: trParts.join(', ') })] : [];
      const trBad = tr.neither > 0;
      if (!all) add('xp', T('XP bars'), 'unknown', T('No team member to look at yet.'), trLines);
      else if (t.neither > 0) add('xp', T('XP bars'), 'fail', T('{n} of {all} team members have an xp that fits neither reading (the total xp, or the xp inside the level), so they have no bar.', { n: t.neither, all: all }), trLines,
        T('Copy the report and send it. The Team box hint (hover a Pokémon) shows its level and xp.'));
      else if (t.none === all) add('xp', T('XP bars'), 'warn', T('The team members carry no usable xp number.'), trLines, T('Copy the report and send it.'));
      else add('xp', T('XP bars'), trBad ? 'warn' : 'ok', T('{n} of {all} members have a bar. The game sends {mode}.', { n: t.total + t.inside + t.full, all: all, mode: t.inside === 0 ? T('the TOTAL xp (the way its own bar uses it)') : t.total === 0 ? T('the xp INSIDE the level') : T('a mix of total and in-level xp (both are understood)') }) + (trBad ? ' ' + T('The trainer’s own EXP does not fit either reading.') : ''), trLines,
        trBad ? T('Copy the report and send it: it says what the trainer’s xp looks like.') : T('Now compare one bar with the game’s own "EXP %" for the same Pokémon, and the trainer’s bar with the one in the game: they should agree to within 1%.'));
    }

    // ===================================================================== 5. captures
    if (!dash) add('catch', T('Best and last catch'), 'unknown', T('Needs the dashboard.'));
    else {
      // an account that is not sending data now (signed out, or stopped) cannot fill them, so it is left out
      const live = (dash.accounts || []).filter(a => a.ageSec !== null && a.ageSec !== undefined && a.ageSec <= 120);
      const seen = a => (a.capturesSeen === undefined ? (a.captures || 0) : a.capturesSeen);          // captures SEEN since the app started (the game's own counter also holds the ones from before)
      const withCaps = live.filter(a => seen(a) > 0);
      if (!withCaps.length) add('catch', T('Best and last catch'), 'unknown', T('No account that is sending data has made a capture since the app started, so there is nothing to show yet.'));
      else {
        const bad = withCaps.filter(a => !a.bestIV || !a.lastCaught);
        add('catch', T('Best and last catch'), bad.length ? 'warn' : 'ok', bad.length ? T('{n} of {m} accounts with captures have no best/last catch yet.', { n: bad.length, m: withCaps.length }) : T('Every account with captures shows its best and last catch.'),
          bad.map(a => T('{acc}: {n} captures seen, best catch {b}, last catch {l}', { acc: lab(a.n), n: seen(a), b: a.bestIV ? T('yes') : T('NO'), l: a.lastCaught ? T('yes') : T('NO') })),
          bad.length ? T('The first capture after the app starts fills them. If it stays empty after a capture, send the report.') : '');
      }
    }

    // ===================================================================== 8. notifications
    if (!main) add('notify', T('Notifications'), 'unknown', T('Needs the main-process part of diagnostics.'));
    else {
      const n = (main.settings || {}).notify || {};
      if (n.enabled === false) add('notify', T('Notifications'), 'warn', T('Notifications are switched off.'), [], T('Right-click the tray icon and tick Notifications.'));
      else add('notify', T('Notifications'), 'ok', T('Switched on{events}. To see one, use "Send test notification" (see "Only you can judge these").', { events: n.events ? ' (' + Object.keys(n.events).filter(k => n.events[k]).join(', ') + ')' : '' }));
    }

    // ===================================================================== 9. tidy (popups)
    if (!main) add('tidy', T('Popup tidy'), 'unknown', T('Needs the main-process part of diagnostics.'));
    else {
      const tl = logs.filter(l => /^tidy( \(panel \d\))?:/.test(l.text));
      const t = (main.settings || {}).tidy || {};
      const cannot = tl.filter(l => /could not attach|not valid/.test(l.text));
      const trouble = tl.filter(l => /no close button|not found|could not|failed|error/i.test(l.text) && cannot.indexOf(l) < 0);
      const done = tl.filter(l => /clos|collaps|hid|hidden|removed/i.test(l.text) && trouble.indexOf(l) < 0 && cannot.indexOf(l) < 0);
      if (t.enabled === false) add('tidy', T('Popup tidy'), 'unknown', T('Switched off in tidy-settings.json.'));
      else if (cannot.length) add('tidy', T('Popup tidy'), 'fail', T('It could not attach to a panel.'), cannot.slice(-3).map(l => mask(l.text)), T('Copy the report and send it.'));
      else if (trouble.length) add('tidy', T('Popup tidy'), 'warn', T('{things} it could not find or close.', { things: plural(trouble.length, 'thing') }), trouble.slice(-4).map(l => mask(l.text)), T('Copy the report and send it: the lines say which button was not found.'));
      else if (done.length) add('tidy', T('Popup tidy'), 'ok', T('It closed or hid {things} since the app started.', { things: plural(done.length, 'thing') }), done.slice(-3).map(l => mask(l.text)));
      else add('tidy', T('Popup tidy'), 'unknown', T('Nothing was closed since the app started (no popup appeared, or the panels were loaded a while ago).'), [], T('Press Reload all and watch: the announcement popup should close by itself within about 3 seconds.'));
    }

    // ===================================================================== 10. saved logins and Log in all
    {
      const acc = main && main.settings && main.settings.accounts, ll = ui.lastLogin || null;
      const lines = [];
      if (acc) lines.push(T('{logins}, {n} with a password{enc}, log in again by itself: {onoff}', { logins: plural(acc.saved, 'saved login'), n: acc.withPassword, enc: acc.encryption === false ? ' ' + T('(encryption is NOT available on this PC: passwords cannot be saved)') : '', onoff: acc.autoLogin ? T('on') : T('off') }));
      if (acc && acc.vault && typeof acc.vault === 'object') {                                  // (lang-52) which safeStorage functions, and what happened to the passwords
        const vv = acc.vault, cnt = x => (typeof x === 'number' && x > 0 ? Math.round(x) : 0);
        const how = vv.api === 'async' ? T('Electron\u2019s new functions') : vv.api === 'sync' ? T('Electron\u2019s old functions') : T('none');
        lines.push(T('password encryption: {how}', { how: how }) + (cnt(vv.migrated) ? ' \u00b7 ' + T('{n} moved to the new form', { n: cnt(vv.migrated) }) : '') + (cnt(vv.failed) ? ' \u00b7 ' + T('{n} could not be read (type them again in Accounts)', { n: cnt(vv.failed) }) : ''));
      }
      const pageLine = lp => {
        const pg = lp.page;
        if (!pg) return T('Panel {n}: the page could not be read', { n: lp.n }) + (lp.error ? ' (' + lp.error + ')' : '');
        const btn = (pg.buttons || []).filter(b => b.visible).slice(0, 6).map(b => '"' + b.text + '"').join(', ');
        return T('Panel {n} page ({ago}, {url}): {pw} password boxes, {tb} text boxes, {forms} forms, {frames} frames, {sr} shadow roots{btn}', { n: lp.n, ago: ago(lp.ageSec), url: pg.url || '?', pw: pg.passwordBoxes, tb: pg.textBoxes, forms: pg.forms || 0, frames: (pg.frames || []).length, sr: pg.shadowRoots || 0, btn: btn ? '; ' + T('buttons: {b}', { b: btn }) : '; ' + T('no visible buttons') });
      };
      ((main && main.loginPages) || []).forEach(lp => lines.push(mask(pageLine(lp))));
      const autoLines = logs.filter(l => /^accounts:/.test(l.text));
      autoLines.slice(-3).forEach(l => lines.push(mask(l.text)));
      const whyOf = r => r.ok ? T('login sent') : (r.reason === 'no-login-form' && typeof r.lastMsgSec === 'number') ? T('already signed in: no login form on the page, and it sent game data {ago}', { ago: ago(r.lastMsgSec) }) : (r.reason === 'no-login-form' ? whyText(r.reason) : (whyText(r.reason) || r.reason || T('failed')));
      if (ll) (ll.results || []).forEach(r => lines.push(T('Log in all, {acc}: {why} ({ago})', { acc: lab(r.n), why: whyOf(r), ago: ago(ll.ageSec) })));
      if (acc && acc.saved === 0) add('login', T('Saved logins and Log in all'), 'unknown', T('No login is saved yet.'), lines, T('Open Accounts and save the e-mail and password of a panel.'));
      else if (!ll) add('login', T('Saved logins and Log in all'), 'unknown', T('Log in all has not been tried since the app started.'), lines, T('See "Only you can judge these": sign one panel out with the game’s own menu, press Log in all, then open Diagnostics again. If it cannot sign in, the report then describes that login page.'));
      else {
        const rs = ll.results || [];
        const bad = rs.filter(r => !r.ok && r.reason !== 'no-login-form' && r.reason !== 'no-saved-login');
        add('login', T('Saved logins and Log in all'), bad.length ? 'fail' : rs.some(r => r.ok) ? 'ok' : 'unknown',
          bad.length ? T('Log in all could not sign {panels} in.', { panels: plural(bad.length, 'panel') }) : rs.some(r => r.ok) ? T('Log in all signed {panels} in.', { panels: plural(rs.filter(r => r.ok).length, 'panel') }) : T('Every panel was already signed in or has no saved login (nothing to do).'),
          lines, bad.length ? T('Copy the report and send it. The reason is in the line above.') : '');
      }
    }

    // ===================================================================== 11. the panels themselves
    if (!main) add('panels', T('Game panels'), 'unknown', T('Needs the main-process part of diagnostics.'));
    else {
      const ps = main.panels || [];
      if (!ps.length) add('panels', T('Game panels'), 'warn', T('No game panel was found.'));
      else {
        const off = ps.filter(p => p.crashed || !/pokehorizonidle\.com/.test(p.url || ''));
        add('panels', T('Game panels'), off.length ? 'warn' : 'ok', off.length ? T('{panels} not on the game page or crashed.', { panels: plural(off.length, 'panel') }) : T('{panels} on the game page.', { panels: plural(ps.length, 'panel') }),
          ps.map(p => (p.n ? T('Panel {n}', { n: p.n }) : T('Panel ?')) + ': ' + (p.url || '?') + (p.loading ? ' ' + T('(loading)') : '') + (p.crashed ? ' ' + T('(CRASHED)') : '')));
      }
    }

    // ===================================================================== 12. hits and kills (counted by the reader)
    if (!dash) add('combat', T('Hits per kill'), 'unknown', T('Needs the dashboard.'));
    else {
      const live = (dash.accounts || []).filter(a => a.ageSec !== null && a.ageSec !== undefined && a.ageSec <= 120);
      const withData = live.filter(a => a.combat && a.combat.kills >= 20);
      const anyField = (dash.accounts || []).some(a => a.combat !== undefined);
      if (!anyField) add('combat', T('Hits per kill'), 'unknown', T('The reader does not count hits and kills yet (the dashboard gets no counts).'), [], T('Run  node install-diagnostics.js  in the project folder, then quit the app from the tray and start it again.'));
      else if (!withData.length) add('combat', T('Hits per kill'), 'unknown', T('Not enough yet: it counts from the start of a hunt and needs 20 kills on an account that is sending data.'));
      else {
        // does the number of "kill" messages match the game's own kill counter over the same time? (If not, "hits per kill" may be wrong.)
        const off = withData.filter(a => a.combat.counterKills > 20 && a.combat.messageKills !== null && Math.abs(a.combat.messageKills - a.combat.counterKills) > a.combat.counterKills * 0.05);
        const lines = withData.map(a => { const c = a.combat; return T('{acc}: {hpk} hits per kill over {k} kills', { acc: lab(a.n), hpk: D((c.hits / c.kills).toFixed(2)), k: c.kills }) + (c.gapMs === null || c.gapMs === undefined ? '' : ' \u00b7 ' + T('{s} s between hits', { s: D((c.gapMs / 1000).toFixed(2)) })) + (c.spawnMs === null || c.spawnMs === undefined ? '' : ' \u00b7 ' + T('{s} s from a kill to the first hit', { s: D((c.spawnMs / 1000).toFixed(2)) })) + (c.counterKills > 20 && c.messageKills !== null ? ' \u00b7 ' + T('kill messages {m} vs the game’s counter {c}', { m: c.messageKills, c: c.counterKills }) : ''); });
        add('combat', T('Hits per kill'), off.length ? 'warn' : 'ok', off.length ? T('On {accounts} the number of kill messages is not the number of kills the game counts (more than 5% apart), so the hits per kill may be wrong.', { accounts: plural(off.length, 'account') }) : T('Counted on {accounts}; the kill messages match the game’s own kill counter.', { accounts: plural(withData.length, 'account') }), lines,
          off.length ? T('Copy the report and send it: it says which accounts, and the numbers.') : '');
      }
    }

    // ===================================================================== 12b. balls thrown at shinies (counted by the reader from the throws, and from the Pokédex answers)
    if (!dash) add('shiny', T('Balls at shinies'), 'unknown', T('Needs the dashboard.'));
    else {
      const accs = dash.accounts || [];
      const live = accs.filter(a => a.ageSec !== null && a.ageSec !== undefined && a.ageSec <= 120);
      const withData = live.filter(a => a.shiny && a.shiny.throws >= 20);
      if (!accs.some(a => a.shiny)) add('shiny', T('Balls at shinies'), 'unknown', T('The reader does not count the balls thrown at shinies yet (the dashboard gets no counts).'), [], T('Run  node install-diagnostics.js  in the project folder, then quit the app from the tray and start it again.'));
      else if (!withData.length) add('shiny', T('Balls at shinies'), 'unknown', T('Not enough yet: it needs 20 throws on an account that is sending data to know that the wild Pokémon are recognised.'));
      else {
        // how many throws could be matched with a wild Pokémon whose kind (shiny or not) was known: if it is low, throws at shinies may be missing from the count
        const poor = withData.filter(a => a.shiny.matched < a.shiny.throws * 0.9);
        const tot = withData.reduce((q, a) => ({ t: q.t + a.shiny.throws, m: q.m + a.shiny.matched }), { t: 0, m: 0 });
        const lines = withData.map(a => T('{acc}: {n} balls at shinies since the app started ({c} shinies caught), {t} throws, {m} matched with a wild Pokémon', { acc: lab(a.n), n: a.shiny.thrown, c: a.shiny.caught, t: a.shiny.throws, m: a.shiny.matched }) + (a.shiny.dexOpened > 0 ? ' \u00b7 ' + T('Pokédex: {b} balls at shinies in {s} of {o} species opened', { b: a.shiny.dexBalls, s: a.shiny.dexSpecies, o: a.shiny.dexOpened }) : ''));
        add('shiny', T('Balls at shinies'), poor.length ? 'warn' : 'ok', poor.length ? T('On {accounts} fewer than 9 in 10 throws could be matched with a wild Pokémon, so some throws at shinies may be missing from the count.', { accounts: plural(poor.length, 'account') }) : T('Counted on {accounts}; {m} of {t} throws were matched with a wild Pokémon whose kind (shiny or not) was known.', { accounts: plural(withData.length, 'account'), m: tot.m, t: tot.t }), lines,
          poor.length ? T('Copy the report and send it: it says how many throws were matched.') : '');
      }
    }

    // ===================================================================== 13. errors
    {
      const all = [];
      ((main && main.errors) || []).forEach(e => all.push({ where: 'main', ageSec: e.ageSec, text: e.src + ': ' + e.msg }));
      ((dash && dash.errors) || []).forEach(e => all.push({ where: 'dashboard', ageSec: e.ageSec, text: e.msg }));
      ((ui && ui.errors) || []).forEach(e => all.push({ where: 'window', ageSec: e.ageSec, text: e.msg }));
      const serious = all.filter(e => /render-process-gone|uncaught/i.test(e.text));
      if (!main && !dash) add('errors', T('Errors'), 'unknown', T('Nothing could be read.'));
      else if (!all.length) add('errors', T('Errors'), 'ok', T('No error has been recorded since the app started.'));
      else add('errors', T('Errors'), serious.length ? 'fail' : 'warn', T('{errors} recorded since the app started.', { errors: plural(all.length, 'error') }), all.slice(-4).map(e => mask('[' + e.where + ', ' + ago(e.ageSec) + '] ' + e.text).slice(0, 220)), T('Copy the report and send it.'));
    }

    // ===================================================================== what only a person can judge
    const manual = [
      { title: T('A notification'), how: T('Right-click the tray icon and choose "Send test notification".'), look: T('A Windows notification appears, saying 4horizon. (Its small label may still say "electron.app.Electron" until the app is packaged.)') },
      { title: T('Popup tidy'), how: T('Press Reload all.'), look: T('Within about 3 seconds the "Anúncio Oficial" popup closes by itself, the Hunt Analyzer window is closed and the chat is collapsed.') },
      { title: T('Log in all from the start page'), how: T('Sign ONE panel out with the game’s own menu, then press Log in all.'), look: T('The panel opens the login window by itself (it presses "Entrar"), waits for the Cloudflare check, fills the form and signs in, in about 5 to 10 seconds. If not, open Diagnostics again: the line "Log in all" says what happened.') },
      { title: T('The Team box'), how: T('Open the Summary and pick an account.'), look: T('Every Pokémon of the team has an icon, its level, and an HP and an EXP bar. The EXP % of the active one equals the game’s own "EXP %".') },
      { title: T('Only one copy'), how: T('Start the app a second time (npm start).'), look: T('The second one closes at once, and the first window comes to the front.') }
    ];

    // ===================================================================== the report
    const out = [];
    const P = s => out.push(s === undefined ? '' : s);
    const when = new Date();
    P('4HORIZON DIAGNOSTICS \u00b7 ' + when.getFullYear() + '-' + String(when.getMonth() + 1).padStart(2, '0') + '-' + String(when.getDate()).padStart(2, '0') + ' ' + String(when.getHours()).padStart(2, '0') + ':' + String(when.getMinutes()).padStart(2, '0') + ' \u00b7 report format 1');
    if (main && main.meta) {
      const m = main.meta;
      P('App ' + (m.app || '?') + ' ' + (m.version || '') + ' \u00b7 Electron ' + (m.electron || '?') + ' \u00b7 Chrome ' + (m.chrome || '?') + ' \u00b7 Node ' + (m.node || '?') + ' \u00b7 ' + (m.os || m.platform) + ' ' + (m.arch || '') +
        ' \u00b7 locale ' + (m.locale || '?') + ' \u00b7 running ' + Math.round(m.uptimeSec / 60) + ' min \u00b7 memory ' + (m.rssMB || '?') + ' MB' + (m.packaged ? ' \u00b7 packaged' : ''));
    } else P('Main-process part of diagnostics: NOT INSTALLED');
    P('Build: app ' + ((main && main.meta && main.meta.build) || 'unknown (old)') + ' \u00b7 window ' + ((ui && ui.build) || 'unknown (old)') + (main && main.staleFiles && main.staleFiles.length ? ' \u00b7 FILES CHANGED AFTER THE APP STARTED (still running the old version): ' + main.staleFiles.join(', ') : ''));
    if (main && main.gpu && typeof main.gpu === 'object') P(gpuLine(main.gpu));          // 1.0.7: the graphics cards, the one in use, acceleration on or off
    P('Character names: ' + (hide ? 'hidden' : 'shown'));
    P('Included: names of message types and fields, counts, true/false settings, errors; for an incubating egg only the KINDS of its values (number of digits, true / false, short labels). Not included: passwords, e-mails, gold, items or any other value from the game.');
    P();
    P('SELF-CHECK');
    checks.forEach(c => {
      P('  [' + { ok: 'OK  ', warn: 'WARN', fail: 'FAIL', unknown: ' ?  ' }[c.status] + '] ' + c.title + ': ' + c.detail);
      c.lines.slice(0, 8).forEach(l => P('         ' + mask(l)));
      if (c.todo && c.status !== 'ok') P('         -> ' + c.todo);
    });
    P();
    if (main) {
      P('PARTS');
      (main.features || []).forEach(f => P('  ' + (f.ok ? '\u2713' : '\u2717') + ' ' + f.label + ' (' + f.file + ')'));
      P();
      P('FILES (size \u00b7 age \u00b7 first 8 characters of its fingerprint)');
      P('  ' + (main.files || []).map(f => f.others ? '(and ' + f.others + ' other files of the folder, not the app\u2019s: not listed)' : f.name + ' ' + bytes(f.size) + ' ' + f.ageDays + 'd' + (f.sha8 ? ' ' + f.sha8 : '')).join('\n  '));
      if (main.datadir && typeof main.datadir === 'object') {
        const dd = main.datadir, fl = Array.isArray(dd.files) ? dd.files : [], mv = dd.moves && typeof dd.moves === 'object' ? dd.moves : {};
        P();
        P('YOUR FILES (history, settings: kept in the user-data folder, not in the app folder)');
        P('  folder: ' + (dd.inAppFolder ? 'the app folder (the user-data folder could not be used)' : String(dd.folder || '?').slice(0, 120)));
        P('  ' + (fl.length ? fl.map(f => String(f.name) + ' ' + (typeof f.kb === 'number' ? f.kb + ' KB' : '?')).join(' \u00b7 ') : 'none yet'));
        const said = Object.keys(mv).filter(k => !/^none$/.test(mv[k]));
        if (said.length) P('  ' + said.map(k => k + ': ' + String(mv[k]).replace(/^moved$/, 'moved from the app folder now').replace(/^leftOld$/, 'already there').slice(0, 90)).join(' \u00b7 '));
      }
      P();
      P('GAME MESSAGES (what arrived since the app started)');
      ACCOUNTS.forEach(n => {
        const a = mainAcc(n);
        if (ui && typeof ui.panels === 'number' && n > ui.panels) { P('  ' + lab(n) + ': not in use (Settings: ' + ui.panels + ' game panels)'); return; }
        if (!a) { P('  ' + lab(n) + ': nothing'); return; }
        P('  ' + lab(n) + ': ' + plural(a.frames, 'message') + ', ' + kb(a.kb) + ', first ' + ago(a.firstAgeSec) + ', last ' + ago(a.lastAgeSec) + ' \u00b7 connection ' + (a.socket === true ? 'open' : a.socket === false ? 'CLOSED ' + ago(a.socketAgeSec) : 'not seen'));
        P('      ' + (a.types || []).slice(0, 30).map(t => t.type + ' ' + t.n + ' (' + ago(t.lastAgeSec) + ')').join(' \u00b7 '));
      });
      P();
      P('FIELD NAMES OF THE MESSAGES THE APP READS (names only)');
      Object.keys(main.fields || {}).sort().forEach(t => P('  ' + t + ': ' + main.fields[t].slice(0, t === 'ready' ? 400 : 60).join(', ') + (main.fields[t].length > (t === 'ready' ? 400 : 60) ? ', ...' : '')));
      P();
    }
    if (dash) {
      P('ACCOUNTS AS THE DASHBOARD SEES THEM');
      (dash.accounts || []).forEach(a => {
        const x = a.xp || {};
        P('  ' + lab(a.n) + ': trainer level ' + (a.level || '?') + ' \u00b7 hunt ' + (a.huntId || '-') + (a.huntId ? (a.huntKnown ? ' (known)' : ' (NOT in the hunt data)') : '') + ' \u00b7 kills ' + (a.defeated || 0) + ' \u00b7 kills/h ' + (a.killsH || 0) + ' \u00b7 captures ' + (a.captures || 0) +
          ' \u00b7 leader ' + (a.lead ? 'yes' : 'no') + ' \u00b7 team ' + (a.teamN || 0) + '/6 (active ' + (a.teamActive ? 'yes' : 'no') + ', xp: total ' + (x.total || 0) + ', inside ' + (x.inside || 0) + ', full ' + (x.full || 0) + ', neither ' + (x.neither || 0) + ', none ' + (x.none || 0) + ')' +
          ' \u00b7 trainer xp ' + (a.trainerXp || 'n/a') + ' \u00b7 combat ' + combatText(a.combat) + ' \u00b7 balls at shinies ' + shinyText(a.shiny) + ' \u00b7 kinds of supplies ' + (a.kinds ? a.kinds.balls + ' balls, ' + a.kinds.potions + ' potions' : 'n/a') + ' \u00b7 captures seen ' + (a.capturesSeen === undefined ? 'n/a' : a.capturesSeen) + ' \u00b7 best catch ' + (a.bestIV ? 'yes' : 'no') + ' \u00b7 last catch ' + (a.lastCaught ? 'yes' : 'no') + ' \u00b7 last update ' + ago(a.ageSec));
        if (a.team && a.team.length) P('      team (level, xp reading): ' + a.team.map(m => 'Lv ' + m.level + ' ' + m.reading).join(' \u00b7 '));
      });
      if (dash.hunt) P('  Hunt data (names of hunts and Pok\u00e9mon): ' + dash.hunt.hunts + ' hunts, ' + dash.hunt.species + ' species');
      if (dash.huntLog && Array.isArray(dash.huntLog.accounts)) {             // the hunts kept for the comparison of the Summary (counts only)
        const cnt = v => (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.round(v) : 0;
        P('  Hunts kept for the comparison (on this computer): ' + dash.huntLog.accounts.slice(0, 4).map(x => lab(x.n) + ' ' + cnt(x.sessions) + ' sessions, ' + cnt(x.hunts) + ' hunts').join(' \u00b7 ') +
          ' \u00b7 ranked by ' + ({ gold: '$', xp: 'XP', both: '$+XP' }[dash.huntLog.rank] || '?') + (dash.huntLog.saveError ? ' \u00b7 SAVING FAILED (the browser storage refused it)' : ''));
      }
      if (dash.view) P('  The Summary shows: ' + (dash.view.selected === 'sum' ? 'all accounts together' : lab(dash.view.selected)) + ' \u00b7 lock ' + (dash.view.locked ? 'ON (it does not follow the expanded screen)' : 'off (it follows the expanded screen)'));
      P();
    }
    if (main && main.nav !== undefined) {
      P('NAVIGATION BUTTONS (Centro, Market, Mochila, Hunts and Back to last hunt of each panel; the texts listed are the buttons and links of the game page)');
      if (!main.nav) P('  not pressed since the app started');
      else {
        const nv = main.nav, word = { center: 'Centro', market: 'Market', bag: 'Mochila', hunts: 'Hunts', lasthunt: 'Back to last hunt' + (nv.hunt ? ' (' + nv.hunt + ')' : '') }[nv.what] || String(nv.what);
        P('  last press ' + ago(nv.ageSec) + ': ' + word + ' on ' + lab(nv.n) + ': ' + (nv.ok ? 'done' : 'NOT DONE (' + (nv.reason || '?') + ')') + (nv.ok && nv.already ? ' (it was the hunt in progress)' : '') + (!nv.ok && nv.labels && nv.labels.length ? ' \u00b7 buttons of its page: ' + nv.labels.join(', ') : ''));
        if (nv.probe) P('      what was looked at: search box ' + nv.probe.input + ', panel ' + nv.probe.box + ', searched "' + nv.probe.term + '"' + (typeof nv.probe.all === 'number' ? ' · texts that are exactly the Pokémon: ' + nv.probe.all + ' in the page, ' + nv.probe.vis + ' visible, ' + nv.probe.inBox + ' in the panel, ' + nv.probe.below + ' below the search box' + (typeof nv.probe.contains === 'number' ? ', ' + nv.probe.contains + ' that contain it' : '') + (nv.probe.cacar ? ' · Caçar button: ' + nv.probe.cacar : '') + (nv.probe.weak ? ' · "Fraco contra" set to: ' + nv.probe.weak : '') + ' · region tabs found: ' + (nv.probe.regions || 'none') : ''));
      }
      P();
    }
    if (main && main.donate !== undefined) {
      P('DONATE BUTTONS GUARD (in the diamond shop the "+ Doar" button, the "Diamantes" tab and the "Doar R$ ..." pay button cannot be pressed in the app, nor "Comprar passe" and "Dar o Passe para um amigo" of the Battle Pass; a note with a link to the official page takes the place of "+ Doar" and of the two Battle Pass buttons)');
      const dp = (main.donate && main.donate.panels) || [];
      const seenTxt = (v, no) => (v === null || v === undefined ? no : ago(v));
      if (!dp.length) P('  no game panel yet');
      else dp.forEach(q => P('  ' + lab(q.n) + ': script in the page: ' + (q.loads ? 'yes (put in ' + q.loads + (q.loads === 1 ? ' time' : ' times') + ', last ' + ago(q.ageSec) + ')' : 'NO (' + (q.error || 'not put in yet') + ')')
        + ' \u00b7 Doar button seen: ' + seenTxt(q.seenAgeSec, 'not yet (open the shop of diamonds in that panel)')
        + ' \u00b7 Diamantes tab hidden: ' + seenTxt(q.tabAgeSec, 'not yet')
        + ' \u00b7 pay button hidden: ' + seenTxt(q.payAgeSec, 'not yet (it exists only on the donation page)')
        + (q.passAgeSec !== undefined ? ' \u00b7 Battle Pass buttons hidden: ' + seenTxt(q.passAgeSec, 'not yet (open the Battle Pass in that panel)') : '')
        + ' \u00b7 presses stopped: ' + (q.blocked || 0)));
      P();
    }
    if (main && main.external !== undefined) {
      P('LINKS FROM THE GAME (a link that a game page opens in a new window goes to the default browser: the Wiki, a Twitch or Kick stream, the vote buttons; only the site is listed, never the rest of the address)');
      const evs = (main.external && main.external.events) || [];
      if (!evs.length) P('  none since the app started');
      else evs.slice(-8).forEach(e => P('  ' + ago(e.ageSec) + ': ' + e.host + ' \u00b7 ' + e.how + ' \u00b7 ' + (e.n ? lab(e.n) : 'the window of the app')));
      P();
    }
    if (main && main.supplies !== undefined) {
      P('SUPPLY KINDS (the balls and potions the Summary can add up)');
      const ig = (main.supplies && main.supplies.ignoredBalls) || [];
      P('  items that end with "-ball" and are not counted as balls (things Pok\u00e9mon drop): ' + (ig.length ? ig.join(', ') : 'none seen'));
      P('  (if one of them is a real Pok\u00e9 Ball, tell me its name: it is added to the list of balls)');
      const bs = (main.supplies && main.supplies.boundSeen) || null;
      if (bs) { const ks = Object.keys(bs).sort(); P('  balls and potions also in the game\u2019s bound list (not counted, as the game\u2019s own counters do not; the last amount seen, any account): ' + (ks.length ? ks.map(k => k + ' ' + (typeof bs[k] === 'number' && isFinite(bs[k]) ? Math.round(bs[k]).toLocaleString('en-US') : '?')).join(', ') : 'none')); }
      P();
    }
    if (main && main.analyzer !== undefined) {
      P('ANALYZER BUTTON (the button of the top bar that opens or closes the game\u2019s Hunt Analyzer on every account; the words listed are the short words of the top of the game page, its menu)');
      if (!main.analyzer) P('  not pressed since the app started');
      else {
        const an = main.analyzer;
        P('  last press ' + ago(an.ageSec) + ': ' + (an.action === 'open' ? 'opened' : an.action === 'close' ? 'closed' : 'no game panel was ready'));
        (an.results || []).forEach(r => P('      ' + lab(r.n) + ': ' + (r.ok ? (r.skipped ? 'nothing to do' : 'done' + (r.via === 'toolbar' ? ' (closed with the Análise icon of the toolbar)' : '') + (r.hiddenButton ? ' (its Análise icon is hidden in the narrow toolbar)' : '')) : 'NOT DONE (' + (r.reason || '?') + ')') + (r.labels && r.labels.length ? ' \u00b7 words at the top of its page: ' + r.labels.join(', ') : '') + (r.pressed ? ' \u00b7 pressed as the close button: ' + r.pressed : '') + (r.toolbar ? ' \u00b7 Análise icon: ' + r.toolbar : '')));
      }
      P();
    }
    if (main && main.selftest && typeof main.selftest === 'object') {
      const S = main.selftest, pn = Array.isArray(S.panels) ? S.panels : [], pb = Array.isArray(S.problems) ? S.problems : [];
      const icon = v => (v === 'visible' ? 'yes' : v === 'hidden' ? 'yes (hidden in a narrow toolbar)' : v === 'missing' ? 'NOT FOUND' : v === 'notnow' ? 'not on the page now (it appears after Centro)' : '?');
      P('GAME CHECK (Diagnostics › Check the game: what 4horizon relies on in each game page; nothing was pressed) · ' + ago(S.ageSec));
      P('  ' + (pb.length ? pb.length + ' thing' + (pb.length > 1 ? 's' : '') + ' NOT FOUND:' : 'everything 4horizon needs was found'));
      pb.slice(0, 12).forEach(x => P('    ' + lab(Number(x.n)) + ': ' + String(x.what).slice(0, 80) + ' \u2192 affects ' + String(x.affects).slice(0, 90)));
      pn.forEach(p => {
        if (p.error || p.timeout) { P('  ' + lab(Number(p.n)) + ': the page did not answer'); return; }
        const tb = p.toolbar || {};
        P('  ' + lab(Number(p.n)) + ': ' + (p.signedIn ? 'signed in' : 'SIGNED OUT') + ' \u00b7 toolbar: Hunts ' + icon(tb.hunts) + ', An\u00e1lise ' + icon(tb.analise) + ', Centro ' + icon(tb.centro) + ', Mochila ' + icon(tb.mochila) + ' \u00b7 "Ir ao Market" ' + (tb.market === 'hidden' ? 'yes (hidden)' : icon(tb.market)) + ' \u00b7 Hunt Analyzer ' + (p.analyzer === 'open' ? 'open' : 'closed'));
        const h = p.hunts;
        if (h) P('      Hunts panel open: search box yes \u00b7 region tabs ' + (h.regions && h.regions.length ? h.regions.join(', ') : 'NONE') + ' \u00b7 "Todos" ' + (h.todos ? 'yes' : 'NO') + ' \u00b7 "Todos os n\u00edveis" ' + (h.levels ? 'yes' : 'NO') + (h.weak ? ' \u00b7 "Fraco contra": ' + String(h.weak).slice(0, 20) : '') + ' \u00b7 cards ' + (Number(h.cards) || 0) + ' \u00b7 Ca\u00e7ar button ' + (h.cacar === 'found' ? 'yes' : 'none (no hunt chosen)'));
      });
      if (!pn.some(p => p.hunts)) P('  (no Hunts panel was open: open it on one account before "Check the game" to have it checked too)');
      P();
    }
    if (main && main.updates && typeof main.updates === 'object') {
      const U = main.updates, agoU = s => (typeof s === 'number' ? ago(s) : 'not yet');
      P('UPDATES (GitHub is asked for the latest release shortly after the start and every 6 hours)');
      P('  this version ' + String(U.version || '?').slice(0, 20) + ' \u00b7 latest release ' + (U.latest ? String(U.latest).slice(0, 20) : 'not known yet') + ' \u00b7 ' + (U.available ? 'a NEWER version is out (the Update button shows)' : 'up to date') + ' \u00b7 checked ' + agoU(U.checkedSec) + (U.error ? ' \u00b7 last check failed: ' + String(U.error).slice(0, 80) : ''));
      P();
    }
    if (main && main.lockdown !== undefined && main.lockdown) {
      const L = main.lockdown, num = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.round(v) : 0), who = p => (Number(p) === 0 ? 'the app window' : lab(Number(p)));
      P('PANEL LOCKDOWN (the game pages get no permission except the clipboard and full screen, and every panel is forced to safe settings; counts and permission names only)');
      const pn = L.panels || {};
      P('  panels: ' + num(pn.attached) + ' created, ' + num(pn.fixed) + ' with safe settings forced' + (Array.isArray(pn.refused) && pn.refused.length ? ', ' + pn.refused.length + ' REFUSED (not the game, or not an account storage): ' + pn.refused.slice(-3).map(r => String(r.host) + ' / ' + String(r.partition) + ' ' + ago(r.ageSec)).join(', ') : ', none refused') +
        ' \u00b7 locked storages: ' + num(L.sessions) + ' of 5' + (num(L.sessions) < 5 ? ' (NOT ALL)' : '') +
        (L.webrtc ? ' \u00b7 WebRTC address discovery off on ' + num(L.webrtc.set) + ' panels' + (num(L.webrtc.failed) ? ' (COULD NOT be set on ' + num(L.webrtc.failed) + ')' : '') : ''));
      const den = L.denied && typeof L.denied === 'object' ? L.denied : {}, names = Object.keys(den).sort((a, b) => (den[b].total || 0) - (den[a].total || 0));
      if (!names.length) P('  refused: nothing was asked for since the app started');
      else P('  refused: ' + names.slice(0, 20).map(k => String(k).slice(0, 40) + ' \u00d7' + num(den[k].total) + ' (' + Object.keys(den[k].panels || {}).sort().map(who).join(', ') + ')').join(' \u00b7 '));
      const al = L.allowed && typeof L.allowed === 'object' ? L.allowed : {};
      if (Object.keys(al).length) P('  allowed: ' + Object.keys(al).sort().map(k => String(k).slice(0, 40) + ' \u00d7' + num(al[k].total)).join(' \u00b7 '));
      P('  (if a feature of the game stops working, the permission it needed is in "refused": tell me its name)');
      P();
    }
    if (main && main.missions !== undefined && main.missions) {
      const M = main.missions, num = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.round(v) : 0), ago2 = s => (typeof s === 'number' && isFinite(s) ? ago(s) : 'never');
      P('MISSIONS AND EGGS (the notifications of a battle pass mission, a daily mission and an egg ready to hatch; counts only)');
      P('  messages from the game since the start: battle pass ' + num(M.messages && M.messages.battlePass) + ' \u00b7 daily missions ' + num(M.messages && M.messages.dailyQuests) + ' \u00b7 eggs ' + num(M.messages && M.messages.breeding) +
        ' \u00b7 notifications shown: battle pass ' + num(M.sent && M.sent.battlePass) + ', daily ' + num(M.sent && M.sent.dailyQuest) + ', eggs ' + num(M.sent && M.sent.eggReady));
      (Array.isArray(M.accounts) ? M.accounts : []).slice(0, 4).forEach(x => {
        const parts = [];
        parts.push(x.bp ? 'battle pass ' + num(x.bp.done) + '/' + num(x.bp.missions) + ' done (last sent ' + ago2(x.bp.ageSec) + ')' : 'battle pass: not sent yet');
        parts.push(x.dq ? 'daily ' + num(x.dq.done) + '/' + num(x.dq.quests) + ' done, ' + num(x.dq.claimed) + ' claimed (last sent ' + ago2(x.dq.ageSec) + ')' : 'daily missions: not sent yet');
        const e = x.eggs || {}, soon = Array.isArray(e.readyInMin) ? e.readyInMin : [];
        parts.push('eggs ' + num(e.count) + (num(e.ready) ? ', ' + num(e.ready) + ' ready' : '') + (soon.length ? ', next ready in ' + (soon[0] >= 90 ? Math.round(soon[0] / 60) + ' h' : num(soon[0]) + ' min') : ''));
        const tmr = v => (v === undefined ? null : v === null ? 'none' : v <= 0 ? 'ended' : v < 90 ? 'ends in ' + num(v) + ' s' : v < 5400 ? 'ends in ' + Math.round(v / 60) + ' min' : 'ends in ' + Math.round(v / 3600) + ' h');
        if (tmr(x.penaltyInSec) || tmr(x.huntReadyInSec)) parts.push('timers: entry penalty ' + (tmr(x.penaltyInSec) || 'not sent yet') + ', travel ' + (tmr(x.huntReadyInSec) || 'not sent yet'));
        P('  ' + lab(x.n) + ': ' + parts.join(' \u00b7 '));
      });
      if (M.messages && M.messages.battlePass > 0 && M.messages.battlePass <= (M.accounts || []).length) P('  (the game has sent the battle pass only once per account so far: if it only does so at the login, a mission is noticed at the next login)');
      P();
    }
    if (main && main.perf !== undefined) perfSection(main.perf).forEach(l => P(l));          // 1.0.7: CPU AND MEMORY
    if (main && main.light !== undefined) {          // lang-70: Light mode (Settings, for slower PCs)
      const Lm = main.light || {}, lp = Array.isArray(Lm.panels) ? Lm.panels : [];
      P('LIGHT MODE (Settings, for slower PCs: reduced motion in the game panels, the Summary redrawn every 5 s, no animations in the window): ' + (Lm.on ? 'ON' : 'off'));
      if (Lm.on) lp.forEach(q => P('  ' + lab(q.n) + ': ' + (q.reduced ? 'reduced motion on (set ' + ago(q.ageSec) + ')' : 'NOT set yet' + (q.error ? ' (' + q.error + ')' : ''))));
      P();
    }
    if (main && main.economy !== undefined) {
      P('ECONOMY MODE (turned on and off by hand; once a minute the app notes CPU and memory of its processes, the pace of each account, and how late a 1-second timer runs in each game page; last 24 hours)');
      const E = main.economy || {}, fn = v => typeof v === 'number' && isFinite(v);
      const dur = m => { m = Math.round(fn(m) ? m : 0); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm'; };
      const pct = v => (fn(v) ? (Math.round(v * 10) / 10) : 0) + '%';
      const gb = mb => (fn(mb) ? (mb >= 1024 ? (Math.round(mb / 102.4) / 10) + ' GB' : Math.round(mb) + ' MB') : '?');
      const secs = ms => (fn(ms) ? (ms >= 10000 ? Math.round(ms / 1000) : Math.round(ms / 100) / 10) : 0) + ' s';
      const num = v => (fn(v) ? Math.round(v).toLocaleString('en-US') : '?');
      if (E.error) P('  could not be worked out: ' + E.error);
      else {
        const cur = E.now || {};
        P('  Now: ' + (cur.on ? 'ON for ' + dur((cur.sinceSec || 0) / 60) : 'off') + ' \u00b7 measured: on ' + dur(E.time && E.time.on) + ', off ' + dur(E.time && E.time.off) + ' \u00b7 turned on or off ' + (E.events || 0) + ' times' + (E.saveError ? ' \u00b7 SAVING THE MEASUREMENTS FAILED (' + E.saveError + ')' : ''));
        const R = E.res || {}, on = R.on || {}, off = R.off || {}, NEED = 10;
        const resLine = (m, x) => m + ': CPU ' + pct(x.cpu) + ' (game panels ' + pct(x.cpuPanels) + ', graphics ' + pct(x.cpuGpu) + ', window ' + pct(x.cpuWin) + ') \u00b7 memory ' + gb(x.mem) + ' \u00b7 ' + (x.n || 0) + ' samples';
        if ((on.n || 0) >= NEED && (off.n || 0) >= NEED) {
          const save = off.cpu > 0 ? Math.round((1 - on.cpu / off.cpu) * 100) : 0;
          P('  Saving: ' + (save >= 10 ? 'YES, CPU ' + (save > 0 ? '\u2212' : '+') + Math.abs(save) + '%' : save > -10 ? 'LITTLE (CPU ' + (save >= 0 ? '\u2212' : '+') + Math.abs(save) + '%)' : 'NO, economy mode used MORE CPU (+' + Math.abs(save) + '%)') + ' \u00b7 memory ' + gb(off.mem) + ' \u2192 ' + gb(on.mem));
        } else P('  Saving: not known yet (it needs ' + NEED + ' minutes in each mode; so far on ' + (on.n || 0) + ', off ' + (off.n || 0) + ')');
        P('    ' + resLine('off', off)); P('    ' + resLine('on ', on));
        const acc = E.acc || {}, ns = Object.keys(acc).map(Number).sort();
        const hiddenBad = ns.filter(n => acc[n].hiddenOn !== null && acc[n].hiddenOn !== undefined && acc[n].hiddenOn < 0.9);
        const hiddenKnown = ns.filter(n => acc[n].hiddenOn !== null && acc[n].hiddenOn !== undefined);
        if (!hiddenKnown.length) P('  Game screens not drawn: not known yet (no sample with economy mode on)');
        else if (!hiddenBad.length) P('  Game screens not drawn: yes (the game pages count as hidden in economy mode: ' + hiddenKnown.map(n => lab(n)).join(', ') + ')');
        else P('  Game screens not drawn: NO for ' + hiddenBad.map(n => lab(n) + ' (hidden in ' + Math.round(acc[n].hiddenOn * 100) + '% of the samples)').join(', ') + ': the browser kept drawing it');
        if (!ns.length) P('  Accounts: nothing measured yet (no game panel was connected during a sample)');
        ns.forEach(n => {
          const a = acc[n]; let line = '  ' + lab(n) + ': ';
          if (a.verdict === 'normal') line += 'hunting normally';
          else if (a.verdict === 'slower') line += 'SLOWER in economy mode';
          else if (a.verdict === 'stalled') line += 'NOT HUNTING in economy mode (no kills)';
          else if (a.verdict === 'no kills') line += 'no kills with economy mode off either: nothing to compare';
          else line += 'not enough time on one hunt to compare (it needs ' + (E.minCompare || 20) + ' min in each mode on the same hunt; the most so far: on ' + dur(a.most && a.most.on) + ', off ' + dur(a.most && a.most.off) + ')';
          if (a.hunt) line += ' \u00b7 ' + a.hunt + ': kills/h ' + num(a.off.kph) + ' off (' + dur(a.off.min) + ') \u2192 ' + num(a.on.kph) + ' on (' + dur(a.on.min) + '), XP/h ' + num(a.off.xph) + ' \u2192 ' + num(a.on.xph);
          P(line);
          const d = [];
          if (a.msgPerMin && (a.msgPerMin.off !== null || a.msgPerMin.on !== null)) d.push('game messages/min ' + (a.msgPerMin.off === null ? '?' : a.msgPerMin.off) + ' off \u2192 ' + (a.msgPerMin.on === null ? '?' : a.msgPerMin.on) + ' on' + (a.fewMsgs ? ' (FEWER)' : ''));
          if (a.timer && a.timer.on) d.push('1-second timer in economy mode: ' + secs(a.timer.on.avg) + ' late on average, at most ' + secs(a.timer.on.max) + (a.slowTimers ? (a.verdict === 'normal' ? ' (slowed by the browser; the hunt was not affected)' : ' (SLOWED DOWN BY THE BROWSER)') : ''));
          else if (a.timer && a.timer.off) d.push('1-second timer: ' + secs(a.timer.off.avg) + ' late on average with economy mode off');
          if (a.noAnswerOn) d.push('the page did not answer ' + a.noAnswerOn + ' times in economy mode');
          if (d.length) P('      ' + d.join(' \u00b7 '));
        });
      }
      P();
    }
    if (main && (main.eggs || []).length) {
      P('EGGS SEEN (the kinds of values inside an incubating egg; first egg of each panel)');
      main.eggs.forEach(e => {
        P('  ' + lab(e.n) + ' \u00b7 ' + e.path + ' \u00b7 ' + e.count + (e.count === 1 ? ' egg' : ' eggs') + ' \u00b7 seen ' + ago(e.ageSec));
        (e.items || []).slice(0, 2).forEach((it, i) => P('      egg ' + (i + 1) + ': ' + Object.keys(it).map(k => k + ' = ' + it[k]).join(' \u00b7 ')));
      });
      P();
    } else if (main) {
      P('EGGS SEEN: no incubating egg was seen on any connected account since the app started (a panel that is not connected cannot be seen).');
      P();
    }
    if (main && (main.loginPages || []).length) {
      P('LOGIN PAGES (the shape of the page of a panel that was signed out: kinds of boxes, their names, words on buttons; never what is typed)');
      main.loginPages.forEach(lp => {
        const pg = lp.page;
        P('  Panel ' + lp.n + ' \u00b7 looked at ' + ago(lp.ageSec) + ' \u00b7 ' + (lp.sendingData ? 'it was SENDING game data (' + lp.silentSec + ' s ago)' : 'silent for ' + (lp.silentSec === null || lp.silentSec === undefined ? 'the whole session' : lp.silentSec + ' s')));
        if (!pg) { P('      the page could not be read' + (lp.error ? ': ' + mask(lp.error) : '')); return; }
        P('      ' + mask((pg.url || '?') + ' \u00b7 "' + pg.title + '" \u00b7 ' + pg.ready));
        P('      forms ' + pg.forms + ' \u00b7 password boxes ' + pg.passwordBoxes + ' \u00b7 text boxes ' + pg.textBoxes + ' \u00b7 canvas ' + pg.canvas + ' \u00b7 shadow roots ' + pg.shadowRoots + ' \u00b7 frames ' + (pg.frames || []).length);
        (pg.frames || []).slice(0, 5).forEach(f => P('      frame ' + mask(f.src) + (f.sameOrigin ? ' (same site)' : ' (other site)') + (f.visible ? '' : ' (hidden)')));
        (pg.inputs || []).slice(0, 14).forEach(i => P('      box: ' + mask([i.tag + (i.type ? '[' + i.type + ']' : ''), i.name && 'name=' + i.name, i.id && 'id=' + i.id, i.placeholder && 'placeholder="' + i.placeholder + '"', i.autocomplete && 'autocomplete=' + i.autocomplete, i.label && 'label="' + i.label + '"', i.visible ? 'visible' : 'hidden', i.disabled && 'disabled', i.inForm ? 'in a form' : 'not in a form', i.where !== 'page' && 'in ' + i.where].filter(Boolean).join(' '))));
        (pg.buttons || []).slice(0, 16).forEach(b => P('      button: "' + mask(b.text) + '"' + (b.type ? ' [' + b.type + ']' : '') + (b.visible ? '' : ' hidden') + (b.disabled ? ' disabled' : '') + (b.where !== 'page' ? ' in ' + b.where : '')));
        if ((pg.links || []).length) P('      links: ' + mask(pg.links.map(x => '"' + x + '"').join(', ')));
        if ((pg.headings || []).length) P('      headings: ' + mask(pg.headings.map(x => '"' + x + '"').join(', ')));
        if (pg.text) P('      text: ' + mask('"' + pg.text + '"'));
      });
      P();
    }
    if (main && main.settings) {
      const s = main.settings, flat = o => Object.keys(o || {}).map(k => typeof o[k] === 'object' ? k + '{' + flat(o[k]) + '}' : k + '=' + o[k]).join(' ');
      P('SETTINGS (true / false and numbers only)');
      P('  notifications: ' + flat(s.notify));
      P('  tidy: ' + flat(s.tidy));
      P('  saved logins: ' + flat(s.accounts) + ' \u00b7 history: ' + flat(s.history) + ' \u00b7 species names: ' + ((s.species || {}).names || 0));
      if (s.startup) P('  start with the PC: ' + flat(s.startup));
      P();
    }
    if (ui && ui.bridge) P('WINDOW \u00b7 bridge functions: ' + Object.keys(ui.bridge).map(k => k + '=' + (ui.bridge[k] ? 'yes' : 'NO')).join(' ') + (ui.statsAgeSec ? ' \u00b7 last data in the window: ' + ACCOUNTS.map(n => n + ':' + ago(ui.statsAgeSec[n])).join(' ') : ''));
    P();
    const errs = [];
    ((main && main.errors) || []).forEach(e => errs.push('[main, ' + ago(e.ageSec) + '] ' + e.src + ': ' + e.msg));
    ((dash && dash.errors) || []).forEach(e => errs.push('[dashboard, ' + ago(e.ageSec) + '] ' + e.msg));
    ((ui && ui.errors) || []).forEach(e => errs.push('[window, ' + ago(e.ageSec) + '] ' + e.msg));
    P('ERRORS (' + errs.length + ')');
    errs.slice(-15).forEach(e => P('  ' + mask(e).slice(0, 400)));
    P();
    const lg = logs.slice(-60);
    P('LOG (last ' + lg.length + ' lines of the app\u2019s own console)');
    lg.forEach(l => P('  ' + ago(l.ageSec).padStart(8) + ' ' + (l.level === 'error' ? '! ' : l.level === 'warn' ? '? ' : '  ') + mask(l.text)));
    let report = out.join('\n');
    if (report.length > 60000) report = report.slice(0, 60000) + '\n... (cut)';
    return { checks: checks, manual: manual, report: report, summary: worst(checks.map(c => c.status)) };
  }

  return { analyse: analyse, _ago: ago, _gpuLine: gpuLine, _perfSection: perfSection };
});
