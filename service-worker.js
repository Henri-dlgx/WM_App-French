self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

const APP_URL = '/';
const ICON    = '/icon-192.png';

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'WoodMood', {
      body:     data.body ?? '',
      icon:     ICON,
      badge:    ICON,
      tag:      data.tag ?? 'woodmood',
      renotify: true,
      vibrate:  [200, 100, 200],
      data:     { url: self.location.origin + APP_URL }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url ?? (self.location.origin + APP_URL);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const match = list.find(c => c.url.startsWith(self.location.origin + APP_URL));
      if (match) return match.focus();
      return clients.openWindow(target);
    })
  );
});
