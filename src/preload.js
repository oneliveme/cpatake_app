const { contextBridge, ipcRenderer } = require("electron");

require("@sentry/electron/preload");

const { PRESENCE } = require("./config");

contextBridge.exposeInMainWorld("cpatakeDesktop", {
  version: 1,
  setPresence: (presence) => {
    ipcRenderer.send(PRESENCE.CHANNEL, presence);
  },
  clearPresence: () => {
    ipcRenderer.send(PRESENCE.CHANNEL, null);
  },
});

console.log("[Preload] Sentry IPC bridge + desktop presence API installed");
