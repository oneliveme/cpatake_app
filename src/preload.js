// the preload script for now only has sentry, we do not use it for anything else yet
const { initSentry } = require('./integrations/sentryIntegration');

initSentry();

console.log('[Preload] Sentry initialized for renderer');