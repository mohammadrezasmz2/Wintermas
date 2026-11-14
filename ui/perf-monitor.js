// Collects real frame timings in the overlay and reports a short summary to the diagnostic log.
export function createPerfMonitor(send, describe, { firstReportMs = 15000, intervalMs = 60000 } = {}) {
  const deltas = new Float32Array(3600);
  let count = 0, last, long = 0, windowStart = performance.now(), due = firstReportMs;

  function report(now) {
    if (count >= 10) {
      const sorted = deltas.slice(0, count).sort();
      const sum = sorted.reduce((total, value) => total + value, 0);
      const at = q => +sorted[Math.min(count - 1, Math.floor(count * q))].toFixed(2);
      try {
        send({
          type: 'perf', seconds: Math.round((now - windowStart) / 1000), frames: count,
          avgMs: +(sum / count).toFixed(2), p95Ms: at(0.95), p99Ms: at(0.99), maxMs: at(1),
          longFrames: long, ...describe(),
        });
      } catch { /* logging must never break rendering */ }
    }
    count = 0;
    long = 0;
    windowStart = now;
    due = intervalMs;
  }

  return {
    record(now) {
      if (last !== undefined) {
        const delta = now - last;
        // Larger gaps are idle periods (nothing to animate), not dropped frames.
        if (delta > 0 && delta < 200) {
          if (count < deltas.length) deltas[count++] = delta;
          if (delta > 50) long++;
        }
      }
      last = now;
      if (now - windowStart >= due) report(now);
    },
  };
}
