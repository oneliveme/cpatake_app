const RPC = require('discord-rpc');
const https = require('https');

const rpcClient = new RPC.Client({ transport: 'ipc' });
const APPLICATION_ID = '1014618385507692635';

RPC.register(APPLICATION_ID);

let states = [];
let currentStateIndex = 0;
let stateInterval;
let currentActivity = null;
let isInitialized = false;

function rotateState() {
  if (states.length === 0) return;
  currentStateIndex = (currentStateIndex + 1) % states.length;
  rpcClient.setActivity({
    state: states[currentStateIndex],
    details: currentActivity?.details || "www.cpatake.boo",
    largeImageKey: currentActivity?.largeImageKey || "logoicon-onelive",
    startTimestamp: currentActivity?.startTimestamp || Date.now(),
    instance: true,
  });
}

async function onRpcReady() {
  const rpcData = await updateStates();
  if (!rpcData) return;
  
  currentActivity = {
    state: rpcData.state,
    details: rpcData.details,
    startTimestamp: Date.now(),
    largeImageKey: rpcData.largeImageKey,
  };
  
  rpcClient.setActivity(currentActivity);
  
  if (stateInterval) {
    clearInterval(stateInterval);
    stateInterval = null;
  }
  
  if (states.length > 1) {
    stateInterval = setInterval(rotateState, 3 * 60 * 1000);
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
  
  rpcClient.on('ready', onRpcReady);
  rpcClient.login({
    clientId: APPLICATION_ID
  }).catch(console.error);
}

function cleanup() {
  if (stateInterval) {
    clearInterval(stateInterval);
    stateInterval = null;
  }
  
  rpcClient.removeAllListeners('ready');
  
  if (rpcClient) {
    rpcClient.destroy().catch(console.error);
  }
  
  isInitialized = false;
}

module.exports = { initDiscordRichPresence, cleanup };