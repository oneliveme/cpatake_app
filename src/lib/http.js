const https = require("https");
const { NETWORK } = require("../config");

const MAX_REDIRECTS = 3;

function fetchText(url, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }

    if (parsed.protocol !== "https:") {
      reject(new Error(`Refusing non-https URL: ${url}`));
      return;
    }

    const request = https.get(parsed, { timeout: NETWORK.TIMEOUT_MS }, (res) => {
      const { statusCode, headers } = res;

      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        res.resume();
        if (redirectsLeft <= 0) {
          reject(new Error(`Too many redirects for ${url}`));
          return;
        }
        const next = new URL(headers.location, parsed).toString();
        fetchText(next, redirectsLeft - 1).then(resolve, reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP ${statusCode} for ${url}`));
        return;
      }

      let body = "";
      let bytes = 0;

      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > NETWORK.MAX_RESPONSE_BYTES) {
          request.destroy();
          reject(new Error(`Response too large for ${url}`));
          return;
        }
        body += chunk;
      });
      res.on("end", () => resolve(body.trim()));
      res.on("error", reject);
    });

    request.on("timeout", () => {
      request.destroy(new Error(`Timed out after ${NETWORK.TIMEOUT_MS}ms: ${url}`));
    });
    request.on("error", reject);
  });
}

async function fetchJson(url) {
  const body = await fetchText(url);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Malformed JSON from ${url}`);
  }
}

module.exports = { fetchText, fetchJson };