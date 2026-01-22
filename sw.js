// Service Worker for Time Budget Tracker
const CACHE_NAME = 'time-budget-v1';
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});

// Background sync for notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'activity-reminder') {
    event.waitUntil(sendReminders());
  }
});

function sendReminders() {
  return self.registration.showNotification('Time Budget Reminder', {
    body: 'Check your activities!',
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  });
}
