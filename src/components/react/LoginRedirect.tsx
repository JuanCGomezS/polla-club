import { useEffect, useState } from 'react';
import { onAuthStateChange, getCurrentUser } from '../../lib/auth';
import { getRoute } from '../../lib/utils';

/**
 * Componente que redirige a /groups si el usuario ya está autenticado
 * Útil para la página de login
 */
export default function LoginRedirect() {
  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setMounted(true);
    
    // Verificar si ya hay un usuario autenticado
    const unsubscribe = onAuthStateChange((user) => {
      if (user) {
        // Si hay usuario, redirigir a grupos
        window.location.href = getRoute('/groups');
      } else {
        setChecking(false);
      }
    });

    const currentUser = getCurrentUser();
    if (currentUser) {
      window.location.href = getRoute('/groups');
    } else {
      setChecking(false);
    }

    return () => unsubscribe();
  }, []);

  // No renderizar nada hasta que esté montado (evitar mismatch de hidratación)
  if (!mounted || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return null;
}
