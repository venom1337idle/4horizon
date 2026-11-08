const { app, BrowserWindow, Tray, Menu, session } = require('electron');
app.setAppUserModelId('4horizon');      // its own identity for Windows: its own taskbar button and icon, and "4horizon" on the notifications

// GPU acceleration: must be disabled BEFORE app is ready. The setting is read directly from the file because
// settings.js is not initialized yet. Users with visual glitches (artifacts on hover/screenshot) can turn this off.
const fs = require('fs');
const path = require('path');
try {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  if (settings && settings.disableGpu === true) {
    app.disableHardwareAcceleration();
    console.log('GPU acceleration disabled by user setting');
  }
} catch (e) { /* no settings file yet, or it doesn't have the setting: GPU stays on */ }

const diag = require('./diag');
const i18n = require('./i18n');
diag.init();                          // notes errors and log lines for the Diagnostics window; it only watches

// Only one copy of the app may run. A second one would fight the first over the game sessions (one login per account),
// the browser cache and the saved files, so it quits at once and the first window is brought to the front instead.
if (!app.requestSingleInstanceLock()) {
  console.log('4horizon is already running (look for it in the tray). Quit it from the tray first if you want to restart it.');
  app.exit(0);
  process.exit(0);
}
const notifier = require('./notify');
const { attachReader, loadItems, loadSpecies, loadHunts } = require('./ws-reader');

let win = null;
let tray = null;
let isQuitting = false;

// a second copy was started: show this window instead
app.on('second-instance', () => {
  try { diag.offerRestart(win); } catch (e) {}      // the app was updated while it was running: offer to restart it
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});

function createWindow() {
  win = new BrowserWindow({
    show: !process.argv.includes('--hidden'),      // started with the PC and hidden in the tray: no window at the start
    icon: path.join(__dirname, 'icon.ico'),
    width: 1400,
    height: 900,
    webPreferences: {
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.setIcon(path.join(__dirname, 'icon.ico'));      // the green bulb, also on the taskbar button

  // Every game panel: find which account it is (by its partition) and start reading its connection
  win.webContents.on('did-attach-webview', (event, guest) => {
    for (let n = 1; n <= 4; n++) {
      if (guest.session === session.fromPartition('persist:conta' + n)) {
        attachReader(guest, n, (account, data) => {
          if (win && !win.isDestroyed()) win.webContents.send('stats', account, data);
        });
      }
    }
  });

  win.loadFile('index.html');

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
}

function toggleWindow() {
  if (win.isVisible()) {
    win.hide();
  } else {
    win.show();
    win.focus();
  }
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'tray.png'));
  tray.setToolTip('4horizon');

  const trayTemplate = () => [
    { label: i18n.t('Show / Hide'), click: toggleWindow },
    { label: i18n.t('Notifications'), type: 'checkbox', checked: notifier.isEnabled(), click: item => notifier.setEnabled(item.checked) },
    { label: i18n.t('Send test notification'), click: () => notifier.test() },
    { label: i18n.t('Open notification settings'), click: () => notifier.openSettings() },
    { type: 'separator' },
    { label: i18n.t('Quit'), click: () => { isQuitting = true; app.quit(); } }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(trayTemplate()));
  i18n.onChange(() => { try { tray.setContextMenu(Menu.buildFromTemplate(trayTemplate())); } catch (e) {} });
  tray.on('click', toggleWindow);
}

app.whenReady().then(() => {
  loadSpecies();
  createWindow();
  createTray();
});

app.on('before-quit', () => { isQuitting = true; });





