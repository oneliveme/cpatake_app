const { app, shell } = require("electron");

const { ALLOWED_PERMISSIONS, BEHAVIOUR, FLASH } = require("../config");
const createLogger = require("../lib/log");
const { isTrustedUrl, isWebUrl, safeHost } = require("../lib/trust");

const log = createLogger("Security");

function applyCommandLineSwitches() {
  const pluginPath = FLASH.PLUGIN_PATHS[process.platform];

  if (pluginPath) {
    log.info(`Flash plugin: ${pluginPath}`);
    app.commandLine.appendSwitch("ppapi-flash-path", pluginPath);
    app.commandLine.appendSwitch("ppapi-flash-version", FLASH.VERSION);
  } else {
    log.warn(`No Flash plugin bundled for platform "${process.platform}"`);
  }

  if (process.platform === "linux") {
    app.commandLine.appendSwitch("no-sandbox");
  }
}

function hardenedWebPreferences(preloadPath) {
  return {
    plugins: true,
    preload: preloadPath,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    contextIsolation: true,
    enableRemoteModule: false,
    webviewTag: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    safeDialogs: true,
  };
}

function installCertificateHandling(onSecurityEvent) {
  app.on("certificate-error", (event, _webContents, url, error, _cert, callback) => {
    const host = safeHost(url);

    if (BEHAVIOUR.STRICT_TLS || !isTrustedUrl(url)) {
      log.error(`Blocked ${host}: certificate error (${error})`);
      callback(false);
      return;
    }

    log.warn(`Allowing certificate error on trusted host ${host} (${error})`);
    onSecurityEvent?.(`TLS certificate error allowed for ${host}: ${error}`);
    event.preventDefault();
    callback(true);
  });
}

function hardenSession(session) {
  const allowed = new Set(ALLOWED_PERMISSIONS);

  session.setPermissionRequestHandler((contents, permission, callback) => {
    const requester = contents?.getURL() ?? "";

    if (!isTrustedUrl(requester) || !allowed.has(permission)) {
      log.warn(`Denied "${permission}" to ${safeHost(requester) || "unknown origin"}`);
      callback(false);
      return;
    }

    callback(true);
  });

  session.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    return allowed.has(permission) && isTrustedUrl(requestingOrigin);
  });
}

function installWebContentsHardening() {
  app.on("web-contents-created", (_event, contents) => {
    const blockUntrusted = (event, url) => {
      if (isTrustedUrl(url)) return;
      log.warn(`Blocked navigation to ${safeHost(url) || url}`);
      event.preventDefault();
    };

    contents.on("will-navigate", blockUntrusted);
    contents.on("will-redirect", blockUntrusted);

    contents.on("new-window", (event, url) => {
      if (isTrustedUrl(url)) return;

      event.preventDefault();

      if (isWebUrl(url)) {
        log.info(`Opening externally: ${safeHost(url)}`);
        shell.openExternal(url).catch((err) => log.error("openExternal failed:", err));
      } else {
        log.warn(`Blocked window.open for non-web URL: ${url}`);
      }
    });

    contents.on("will-attach-webview", (event, webPreferences) => {
      delete webPreferences.preload;
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      log.warn("Blocked <webview> attachment");
      event.preventDefault();
    });
  });
}

module.exports = {
  applyCommandLineSwitches,
  hardenSession,
  hardenedWebPreferences,
  installCertificateHandling,
  installWebContentsHardening,
};