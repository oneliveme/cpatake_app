const { app } = require("electron");

const { HEALTH } = require("../config");
const createLogger = require("../lib/log");

const log = createLogger("Health");

const KB_PER_MB = 1024;
const toMb = (kb) => Math.round(kb / KB_PER_MB);

let sampleTimer = null;

const baselines = new Map();
const reported = new Set();

function processLabel(metric) {
  const name = metric.name ? ` "${metric.name}"` : "";
  return `${metric.type}${name} (pid ${metric.pid})`;
}

function sample(report) {
  let metrics;

  try {
    metrics = app.getAppMetrics();
  } catch (error) {
    log.error("Failed to read process metrics:", error);
    return;
  }

  const live = new Set();

  for (const metric of metrics) {
    const { pid } = metric;
    const workingSetKb = metric.memory?.workingSetSize ?? 0;
    const peakKb = metric.memory?.peakWorkingSetSize ?? workingSetKb;

    live.add(pid);
    if (!baselines.has(pid)) baselines.set(pid, workingSetKb);

    const growthKb = workingSetKb - baselines.get(pid);
    const overAbsolute = workingSetKb > HEALTH.WARN_MB * KB_PER_MB;
    const overGrowth = growthKb > HEALTH.GROWTH_WARN_MB * KB_PER_MB;

    if ((overAbsolute || overGrowth) && !reported.has(pid)) {
      reported.add(pid);

      const summary =
        `${processLabel(metric)} at ${toMb(workingSetKb)} MB ` +
        `(+${toMb(growthKb)} MB since first seen, peak ${toMb(peakKb)} MB)`;

      log.warn(`High memory: ${summary}`);
      report?.(`High memory: ${summary}`, {
        tags: { kind: "memory", processType: metric.type },
        extra: {
          pid,
          processType: metric.type,
          workingSetMb: toMb(workingSetKb),
          peakWorkingSetMb: toMb(peakKb),
          growthMb: toMb(growthKb),
          trigger: overAbsolute ? "absolute" : "growth",
          uptimeSeconds: Math.round(process.uptime()),
        },
      });
    }
  }

  for (const pid of baselines.keys()) {
    if (!live.has(pid)) baselines.delete(pid);
  }
  for (const pid of reported) {
    if (!live.has(pid)) reported.delete(pid);
  }
}

function startMemoryMonitor(report) {
  if (sampleTimer) return;

  log.info(
    `Sampling every ${HEALTH.SAMPLE_INTERVAL_MS / 1000}s ` +
      `(warn above ${HEALTH.WARN_MB} MB or +${HEALTH.GROWTH_WARN_MB} MB growth)`
  );

  sampleTimer = setInterval(() => sample(report), HEALTH.SAMPLE_INTERVAL_MS);
  sampleTimer.unref?.();
}

function stopMemoryMonitor() {
  if (!sampleTimer) return;
  clearInterval(sampleTimer);
  sampleTimer = null;
  baselines.clear();
  reported.clear();
}

function installCrashReporting({ report, onRendererGone, isShuttingDown } = {}) {
  app.on("render-process-gone", (_event, contents, details) => {
    if (isShuttingDown?.() || details.reason === "clean-exit") return;

    const url = (() => {
      try {
        return contents.getURL();
      } catch {
        return "unknown";
      }
    })();

    log.error(`Renderer gone: ${details.reason} (exit ${details.exitCode ?? "n/a"}) at ${url}`);
    report?.(`Renderer process gone: ${details.reason}`, {
      level: details.reason === "oom" ? "error" : "warning",
      tags: { kind: "renderer-gone", reason: details.reason },
      extra: {
        reason: details.reason,
        exitCode: details.exitCode,
        url,
        uptimeSeconds: Math.round(process.uptime()),
      },
    });

    onRendererGone?.(contents, details);
  });

  app.on("child-process-gone", (_event, details) => {
    if (isShuttingDown?.() || details.reason === "clean-exit") return;

    log.error(`Child process gone: ${details.type} — ${details.reason}`);
    report?.(`Child process gone: ${details.type} (${details.reason})`, {
      tags: { kind: "child-process-gone", processType: details.type },
      extra: {
        processType: details.type,
        reason: details.reason,
        exitCode: details.exitCode,
        serviceName: details.serviceName,
        uptimeSeconds: Math.round(process.uptime()),
      },
    });
  });
}

module.exports = { installCrashReporting, startMemoryMonitor, stopMemoryMonitor };
