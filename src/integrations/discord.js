const RPC = require("discord-rpc");

const { DISCORD } = require("../config");
const { fetchJson, fetchText } = require("../lib/http");
const createLogger = require("../lib/log");
const { isTrustedUrl } = require("../lib/trust");

const log = createLogger("Discord RPC");

let rpcClient = null;
let states = [];
let currentStateIndex = 0;
let stateInterval = null;
let currentActivity = null;
let isInitialised = false;
let isConnected = false;
let cleanupPromise = null;

function stopRotation() {
  if (stateInterval) {
    clearInterval(stateInterval);
    stateInterval = null;
  }
}

function rotateState() {
  if (states.length === 0 || !rpcClient || !isConnected) return;

  currentStateIndex = (currentStateIndex + 1) % states.length;

  try {
    rpcClient.setActivity({
      ...currentActivity,
      state: states[currentStateIndex],
    });
  } catch (error) {
    log.error("Error rotating state:", error);
  }
}

const defaultPresence = () => ({
  state: DISCORD.DEFAULT_STATE,
  details: DISCORD.DEFAULT_DETAILS,
  largeImageKey: DISCORD.DEFAULT_IMAGE_KEY,
});

async function resolvePresence() {
  const switchContent = await fetchText(DISCORD.SWITCH_URL);
  if (switchContent === "0") return defaultPresence();

  const info = await fetchJson(DISCORD.INFO_URL);
  if (!info || typeof info !== "object") return defaultPresence();

  if (typeof info.statesUrl === "string" && isTrustedUrl(info.statesUrl)) {
    try {
      const statesContent = await fetchText(info.statesUrl);
      states = statesContent.split("\n").map((s) => s.trim()).filter(Boolean);
    } catch (error) {
      log.error("Failed to load states list:", error.message);
    }
  } else if (info.statesUrl) {
    log.warn(`Ignoring untrusted statesUrl: ${info.statesUrl}`);
  }

  return {
    state: states[0] || DISCORD.DEFAULT_STATE,
    details: info.details || DISCORD.DEFAULT_DETAILS,
    largeImageKey: info.largeImageKey || DISCORD.DEFAULT_IMAGE_KEY,
  };
}

async function onRpcReady() {
  isConnected = true;
  log.info("Connected");

  try {
    const presence = await resolvePresence();

    if (!rpcClient || !isConnected) return;

    currentActivity = {
      ...presence,
      startTimestamp: Date.now(),
      instance: true,
    };

    rpcClient.setActivity(currentActivity);

    stopRotation();
    if (states.length > 1) {
      stateInterval = setInterval(rotateState, DISCORD.STATE_ROTATION_MS);
    }
  } catch (error) {
    log.error("Error setting initial presence:", error);
  }
}

function initDiscordRichPresence() {
  if (isInitialised) return;
  isInitialised = true;

  try {
    RPC.register(DISCORD.APPLICATION_ID);

    rpcClient = new RPC.Client({ transport: "ipc" });

    rpcClient.on("ready", onRpcReady);
    rpcClient.on("disconnected", () => {
      log.info("Disconnected");
      isConnected = false;
      stopRotation();
    });

    rpcClient.login({ clientId: DISCORD.APPLICATION_ID }).catch((error) => {
      log.info(`Not connected (${error.message})`);
      isConnected = false;
    });
  } catch (error) {
    log.error("Initialisation failed:", error);
  }
}

async function performCleanup() {
  log.info("Cleaning up...");
  stopRotation();

  if (rpcClient) {
    try {
      rpcClient.removeAllListeners();
      if (isConnected) {
        await rpcClient.clearActivity().catch(() => {});
      }
      await rpcClient.destroy();
    } catch (error) {
      log.error("Cleanup error:", error);
    } finally {
      rpcClient = null;
    }
  }

  isConnected = false;
  isInitialised = false;
  log.info("Cleanup complete");
}

function cleanup() {
  if (!cleanupPromise) cleanupPromise = performCleanup();
  return cleanupPromise;
}

module.exports = { initDiscordRichPresence, cleanup };