/// <reference lib="webworker" />
// Offline-only service worker: precaches the app shell so Rituals opens without a network.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
try {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
} catch {
  /* dev mode: index.html not precached */
}
