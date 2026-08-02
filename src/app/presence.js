const { ipcMain } = require("electron");

const { PRESENCE } = require("../config");
const createLogger = require("../lib/log");
const { isTrustedUrl } = require("../lib/trust");

const log = createLogger("Presence");

let privacyMode = PRESENCE.DEFAULT_MODE;
let onPresenceChange = null;
let lastPresence = null;
let isInstalled = false;

function isValidMode(value) {
  return typeof value === "string" && PRESENCE.MODES.includes(value);
}

function sanitiseText(value) {
  if (typeof value !== "string") return null;

  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned ? cleaned.slice(0, PRESENCE.MAX_TEXT_LENGTH) : null;
}

function sanitisePresence(raw) {
  if (!raw || typeof raw !== "object") return null;

  const era = typeof raw.era === "string" && raw.era in PRESENCE.ERAS ? raw.era : null;

  const presence = {
    era,
    room: sanitiseText(raw.room),
    party: sanitiseText(raw.party),
    page: sanitiseText(raw.page),
  };

  if (!presence.era && !presence.room && !presence.party && !presence.page) return null;

  return presence;
}

function applyPrivacyMode(presence) {
  if (privacyMode === "off") return null;
  if (!presence) return null;

  if (privacyMode === "minimal") {
    return { era: presence.era, room: null, party: null, page: null };
  }

  return presence;
}

function emit() {
  onPresenceChange?.(applyPrivacyMode(lastPresence));
}

async function readPrivacyMode(session) {
  try {
    const cookies = await session.cookies.get({
      url: PRESENCE.COOKIE_URL,
      name: PRESENCE.COOKIE_NAME,
    });

    const raw = cookies[0]?.value;
    if (!raw) return PRESENCE.DEFAULT_MODE;

    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
    }

    return isValidMode(value) ? value : PRESENCE.DEFAULT_MODE;
  } catch (error) {
    log.error("Failed to read privacy cookie:", error.message);
    return PRESENCE.DEFAULT_MODE;
  }
}

async function refreshPrivacyMode(session) {
  const next = await readPrivacyMode(session);
  if (next === privacyMode) return;

  privacyMode = next;
  log.info(`Privacy mode: ${privacyMode}`);
  emit();
}

function watchPrivacyCookie(session) {
  refreshPrivacyMode(session);

  session.cookies.on("changed", (_event, cookie) => {
    if (cookie.name !== PRESENCE.COOKIE_NAME) return;
    refreshPrivacyMode(session);
  });
}

function installPresenceBridge(session, handler) {
  onPresenceChange = handler;

  if (isInstalled) {
    refreshPrivacyMode(session);
    return;
  }
  isInstalled = true;

  watchPrivacyCookie(session);

  ipcMain.on(PRESENCE.CHANNEL, (event, raw) => {
    const senderUrl = event.senderFrame?.url ?? event.sender?.getURL?.() ?? "";

    if (!isTrustedUrl(senderUrl)) {
      log.warn(`Ignoring presence from untrusted sender: ${senderUrl || "unknown"}`);
      return;
    }

    lastPresence = sanitisePresence(raw);
    emit();
  });

  log.info(`Bridge active on "${PRESENCE.CHANNEL}"`);
}

function clearPresence() {
  lastPresence = null;
  emit();
}

module.exports = { clearPresence, installPresenceBridge, sanitisePresence };
