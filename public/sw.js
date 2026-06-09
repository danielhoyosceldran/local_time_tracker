// Minimal service worker: required only so the app is installable as a PWA.
// It does NOT cache anything — every request goes straight to the network, so
// the app keeps requiring an internet connection (no offline support by design).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // No-op: let the browser handle the request against the network as usual.
});
