const { ERAS, FALLBACK_CACHE_KEYS } = require("../config");
const { fetchJson } = require("../lib/http");
const createLogger = require("../lib/log");

const log = createLogger("Version Control");

const versionCache = {};

let isVersionDataComplete = false;

const CDN_TO_ERA = new Map(
  Object.entries(ERAS).map(([era, config]) => [config.cdn, era])
);

const PATH_VERSION_KEYS = [
  ["/play/v2/client/", "clientVersion"],
  ["/play/v2/content/", "contentVersion"],
  ["/play/v2/games/", "minigameVersion"],
];

function isValidCacheKeys(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.clientVersion === "string" &&
    typeof value.contentVersion === "string" &&
    typeof value.minigameVersion === "string"
  );
}

async function loadVersionData() {
  log.info("Loading version data for all eras...");

  let allLoaded = true;

  await Promise.all(
    Object.entries(ERAS).map(async ([era, config]) => {
      try {
        const manifest = await fetchJson(config.jsonUrl);

        if (!isValidCacheKeys(manifest?.cacheKeys)) {
          throw new Error("manifest missing valid cacheKeys");
        }

        versionCache[era] = manifest.cacheKeys;
        log.info(`Loaded ${era}:`, manifest.cacheKeys);
      } catch (error) {
        log.error(`Failed to load ${era}: ${error.message} — using fallback`);
        versionCache[era] = { ...FALLBACK_CACHE_KEYS };
        allLoaded = false;
      }
    })
  );

  return allLoaded;
}

function getCacheKeyForPath(era, urlPath) {
  const versions = versionCache[era];
  if (!versions) return null;

  const match = PATH_VERSION_KEYS.find(([fragment]) => urlPath.includes(fragment));
  return match ? versions[match[1]] : null;
}

function setupVersionControl(session) {
  const cdnUrls = Object.values(ERAS).map((config) => `*://${config.cdn}/*`);

  session.webRequest.onBeforeRequest({ urls: cdnUrls }, (details, callback) => {
    let url;
    try {
      url = new URL(details.url);
    } catch {
      callback({ cancel: false });
      return;
    }

    if (!url.pathname.endsWith(".swf") || url.searchParams.has("ver")) {
      callback({ cancel: false });
      return;
    }

    const era = CDN_TO_ERA.get(url.hostname);
    const cacheKey = era && getCacheKeyForPath(era, url.pathname);
    if (!cacheKey) {
      callback({ cancel: false });
      return;
    }

    url.searchParams.set("ver", cacheKey);
    log.info(`Versioned ${url.pathname} -> ver=${cacheKey}`);
    callback({ redirectURL: url.toString() });
  });

  log.info("Request interception active");
}

async function initVersionControl(session) {
  if (!isVersionDataComplete) {
    try {
      isVersionDataComplete = await loadVersionData();
    } catch (error) {
      log.error("Failed to load version data:", error);
    }
  }

  try {
    setupVersionControl(session);
  } catch (error) {
    log.error("Failed to install request interception:", error);
  }
}

module.exports = { initVersionControl };