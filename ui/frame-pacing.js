// Vsync-aligned frame pacing for the overlay.
// requestAnimationFrame gives evenly spaced frames that match the monitor, unlike setTimeout,
// whose resolution on Windows can be ~15.6 ms (especially on battery) and drifts against vsync.
// On high-refresh monitors every Nth vsync is used so the overlay stays near targetFps with even spacing.
// If compositor callbacks stall (some Windows setups pause them for overlays), a watchdog keeps the
// animation going with timers and the pacer probes every few seconds to return to vsync pacing.
export function createFramePacer(frame, { targetFps = 72, watchdogMs = 250, onModeChange } = {}) {
  const hasRaf = typeof requestAnimationFrame === 'function';
  let mode = hasRaf ? 'raf' : 'timer';
  let raf = 0, timer = 0, misses = 0, tick = 0, probeAt = 0;
  let refreshMs = 1000 / 60, lastVsync;

  function cancel() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(timer);
    timer = 0;
  }

  function setMode(next) {
    if (mode === next) return;
    mode = next;
    misses = 0;
    lastVsync = undefined;
    onModeChange?.(mode);
  }

  function onVsync(timestamp) {
    raf = 0;
    clearTimeout(timer);
    timer = 0;
    misses = 0;
    if (lastVsync !== undefined) {
      const delta = timestamp - lastVsync;
      if (delta > 2 && delta < 50) refreshMs += (delta - refreshMs) * 0.08;
    }
    lastVsync = timestamp;
    const skip = Math.max(1, Math.round(1000 / targetFps / refreshMs));
    if (++tick % skip) {
      requestVsync();
      return;
    }
    frame(timestamp);
  }

  function onWatchdog() {
    timer = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastVsync = undefined;
    if (++misses >= 3) {
      probeAt = performance.now();
      setMode('timer');
    }
    frame(performance.now());
  }

  function requestVsync() {
    raf = requestAnimationFrame(onVsync);
    timer = setTimeout(onWatchdog, watchdogMs);
  }

  function schedule(nextFrame) {
    cancel();
    if (mode === 'raf') {
      requestVsync();
      return;
    }
    const now = performance.now();
    if (hasRaf && now - probeAt > 3000) {
      probeAt = now;
      requestAnimationFrame(() => { if (mode === 'timer') setMode('raf'); });
    }
    const due = Number.isFinite(nextFrame) ? nextFrame : now + 1000 / 60;
    timer = setTimeout(() => {
      timer = 0;
      frame(performance.now());
    }, Math.max(0, due - now));
  }

  return {
    schedule,
    cancel,
    get mode() { return mode; },
    get refreshMs() { return refreshMs; },
  };
}
