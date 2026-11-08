// gpu.js: the graphics card (1.0.7).
//
// 1. Settings › "Disable GPU acceleration" (1.0.6). The choice is kept in settings.json ("disableGpu": true). Electron decides at the start whether the
//    graphics card is used, so main.js calls applyAtStart() before the app is ready, and a change made in Settings takes effect after a restart.
//    Only a real true turns it off: anything else (false, missing, a broken file, a text) leaves the graphics card on.
// 2. The Diagnostics report: which graphics cards the PC has (maker, name, driver version), which one Chromium uses, whether acceleration is on, and
//    whether a restart is still needed for a change. Nothing personal: these are the same facts as in the Windows "System" page.
// It never throws: the app starts the same way if anything here fails.

'use strict';
const fs = require('fs');
const path = require('path');
let electron = null;
try { electron = require('electron'); } catch (e) { electron = null; }

const VENDORS = { 0x10de: 'NVIDIA', 0x1002: 'AMD', 0x1022: 'AMD', 0x8086: 'Intel', 0x1414: 'Microsoft (software)', 0x5143: 'Qualcomm', 0x13b5: 'ARM', 0x106b: 'Apple' };
const MAX_DEVICES = 4;
const state = { disabledAtStart: false, devices: null, error: null, asked: false };

const appOf = a => a || (electron && electron.app) || null;
const hex4 = n => (typeof n === 'number' && isFinite(n) && n >= 0 ? '0x' + Math.floor(n).toString(16).padStart(4, '0') : null);
const text = (s, max) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, max) : null);

// is acceleration switched off in settings.json of this user-data folder? (only "disableGpu": true counts)
function wantedIn(dir) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'));
    return !!(s && typeof s === 'object' && !Array.isArray(s) && s.disableGpu === true);
  } catch (e) { return false; }
}
function wantedNow(app) { try { return wantedIn(appOf(app).getPath('userData')); } catch (e) { return null; } }

// main.js: first thing, before the app is ready (later it would have no effect)
function applyAtStart(app) {
  app = appOf(app);
  if (!app) return false;
  if (wantedNow(app) === true) {
    try { app.disableHardwareAcceleration(); state.disabledAtStart = true; console.log('GPU acceleration disabled by user setting'); } catch (e) { state.disabledAtStart = false; }
  }
  return state.disabledAtStart;
}

// Electron's list of graphics cards -> { vendor, name, driver, active } (never more than 4, never anything but these short texts)
function devicesOf(info) {
  const list = info && Array.isArray(info.gpuDevice) ? info.gpuDevice : [];
  return list.filter(d => d && typeof d === 'object').slice(0, MAX_DEVICES).map(d => ({
    vendor: VENDORS[d.vendorId] || hex4(d.vendorId) || '?',
    deviceId: hex4(d.deviceId),
    name: text(d.deviceString, 80),
    driver: text(d.driverVersion, 40),
    active: d.active === true
  }));
}
// Chromium's own words per feature ("enabled", "disabled_software", "unavailable_off"...): only short texts are kept
function featuresOf(st) {
  const out = {};
  if (!st || typeof st !== 'object') return out;
  Object.keys(st).slice(0, 30).forEach(k => { const v = st[k]; if (typeof v === 'string' && /^[\w.-]{1,40}$/.test(k)) out[k] = v.slice(0, 40); });
  return out;
}

// once, after the app is ready: the list of graphics cards (Electron gives it asynchronously; the report reads what was found)
async function readDevices(app) {
  app = appOf(app);
  state.asked = true;
  try {
    const info = await app.getGPUInfo('basic');
    state.devices = devicesOf(info); state.error = null;
  } catch (e) { state.devices = null; state.error = String((e && e.message) || e).slice(0, 120); }
  return state.devices;
}

// for the report
function info(app) {
  app = appOf(app);
  let features = null;
  try { if (app && (!app.isReady || app.isReady())) features = featuresOf(app.getGPUFeatureStatus()); } catch (e) { features = null; }
  const wanted = wantedNow(app);
  return {
    disabledAtStart: state.disabledAtStart,
    disabledInSettings: wanted,
    restartNeeded: wanted !== null && wanted !== state.disabledAtStart,
    devices: state.devices,
    error: state.error,
    asked: state.asked,
    features: features
  };
}

// the two questions of the Settings window (only the app's own window may ask: a game panel gets nothing)
let started = false;
function init() {
  if (started) return;
  started = true;
  const app = appOf();
  try { if (app && app.whenReady) app.whenReady().then(() => readDevices(app)).catch(() => {}); } catch (e) {}
  if (!electron || !electron.ipcMain) return;
  const S = require('./settings');
  electron.ipcMain.handle('gpu:get', e => {
    if (!S.fromOurWindow(e)) return null;
    return { disableGpu: wantedNow() === true, disabledAtStart: state.disabledAtStart };
  });
  electron.ipcMain.handle('gpu:set', (e, disable) => {
    if (!S.fromOurWindow(e)) return null;
    const s = S.read();
    s.disableGpu = disable === true;
    const ok = S.write(s);
    return { disableGpu: s.disableGpu, saved: ok, needsRestart: s.disableGpu !== state.disabledAtStart };
  });
}

module.exports = { applyAtStart, init, info, readDevices, devicesOf, featuresOf, wantedIn, VENDORS, _state: state, _reset: () => { state.disabledAtStart = false; state.devices = null; state.error = null; state.asked = false; } };
