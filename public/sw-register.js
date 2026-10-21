// Register the minimal service worker so the app is installable.
// It performs no caching, so the app still requires an internet connection.
// Kept as a file (not inline in index.html) so the CSP needs no script hash.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.error('SW registration failed:', err);
    });
  });
}
