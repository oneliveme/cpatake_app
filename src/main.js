const { app } = require("electron");

const { APP, BEHAVIOUR } = require("./config");
const { acquireSingleInstanceLock, installQuitHandling } = require("./app/lifecycle");
const security = require("./app/security");
const { createGameWindow, createSplashWindow } = require("./app/windows");
const discord = require("./integrations/discord");
const { initSentry, reportSecurityEvent } = require("./integrations/sentry");
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

  if (BEHAVIOUR.CLEAR_CACHE_ON_START) {
    await gameSession.clearCache();
    await gameSession.clearHostResolverCache();
  }

  webContents.on("did-finish-load", () => {
    dismissSplash();
    discord.initDiscordRichPresence();
  });

  webContents.on("did-fail-load", (_event, errorCode, errorDescription, _url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    log.error(`Failed to load game: ${errorDescription} (${errorCode})`);
    dismissSplash();
  });

  gameWindow.on("closed", () => {
    gameWindow = null;
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

function main() {
  if (!acquireSingleInstanceLock(focusExistingWindow)) return;

  app.setAsDefaultProtocolClient(APP.PROTOCOL);
  installQuitHandling(() => discord.cleanup());

  app.whenReady().then(() => {
    start().catch((error) => log.error("Startup failed:", error));

    app.on("activate", () => {
      if (!gameWindow) start().catch((error) => log.error("Restart failed:", error));
    });
  });
}

main();