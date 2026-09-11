const CACHE_NAME = 'spirit-to-all-v8';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.error('Push no válido:', error);
  }

  const title = data.title || 'Spirit to All';

  const options = {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [120, 60, 120],
    data: {
      evento_id: data.evento_id || null,
      ensayo_id: data.ensayo_id || null,
      destino: data.destino || null
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const destino = data.destino || '';
  const eventoId = data.evento_id || null;
  const ensayoId = data.ensayo_id || null;

  let url = './';

  if (destino === 'solicitudes') {
    url = './?admin=pendientes';
  } else if (destino === 'calendario') {
    url = ensayoId
      ? `./?calendario=1&ensayo=${encodeURIComponent(ensayoId)}`
      : './?calendario=1';
  } else if (eventoId) {
    url = `./?evento=${encodeURIComponent(eventoId)}`;
  }

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      for (const client of clientList) {
        try {
          if ('focus' in client) {
            await client.navigate(url);
            return client.focus();
          }
        } catch (error) {
          console.error('No se pudo reutilizar ventana:', error);
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })()
  );
});
