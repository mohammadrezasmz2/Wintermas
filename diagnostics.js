// Diagnostic log for Wintermas (main process).
// Writes one line per event to %APPDATA%\Wintermas\logs\wintermas.log so problems on a user's PC
// (GPU fallbacks, renderer crashes, stalled frames, conflicts with other overlay apps) can be traced.
// The file rotates at 2 MiB to wintermas.old.log. Logging never throws into the app.
import { appendFile, mkdir, rename, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';

const MAX_BYTES = 2 * 1024 * 1024;
const REPEAT_WINDOW_MS = 60_000;
const REPEAT_LIMIT = 20;

function serialize(data) {
  if (data === undefined) return '';
  try {
    const text = JSON.stringify(data);
    return ' ' + (text.length > 4000 ? text.slice(0, 4000) + '…' : text);
  } catch {
    return ' [unserializable]';
  }
}

export function createDiagnostics(app) {
  let file, bytes = 0, ready = false;
  let queue = Promise.resolve();
  const pending = [];
  const repeats = new Map();
  const labels = new WeakMap();

  async function rotate() {
    const old = file.replace(/\.log$/, '.old.log');
    await rm(old, { force: true }).catch(() => {});
    await rename(file, old).catch(() => {});
    bytes = 0;
  }

  function append(line) {
    queue = queue.then(async () => {
      if (bytes + line.length > MAX_BYTES) await rotate();
      await appendFile(file, line, 'utf8');
      bytes += Buffer.byteLength(line);
    }).catch(() => {});
  }

  function write(level, scope, message, data) {
    try {
      const key = level + scope + message;
      const now = Date.now();
      const seen = repeats.get(key);
      if (seen && now - seen.since < REPEAT_WINDOW_MS) {
        if (++seen.count > REPEAT_LIMIT) {
          seen.suppressed++;
          return;
        }
      } else {
        if (seen?.suppressed) {
          const note = `${new Date(now).toISOString()} [INFO] diagnostics: suppressed ${seen.suppressed} repeats of "${scope}: ${message}"\n`;
          if (ready) append(note); else pending.push(note);
        }
        if (repeats.size > 500) repeats.clear();
        repeats.set(key, { since: now, count: 1, suppressed: 0 });
      }
      const line = `${new Date(now).toISOString()} [${level.toUpperCase()}] ${scope}: ${message}${serialize(data)}\n`;
      if (ready) append(line);
      else if (pending.length < 200) pending.push(line);
    } catch { /* never let logging break the app */ }
  }

  function watch(contents, label) {
    labels.set(contents, label);
    // One declared parameter: Electron 35+ passes the details on the event and warns when a
    // listener asks for the legacy positional arguments; older versions only pass those.
    contents.on('console-message', function (event) {
      const [, legacyLevel, legacyMessage, legacyLine, legacySource] = arguments;
      const level = event?.level ?? ['verbose', 'info', 'warning', 'error'][legacyLevel] ?? 'info';
      if (level !== 'warning' && level !== 'error') return;
      write(level === 'error' ? 'error' : 'warn', label, String(event?.message ?? legacyMessage ?? ''), {
        source: event?.sourceId ?? legacySource, line: event?.lineNumber ?? legacyLine,
      });
    });
    contents.on('unresponsive', () => write('warn', label, 'renderer unresponsive'));
    contents.on('responsive', () => write('info', label, 'renderer responsive again'));
    contents.on('did-fail-load', (event, code, description, url) => write('error', label, 'load failed', { code, description, url }));
    contents.on('preload-error', (event, path, error) => write('error', label, 'preload error', { path, error: error?.message }));
  }

  app.on('render-process-gone', (event, contents, details) => {
    write('error', labels.get(contents) ?? 'renderer', 'renderer process gone', details);
  });
  app.on('child-process-gone', (event, details) => {
    write(details.reason === 'clean-exit' ? 'info' : 'error', 'process', 'child process gone', details);
  });
  app.on('gpu-info-update', () => write('info', 'gpu', 'feature status', app.getGPUFeatureStatus()));
  app.on('before-quit', () => write('info', 'app', 'quitting'));
  process.on('uncaughtExceptionMonitor', error => write('error', 'main', 'uncaught exception', {
    message: error?.message, stack: error?.stack,
  }));

  async function start(context) {
    try {
      const folder = join(app.getPath('userData'), 'logs');
      await mkdir(folder, { recursive: true });
      file = join(folder, 'wintermas.log');
      bytes = await stat(file).then(info => info.size, () => 0);
      if (bytes > MAX_BYTES) await rotate();
      ready = true;
      append(`\n${new Date().toISOString()} [INFO] app: ===== Wintermas session =====\n`);
      for (const line of pending.splice(0)) append(line);
      write('info', 'app', 'started', {
        version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome,
        os: `${os.type()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model, cores: os.cpus().length,
        memoryGiB: +(os.totalmem() / 1024 ** 3).toFixed(1), ...context,
      });
      write('info', 'gpu', 'feature status', app.getGPUFeatureStatus());
      app.getGPUInfo('basic').then(info => write('info', 'gpu', 'devices', {
        devices: info?.gpuDevice, driver: info?.auxAttributes?.glRenderer,
      })).catch(() => {});
    } catch (error) {
      console.error('Diagnostics:', error.message);
    }
  }

  return {
    start,
    write,
    watch,
    get file() { return file ?? join(app.getPath('userData'), 'logs', 'wintermas.log'); },
  };
}
