const { app, BrowserWindow, autoUpdater } = require("electron");
const discord_integration = require('./integrations/discord');
const versionControl = require('./integrations/versionControl');
const { initSentryMain } = require('./integrations/sentryIntegration');
const path = require("path");

initSentryMain();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) app.quit();

// Check for updates except for macOS
if (process.platform != "darwin") require("update-electron-app")({ repo: "oneliveme/cpatake_app" });

const pluginPaths = {
  win32: path.join(path.dirname(__dirname), "lib/pepflashplayer.dll"),
  darwin: path.join(path.dirname(__dirname), "lib/PepperFlashPlayer.plugin"),
  linux: path.join(path.dirname(__dirname), "lib/libpepflashplayer.so"),
};

if (process.platform === "linux") app.commandLine.appendSwitch("no-sandbox");

const pluginName = pluginPaths[process.platform];
console.log("pluginName", pluginName);

app.commandLine.appendSwitch("ppapi-flash-path", pluginName);
app.commandLine.appendSwitch("ppapi-flash-version", "32.0.0.371");
app.commandLine.appendSwitch("ignore-certificate-errors");

let mainWindow;

const createWindow = () => {
  // Create the browser window.
  let splashWindow = new BrowserWindow({
    width: 600,
    height: 320,
    frame: false,
    transparent: true,
    show: false,
  });

  splashWindow.setResizable(false);
  splashWindow.loadURL(
    "file://" + path.join(path.dirname(__dirname), "src/index.html"),
  );

  splashWindow.on("closed", () => (splashWindow = null));
  splashWindow.webContents.on("did-finish-load", () => {
    splashWindow.show();
  });

  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    useContentSize: true,
    show: false,
    webPreferences: {
      plugins: true,
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  versionControl.initVersionControl(mainWindow.webContents.session);

  mainWindow.webContents.on("did-finish-load", () => {
    if (splashWindow) {
      splashWindow.close();
      mainWindow.show();
    }

    discord_integration.initDiscordRichPresence();
  });

  function isAllowedOrigin(origin) {
    return /^(https?:\/\/)?([a-zA-Z0-9-]+\.)*(dink\.cf|onelive\.me|olcdns\.com|fullmoon\.dev|live\.net\.co|cpatake\.boo)$/.test(origin);
  }

  mainWindow.webContents.on("will-navigate", (event, urlString) => {
    const origin = new URL(urlString).origin;
    if (!isAllowedOrigin(origin)) {
      event.preventDefault();
    }
  });

  mainWindow.on("closed", () => (mainWindow = null));

  mainWindow.webContents.session.clearHostResolverCache();
  mainWindow.webContents.session.clearCache();

  new Promise((resolve) =>
    setTimeout(() => {
      mainWindow.loadURL("https://www.cpatake.boo/i/play");
      resolve();
    }, 5000)
  );
};

const launchMain = () => {
  // Disallow multiple clients running
  if (!app.requestSingleInstanceLock()) return app.quit();

  app.on("second-instance", (_event, _commandLine, _workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.setAsDefaultProtocolClient("cpatake");

  app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    discord_integration.cleanup();
  });
};

launchMain();