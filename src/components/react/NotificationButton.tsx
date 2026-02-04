import { useEffect, useState } from 'react';
import {
  requestNotificationPermission,
  getNotificationPermission,
  isNotificationSupported,
  listenToForegroundMessages
} from '../../lib/notifications';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function NotificationButton() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);
  const [hasTokenInDb, setHasTokenInDb] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  useEffect(() => {
    // Verificar soporte y estado inicial
    setSupported(isNotificationSupported());
    setPermission(getNotificationPermission());

    // Verificar si el usuario tiene token guardado en Firestore
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const tokens = data?.fcmTokens || [];
            setHasTokenInDb(tokens.length > 0);
          }
        } catch (error) {
          console.error('Error verificando token en DB:', error);
        }
      }
      setCheckingToken(false);
    });

    // Escuchar notificaciones cuando la app está abierta
    const unsubscribe = listenToForegroundMessages((payload) => {
      console.log('Notificación recibida en componente:', payload);
      // Aquí puedes agregar un toast o alert personalizado si lo deseas
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      const token = await requestNotificationPermission();
      if (token) {
        setPermission('granted');
        setHasTokenInDb(true);
      } else {
        setPermission(getNotificationPermission());
      }
    } catch (error) {
      console.error('Error al activar notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return (
      <div className="text-sm text-gray-500 p-2 rounded bg-gray-50">
        <span className="mr-2">❌</span>
        Tu navegador no soporta notificaciones
      </div>
    );
  }

  if (permission === 'granted') {
    if (checkingToken) {
      return (
        <div className="text-sm text-gray-500 p-2 rounded bg-gray-50 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
          <span>Verificando token...</span>
        </div>
      );
    }

    if (!hasTokenInDb) {
      return (
        <div className="text-sm text-orange-700 bg-orange-50 p-3 rounded">
          <div className="flex items-center mb-1">
            <span className="mr-2">⚠️</span>
            <strong>Permiso concedido pero token no guardado</strong>
          </div>
          <button
            onClick={handleEnableNotifications}
            disabled={loading}
            className="text-xs bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 transition"
          >
            {loading ? 'Reintentando...' : 'Reintentar'}
          </button>
        </div>
      );
    }

    return (
      <div className="text-sm text-green-700 bg-green-50 p-2 rounded flex items-center">
        <span className="mr-2">✅</span>
        <span>Notificaciones activadas</span>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="text-sm text-red-700 bg-red-50 p-3 rounded">
        <div className="flex items-center mb-1">
          <span className="mr-2">🔕</span>
          <strong>Notificaciones bloqueadas</strong>
        </div>
        <p className="text-xs text-red-600 mt-1">
          Para activarlas, ve a la configuración de tu navegador y permite las notificaciones para este sitio.
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={handleEnableNotifications}
      disabled={loading}
      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {loading ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          <span>Activando...</span>
        </>
      ) : (
        <>
          <span>🔔</span>
          <span>Activar notificaciones</span>
        </>
      )}
    </button>
  );
}
