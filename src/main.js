const { app, ipcMain } = require("electron");
const { pathToFileURL } = require("url");

const { APP, BEHAVIOUR, CACHE_BUST, HEALTH } = require("./config");
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
let shouldOpenCacheBust = process.argv.some(isCacheBustProtocolUrl);

function isCacheBustProtocolUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === `${APP.PROTOCOL}:` &&
      url.hostname === "cachebustpage" &&
      (url.pathname === "" || url.pathname === "/") &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function assertCacheBustPageRequest(event) {
  if (
    event.sender !== gameWindow?.webContents ||
    event.frameId !== 0 ||
    event.sender.getURL() !== pathToFileURL(APP.CACHE_BUST_FILE).href
  ) {
    throw new Error("Cache-bust action rejected from an untrusted page");
  }
}

function installCacheBustHandlers() {
  ipcMain.handle(CACHE_BUST.CLEAR_CHANNEL, async (event) => {
    assertCacheBustPageRequest(event);

    const session = event.sender.session;
    await Promise.all([
      session.clearCache(),
      session.clearHostResolverCache(),
      session.clearAuthCache(),
      session.clearStorageData({
        storages: ["appcache", "shadercache", "serviceworkers", "cachestorage"],
      }),
    ]);

    log.info("Electron cache cleared");
    return true;
  });

  ipcMain.handle(CACHE_BUST.RETURN_CHANNEL, (event) => {
    assertCacheBustPageRequest(event);
    shouldOpenCacheBust = false;
    event.sender.loadURL(APP.PLAY_URL).catch((error) => {
      log.error("Failed to return to the game:", error);
    });
    return true;
  });
}

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

  if (shouldOpenCacheBust) {
    if (gameWindow.webContents.getURL() === pathToFileURL(APP.CACHE_BUST_FILE).href) return;
    log.info("Opening cache-bust page");
    await gameWindow.loadFile(APP.CACHE_BUST_FILE);
    return;
  }

  log.info(`Loading ${APP.PLAY_URL}`);
  gameWindow.loadURL(APP.PLAY_URL).catch((error) => {
    if (!shouldOpenCacheBust) log.error("Failed to load the game:", error);
  });
}

function focusExistingWindow() {
  if (!gameWindow || gameWindow.isDestroyed()) return;
  if (gameWindow.isMinimized()) gameWindow.restore();
  gameWindow.focus();
}

function openCacheBustPage() {
  shouldOpenCacheBust = true;
  focusExistingWindow();

  if (!gameWindow) {
    if (app.isReady()) startOnce();
    return;
  }

  gameWindow.loadFile(APP.CACHE_BUST_FILE).catch((error) => {
    log.error("Failed to open cache-bust page:", error);
  });
}

function handleSecondInstance(_event, commandLine) {
  if (Array.isArray(commandLine) && commandLine.some(isCacheBustProtocolUrl)) {
    openCacheBustPage();
    return;
  }

  focusExistingWindow();
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
  if (!acquireSingleInstanceLock(handleSecondInstance)) return;

  app.setAsDefaultProtocolClient(APP.PROTOCOL);

  installCacheBustHandlers();

  app.on("open-url", (event, url) => {
    if (!isCacheBustProtocolUrl(url)) return;
    event.preventDefault();
    openCacheBustPage();
  });

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