self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

const APP_URL       = '/';
const ICON          = '/icon-192.png';
const THROTTLE_CACHE = 'wm-push-throttle-v1';
const COOLDOWN_MS   = 60_000;   // matches the foreground _pushThrottle in index.html

// Service workers get killed and restarted between events, so an in-memory
// last-fired timestamp wouldn't survive — Cache Storage does. This is the last
// line of defense: whatever upstream cause produces a duplicate push for the
// same tag (double MQTT delivery, a relay retry, focused-tab misdetection on
// some browsers), no single notification type can show twice within a minute.
async function shouldThrottle(tag) {
  const cache = await caches.open(THROTTLE_CACHE);
  const key   = new Request('https://woodmood.internal/throttle/' + tag);
  const hit   = await cache.match(key);
  const now   = Date.now();
  if (hit) {
    const last = parseInt(await hit.text(), 10);
    if (!isNaN(last) && now - last < COOLDOWN_MS) return true;
  }
  await cache.put(key, new Response(String(now)));
  return false;
}

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  const tag  = data.tag ?? 'woodmood';
  event.waitUntil(
    (async () => {
      // If a WoodMood tab is open and focused, the page already showed its own
      // Notification from the live MQTT status (see triggerPush() in index.html) —
      // showing this one too would duplicate it. Only the service worker path can
      // reach the user when no tab is open, so skip here in that one case.
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      const hasFocusedTab = windows.some(c => c.focused);
      if (hasFocusedTab) return;

      if (await shouldThrottle(tag)) return;

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
