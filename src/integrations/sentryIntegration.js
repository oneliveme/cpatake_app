const { init: initMain } = require('@sentry/electron/main');
const { init: initRenderer } = require('@sentry/electron/renderer');

const SENTRY_DSN = 'https://5779734913abdcc9df38156c539ae191@o4508235608555520.ingest.de.sentry.io/4510244448174160';

const APP_VERSION = require('../../package.json').version;

function initSentryMain() {
  initMain({
    dsn: SENTRY_DSN,
    release: `clubpenguinatake@${APP_VERSION}`,
    environment: process.env.NODE_ENV || 'development',
    sampleRate: 1.0,
    
    integrations: (integrations) => {
      return integrations;
    },
    
    debug: false,
    autoSessionTracking: true,
  });
  
  console.log('[Sentry] Main process initialized');
}

function initSentryRenderer() {
  initRenderer({
    dsn: SENTRY_DSN,
    release: `clubpenguinatake@${APP_VERSION}`,
    environment: process.env.NODE_ENV || 'development',
    sampleRate: 1.0,
    debug: false,
    autoSessionTracking: true,
    
    beforeSend(event, hint) {
      if (event.user) {
        delete event.user.ip_address;
      }
      
      return event;
    },
  });
  
  console.log('[Sentry] Renderer process initialized');
}

module.exports = {
  initSentryMain,
  initSentryRenderer
};