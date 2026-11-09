const { contextBridge, ipcRenderer } = require('electron');

// Lets index.html receive the numbers that main.js sends, and nothing else
contextBridge.exposeInMainWorld('bridge', {
  diagGet: () => ipcRenderer.invoke('diag:get'),
  langGet: () => ipcRenderer.invoke('lang:get'),
  langSet: (l) => ipcRenderer.invoke('lang:set', l),
  notifyGet: () => ipcRenderer.invoke('notify:get'),
  notifySet: (p) => ipcRenderer.invoke('notify:set', p),
  notifyTest: () => ipcRenderer.invoke('notify:test'),
  startupGet: () => ipcRenderer.invoke('startup:get'),
  startupSet: (p) => ipcRenderer.invoke('startup:set', p),
  gpuGet: () => ipcRenderer.invoke('gpu:get'),
  gpuSet: (disable) => ipcRenderer.invoke('gpu:set', disable),
  lightGet: () => ipcRenderer.invoke('light:get'),                        // lang-70: Settings › Light mode
  lightSet: (on) => ipcRenderer.invoke('light:set', on),
  analyzerToggle: () => ipcRenderer.invoke('analyzer:toggle'),
  navGo: (what, n) => ipcRenderer.invoke('nav:go', what, n),
  navHunt: (n, hunt) => ipcRenderer.invoke('nav:hunt', n, hunt),
  economySet: (on) => ipcRenderer.invoke('economy:set', on),
  updateGet: () => ipcRenderer.invoke('update:get'),          // lang-58: this version, and whether a newer release is out
  updateOpen: () => ipcRenderer.invoke('update:open'),        // ...its page in the browser
  navFavs: (n) => ipcRenderer.invoke('nav:favs', n),
  navFavGo: (n, item) => ipcRenderer.invoke('nav:favgo', n, item),
  diagProbe: () => ipcRenderer.invoke('diag:probe-login'),
  diagSelfTest: () => ipcRenderer.invoke('diag:selftest'),
  settingsExport: (windowPart) => ipcRenderer.invoke('settings:export', windowPart),          // lang-67: settings backup
  settingsImport: () => ipcRenderer.invoke('settings:import'),          // lang-67: "Check the game" (looks only)
  diagCopy: (text) => ipcRenderer.invoke('diag:copy', text),
  diagSave: (text) => ipcRenderer.invoke('diag:save', text),
  accountsGet: () => ipcRenderer.invoke('accounts:get'),
  accountsSave: (payload) => ipcRenderer.invoke('accounts:save', payload),
  accountsClearCache: (n) => ipcRenderer.invoke('accounts:clear-cache', n),
  accountsLogin: (which) => ipcRenderer.invoke('accounts:login', which),
  getHistory: () => ipcRenderer.invoke('history:get'),
  exportCsv: (text, name) => ipcRenderer.invoke('history:export', text, name),
  onStats: (callback) => ipcRenderer.on('stats', (event, account, data) => callback(account, data))
});
