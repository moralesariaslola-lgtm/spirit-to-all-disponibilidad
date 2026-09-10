const CACHE_NAME = 'spirit-to-all-v6';

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
      .catch(error => {
        console.error('Error creando la caché:', error);
      })
  );

  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copia = response.clone();

        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, copia))
          .catch(() => {});

        return response;
      })
      .catch(async () => {
        const respuestaCache = await caches.match(event.request);

        if (respuestaCache) return respuestaCache;

        if (event.request.mode === 'navigate') {
          return caches.match('/spirit-to-all-disponibilidad/index.html');
        }

        return Response.error();
      })
  );
});

self.addEventListener('push', event => {
  let datos = {
    title: 'Spirit to All',
    body: 'Tienes una nueva notificación.',
    evento_id: null,
    destino: null
  };

  try {
    if (event.data) {
      datos = {
        ...datos,
        ...event.data.json()
      };
    }
  } catch (error) {
    console.error('No se pudo leer la notificación push:', error);
  }

  const opciones = {
    body: datos.body,
    icon: '/spirit-to-all-disponibilidad/icon-192.png',
    badge: '/spirit-to-all-disponibilidad/icon-192.png',
    data: {
      evento_id: datos.evento_id,
      destino: datos.destino
    }
  };

  event.waitUntil(
    self.registration.showNotification(
      datos.title || 'Spirit to All',
      opciones
    )
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  let url = '/spirit-to-all-disponibilidad/';

  if (event.notification.data?.destino === 'solicitudes') {
    url += '?admin=pendientes';
  } else if (event.notification.data?.evento_id) {
    url += '?evento=' + encodeURIComponent(event.notification.data.evento_id);
  }

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(ventanas => {
      for (const ventana of ventanas) {
        if ('navigate' in ventana) {
          ventana.navigate(url);
          return ventana.focus();
        }
      }

      return clients.openWindow(url);
    })
  );
});
