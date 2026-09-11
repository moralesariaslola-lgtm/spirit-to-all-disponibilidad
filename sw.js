const CACHE_NAME = 'spirit-to-all-v9';

const APP_SHELL = [
  '/spirit-to-all-disponibilidad/',
  '/spirit-to-all-disponibilidad/index.html',
  '/spirit-to-all-disponibilidad/manifest.webmanifest',
  '/spirit-to-all-disponibilidad/icon-192.png',
  '/spirit-to-all-disponibilidad/icon-512.png',
  '/spirit-to-all-disponibilidad/logo-header.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(error =>
        console.error('Error creando la caché:', error)
      )
  );

  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copia = response.clone();

        caches.open(CACHE_NAME)
          .then(cache =>
            cache.put(event.request, copia)
          )
          .catch(() => {});

        return response;
      })
      .catch(async () => {
        const respuestaCache =
          await caches.match(
            event.request
          );

        if (respuestaCache) {
          return respuestaCache;
        }

        if (
          event.request.mode === 'navigate'
        ) {
          return caches.match(
            '/spirit-to-all-disponibilidad/index.html'
          );
        }

        return Response.error();
      })
  );
});

self.addEventListener('push', event => {
  let data = {};

  try {
    data = event.data
      ? event.data.json()
      : {};
  } catch (error) {
    console.error(
      'Push no válido:',
      error
    );
  }

  const title =
    data.title || 'Spirit to All';

  const options = {
    body: data.body || '',
    icon:
      '/spirit-to-all-disponibilidad/icon-192.png',
    badge:
      '/spirit-to-all-disponibilidad/icon-192.png',
    vibrate: [120, 60, 120],
    data: {
      evento_id:
        data.evento_id || null,
      ensayo_id:
        data.ensayo_id || null,
      destino:
        data.destino || null
    }
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});

self.addEventListener(
  'notificationclick',
  event => {
    event.notification.close();

    const data =
      event.notification.data || {};

    const destino =
      data.destino || '';

    const eventoId =
      data.evento_id || null;

    const ensayoId =
      data.ensayo_id || null;

    const destinoUrl =
      new URL(
        './',
        self.registration.scope
      );

    if (destino === 'solicitudes') {
      destinoUrl.searchParams.set(
        'admin',
        'pendientes'
      );

      destinoUrl.searchParams.set(
        'push',
        '1'
      );

    } else if (
      destino === 'calendario'
    ) {
      destinoUrl.searchParams.set(
        'calendario',
        '1'
      );

      if (ensayoId) {
        destinoUrl.searchParams.set(
          'ensayo',
          String(ensayoId)
        );
      }

    } else if (
      destino === 'inicio'
    ) {
      destinoUrl.searchParams.set(
        'aprobado',
        '1'
      );

    } else if (eventoId) {
      destinoUrl.searchParams.set(
        'evento',
        String(eventoId)
      );
    }

    const url =
      destinoUrl.href;

    event.waitUntil(
      (async () => {
        const clientList =
          await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
          });

        for (
          const client of clientList
        ) {
          try {
            if ('navigate' in client) {
              await client.navigate(url);
              return client.focus();
            }
          } catch (error) {
            console.error(
              'No se pudo reutilizar ventana:',
              error
            );
          }
        }

        if (
          self.clients.openWindow
        ) {
          return self.clients.openWindow(
            url
          );
        }
      })()
    );
  }
);
