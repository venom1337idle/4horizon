const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const lines = []; const realLog = console.log; console.log = function () { lines.push(Array.from(arguments).join(' ')); };
const timers = []; const realSetTimeout = global.setTimeout; global.setTimeout = (f, ms) => { timers.push({ f, ms }); return 0; };
const runTimers = () => { const t = timers.splice(0); t.forEach(x => x.f()); return t.length; };
const { attachReader } = require('./ws-reader');
function panel(over) {
  const w = { cmds: [], attaches: 0, attached: true, destroyed: false, dbgHandlers: {}, wcHandlers: {}, failAttach: false };
  w.wc = {
    debugger: { attach() { if (w.failAttach) throw new Error('target gone'); w.attaches++; w.attached = true; }, isAttached: () => w.attached, sendCommand: async c => { w.cmds.push(c); },
                on(e, f) { (w.dbgHandlers[e] = w.dbgHandlers[e] || []).push(f); } },
    isDestroyed: () => w.destroyed, once() {}, on(e, f) { (w.wcHandlers[e] = w.wcHandlers[e] || []).push(f); }, executeJavaScript: async () => ''
  };
  Object.assign(w.wc, over || {});
  return w;
}
const sent = [];
const w = panel(); attachReader(w.wc, 7, (a, d) => sent.push(d));
const enables = () => w.cmds.filter(c => c === 'Network.enable').length;
ok('on attach: the debugger is attached once (at the start) and the network is switched on once', w.attaches === 1 && enables() === 1, [w.attaches, w.cmds]);
const base = w.attaches;
ok('exactly ONE listener for game messages and ONE for "detach" (no duplicates)', w.dbgHandlers.message.length === 1 && w.dbgHandlers.detach.length === 1);
ok('the reader listens to the three page events', ['did-navigate', 'did-navigate-in-page', 'did-finish-load'].every(e => (w.wcHandlers[e] || []).length === 1), Object.keys(w.wcHandlers));
['did-navigate', 'did-navigate-in-page', 'did-finish-load'].forEach((e, i) => { w.wcHandlers[e][0](); ok('after "' + e + '" the network is switched on again (total ' + (i + 2) + ')', enables() === i + 2, enables()); });
// a game message still arrives after all of that
const frame = o => w.dbgHandlers.message[0]({}, 'Network.webSocketFrameReceived', { response: { payloadData: JSON.stringify(o) } });
frame({ type: 'character', character: { name: 'x', level: 5, activePokemonId: 1 } });
ok('game messages are still read after the page changes', sent.some(d => d.level === 5), sent.length);

// ---- the game connection: created / closed events reach the diagnostics, the rest of the reader is not disturbed
const dg = require('./diag');
ok('before any connection event, the state of panel 7 is not known', dg.socketOpen(7) === null);
w.dbgHandlers.message[0]({}, 'Network.webSocketCreated', { requestId: 'q1', url: 'wss://pokehorizonidle.com/ws' });
ok('the game connection is created: panel 7 is open', dg.socketOpen(7) === true);
w.dbgHandlers.message[0]({}, 'Network.webSocketCreated', { requestId: 'q2', url: 'wss://tracker.example.net/x' }); w.dbgHandlers.message[0]({}, 'Network.webSocketClosed', { requestId: 'q2' });
ok('another site\u2019s connection opening and closing changes nothing', dg.socketOpen(7) === true);
const sentBefore = sent.length;
w.dbgHandlers.message[0]({}, 'Network.webSocketClosed', { requestId: 'q1' });
ok('the game connection closes (signing out): panel 7 is closed, immediately', dg.socketOpen(7) === false);
ok('connection events are not treated as game messages (nothing was sent on)', sent.length === sentBefore);
w.dbgHandlers.message[0]({}, 'Network.webSocketCreated', { requestId: 'q3', url: 'wss://pokehorizonidle.com/ws' });
frame({ type: 'character', character: { name: 'x', level: 9, activePokemonId: 1 } });
ok('signing in again opens a new connection, and game messages are read as before (level 9 arrives)', dg.socketOpen(7) === true && sent.some(d => d.level === 9));
let thr = null; try { w.dbgHandlers.message[0]({}, 'Network.webSocketCreated', undefined); w.dbgHandlers.message[0]({}, 'Network.webSocketClosed', {}); w.dbgHandlers.message[0]({}, 'Network.webSocketCreated', { requestId: 5, url: 12 }); } catch (e) { thr = e.message; }
ok('connection events with missing or odd parameters never break the reader', !thr, thr);

// the debugger lets go
w.attached = false; lines.length = 0;
w.dbgHandlers.detach[0]({}, 'target closed');
ok('a detach is noted ("the reader was detached (target closed)") and a re-attach is planned in 1 s, not at once', lines.some(l => /Account 7: the reader was detached \(target closed\)/.test(l)) && timers.length === 1 && timers[0].ms === 1000 && w.attaches === base, [lines, timers.length]);
const before = enables(); runTimers();
ok('after the second the debugger is attached again, the network switched on again, and it is said', w.attaches === base + 1 && enables() === before + 1 && lines.some(l => /Account 7: reader attached again/.test(l)), [w.attaches, lines]);
frame({ type: 'character', character: { name: 'x', level: 6, activePokemonId: 1 } });
ok('...and the SAME message listener keeps working (level 6 arrives)', sent.some(d => d.level === 6) && w.dbgHandlers.message.length === 1);

// someone else already re-attached it
w.attached = true; w.dbgHandlers.detach[0]({}, 'replaced'); const a0 = w.attaches; runTimers();
ok('if it is already attached again by then, it does not attach a second time (but listens again)', w.attaches === a0 && lines.filter(l => /reader attached again/.test(l)).length === 2, [w.attaches, a0]);
// the panel is gone
w.destroyed = true; timers.length = 0; w.attached = false; w.dbgHandlers.detach[0]({}, 'target closed'); const n0 = w.attaches;
ok('a panel that was destroyed is left alone: nothing is planned, nothing attached', timers.length === 0 && w.attaches === n0);
// destroyed during the wait
const w2 = panel(); attachReader(w2.wc, 8, () => {}); const b2 = w2.attaches; w2.attached = false; w2.dbgHandlers.detach[0]({}, 'x'); w2.destroyed = true; lines.length = 0; runTimers();
ok('a panel destroyed DURING the second of waiting is left alone too', w2.attaches === b2 && !lines.some(l => /attached again/.test(l)));
// attaching fails
const w3 = panel(); attachReader(w3.wc, 9, () => {}); w3.attached = false; w3.failAttach = true; w3.dbgHandlers.detach[0]({}, 'x'); lines.length = 0; let threw = null;
try { runTimers(); } catch (e) { threw = e.message; }
ok('if attaching fails the reason is logged and nothing escapes: "could not attach again (target gone)"', !threw && lines.some(l => /Account 9: could not attach again \(target gone\)/.test(l)), [threw, lines]);

// an older panel object without "on" or "isAttached" must not break the reader
const w4 = panel({ on: undefined }); delete w4.wc.on; let t4 = null; try { attachReader(w4.wc, 4, () => {}); } catch (e) { t4 = e.message; }
ok('a panel object that has no page events is still read (the page-event part is skipped quietly)', !t4 && w4.dbgHandlers.message.length === 1, t4);
const w5 = panel(); delete w5.wc.debugger.isAttached; attachReader(w5.wc, 5, () => {}); w5.dbgHandlers.detach[0]({}, 'x'); lines.length = 0; let t5 = null; try { runTimers(); } catch (e) { t5 = e.message; }
ok('...and one without isAttached() fails softly in the re-attach, with a log line', !t5 && lines.some(l => /could not attach again/.test(l)), [t5, lines]);
global.setTimeout = realSetTimeout; console.log = realLog;
out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
