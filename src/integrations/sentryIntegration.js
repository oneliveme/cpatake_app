const Sentry = require('@sentry/electron');

const SENTRY_DSN = 'https://5779734913abdcc9df38156c539ae191@o4508235608555520.ingest.de.sentry.io/4510244448174160';

const APP_VERSION = require('../../package.json').version;

function initSentry() {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    release: `clubpenguinatake@${APP_VERSION}`,
    environment: process.env.NODE_ENV || 'production',
    sampleRate: 1.0,
    autoSessionTracking: true,
    debug: false,
  });
  
  console.log('[Sentry] Initialized for', process.type || 'main', 'process');
}

module.exports = {
  initSentry
};
