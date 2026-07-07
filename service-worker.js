self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

const APP_URL = '/';
const ICON    = '/icon-192.png';

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    (async () => {
      // If a WoodMood tab is open and focused, the page already showed its own
      // Notification from the live MQTT status (see triggerPush() in index.html) —
      // showing this one too would duplicate it. Only the service worker path can
      // reach the user when no tab is open, so skip here in that one case.
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      const hasFocusedTab = windows.some(c => c.focused);
      if (hasFocusedTab) return;

      await self.registration.showNotification(data.title ?? 'WoodMood', {
        body:     data.body ?? '',
        icon:     ICON,
        badge:    ICON,
        tag:      data.tag ?? 'woodmood',
        renotify: true,
        vibrate:  [200, 100, 200],
        data:     { url: self.location.origin + APP_URL }
      });
    })()
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
