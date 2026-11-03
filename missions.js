// missions.js: notifications for a battle pass mission completed, a daily mission completed, and an egg ready to hatch (lang-41).
//
// It only READS three messages the game sends (the reader hands them over; nothing is ever sent to the game):
//   "battle-pass"           { state: { date, day, week, sets: [{ day, missions: [{ kind, type, speciesId, progress, target, points }] }], weekly: { kind, progress, target, points } } }
//   "ready" / "character"   { character: { dailyQuests: { date, quests: [{ tier, claimed, goals: [{ kind, speciesId, progress, target }] }] } } }
//   "breeding"              { slots, eggs: [{ id, speciesId, shiny, status, startedAt, readyAt, remainingMs }] }
// A mission counts as done when its progress reaches its target (a daily mission: every one of its goals). A notification is shown when a mission is SEEN going
// from not done to done; what is already done when the app first sees it (at the login) is not announced, so a restart does not repeat old news.
// An egg: the time it will be ready is worked out from readyAt (or from remainingMs when it arrives), and a timer looks every 20 s; each egg is announced once.
// An egg that is already ready when it is first seen is not announced either. The notifications go through notify.js (its switches, quiet hours, silent mode).

let notify = null;
const N = () => { if (!notify) { try { notify = require('./notify'); } catch (e) { notify = { event() { return false; }, label: n => 'Account ' + n }; } } return notify; };
let i18n = null; try { i18n = require('./i18n'); } catch (e) {}
const t = (en, p) => (i18n && i18n.t ? i18n.t(en, p) : String(en).replace(/\{(\w+)\}/g, (m, k) => (p && p[k] !== undefined ? p[k] : m)));
const fin = v => typeof v === 'number' && isFinite(v);
const done = (progress, target) => fin(progress) && fin(target) && target > 0 && progress >= target;

const acc = {};               // per account: what was seen
const A = n => acc[n] || (acc[n] = { bp: null, dq: null, eggs: {}, eggsSeen: false });
const stats = { battlePass: 0, dailyQuests: 0, breeding: 0, sent: { battlePass: 0, dailyQuest: 0, eggReady: 0 }, lastBattlePassAt: {}, lastDailyAt: {} };
let now = () => Date.now();
let timer = null;

const tierName = tier => {
  const k = String(tier || '').toLowerCase();
  if (/^(easy|facil|fácil|1)$/.test(k)) return t('easy');
  if (/^(medium|media|média|normal|2)$/.test(k)) return t('medium');
  if (/^(hard|dificil|difícil|3)$/.test(k)) return t('hard');
  return String(tier || '').slice(0, 20);
};

// ---------------------------------------------------------------------------------------------------------------- battle pass
function battlePass(account, msg, nameOf) {
  const st = msg && msg.state;
  if (!st || typeof st !== 'object') return;
  stats.battlePass++; stats.lastBattlePassAt[account] = now();
  const a = A(account), cur = {};
  (Array.isArray(st.sets) ? st.sets : []).slice(0, 10).forEach((set, si) => {
    (set && Array.isArray(set.missions) ? set.missions : []).slice(0, 10).forEach((m, mi) => {
      if (!m || typeof m !== 'object') return;
      const key = 'd' + (set.day !== undefined ? set.day : si) + ':' + mi + ':' + (m.kind || '') + ':' + (m.speciesId || '') + ':' + (m.target || '');
      cur[key] = { done: done(m.progress, m.target), m: m };
    });
  });
  if (st.weekly && typeof st.weekly === 'object') cur['w' + (st.week !== undefined ? st.week : '') + ':' + (st.weekly.kind || '') + ':' + (st.weekly.target || '')] = { done: done(st.weekly.progress, st.weekly.target), m: st.weekly, weekly: true };
  if (a.bp) {
    Object.keys(cur).forEach(k => {
      const was = a.bp[k];
      if (cur[k].done && was && !was.done) {
        const m = cur[k].m, who = N().label(account);
        const what = cur[k].weekly ? t('challenge of the week') : t('mission of the day');
        const sent = N().event(account, 'battlePass', t('{who}: battle pass mission completed', { who: who }),
          t('Done: {what} ({n}/{n}){pp}. Claim it in the Passe window.', { what: what, n: fmtInt(m.target), pp: fin(m.points) && m.points > 0 ? ' \u00b7 +' + fmtInt(m.points) + ' PP' : '' }), 'bp:' + k);
        if (sent) stats.sent.battlePass++;
      }
    });
  }
  a.bp = cur;
}

// ---------------------------------------------------------------------------------------------------------------- daily missions
// one notification per GOAL that is done (lang-42); the goal that completes its mission says so in the same notification (no second one)
const goalName = (g, nameOf) => {
  const n = fin(g.speciesId) && g.speciesId > 0 && nameOf ? nameOf(g.speciesId) : '';
  if (n) return n;
  const k = String(g.kind || '');
  if (/pvp/i.test(k)) return 'PvP';
  if (/market|buy|trade/i.test(k)) return t('Market');
  return k.slice(0, 30) || t('a goal');
};
function dailyQuests(account, msg, nameOf) {
  const dq = msg && msg.character && msg.character.dailyQuests;
  if (!dq || typeof dq !== 'object' || !Array.isArray(dq.quests)) return;
  stats.dailyQuests++; stats.lastDailyAt[account] = now();
  const a = A(account), cur = {}, goalsNow = {};
  dq.quests.slice(0, 10).forEach((q, i) => {
    if (!q || typeof q !== 'object') return;
    const goals = Array.isArray(q.goals) ? q.goals.filter(g => g && typeof g === 'object').slice(0, 10) : [];
    const qk = (dq.date || '') + ':' + i + ':' + (q.tier || '');
    cur[qk] = { done: goals.length > 0 && goals.every(g => done(g.progress, g.target)), claimed: q.claimed === true, q: q, goals: goals };
    goals.forEach((g, gi) => { goalsNow[qk + ':' + gi + ':' + (g.kind || '') + ':' + (g.speciesId || '') + ':' + (g.target || '')] = { done: done(g.progress, g.target), g: g, qk: qk }; });
  });
  if (a.dqGoals) {
    const fresh = {};                                    // the goals that are done now and were not before, by mission (one notification per mission and message)
    Object.keys(goalsNow).forEach(k => { const was = a.dqGoals[k], x = goalsNow[k]; if (x.done && was && !was.done && !cur[x.qk].claimed) (fresh[x.qk] = fresh[x.qk] || []).push(x.g); });
    Object.keys(fresh).forEach(qk => {
      const qd = cur[qk], who = N().label(account), tier = tierName(qd.q.tier), dn = qd.goals.filter(g => done(g.progress, g.target)).length;
      const head = t('Done: {goals}.', { goals: fresh[qk].map(g => goalName(g, nameOf) + ' ' + fmtInt(g.target) + '/' + fmtInt(g.target)).join(', ') });
      const body = qd.done ? head + ' ' + t('The {tier} mission is complete: claim it in the Missões window.', { tier: tier })
        : head + ' ' + t('The {tier} mission: {d} of {all} goals done.', { tier: tier, d: dn, all: qd.goals.length });
      const sent = N().event(account, 'dailyQuest', qd.done ? t('{who}: daily mission completed', { who: who }) : t('{who}: daily mission goal done', { who: who }), body, 'dq:' + qk + ':' + dn);
      if (sent) stats.sent.dailyQuest++;
    });
  }
  a.dq = cur; a.dqGoals = goalsNow;
}

// ---------------------------------------------------------------------------------------------------------------- eggs
const FINISHED = /hatch|done|claim|collect|open/i;
function breeding(account, msg, nameOf) {
  if (!msg || !Array.isArray(msg.eggs)) return;
  stats.breeding++;
  const a = A(account), at = now(), keep = {};
  msg.eggs.slice(0, 12).forEach(e => {
    if (!e || typeof e !== 'object' || e.id === undefined || e.id === null) return;
    const id = String(e.id).slice(0, 40), old = a.eggs[id];
    let due = null;
    if (fin(e.readyAt) && e.readyAt > 1e12) due = e.readyAt;                     // a time in milliseconds
    else if (fin(e.readyAt) && e.readyAt > 1e9) due = e.readyAt * 1000;          // a time in seconds
    else if (fin(e.remainingMs)) due = at + Math.max(0, e.remainingMs);
    const finished = typeof e.status === 'string' && FINISHED.test(e.status) && !/ready/i.test(e.status);
    const readyNow = (typeof e.status === 'string' && /ready/i.test(e.status)) || (due !== null && due <= at);
    keep[id] = { due: due, species: fin(e.speciesId) && nameOf ? nameOf(e.speciesId) : '', shiny: e.shiny === true, finished: finished,
      told: old ? old.told : (!a.eggsSeen && readyNow) || finished };               // ready already when the app first sees the eggs: not announced
    if (keep[id].told !== true && readyNow && !finished) tellEgg(account, keep[id]);
  });
  a.eggs = keep; a.eggsSeen = true;
}
function tellEgg(account, egg) {
  egg.told = true;
  const who = N().label(account);
  const sent = N().event(account, 'eggReady', t('{who}: an egg is ready to hatch', { who: who }),
    (egg.species ? t('{name} is ready in the incubator.', { name: (egg.shiny ? '\u2726 ' : '') + egg.species }) : t('An egg is ready in the incubator.')), 'egg:' + Math.round(egg.due || 0));
  if (sent) stats.sent.eggReady++;
}
function tick() {
  const at = now();
  Object.keys(acc).forEach(n => { const a = acc[n]; Object.keys(a.eggs).forEach(id => { const e = a.eggs[id]; if (!e.told && !e.finished && e.due !== null && e.due <= at) tellEgg(Number(n), e); }); });
}

const fmtInt = v => { try { return i18n && i18n.int ? i18n.int(v) : Math.round(v).toLocaleString('en-US'); } catch (e) { return String(v); } };

// ---------------------------------------------------------------------------------------------------------------- the hunt timer (lang-43)
// "character" / "ready" carry character.travelReadyAt: when the account may travel to a hunt again (the timer on the game's Hunts button). It is passed to the
// window like the other numbers (the "stats" channel), so that "Back to last hunt" shows only once it has run out. Sent only when it changes.
let electron = null; try { electron = require('electron'); } catch (e) {}
const lastReady = {};
let toWindow = (account, data) => {
  try { const w = electron && electron.BrowserWindow ? electron.BrowserWindow.getAllWindows().filter(x => !x.isDestroyed())[0] : null; if (w) w.webContents.send('stats', account, data); } catch (e) {}
};
function huntTimer(account, msg) {
  const c = msg && msg.character;
  if (!c || typeof c !== 'object' || !('travelReadyAt' in c)) return;
  let at = c.travelReadyAt;
  at = fin(at) ? (at > 1e12 ? at : at > 1e9 ? at * 1000 : 0) : 0;                  // milliseconds (as the game sends it) or seconds; anything else: no timer
  if (lastReady[account] === at) return;
  lastReady[account] = at;
  toWindow(account, { huntReadyAt: at });
}

// lang-46: the entry penalty of the hunt session (session.entryPenaltyUntil), only noted for the report: is it the countdown of the game's Hunts button?
// ("Back to last hunt" waits for no timer since lang-46: travelReadyAt turned out to be something else, the game lets you travel at any time.)
const lastPenalty = {};
function huntPenalty(account, msg) {
  const s = msg && msg.session;
  if (!s || typeof s !== 'object' || !('entryPenaltyUntil' in s)) return;
  const v = s.entryPenaltyUntil;
  lastPenalty[account] = fin(v) ? (v > 1e12 ? v : v > 1e9 ? v * 1000 : 0) : 0;
}

// the reader gives every message of these kinds; anything else is ignored
function handle(account, type, msg, nameOf) {
  try { if (type === 'ready' || type === 'character') huntTimer(account, msg); else if (type === 'hunt-session') { huntPenalty(account, msg); return; } } catch (e) {}
  try {
    if (type === 'battle-pass') battlePass(account, msg, nameOf);
    else if (type === 'ready' || type === 'character') { dailyQuests(account, msg, nameOf); if (type === 'ready' && msg && msg.breeding) breeding(account, msg.breeding, nameOf); }
    else if (type === 'breeding') breeding(account, msg, nameOf);
  } catch (e) { try { require('./diag').error('missions', e); } catch (x) {} }
  if (!timer) { timer = setInterval(tick, 20000); if (timer.unref) timer.unref(); }
}

// for the report of the Diagnostics: how often the game sent each kind, and what is being watched (counts only)
function info() {
  const out = { messages: { battlePass: stats.battlePass, dailyQuests: stats.dailyQuests, breeding: stats.breeding }, sent: Object.assign({}, stats.sent), accounts: [] };
  Object.keys(acc).sort().forEach(n => {
    const a = acc[n], bp = a.bp ? Object.values(a.bp) : null, dq = a.dq ? Object.values(a.dq) : null, eggs = Object.values(a.eggs), at = now();
    out.accounts.push({ n: Number(n), bp: bp ? { missions: bp.length, done: bp.filter(x => x.done).length, ageSec: stats.lastBattlePassAt[n] ? Math.round((at - stats.lastBattlePassAt[n]) / 1000) : null } : null,
      dq: dq ? { quests: dq.length, done: dq.filter(x => x.done).length, claimed: dq.filter(x => x.claimed).length, ageSec: stats.lastDailyAt[n] ? Math.round((at - stats.lastDailyAt[n]) / 1000) : null } : null,
      huntReadyInSec: lastReady[n] === undefined ? undefined : lastReady[n] ? Math.max(0, Math.round((lastReady[n] - at) / 1000)) : null,
      penaltyInSec: lastPenalty[n] === undefined ? undefined : lastPenalty[n] ? Math.max(0, Math.round((lastPenalty[n] - at) / 1000)) : null,
      eggs: { count: eggs.length, readyInMin: eggs.filter(e => !e.finished && e.due !== null && e.due > at).map(e => Math.ceil((e.due - at) / 60000)).sort((x, y) => x - y), ready: eggs.filter(e => !e.finished && e.due !== null && e.due <= at).length } });
  });
  return out;
}

module.exports = { handle, info, tick, _setWindow: f => { toWindow = f; }, _reset: () => { Object.keys(acc).forEach(k => delete acc[k]); Object.keys(lastReady).forEach(k => delete lastReady[k]); Object.keys(lastPenalty).forEach(k => delete lastPenalty[k]); stats.battlePass = stats.dailyQuests = stats.breeding = 0; stats.sent = { battlePass: 0, dailyQuest: 0, eggReady: 0 }; stats.lastBattlePassAt = {}; stats.lastDailyAt = {}; if (timer) { clearInterval(timer); timer = null; } },
  _setNow: f => { now = f; }, _setNotify: n => { notify = n; } };
