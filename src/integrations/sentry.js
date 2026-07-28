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

function reportSecurityEvent(message) {
  if (!initialised) return;

  try {
    Sentry.captureMessage(message, "warning");
  } catch (error) {
    log.error("Failed to report security event:", error);
  }
}

module.exports = { initSentry, reportSecurityEvent };