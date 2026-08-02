const { app } = require("electron");

const { APP, BEHAVIOUR, HEALTH } = require("./config");
const {
  acquireSingleInstanceLock,
  installQuitHandling,
  isShuttingDown,
} = require("./app/lifecycle");
const health = require("./app/health");
const presence = require("./app/presence");
const security = require("./app/security");
const { createGameWindow, createSplashWindow } = require("./app/windows");
const discord = require("./integrations/discord");
const { initSentry, reportEvent, reportSecurityEvent } = require("./integrations/sentry");
const { initVersionControl } = require("./integrations/versionControl");
const createLogger = require("./lib/log");

const log = createLogger("Main");

initSentry();

if (require("electron-squirrel-startup")) app.quit();

if (process.platform !== "darwin") {
  require("update-electron-app")({ repo: APP.UPDATE_REPO });
}

security.applyCommandLineSwitches();
security.installCertificateHandling(reportSecurityEvent);
security.installWebContentsHardening();

let gameWindow = null;
let startPromise = null;
let rendererRecoveries = 0;

function recoverRenderer(contents, details) {
  if (!gameWindow || gameWindow.isDestroyed()) return;
  if (contents !== gameWindow.webContents) return;

  if (rendererRecoveries >= HEALTH.MAX_RENDERER_RECOVERIES) {
    log.error(`Renderer gone (${details.reason}) — recovery limit reached, leaving window as is`);
    return;
  }

  rendererRecoveries += 1;
  log.warn(
    `Renderer gone (${details.reason}) — reloading ` +
      `(${rendererRecoveries}/${HEALTH.MAX_RENDERER_RECOVERIES})`
  );

  try {
    gameWindow.webContents.reload();
  } catch (error) {
    log.error("Reload after renderer crash failed:", error);
  }
}

async function start() {
  let splashWindow = createSplashWindow();

  const dismissSplash = () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    splashWindow = null;
    if (gameWindow && !gameWindow.isDestroyed()) gameWindow.show();
  };

  gameWindow = createGameWindow();
  const { webContents } = gameWindow;
  const gameSession = webContents.session;

  security.hardenSession(gameSession);
  presence.installPresenceBridge(gameSession, discord.applyGamePresence);

  if (BEHAVIOUR.CLEAR_CACHE_ON_START) {
    await gameSession.clearCache();
    await gameSession.clearHostResolverCache();
  }

  webContents.on("did-finish-load", () => {
    rendererRecoveries = 0;
    dismissSplash();
    discord.initDiscordRichPresence();
  });

  webContents.on("did-fail-load", (_event, errorCode, errorDescription, _url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    log.error(`Failed to load game: ${errorDescription} (${errorCode})`);
    dismissSplash();
  });

  gameWindow.on("unresponsive", () => {
    log.warn("Game window unresponsive");
    reportEvent("Game window unresponsive", {
      tags: { kind: "unresponsive" },
      extra: { uptimeSeconds: Math.round(process.uptime()) },
    });
  });

  gameWindow.on("responsive", () => log.info("Game window responsive again"));

  gameWindow.on("closed", () => {
    gameWindow = null;
    presence.clearPresence();
  });

  await initVersionControl(gameSession);

  if (!gameWindow || gameWindow.isDestroyed()) return;

  log.info(`Loading ${APP.PLAY_URL}`);
  gameWindow.loadURL(APP.PLAY_URL);
}

function focusExistingWindow() {
  if (!gameWindow || gameWindow.isDestroyed()) return;
  if (gameWindow.isMinimized()) gameWindow.restore();
  gameWindow.focus();
}

function startOnce() {
  if (gameWindow || startPromise) return startPromise ?? Promise.resolve();

  startPromise = start()
    .catch((error) => log.error("Startup failed:", error))
    .finally(() => {
      startPromise = null;
    });

  return startPromise;
}

function main() {
  if (!acquireSingleInstanceLock(focusExistingWindow)) return;

  app.setAsDefaultProtocolClient(APP.PROTOCOL);

  health.installCrashReporting({
    report: reportEvent,
    onRendererGone: recoverRenderer,
    isShuttingDown,
  });

  installQuitHandling(async () => {
    health.stopMemoryMonitor();
    await discord.cleanup();
  });

  app.whenReady().then(() => {
    health.startMemoryMonitor(reportEvent);
    startOnce();

    app.on("activate", () => startOnce());
  });
}

main();