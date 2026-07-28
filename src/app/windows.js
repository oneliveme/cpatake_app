const { BrowserWindow } = require("electron");

const { APP } = require("../config");
const { hardenedWebPreferences } = require("./security");

function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 600,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splash.loadFile(APP.SPLASH_FILE);
  splash.once("ready-to-show", () => splash.show());

  return splash;
}

function createGameWindow() {
  return new BrowserWindow({
    autoHideMenuBar: true,
    useContentSize: true,
    show: false,
    webPreferences: hardenedWebPreferences(APP.PRELOAD_FILE),
  });
}

module.exports = { createGameWindow, createSplashWindow };