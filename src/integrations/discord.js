const RPC = require('discord-rpc');
const https = require('https');

const APPLICATION_ID = '1014618385507692635';

RPC.register(APPLICATION_ID);

let rpcClient = null;
let states = [];
let currentStateIndex = 0;
let stateInterval = null;
let currentActivity = null;
let isInitialized = false;
let isConnected = false;
let cleanupInProgress = false;

function rotateState() {
  if (states.length === 0 || !rpcClient || !isConnected) return;
  currentStateIndex = (currentStateIndex + 1) % states.length;
  try {
    rpcClient.setActivity({
      state: states[currentStateIndex],
      details: currentActivity?.details || "www.cpatake.boo",
      largeImageKey: currentActivity?.largeImageKey || "logoicon-onelive",
      startTimestamp: currentActivity?.startTimestamp || Date.now(),
      instance: true,
    });
  } catch (error) {
    console.error('[Discord RPC] Error rotating state:', error);
  }
}

async function onRpcReady() {
  isConnected = true;
  console.log('[Discord RPC] Connected');

  try {
    const rpcData = await updateStates();
    if (!rpcData || !isConnected) return;

    currentActivity = {
      state: rpcData.state,
      details: rpcData.details,
      startTimestamp: Date.now(),
      largeImageKey: rpcData.largeImageKey,
    };

    if (rpcClient && isConnected) {
      rpcClient.setActivity(currentActivity);
    }

    if (stateInterval) {
      clearInterval(stateInterval);
      stateInterval = null;
    }

    if (states.length > 1 && isConnected) {
      stateInterval = setInterval(rotateState, 3 * 60 * 1000);
    }
  } catch (error) {
    console.error('[Discord RPC] Error in onRpcReady:', error);
  }
}

function fetchTextContent(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data.trim()));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function fetchJsonContent(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function updateStates() {
  const switchContent = await fetchTextContent('https://app.cpatake.boo/assets/desktop/newrpc/switch.txt');
  if (switchContent === '0') {
    return {
      state: "Exploring the Island",
      details: "www.cpatake.boo",
      largeImageKey: "logoicon-onelive"
    };
  }

  const rpcInfo = await fetchJsonContent('https://app.cpatake.boo/assets/desktop/newrpc/info.json');
  if (!rpcInfo) return null;

  const statesContent = await fetchTextContent(rpcInfo.statesUrl);
  if (statesContent) {
    states = statesContent.split('\n').filter(state => state.trim());
  }

  return {
    state: states[0] || "Exploring the Island",
    details: rpcInfo.details,
    largeImageKey: rpcInfo.largeImageKey
  };
}

function initDiscordRichPresence() {
  if (isInitialized) return;
  isInitialized = true;

  try {
    rpcClient = new RPC.Client({ transport: 'ipc' });

    rpcClient.on('ready', onRpcReady);

    rpcClient.on('disconnected', () => {
      console.log('[Discord RPC] Disconnected');
      isConnected = false;
    });

    rpcClient.login({
      clientId: APPLICATION_ID
    }).catch((error) => {
      console.error('[Discord RPC] Login failed:', error.message);
      isConnected = false;
    });
  } catch (error) {
    console.error('[Discord RPC] Initialization failed:', error);
  }
}

async function cleanup() {
  if (cleanupInProgress) return;
  cleanupInProgress = true;

  console.log('[Discord RPC] Cleaning up...');

  if (stateInterval) {
    clearInterval(stateInterval);
    stateInterval = null;
  }

  if (rpcClient) {
    try {
      rpcClient.removeAllListeners();

      if (isConnected) {
        await rpcClient.clearActivity().catch(() => { });
        await rpcClient.destroy();
      }
    } catch (error) {
      console.error('[Discord RPC] Cleanup error:', error);
    } finally {
      rpcClient = null;
    }
  }

  isConnected = false;
  isInitialized = false;
  cleanupInProgress = false;

  console.log('[Discord RPC] Cleanup complete');
}

module.exports = { initDiscordRichPresence, cleanup };