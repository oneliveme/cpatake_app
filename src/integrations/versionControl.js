const https = require('https');

const ERA_CONFIG = {
  'AS1': {
    host: 'as1.cpatake.boo',
    cdn: 'antique.cpa.olcdns.com',
    jsonUrl: 'https://nocache.fullmoon.dev/VersionControl/ClubPenguinAtake/Service/AS1.json?nocache=true'
  },
  'AS2': {
    host: 'as2.cpatake.boo',
    cdn: 'legacy.cpa.olcdns.com',
    jsonUrl: 'https://nocache.fullmoon.dev/VersionControl/ClubPenguinAtake/Service/AS2.json?nocache=true'
  },
  'EP': {
    host: 'ep.cpatake.boo',
    cdn: 'experimentalpenguins.cpa.olcdns.com',
    jsonUrl: 'https://nocache.fullmoon.dev/VersionControl/ClubPenguinAtake/Service/EP.json?nocache=true'
  },
  'PC': {
    host: 'pc.cpatake.boo',
    cdn: 'penguinchat.cpa.olcdns.com',
    jsonUrl: 'https://nocache.fullmoon.dev/VersionControl/ClubPenguinAtake/Service/PC.json?nocache=true'
  },
  'PC3': {
    host: 'pc3.cpatake.boo',
    cdn: 'penguinchat3.cpa.olcdns.com',
    jsonUrl: 'https://nocache.fullmoon.dev/VersionControl/ClubPenguinAtake/Service/PC3.json?nocache=true'
  }
};

const versionCache = {};

function fetchVersionData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function loadVersionData() {
  console.log('[Version Control] Loading version data for all eras...');
  
  for (const [eraName, config] of Object.entries(ERA_CONFIG)) {
    try {
      const versionData = await fetchVersionData(config.jsonUrl);
      versionCache[eraName] = versionData.cacheKeys;
      console.log(`[Version Control] Loaded ${eraName}:`, versionData.cacheKeys);
    } catch (error) {
      console.error(`[Version Control] Failed to load ${eraName}:`, error.message);
      versionCache[eraName] = {
        clientVersion: '000000R1',
        contentVersion: '000000R1',
        minigameVersion: '000000R1'
      };
    }
  }
}

function getEraFromCdn(hostname) {
  for (const [eraName, config] of Object.entries(ERA_CONFIG)) {
    if (hostname === config.cdn) {
      return eraName;
    }
  }
  return null;
}

function getCacheKeyForPath(eraName, urlPath) {
  const versions = versionCache[eraName];
  if (!versions) return null;

  if (urlPath.includes('/play/v2/client/')) {
    return versions.clientVersion;
  } else if (urlPath.includes('/play/v2/content/')) {
    return versions.contentVersion;
  } else if (urlPath.includes('/play/v2/games/')) {
    return versions.minigameVersion;
  }
  
  return null;
}

function setupVersionControl(session) {
  const cdnUrls = Object.values(ERA_CONFIG).map(config => `*://${config.cdn}/*`);
  
  session.webRequest.onBeforeRequest(
    { urls: cdnUrls },
    (details, callback) => {
      const url = new URL(details.url);
      const hostname = url.hostname;
      const pathname = url.pathname;
      
      if (!pathname.endsWith('.swf')) {
        callback({ cancel: false });
        return;
      }
      
      if (url.searchParams.has('ver')) {
        callback({ cancel: false });
        return;
      }
      
      const eraName = getEraFromCdn(hostname);
      if (!eraName) {
        callback({ cancel: false });
        return;
      }
      
      const cacheKey = getCacheKeyForPath(eraName, pathname);
      if (!cacheKey) {
        callback({ cancel: false });
        return;
      }
      
      url.searchParams.set('ver', cacheKey);
      const newUrl = url.toString();
      
      console.log(`[Version Control] Redirecting: ${details.url} -> ${newUrl}`);
      
      callback({ redirectURL: newUrl });
    }
  );
  
  console.log('[Version Control] Request interception setup complete');
}

async function initVersionControl(session) {
  try {
    await loadVersionData();
    setupVersionControl(session);
    console.log('[Version Control] Initialization complete');
  } catch (error) {
    console.error('[Version Control] Initialization failed:', error);
  }
}

module.exports = { initVersionControl };