const Sentry = require("@sentry/electron/main");

const { SENTRY } = require("../config");
const createLogger = require("../lib/log");

const log = createLogger("Sentry");
const APP_VERSION = require("../../package.json").version;

let initialised = false;

function initSentry() {
  if (initialised) return;
  initialised = true;

  Sentry.init({
    dsn: SENTRY.DSN,
    release: `clubpenguinatake@${APP_VERSION}`,
    environment: process.env.NODE_ENV || "production",
    sampleRate: 1.0,
    enableAutoSessionTracking: true,
    debug: false,
  });

  log.info("Initialised");
}

function reportEvent(message, { level = "warning", tags, extra } = {}) {
  if (!initialised) return;

  try {
    Sentry.withScope((scope) => {
      scope.setLevel(level);
      if (tags) scope.setTags(tags);
      if (extra) scope.setExtras(extra);
      Sentry.captureMessage(message, level);
    });
  } catch (error) {
    log.error("Failed to report event:", error);
  }
}

function reportSecurityEvent(message) {
  reportEvent(message, { tags: { kind: "security" } });
}

module.exports = { initSentry, reportEvent, reportSecurityEvent };