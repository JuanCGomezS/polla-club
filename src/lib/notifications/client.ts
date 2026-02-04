import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';

let messaging: Messaging | null = null;

// Inicializar messaging solo en el cliente
export function getMessagingInstance() {
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (!messaging) {
    try {
      messaging = getMessaging();
    } catch (error) {
      console.error('Error inicializando Firebase Messaging:', error);
      return null;
    }
  }
  
  return messaging;
}

/**
 * Solicitar permiso de notificaciones y obtener token FCM
 * @returns Token FCM o null si falla
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    // Verificar soporte de notificaciones
    if (!('Notification' in window)) {
      console.error('Este navegador no soporta notificaciones');
      return null;
    }

    // Asegurar que el Service Worker esté registrado con la scope correcta
    if ('serviceWorker' in navigator) {
      try {
        const base = (document.documentElement.dataset.base as string) || '/';
        const normalizedBase = base.endsWith('/') ? base : `${base}/`;
        const swPath = `${normalizedBase}firebase-messaging-sw.js`;
        
        console.log('🔧 DEBUG: Intentando registrar SW en:', swPath);
        console.log('🔧 DEBUG: Scope:', normalizedBase);
        
        await navigator.serviceWorker.register(swPath, {
          scope: normalizedBase
        });
        console.log('✅ Service Worker pre-registrado para Firebase Messaging');
      } catch (swError) {
        console.error('❌ Error pre-registrando Service Worker:', swError);
        throw new Error(`Service Worker falló: ${swError}`);
      }
    }

    // Solicitar permiso
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('Permiso de notificaciones denegado');
      return null;
    }

    console.log('✅ Permiso de notificaciones concedido');

    // Obtener instancia de messaging
    const messagingInstance = getMessagingInstance();
    if (!messagingInstance) {
      console.error('No se pudo inicializar Firebase Messaging');
      return null;
    }

    // Obtener token FCM
    const vapidKey = import.meta.env.PUBLIC_FIREBASE_VAPID_KEY;
    console.log('🔧 DEBUG: VAPID key presente?', !!vapidKey);
    
    if (!vapidKey) {
      console.error('PUBLIC_FIREBASE_VAPID_KEY no está configurada');
      throw new Error('VAPID key no configurada');
    }

    console.log('🔧 DEBUG: Esperando Service Worker ready...');
    const swRegistration = await navigator.serviceWorker.ready;
    console.log('🔧 DEBUG: Service Worker ready:', swRegistration.scope);

    console.log('🔧 DEBUG: Solicitando token FCM...');
    const token = await getToken(messagingInstance, {
      vapidKey: vapidKey,
      serviceWorkerRegistration: swRegistration
    });

    if (!token) {
      console.error('No se pudo obtener el token FCM');
      throw new Error('Token FCM no obtenido');
    }

    console.log('✅ Token FCM obtenido:', token.substring(0, 20) + '...');

    // Guardar token en Firestore
    const user = auth.currentUser;
    console.log('🔧 DEBUG: Usuario actual?', !!user, user?.uid);
    
    if (user) {
      console.log('🔧 DEBUG: Guardando token en Firestore...');
      await saveTokenToFirestore(user.uid, token);
      console.log('✅ Token guardado exitosamente en Firestore');
    } else {
      throw new Error('Usuario no autenticado');
    }

    return token;
  } catch (error) {
    console.error('❌ Error al solicitar permiso de notificaciones:', error);
    throw error; // Re-throw para que el componente lo capture
  }
}

/**
 * Guardar token FCM en Firestore
 */
async function saveTokenToFirestore(userId: string, token: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      fcmTokens: arrayUnion(token),
      lastTokenUpdate: new Date()
    });
    console.log('✅ Token guardado en Firestore');
  } catch (error) {
    console.error('Error guardando token en Firestore:', error);
    throw error;
  }
}

/**
 * Escuchar notificaciones cuando la app está abierta (foreground)
 */
export function listenToForegroundMessages(
  callback: (payload: any) => void
): (() => void) | null {
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) {
    return null;
  }

  const unsubscribe = onMessage(messagingInstance, (payload) => {
    console.log('📩 Notificación recibida (foreground):', payload);
    callback(payload);

    // Mostrar notificación del navegador si tiene permiso
    if (Notification.permission === 'granted' && payload.notification) {
      new Notification(payload.notification.title || 'PollaClub', {
        body: payload.notification.body || '',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: payload.data
      });
    }
  });

  return unsubscribe;
}

/**
 * Verificar estado de permisos de notificaciones
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Verificar si las notificaciones están soportadas
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}
