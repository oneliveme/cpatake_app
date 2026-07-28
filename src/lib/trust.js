const { TRUSTED_DOMAINS } = require("../config");

function isTrustedUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return TRUSTED_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
}

function isWebUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function safeHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

module.exports = { isTrustedUrl, isWebUrl, safeHost };