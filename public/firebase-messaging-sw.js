importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');


const firebaseConfig = {
  apiKey: "AIzaSyCx4VN7vPa4UwIH4j91OvCl1S4zGjHNESQ",
  authDomain: "polla-club.firebaseapp.com",
  projectId: "polla-club",
  storageBucket: "polla-club.firebasestorage.app",
  messagingSenderId: "481073733993",
  appId: "1:481073733993:web:de3856a48f87d1c9e8f8cc"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Manejar notificaciones cuando la app está en background o cerrada
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notificación recibida en background:', payload);
  
  const notificationTitle = payload.notification?.title || 'PollaClub';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: payload.data || {},
    tag: payload.data?.matchId || 'default', // Para no duplicar notificaciones del mismo partido
    requireInteraction: false, // Se cierra automáticamente después de un tiempo
    vibrate: [200, 100, 200] // Vibración en móviles
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar click en la notificación
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Click en notificación:', event.notification);
  
  event.notification.close();
  
  // Obtener URL del grupo desde los datos de la notificación
  const groupId = event.notification.data?.groupId;
  const baseUrl = self.location.origin;
  const urlToOpen = groupId ? `${baseUrl}/groups/${groupId}` : baseUrl;
  
  // Abrir o enfocar la ventana
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Buscar si ya hay una ventana abierta con la URL
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no hay ventana abierta, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Log cuando el service worker se activa
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker activado');
});

// Log cuando el service worker se instala
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker instalado');
  self.skipWaiting(); // Activar inmediatamente
});
