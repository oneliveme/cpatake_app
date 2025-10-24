const SENTRY_DSN = 'https://5779734913abdcc9df38156c539ae191@o4508235608555520.ingest.de.sentry.io/4510244448174160';

const APP_VERSION = require('../../package.json').version;

const commonConfig = {
  dsn: SENTRY_DSN,
  release: `clubpenguinatake@${APP_VERSION}`,
  environment: process.env.NODE_ENV || 'production',
  sampleRate: 1.0,
  autoSessionTracking: true,
  debug: false
};

function initSentryMain() {
  const { init } = require('@sentry/electron/main');
  init(commonConfig);
  console.log('[Sentry] Main process initialized');
}

function initSentryRenderer() {
  const { init } = require('@sentry/electron/renderer');
  init(commonConfig);
  console.log('[Sentry] Renderer process initialized');
}

module.exports = {
  initSentryMain,
  initSentryRenderer
};