// Bet Lab migration cleanup (2026-11-02): the previous BetIQ Pro build's
// cache-first service worker (cache 'betiq-v1') kept serving the old app
// shell to returning browsers, hiding the current Bet Lab site and its
// cloud sign-in. This worker clears all caches, unregisters itself, and
// reloads open pages so every browser loads the live site from the network.
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  })());
});
