// the preload script for now only has sentry, we do not use it for anything else yet
const { initSentryRenderer } = require('./integrations/sentryIntegration');

initSentryRenderer();

console.log('[Preload] Sentry initialized for renderer');