const { contextBridge, ipcRenderer } = require("electron");

require("@sentry/electron/preload");

const { CACHE_BUST, PRESENCE } = require("./config");

contextBridge.exposeInMainWorld("cpatakeDesktop", {
  version: 1,
  setPresence: (presence) => {
    ipcRenderer.send(PRESENCE.CHANNEL, presence);
  },
  clearPresence: () => {
    ipcRenderer.send(PRESENCE.CHANNEL, null);
  },
  clearCache: () => ipcRenderer.invoke(CACHE_BUST.CLEAR_CHANNEL),
  returnToPlay: () => ipcRenderer.invoke(CACHE_BUST.RETURN_CHANNEL),
});

console.log("[Preload] Sentry IPC bridge + desktop presence API installed");
