const { app, BrowserWindow, Tray, Menu, session } = require('electron');
app.setAppUserModelId('4horizon');      // its own identity for Windows: its own taskbar button and icon, and "4horizon" on the notifications

// GPU acceleration (Settings › Disable GPU acceleration): must be switched off BEFORE the app is ready, so gpu.js reads settings.json itself
// (settings.js is not started yet). Users with visual glitches (artifacts on hover/screenshot) can turn it off. It never throws.
try { require('./gpu').applyAtStart(app); } catch (e) { /* the graphics card simply stays on */ }
// lang-71: Settings › Streamer mode: the game screens keep moving behind other windows (Chromium's switches, also only before the app is ready)
try { require('./streamer').applyAtStart(app); } catch (e) { /* the game screens simply rest in the background, as before */ }
const path = require('path');

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

  // lang-71: Ctrl+B shows or hides the top bar, and F11 turns full screen on and off, wherever the keyboard is (the window, the Summary, a game screen).
  // Only these two keys are taken from the page. (F11 came with Electron's own menu, which is removed: see app.whenReady below.)
  const barKey = (event, input) => {
    if (!input || input.type !== 'keyDown' || input.alt || input.meta) return;
    if (input.control && !input.shift && String(input.key).toLowerCase() === 'b') {
      event.preventDefault();
      if (win && !win.isDestroyed()) win.webContents.send('bar', 'toggle');
    } else if (!input.control && !input.shift && input.key === 'F11') {
      event.preventDefault();
      if (win && !win.isDestroyed()) win.setFullScreen(!win.isFullScreen());
    }
  };
  win.webContents.on('before-input-event', barKey);

  // Every game panel: find which account it is (by its partition) and start reading its connection
  win.webContents.on('did-attach-webview', (event, guest) => {
    try { guest.on('before-input-event', barKey); } catch (e) {}
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
    { label: i18n.t('Show the top bar'), click: () => { if (!win || win.isDestroyed()) return; win.show(); win.focus(); win.webContents.send('bar', 'show'); } },      // lang-71: the way back when the top bar is hidden
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
  // lang-71: no File / Edit / View / Window menu. Its shortcuts went with it (Ctrl+R reloaded all four games at once, Ctrl+Shift+I, Ctrl+W, the zoom of the whole window);
  // F11 is kept by barKey above. Copy, paste, cut and select all in the game's fields are the browser's own and work without it.
  try { Menu.setApplicationMenu(null); } catch (e) {}
  loadSpecies();
  createWindow();
  createTray();
});

app.on('before-quit', () => { isQuitting = true; });





