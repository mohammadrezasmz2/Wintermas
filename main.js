import { app, BrowserWindow, Menu, Tray, nativeImage, screen, ipcMain, powerMonitor, globalShortcut, shell } from 'electron';
import { createDiagnostics } from './diagnostics.js';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const defaults = { enabled: false, intensity: 65, wind: 15, snowSpeed: 100, rainSpeed: 100, taskbar: true, paused: true, startup: false, weather: 'snow' };
const collapsed = { width: 96, height: 54 };
const expanded = { width: 342, height: 735 };
const appPath = app.getAppPath();
const native = join(appPath.endsWith('.asar') ? process.resourcesPath : appPath, 'native', 'desktop.exe');

let settings = { ...defaults };
let panel, tray, worker, retry, settingsFile;
let trayHintShown = false;
let quitting = false, locked = false, tracking = false;
let save = Promise.resolve();
const overlays = new Map();
const packagedEntry = process.defaultApp ? [app.getAppPath(), '--quiet'] : ['--quiet'];
const weathers = ['snow', 'rain'];
let displayCache;
const diagnostics = createDiagnostics(app);
// Chromium may treat a click-through overlay as occluded and pause its frames; keep it rendering.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

function send(win, channel, value) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, value);
}

function trayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Wintermas', click: showPanel },
    { label: settings.enabled ? 'Turn Christmas mode off' : 'Turn Christmas mode on', click: () => {
      update({ enabled: !settings.enabled }).catch(console.error);
    } },
    { label: 'Turn ' + (settings.weather === 'rain' ? 'rainfall' : 'snowfall') +
      (settings.paused ? ' on' : ' off'), enabled: settings.enabled, click: () => {
      update({ paused: !settings.paused }).catch(console.error);
    } },
    { label: 'Weather', enabled: settings.enabled, submenu: [
      { label: 'Snow', type: 'radio', checked: settings.weather !== 'rain', click: () => update({ weather: 'snow' }).catch(console.error) },
      { label: 'Rain', type: 'radio', checked: settings.weather === 'rain', click: () => update({ weather: 'rain' }).catch(console.error) },
    ] },
    { type: 'separator' },
    { label: 'Open diagnostic log', click: () => { shell.openPath(diagnostics.file).catch(console.error); } },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

// The panel is a flyout above the tray icon: nothing stays pinned on the desktop.
let panelHiddenAt = 0, panelPinned = false, showWhenSized = false;

function placeFlyout() {
  const { width, height } = panel.getBounds();
  const icon = tray.getBounds();
  const anchor = icon.width > 0 ? { x: icon.x + icon.width / 2, y: icon.y + icon.height / 2 } : screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint({ x: Math.round(anchor.x), y: Math.round(anchor.y) });
  const area = display.workArea, full = display.bounds, gap = 8;
  const clampX = x => Math.round(Math.max(area.x + gap, Math.min(x, area.x + area.width - width - gap)));
  const clampY = y => Math.round(Math.max(area.y + gap, Math.min(y, area.y + area.height - height - gap)));
  let x = clampX(anchor.x - width / 2), y = area.y + area.height - height - gap;
  if (area.y > full.y) y = area.y + gap;
  else if (area.x > full.x) { x = area.x + gap; y = clampY(anchor.y - height / 2); }
  else if (area.width < full.width) { x = area.x + area.width - width - gap; y = clampY(anchor.y - height / 2); }
  panel.setPosition(x, Math.round(y));
}

function showPanel() {
  placeFlyout();
  panel.show();
  panel.focus();
}

function togglePanel() {
  if (panel.isVisible()) hidePanel();
  // A click on the tray icon first blurs (and hides) the open flyout; don't reopen it at once.
  else if (Date.now() - panelHiddenAt > 300) showPanel();
}

function hidePanel() {
  if (!panel.isVisible()) return;
  panel.hide();
  panelHiddenAt = Date.now();
  if (trayHintShown) return;
  trayHintShown = true;
  tray.displayBalloon({
    title: 'Wintermas is still running',
    content: 'Click the Wintermas icon near the clock to open it again.',
    iconType: 'custom',
    noSound: true,
  });
  // Saving the settings marks the first run as done, so the hint is not repeated.
  save = save.catch(() => {}).then(() => writeFile(settingsFile, JSON.stringify(settings, null, 2))).catch(() => {});
}

function sizeWidget(open, contentHeight) {
  const area = screen.getDisplayMatching(panel.getBounds()).workArea;
  const { width, height: desiredHeight } = expanded;
  const requested = Number.isFinite(contentHeight) ? Math.max(160, Math.min(desiredHeight, Math.ceil(contentHeight))) : desiredHeight;
  panel.setSize(width, Math.min(requested, area.height - 16));
  placeFlyout();
  if (showWhenSized && Number.isFinite(contentHeight)) {
    showWhenSized = false;
    showPanel();
  }
}

function refreshOverlays() {
  displayCache = undefined;
  const displays = screen.getAllDisplays();
  const ids = new Set(displays.map(display => display.id));
  for (const [id, win] of overlays) {
    if (!ids.has(id)) {
      overlays.delete(id);
      win.destroy();
    }
  }
  for (const display of displays) {
    if (overlays.has(display.id)) {
      overlays.get(display.id).setBounds(display.bounds);
      continue;
    }
    if (!settings.enabled || locked) continue;
    const win = new BrowserWindow({
      ...display.bounds, transparent: true, frame: false, focusable: false, skipTaskbar: true,
      hasShadow: false, resizable: false, movable: false, show: false, fullscreenable: false,
      webPreferences: {
        preload: join(app.getAppPath(), 'preload.cjs'), backgroundThrottling: false,
      },
    });
    overlays.set(display.id, win);
    diagnostics.watch(win.webContents, 'overlay:' + display.id);
    diagnostics.write('info', 'overlay', 'created', { display: display.id, bounds: display.bounds,
      scale: display.scaleFactor, hz: display.displayFrequency });
    win.setAlwaysOnTop(true, 'pop-up-menu');
    win.setIgnoreMouseEvents(true);
    win.webContents.on('did-finish-load', () => {
      send(win, 'settings:changed', settings);
      if (settings.enabled && !locked) win.showInactive();
    });
    win.loadFile('ui/overlay.html').catch(console.error);
  }
}

function syncRuntime() {
  clearTimeout(retry);
  if (settings.enabled && !locked) {
    refreshOverlays();
    if (!worker) startTracking();
  } else {
    if (worker && !worker.stdin.destroyed && !worker.stdin.writableEnded) worker.stdin.end();
  }
  syncVisibility();
}

function syncVisibility() {
  for (const win of overlays.values()) {
    if (locked || !settings.enabled) {
      win.setIgnoreMouseEvents(true);
      win.hide();
    }
    else if (!win.webContents.isLoading() && !win.isVisible()) win.showInactive();
  }
}

async function update(patch) {
  if (!patch || typeof patch !== 'object') return settings;
  for (const key of ['intensity', 'wind', 'snowSpeed', 'rainSpeed']) {
    if (!Number.isFinite(patch[key])) continue;
    const min = key === 'wind' ? -100 : key.endsWith('Speed') ? 25 : 0;
    const max = key.endsWith('Speed') ? 250 : 100;
    settings[key] = Math.max(min, Math.min(max, patch[key]));
  }
  for (const key of ['enabled', 'paused', 'taskbar', 'startup']) {
    if (typeof patch[key] === 'boolean') settings[key] = patch[key];
  }
  if (weathers.includes(patch.weather)) settings.weather = patch.weather;
  diagnostics.write('info', 'settings', 'changed', patch);
  if ('startup' in patch) {
    app.setLoginItemSettings({
      openAtLogin: settings.startup,
      args: packagedEntry,
      path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
    });
  }
  const snapshot = { ...settings };
  send(panel, 'settings:changed', snapshot);
  for (const win of overlays.values()) send(win, 'settings:changed', snapshot);
  trayMenu();
  if ('enabled' in patch) syncRuntime();
  else syncVisibility();
  save = save.catch(() => {}).then(async () => {
    await writeFile(settingsFile + '.tmp', JSON.stringify(snapshot, null, 2));
    await rename(settingsFile + '.tmp', settingsFile);
  });
  await save;
  return snapshot;
}

function broadcastGeometry(windows, pressed, control) {
  if (locked || !settings.enabled) return;
  const mouse = screen.getCursorScreenPoint();
  displayCache ??= new Map(screen.getAllDisplays().map(display => [display.id, display]));
  const displays = displayCache;
  for (const [id, win] of overlays) {
    const display = displays.get(id);
    if (!display || !win.isVisible()) continue;
    const { x, y, width, height } = display.bounds;
    const origin = screen.dipToScreenPoint({ x, y });
    const scale = display.scaleFactor;
    const rectangles = [];
    for (const rect of windows) {
      const left = (rect.left - origin.x) / scale;
      const top = (rect.top - origin.y) / scale;
      const right = (rect.right - origin.x) / scale;
      const bottom = (rect.bottom - origin.y) / scale;
      if (right > 0 && bottom > 0 && left < width && top < height) {
        rectangles.push({ id: rect.id, left, top, right, bottom, taskbar: rect.taskbar });
      }
    }
    const workBottom = display.workArea.y + display.workArea.height - y;
    if (workBottom < height && !rectangles.some(rect => rect.taskbar && rect.bottom >= height - 1)) {
      rectangles.unshift({ id: 'taskbar-fallback', left: 0, top: workBottom, right: width, bottom: height, taskbar: true });
    }
    send(win, 'desktop', { rectangles, mouse: { x: mouse.x - x, y: mouse.y - y, pressed, control } });
  }
}

function startTracking() {
  worker = spawn(native, [String(process.pid)], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  diagnostics.write('info', 'tracker', 'desktop helper started', { pid: worker.pid });
  worker.stdin.on('error', () => {});
  worker.on('error', console.error);
  const lines = createInterface({ input: worker.stdout });
  lines.on('line', line => {
    try {
      const { windows, pressed, control } = JSON.parse(line);
      if (!tracking) {
        tracking = true;
        send(panel, 'desktop', { tracking });
      }
      broadcastGeometry(windows, pressed, control);
    } catch (error) { console.error(error.message); }
  });
  worker.once('close', code => {
    diagnostics.write(quitting ? 'info' : 'warn', 'tracker', 'desktop helper stopped', { code });
    worker = undefined;
    tracking = false;
    send(panel, 'desktop', { tracking });
    for (const win of overlays.values()) send(win, 'desktop', { rectangles: [], mouse: { x: -1000, y: -1000 } });
    if (!quitting && settings.enabled && !locked) retry = setTimeout(startTracking, 300);
  });
}

async function smokeTest() {
  try {
    const panelCheck = await panel.webContents.executeJavaScript(`(async () => {
      const toggle = document.querySelector('#toggle');
      for (let i = 0; i < 40 && document.querySelector('#menu').hidden; i++) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      await new Promise(resolve => setTimeout(resolve, 600));
      const menu = document.querySelector('#menu');
      const open = !menu.hidden;
      const actions = menu.querySelectorAll('[data-action]').length;
      const iconReady = toggle.querySelector('img').naturalWidth > 0;
      const options = document.querySelector('#options');
      const disabledByDefault = options.disabled;
      await wintermas.update({ enabled: true, paused: false });
      const enabledAfterToggle = !options.disabled;
      const bottom = menu.getBoundingClientRect().bottom;
      const height = innerHeight;
      return { open, actions, iconReady, bottom, height, disabledByDefault, enabledAfterToggle };
    })()`);
    const flyout = panel.getBounds();
    const flyoutArea = screen.getDisplayMatching(flyout).workArea;
    const insideWorkArea = flyout.x >= flyoutArea.x && flyout.y >= flyoutArea.y &&
      flyout.x + flyout.width <= flyoutArea.x + flyoutArea.width && flyout.y + flyout.height <= flyoutArea.y + flyoutArea.height;
    if (process.env.WINTERMAS_SMOKE_PREVIEW) {
      await writeFile(process.env.WINTERMAS_SMOKE_PREVIEW, (await panel.capturePage()).toPNG());
    }
    const deadline = Date.now() + 4000;
    while ((!tracking || [...overlays.values()].some(win => win.webContents.isLoading())) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    const renderers = await Promise.all([...overlays.values()].map(win => win.webContents.executeJavaScript(
      `(async () => {
        const atlas = new Image();
        atlas.src = new URL('./santa-frames.svg', location.href).href;
        await atlas.decode();
        for (let i = 0; i < 20 && !document.documentElement.dataset.rendered; i++) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return atlas.naturalWidth === 1320 && atlas.naturalHeight === 220 &&
          document.documentElement.dataset.ready === 'true' &&
          document.documentElement.dataset.rendered === 'true' &&
          document.querySelector('canvas').width > 0;
      })()`
    )));
    const panelReady = insideWorkArea && panelCheck.iconReady && panelCheck.open &&
      panelCheck.disabledByDefault && panelCheck.enabledAfterToggle &&
      panelCheck.actions === 7 && panelCheck.bottom <= panelCheck.height;
    if (!tracking || !panelReady || !renderers.length || !renderers.every(Boolean)) {
      throw new Error(JSON.stringify({ tracking, panelCheck, renderers }));
    }
    const frameRates = await Promise.all([...overlays.values()].map(win => win.webContents.executeJavaScript(`
      (async () => {
        const context = document.querySelector('canvas').getContext('2d');
        const clear = context.clearRect;
        const backend = document.documentElement.dataset.snowBackend;
        const gpu = backend === 'webgl' && document.querySelector('#snow').getContext('webgl');
        const draw = gpu && gpu.drawArrays;
        let sceneFrames = 0;
        let snowFrames = 0;
        context.clearRect = function (...args) {
          sceneFrames++;
          return clear.apply(this, args);
        };
        if (gpu) gpu.drawArrays = function (...args) {
          snowFrames++;
          return draw.apply(this, args);
        };
        const started = performance.now();
        await new Promise(resolve => setTimeout(resolve, 1200));
        context.clearRect = clear;
        if (gpu) gpu.drawArrays = draw;
        const seconds = (performance.now() - started) / 1000;
        return { backend, snowFps: Math.round((gpu ? snowFrames : sceneFrames) / seconds),
          sceneFps: Math.round(sceneFrames / seconds) };
      })()
    `)));
    console.log('Overlay:', JSON.stringify(frameRates));
    console.log('GPU:', JSON.stringify(app.getGPUFeatureStatus()));
    console.log('Processes:', JSON.stringify(app.getAppMetrics().map(process => ({
      type: process.type, cpu: process.cpu.percentCPUUsage, privateKiB: process.memory.privateBytes,
    }))));
    app.quit();
  } catch (error) {
    console.error(error);
    app.exit(2);
  }
}

async function start() {
  app.setAppUserModelId('Wintermas');
  await app.whenReady();
  const icon = nativeImage.createFromBuffer(await readFile(join(appPath, 'ui', 'icon.png')));
  if (icon.isEmpty()) throw new Error('Wintermas icon could not be decoded.');
  const data = app.getPath('userData');
  await mkdir(data, { recursive: true });
  settingsFile = join(data, 'settings.json');
  try {
    const stored = JSON.parse(await readFile(settingsFile, 'utf8'));
    settings = Object.fromEntries(Object.entries(defaults).map(([key, value]) =>
      [key, typeof stored[key] === typeof value ? stored[key] : value]));
    trayHintShown = true; // the "where did it go" hint is only for the very first run
  }
  catch (error) { if (error.code !== 'ENOENT') console.error(error.message); }
  if (!weathers.includes(settings.weather)) settings.weather = defaults.weather;
  if (process.argv.includes('--smoke-test')) settings = { ...defaults };
  await diagnostics.start({ settings, displays: screen.getAllDisplays().map(display => ({ id: display.id,
    bounds: display.bounds, scale: display.scaleFactor, hz: display.displayFrequency })) });
  const area = screen.getPrimaryDisplay().workArea;
  panel = new BrowserWindow({
    ...expanded, x: area.x + area.width - expanded.width - 8, y: area.y + area.height - expanded.height - 8,
    show: false, icon, frame: false, transparent: true, skipTaskbar: true,
    resizable: false, minimizable: false, maximizable: false, fullscreenable: false,
    title: 'Wintermas · Christmas',
    webPreferences: { preload: join(app.getAppPath(), 'preload.cjs') },
  });
  panel.setAlwaysOnTop(true, 'screen-saver');
  panel.on('close', event => { if (!quitting) { event.preventDefault(); hidePanel(); } });
  panel.on('blur', () => { if (!panelPinned && !process.argv.includes('--smoke-test')) hidePanel(); });
  tray = new Tray(icon.resize({ width: 32, height: 32, quality: 'best' }));
  tray.setToolTip('Wintermas');
  tray.on('click', togglePanel);
  tray.on('double-click', showPanel);
  tray.on('balloon-click', showPanel);
  trayMenu();
  ipcMain.handle('settings:get', () => ({ ...settings, tracking }));
  ipcMain.on('diag:log', (event, entry) => {
    const overlay = [...overlays].find(([, win]) => win.webContents === event.sender);
    diagnostics.write('info', overlay ? 'overlay:' + overlay[0] : 'panel', entry?.type ?? 'event', entry);
  });
  diagnostics.watch(panel.webContents, 'panel');
  ipcMain.on('snowball:pointer', (event, capture) => {
    const overlay = [...overlays.values()].find(win => win.webContents === event.sender);
    if (overlay) overlay.setIgnoreMouseEvents(!(capture === true && !locked && settings.enabled));
  });
  globalShortcut.register('Alt+Shift+B', () => {
    if (locked || !settings.enabled) return;
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    send(overlays.get(display.id), 'effect:action', 'gather');
  });
  ipcMain.handle('settings:set', (event, patch) => event.sender === panel.webContents ? update(patch) : settings);
  ipcMain.handle('widget:open', (event, open, contentHeight) => {
    if (event.sender === panel.webContents) sizeWidget(open === true, contentHeight);
  });
  ipcMain.on('widget:pin', (event, pinned) => {
    if (event.sender === panel.webContents) panelPinned = pinned === true;
  });
  ipcMain.handle('widget:hide', event => {
    if (event.sender === panel.webContents) hidePanel();
  });
  ipcMain.handle('effect:action', (event, action, color) => {
    if (event.sender !== panel.webContents || !settings.enabled || locked) return;
    if (action === 'garland' || action === 'tree') {
      const display = screen.getDisplayMatching(panel.getBounds());
      for (const [id, win] of overlays) {
        send(win, 'effect:action', id === display.id ? { placement: action, color } : 'decor-cancel');
      }
    } else if (['clear', 'snowball', 'santa', 'reset', 'decor-reset'].includes(action)) {
      if (settings.weather === 'rain' && action !== 'decor-reset') return;
      for (const win of overlays.values()) send(win, 'effect:action', action);
    }
  });
  for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(event, refreshOverlays);
  powerMonitor.on('lock-screen', () => { locked = true; syncRuntime(); });
  for (const event of ['suspend', 'resume', 'on-battery', 'on-ac']) {
    powerMonitor.on(event, () => diagnostics.write('info', 'power', event));
  }
  powerMonitor.on('unlock-screen', () => { locked = false; syncRuntime(); });
  syncRuntime();
  // Opened by hand: show the flyout once it has its final size. Started with Windows (--quiet): stay in the tray.
  if (!process.argv.includes('--smoke-test') && !process.argv.includes('--quiet')) showWhenSized = true;
  await panel.loadFile('ui/index.html');

  if (process.argv.includes('--smoke-test')) setTimeout(smokeTest, 2500);
}

if (process.argv.includes('--smoke-test') && process.env.WINTERMAS_SMOKE_DATA) {
  app.setPath('userData', process.env.WINTERMAS_SMOKE_DATA);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (panel) showPanel(); });
  app.on('before-quit', () => {
    globalShortcut.unregisterAll();
    quitting = true;
    clearTimeout(retry);
    worker?.stdin.end();
  });
  start().catch(error => { console.error(error); app.exit(1); });
}


