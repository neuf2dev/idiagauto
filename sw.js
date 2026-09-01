const CACHE_NAME = 'idiagauto-v3';

self.addEventListener('install', (event) => {
  // Force l'activation immédiate du nouveau Service Worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Supprime tous les anciens caches pour éviter les écrans blancs
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Stratégie réseau d'abord : va chercher le code frais sur le serveur
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});