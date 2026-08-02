const RPC = require("discord-rpc");

const { DISCORD, PRESENCE } = require("../config");
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

let livePresence = null;
let sessionStart = Date.now();
let pendingActivity = null;
let flushTimer = null;
let staleTimer = null;
let lastSentAt = 0;

function stopRotation() {
  if (stateInterval) {
    clearInterval(stateInterval);
    stateInterval = null;
  }
}

function setActivity(activity) {
  if (!rpcClient || !isConnected) return;

  try {
    const pending = rpcClient.setActivity(activity);
    if (pending && typeof pending.catch === "function") {
      pending.catch((error) => log.error("setActivity failed:", error.message));
    }
  } catch (error) {
    log.error("setActivity threw:", error);
  }
}

function flushActivity() {
  flushTimer = null;
  if (!pendingActivity) return;

  const activity = pendingActivity;
  pendingActivity = null;
  lastSentAt = Date.now();
  setActivity(activity);
}

function queueActivity(activity) {
  pendingActivity = activity;
  if (flushTimer) return;

  const wait = Math.max(0, PRESENCE.MIN_UPDATE_INTERVAL_MS - (Date.now() - lastSentAt));

  if (wait === 0) {
    flushActivity();
    return;
  }

  flushTimer = setTimeout(flushActivity, wait);
  flushTimer.unref?.();
}

function buildLiveActivity(presence) {
  const era = presence.era ? PRESENCE.ERAS[presence.era] : null;

  let details;
  if (era) {
    details = presence.party ? `${era.label} — ${presence.party}` : era.label;
  } else if (presence.page) {
    details = `Browsing ${presence.page}`;
  } else {
    details = DISCORD.DEFAULT_DETAILS;
  }

  return {
    details,
    state: presence.room || presence.party || DISCORD.DEFAULT_STATE,
    largeImageKey: era?.imageKey || DISCORD.DEFAULT_IMAGE_KEY,
    startTimestamp: sessionStart,
    instance: true,
  };
}

function rotateState() {
  if (states.length === 0 || !rpcClient || !isConnected || livePresence) return;

  currentStateIndex = (currentStateIndex + 1) % states.length;

  queueActivity({
    ...currentActivity,
    state: states[currentStateIndex],
  });
}

function startRotation() {
  stopRotation();
  if (livePresence || states.length <= 1) return;
  stateInterval = setInterval(rotateState, DISCORD.STATE_ROTATION_MS);
  stateInterval.unref?.();
}

function refreshActivity() {
  if (!rpcClient || !isConnected) return;

  if (livePresence) {
    stopRotation();
    queueActivity(buildLiveActivity(livePresence));
    return;
  }

  if (currentActivity) queueActivity(currentActivity);
  startRotation();
}

function clearStaleTimer() {
  if (!staleTimer) return;
  clearTimeout(staleTimer);
  staleTimer = null;
}

function applyGamePresence(presence) {
  clearStaleTimer();

  const had = Boolean(livePresence);
  livePresence = presence || null;

  if (livePresence) {
    staleTimer = setTimeout(() => {
      log.info("Live presence went stale — reverting to default");
      livePresence = null;
      refreshActivity();
    }, PRESENCE.STALE_AFTER_MS);
    staleTimer.unref?.();
  } else if (had) {
    log.info("Live presence cleared");
  }

  refreshActivity();
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
      startTimestamp: sessionStart,
      instance: true,
    };

    refreshActivity();
  } catch (error) {
    log.error("Error setting initial presence:", error);
  }
}

function initDiscordRichPresence() {
  if (isInitialised) return;
  isInitialised = true;
  sessionStart = Date.now();

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
  clearStaleTimer();

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  pendingActivity = null;
  livePresence = null;

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

module.exports = { applyGamePresence, initDiscordRichPresence, cleanup };