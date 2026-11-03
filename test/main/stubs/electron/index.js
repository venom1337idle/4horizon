const path = require('path'), os = require('os'), fs = require('fs');
const USERDATA = process.env.HG_USERDATA || path.join(os.tmpdir(), 'hg-userdata-test');
fs.mkdirSync(USERDATA, { recursive: true });
const handlers = {}, appHandlers = {}, clip = { text: null }, dlg = { result: { canceled: false, filePath: path.join(USERDATA, 'saved-report.txt') }, calls: 0, box: { response: 0 }, boxCalls: [], boxReject: false };
const calls = { relaunch: 0, quit: 0 };
const SESS = {};
const WINDOW_SENDER = { id: 'ours' };
module.exports = {
  app: { getPath: () => USERDATA, getName: () => '4horizon', getVersion: () => '1.0.0', getLocale: () => 'pt-BR', isPackaged: false, whenReady: () => ({ then: () => ({ catch() {} }) }),
         on: (e, f) => { (appHandlers[e] = appHandlers[e] || []).push(f); }, requestSingleInstanceLock: () => true, exit() {}, relaunch() { calls.relaunch++; }, quit() { calls.quit++; } },
  ipcMain: { handle: (c, f) => { handlers[c] = f; } },
  BrowserWindow: { fromWebContents: s => (s === WINDOW_SENDER ? {} : null), getAllWindows: () => [] },
  clipboard: { writeText: t => { clip.text = t; } },
  dialog: { showSaveDialog: async () => { dlg.calls++; return dlg.result; }, showMessageBox: function () { dlg.boxCalls.push(Array.from(arguments)); if (dlg.boxReject) return Promise.reject(new Error('dialog failed')); return Promise.resolve(dlg.box); } },
  safeStorage: { isEncryptionAvailable: () => true, encryptString: t => Buffer.from('S:' + t), decryptString: b => String(b).replace(/^S:/, '') },          // (like an Electron before the async functions)
  shell: { openExternal: url => { (global.__OPENED = global.__OPENED || []).push(url); return Promise.resolve(); } },
  session: { fromPartition: p => SESS[p] || (SESS[p] = { p }) },
  webContents: { getAllWebContents: () => global.__PANELS || [] },
  Notification: class { static isSupported() { return false; } },
  _calls: calls, _SESS: SESS, _handlers: handlers, _app: appHandlers, _clip: clip, _dlg: dlg, _WINDOW: WINDOW_SENDER, _USERDATA: USERDATA
};
