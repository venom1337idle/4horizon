// run-gpu.js: gpu.js (1.0.7): Settings › "Disable GPU acceleration" (1.0.6) and the graphics cards in the Diagnostics report.
// The switch must be read BEFORE the app is ready (Electron decides then whether the graphics card is used), only a real true turns it off,
// and nothing here may ever stop the app from starting.
const fs = require('fs'), path = require('path'), os = require('os');
process.env.HG_USERDATA = fs.mkdtempSync(path.join(os.tmpdir(), '4h-gpu-'));          // a user-data folder of its own (the other suites keep theirs)
const electron = require('electron');
const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const UD = electron._USERDATA, SF = path.join(UD, 'settings.json'), calls = electron._calls, fake = electron._gpu;
const G = require('./gpu');
const setFile = t => { if (t === null) { try { fs.unlinkSync(SF); } catch (e) {} } else fs.writeFileSync(SF, t); };
const fresh = () => { G._reset(); calls.disableGpu = 0; fake.throwOnDisable = false; };
const quiet = f => { const l = console.log; console.log = () => {}; try { return f(); } finally { console.log = l; } };      // (applyAtStart prints one line, as main.js did)

(async () => {
  // ---- 1. the switch, read at the start
  fresh(); setFile(null);
  ok('no settings.json yet (a new install): the graphics card stays on', quiet(() => G.applyAtStart()) === false && calls.disableGpu === 0, calls);
  fresh(); setFile(JSON.stringify({ lang: 'pt-BR', disableGpu: true }));
  ok('"disableGpu": true: acceleration is switched off, exactly once', quiet(() => G.applyAtStart()) === true && calls.disableGpu === 1 && G._state.disabledAtStart === true, calls);
  [['false', { disableGpu: false }], ['missing', { lang: 'en' }], ['the text "true"', { disableGpu: 'true' }], ['the number 1', { disableGpu: 1 }], ['a list', [true]], ['null', null]].forEach(([what, v]) => {
    fresh(); setFile(JSON.stringify(v));
    ok('"disableGpu" ' + what + ': the graphics card stays on (only a real true turns it off)', quiet(() => G.applyAtStart()) === false && calls.disableGpu === 0, calls);
  });
  fresh(); setFile('{ "disableGpu": tru');
  let threw = null; try { ok('a broken settings.json: the graphics card stays on, nothing is thrown', quiet(() => G.applyAtStart()) === false && calls.disableGpu === 0); } catch (e) { threw = e.message; }
  ok('...and it did not throw', threw === null, threw);
  fresh(); setFile(JSON.stringify({ disableGpu: true })); fake.throwOnDisable = true;
  threw = null; let r = null; try { r = quiet(() => G.applyAtStart()); } catch (e) { threw = e.message; }
  ok('if Electron refuses (called too late), the app still starts: no throw, and it is not reported as off', threw === null && r === false && G._state.disabledAtStart === false, [threw, r]);
  fresh();
  threw = null; try { G.applyAtStart({ getPath() { throw new Error('no folder'); } }); G.applyAtStart(null); } catch (e) { threw = e.message; }
  ok('an app without a user-data folder, or no app at all: no throw', threw === null, threw);

  // ---- 2. main.js calls it first, before anything else is started
  const mainJs = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  const at = mainJs.indexOf("require('./gpu').applyAtStart(app)");
  ok('main.js asks gpu.js at the start', at > 0, at);
  ok('...before the diagnostics start, before the single-copy check and before the app is ready', at < mainJs.indexOf('diag.init()') && at < mainJs.indexOf('requestSingleInstanceLock') && at < mainJs.indexOf('app.whenReady()'), [at, mainJs.indexOf('diag.init()')]);
  ok('...inside a try, so a problem there never stops the app', /try \{ require\('\.\/gpu'\)\.applyAtStart\(app\); \} catch/.test(mainJs));
  ok('main.js does not switch the graphics card off by itself any more (only gpu.js does)', mainJs.indexOf('disableHardwareAcceleration') < 0);
  ok('main.js has no second "const path" (it crashed at the start once)', (mainJs.match(/const path = require\('path'\)/g) || []).length === 1);

  // ---- 3. the two questions of the Settings window
  fresh(); setFile(JSON.stringify({ lang: 'pt-BR', minimizeToTray: true }));
  const S = require('./settings'); S.init();
  G.init(); G.init();                                                                       // twice: Electron throws on a second handler, so it must not register twice
  const H = electron._handlers, ours = { sender: electron._WINDOW }, other = { sender: { id: 'a game page' } };
  ok('gpu:get and gpu:set are answered (by gpu.js)', typeof H['gpu:get'] === 'function' && typeof H['gpu:set'] === 'function', Object.keys(H));
  ok('settings.js no longer answers them too (two answers for one question would throw in Electron)', fs.readFileSync(path.join(__dirname, 'settings.js'), 'utf8').indexOf("handle('gpu:") < 0);
  const pre = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
  ok('the window can ask both (preload.js: gpuGet / gpuSet)', /gpuGet:.*invoke\('gpu:get'\)/.test(pre) && /gpuSet:.*invoke\('gpu:set'/.test(pre));
  ok('gpu:get: off by default', JSON.stringify(H['gpu:get'](ours)) === JSON.stringify({ disableGpu: false, disabledAtStart: false }), H['gpu:get'](ours));
  const s1 = H['gpu:set'](ours, true), f1 = JSON.parse(fs.readFileSync(SF, 'utf8'));
  ok('gpu:set true: saved in settings.json, and a restart is needed (it was on at the start)', s1.saved === true && s1.disableGpu === true && s1.needsRestart === true && f1.disableGpu === true, [s1, f1]);
  ok('...the other settings in the file are kept (language, minimize to tray)', f1.lang === 'pt-BR' && f1.minimizeToTray === true, f1);
  ok('gpu:get now says it is off', H['gpu:get'](ours).disableGpu === true);
  const s2 = H['gpu:set'](ours, false);
  ok('gpu:set false: back on, and no restart is needed (it is as at the start again)', s2.disableGpu === false && s2.needsRestart === false && JSON.parse(fs.readFileSync(SF, 'utf8')).disableGpu === false, s2);
  ok('gpu:set with anything but true (the text "yes", 1, nothing) means on', ['yes', 1, undefined, {}].every(v => H['gpu:set'](ours, v).disableGpu === false));
  const before = fs.readFileSync(SF, 'utf8');
  ok('a game page gets nothing from gpu:get and cannot change gpu:set', H['gpu:get'](other) === null && H['gpu:set'](other, true) === null && fs.readFileSync(SF, 'utf8') === before);

  // ---- 4. the graphics cards (Electron's own list)
  const LAPTOP = { gpuDevice: [
    { vendorId: 0x10de, deviceId: 0x2d58, deviceString: 'NVIDIA GeForce RTX 5070 Laptop GPU', driverVersion: '32.0.15.6214', active: true, secret: 'x' },
    { vendorId: 0x1002, deviceId: 0x13c0, deviceString: 'AMD Radeon(TM) 610M', driverVersion: '31.0.24033.1003', active: false } ] };
  const d = G.devicesOf(LAPTOP);
  ok('two graphics cards (the laptop of a user: NVIDIA + AMD): maker, name, driver, which one is in use', d.length === 2 && d[0].vendor === 'NVIDIA' && d[0].name === 'NVIDIA GeForce RTX 5070 Laptop GPU' && d[0].driver === '32.0.15.6214' && d[0].active === true && d[1].vendor === 'AMD' && d[1].active === false && d[0].deviceId === '0x2d58', d);
  ok('...only those fields are kept (nothing else Electron sends)', Object.keys(d[0]).sort().join() === 'active,deviceId,driver,name,vendor', Object.keys(d[0]));
  ok('a maker that is not known is shown by its number', G.devicesOf({ gpuDevice: [{ vendorId: 0xabcd }] })[0].vendor === '0xabcd');
  ok('Intel and the Windows software card are named', G.devicesOf({ gpuDevice: [{ vendorId: 0x8086 }, { vendorId: 0x1414 }] }).map(x => x.vendor).join() === 'Intel,Microsoft (software)');
  const many = G.devicesOf({ gpuDevice: Array.from({ length: 10 }, (_, i) => ({ vendorId: 0x10de, deviceString: 'x'.repeat(500), driverVersion: 'y'.repeat(500), active: i === 0 })) });
  ok('never more than 4 cards, a name of at most 80 characters, a driver of at most 40', many.length === 4 && many.every(x => x.name.length <= 80 && x.driver.length <= 40), [many.length, many[0].name.length]);
  threw = null; try { [undefined, null, 5, 'x', {}, { gpuDevice: 'x' }, { gpuDevice: [null, 5, 'a', {}] }].forEach(v => G.devicesOf(v)); } catch (e) { threw = e.message; }
  ok('odd answers from Electron never throw', threw === null && G.devicesOf({ gpuDevice: [null, 5, 'a', {}] }).length === 1, threw);
  ok('Chromium\u2019s feature states: only short texts are kept', JSON.stringify(G.featuresOf({ gpu_compositing: 'enabled', rasterization: 'disabled_software', webgl: 'enabled', n: 5, 'bad key!': 'x' })) === JSON.stringify({ gpu_compositing: 'enabled', rasterization: 'disabled_software', webgl: 'enabled' }));
  G._reset(); fake.info = () => Promise.resolve(LAPTOP);
  ok('before the list is read, the report says so', G.info().devices === null && G.info().asked === false);
  await G.readDevices();
  ok('after the app is ready, the list is read once and kept for the report', G.info().devices.length === 2 && G.info().asked === true && G.info().error === null, G.info());
  fake.info = () => Promise.reject(new Error('GPU process unavailable'));
  await G.readDevices();
  ok('if Electron cannot say (acceleration off, no GPU process), the report gets the reason instead of a list', G.info().devices === null && /GPU process unavailable/.test(G.info().error), G.info());
  fake.status = { gpu_compositing: 'disabled_software', rasterization: 'disabled_software', webgl: 'unavailable_off' };
  ok('the report has Chromium\u2019s states (here: everything drawn by the processor)', G.info().features.gpu_compositing === 'disabled_software', G.info().features);

  // ---- 5. on or off, and is a restart needed?
  fresh(); setFile(JSON.stringify({ disableGpu: true })); quiet(() => G.applyAtStart());
  ok('off at the start and still off in Settings: off, no restart needed', G.info().disabledAtStart === true && G.info().disabledInSettings === true && G.info().restartNeeded === false, G.info());
  setFile(JSON.stringify({ disableGpu: false }));
  ok('off at the start, switched on in Settings since: the report says a restart is needed', G.info().disabledAtStart === true && G.info().restartNeeded === true, G.info());

  // ---- 6. in the Diagnostics report
  fresh(); fake.info = () => Promise.resolve(LAPTOP); await G.readDevices(); fake.status = { gpu_compositing: 'enabled', rasterization: 'enabled', webgl: 'enabled' }; setFile(JSON.stringify({}));
  const diag = require('./diag'), c = diag.collect();
  ok('the report data has a "gpu" part', c.gpu && Array.isArray(c.gpu.devices) && c.gpu.devices.length === 2 && c.gpu.disabledAtStart === false, c.gpu);
  ok('...and gpu.js is one of the parts and watched files of the report', c.features.some(f => f.file === 'gpu.js' && f.ok === true) && c.files.some(f => f.name === 'gpu.js'), c.features.filter(f => f.file === 'gpu.js'));
  const core = require('./diag-core');
  const text = core.analyse({ main: c, dash: null, ui: null, hideNames: true }).report;
  const line = (text.split('\n').find(l => /^Graphics: /.test(l)) || '');
  ok('the report text has one "Graphics" line, right after the "Build" line', /\nBuild: [^\n]*\nGraphics: /.test(text), line);
  ok('...with acceleration ON, both cards, their drivers, and which one is in use', line.indexOf('acceleration ON') >= 0 && line.indexOf('NVIDIA GeForce RTX 5070 Laptop GPU, driver 32.0.15.6214, IN USE') >= 0 && line.indexOf('AMD Radeon(TM) 610M, driver 31.0.24033.1003') >= 0 && line.indexOf('610M, driver 31.0.24033.1003, IN USE') < 0 && line.indexOf('compositing enabled') >= 0, line);
  const L = core._gpuLine;
  ok('acceleration off: the line says where it was switched off', /^Graphics: acceleration OFF \(Settings \u203a Disable GPU acceleration\)/.test(L({ disabledAtStart: true, devices: [] , asked: true })));
  ok('changed in Settings but not restarted yet: the line says so', /restart 4horizon to apply it/.test(L({ disabledAtStart: false, restartNeeded: true })));
  ok('no list: the reason, "none reported", or "not read yet"', /cards: not known \(boom\)/.test(L({ error: 'boom' })) && /cards: none reported/.test(L({ asked: true, devices: [] })) && /cards: not read yet/.test(L({})));
  ok('a card without a name is shown by maker and number', /AMD 0x13c0/.test(L({ devices: [{ vendor: 'AMD', deviceId: '0x13c0' }] })));
  ok('the maker is added only when the name does not already say it (no "Microsoft Basic Render Driver (Microsoft (software))")', L({ devices: [{ vendor: 'Microsoft (software)', name: 'Microsoft Basic Render Driver', driver: '10.0' }] }).indexOf('Microsoft Basic Render Driver, driver 10.0') >= 0 && /Radeon 610M \(AMD\)/.test(L({ devices: [{ vendor: 'AMD', name: 'Radeon 610M' }] })));
  ok('an old main process without the "gpu" part: no Graphics line, nothing breaks', core.analyse({ main: Object.assign({}, c, { gpu: undefined }), dash: null, ui: null, hideNames: true }).report.indexOf('\nGraphics: ') < 0);

  try { fs.rmSync(UD, { recursive: true, force: true }); } catch (e) {}
  out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { out('FAILED ' + (e && e.stack || e)); process.exit(1); });
