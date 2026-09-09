const CACHE_NAME = 'spirit-to-all-v1';

const APP_SHELL = [
  '/spirit-to-all-disponibilidad/',
  '/spirit-to-all-disponibilidad/index.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
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

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, copia);
        });

        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
self.addEventListener('push', event => {

  let datos={
    title:'Spirit to All',
    body:'Tienes una nueva notificación.',
    evento_id:null
  };

  try{
    if(event.data){
      datos={...datos,...event.data.json()};
    }
  }catch(error){
    console.error('Error leyendo push:',error);
  }

  const opciones={
    body:datos.body,
    icon:'./icon-192.png',
    badge:'./icon-192.png',
    data:{
      evento_id:datos.evento_id
    }
  };

  event.waitUntil(
    self.registration.showNotification(
      datos.title||'Spirit to All',
      opciones
    )
  );
});

self.addEventListener('notificationclick', event => {

  event.notification.close();

  let url='/spirit-to-all-disponibilidad/';

  if(event.notification.data?.evento_id){
    url+='?evento='+encodeURIComponent(
      event.notification.data.evento_id
    );
  }

  event.waitUntil(
    clients.openWindow(url)
  );
});
