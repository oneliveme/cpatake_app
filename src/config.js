const path = require("path");

const APP_ROOT = path.dirname(__dirname);

const TRUSTED_DOMAINS = [
  "cpatake.boo",
  "onelive.me",
  "fullmoon.dev",
  "live.net.co"
];

const ALLOWED_PERMISSIONS = ["fullscreen", "pointerLock"];

const APP = {
  ROOT: APP_ROOT,
  PLAY_URL: "https://www.cpatake.boo/i/play",
  PROTOCOL: "cpatake",
  UPDATE_REPO: "oneliveme/cpatake_app",
  SPLASH_FILE: path.join(__dirname, "index.html"),
  PRELOAD_FILE: path.join(__dirname, "preload.js"),
};

const FLASH = {
  VERSION: "32.0.0.371",
  PLUGIN_PATHS: {
    win32: path.join(APP_ROOT, "lib", "pepflashplayer.dll"),
    darwin: path.join(APP_ROOT, "lib", "PepperFlashPlayer.plugin"),
    linux: path.join(APP_ROOT, "lib", "libpepflashplayer.so"),
  },
};

const ERAS = {
  AS1: {
    host: "as1.cpatake.boo",
    cdn: "antique.cdns.cpatake.boo",
    jsonUrl:
      "https://nocache.fullmoon.dev/VersionControl/ClubPenguinAtake/Service/AS1.json?nocache=true",
  },
  AS2: {
    host: "as2.cpatake.boo",
    cdn: "legacy.cdns.cpatake.boo",
    jsonUrl:
      "https://nocache.fullmoon.dev/VersionControl/ClubPenguinAtake/Service/AS2.json?nocache=true",
  },
  EP: {
    host: "ep.cpatake.boo",
    cdn: "experimentalpenguins.cdns.cpatake.boo",
    jsonUrl:
      "https://nocache.fullmoon.dev/VersionControl/ClubPenguinAtake/Service/EP.json?nocache=true",
  },
  PC: {
    host: "pc.cpatake.boo",
    cdn: "penguinchat.cdns.cpatake.boo",
    jsonUrl:
      "https://nocache.fullmoon.dev/VersionControl/ClubPenguinAtake/Service/PC.json?nocache=true",
  },
  PC3: {
    host: "pc3.cpatake.boo",
    cdn: "penguinchat3.cdns.cpatake.boo",
    jsonUrl:
      "https://nocache.fullmoon.dev/VersionControl/ClubPenguinAtake/Service/PC3.json?nocache=true",
  },
};

const FALLBACK_CACHE_KEYS = {
  clientVersion: "000000R1",
  contentVersion: "000000R1",
  minigameVersion: "000000R1",
};

const DISCORD = {
  APPLICATION_ID: "1014618385507692635",
  SWITCH_URL: "https://app.cpatake.boo/assets/desktop/newrpc/switch.txt",
  INFO_URL: "https://app.cpatake.boo/assets/desktop/newrpc/info.json",
  DEFAULT_STATE: "Exploring the Island",
  DEFAULT_DETAILS: "www.cpatake.boo",
  DEFAULT_IMAGE_KEY: "logoicon-onelive",
  STATE_ROTATION_MS: 3 * 60 * 1000,
};

const SENTRY = {
  DSN: "https://5779734913abdcc9df38156c539ae191@o4508235608555520.ingest.de.sentry.io/4510244448174160",
};

const NETWORK = {
  TIMEOUT_MS: 10000,
  MAX_RESPONSE_BYTES: 1024 * 1024,
};

const BEHAVIOUR = {
  CLEAR_CACHE_ON_START: false,
  STRICT_TLS: process.env.CPATAKE_STRICT_TLS === "1",
};

module.exports = {
  APP,
  ALLOWED_PERMISSIONS,
  BEHAVIOUR,
  DISCORD,
  ERAS,
  FALLBACK_CACHE_KEYS,
  FLASH,
  NETWORK,
  SENTRY,
  TRUSTED_DOMAINS,
};