import { useEffect, useState } from 'react';
import { onAuthStateChange } from '../../lib/auth';
import type { User } from 'firebase/auth';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  fallback?: React.ReactNode;
}

/**
 * Componente que protege contenido que requiere autenticación
 * En Astro, el routing se maneja en las páginas, este componente solo verifica auth
 */
export default function AuthGuard({ 
  children, 
  requireAuth = true,
  fallback
}: AuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChange((authUser) => {
      setUser(authUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Evitar hidratación mismatch: no renderizar nada hasta que esté montado en el cliente
  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (requireAuth && !user) {
    // Redirigir inmediatamente si no hay usuario y se requiere auth
    if (mounted && !loading) {
      window.location.href = '/login';
      return null;
    }
    
    if (fallback) {
      return <>{fallback}</>;
    }
    
    // Mostrar mensaje mientras redirige
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  if (!requireAuth && user) {
    // Si no requiere auth pero el usuario está autenticado, mostrar contenido
    return <>{children}</>;
  }

  return <>{children}</>;
}
