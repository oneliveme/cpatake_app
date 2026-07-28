const { app } = require("electron");

const createLogger = require("../lib/log");

const log = createLogger("Lifecycle");

const CLEANUP_TIMEOUT_MS = 3000;

let isQuitting = false;

function acquireSingleInstanceLock(onSecondInstance) {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }

  app.on("second-instance", onSecondInstance);
  return true;
}

function installQuitHandling(cleanup) {
  app.on("before-quit", (event) => {
    if (isQuitting) return;

    event.preventDefault();
    isQuitting = true;
    log.info("Shutting down...");

    const timeout = new Promise((resolve) => {
      setTimeout(() => {
        log.warn(`Cleanup exceeded ${CLEANUP_TIMEOUT_MS}ms — quitting anyway`);
        resolve();
      }, CLEANUP_TIMEOUT_MS).unref?.();
    });

    Promise.race([Promise.resolve().then(cleanup), timeout])
      .catch((error) => log.error("Cleanup failed:", error))
      .finally(() => app.quit());
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

module.exports = { acquireSingleInstanceLock, installQuitHandling };