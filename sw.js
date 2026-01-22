// Service Worker for Time Budget Tracker
const CACHE_NAME = 'time-budget-v3';
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

// Push event for notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Time Budget', body: 'Check your activities!' };
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        url: self.location.origin
      }
    })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// Background sync for reminders
self.addEventListener('sync', (event) => {
  if (event.tag === 'activity-reminder') {
    event.waitUntil(sendLocalReminder());
  }
});

function sendLocalReminder() {
  return self.registration.showNotification('Time Budget Reminder', {
    body: 'Time to check your schedule!',
    icon: './icon-192.png',
    badge: './icon-192.png'
  });
}


