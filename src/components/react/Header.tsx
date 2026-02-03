import { useEffect, useState } from 'react';
import { onAuthStateChange, logoutUser, getUserData } from '../../lib/auth';
import { getRoute } from '../../lib/utils';
import type { User } from 'firebase/auth';
import type { User as UserType } from '../../lib/types';

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Escuchar cambios en el estado de autenticación
    const unsubscribe = onAuthStateChange((authUser) => {
      setUser(authUser);
      
      if (authUser) {
        loadUserData(authUser.uid);
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadUserData = async (uid: string) => {
    try {
      const data = await getUserData(uid);
      setUserData(data);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    window.location.href = getRoute('/');
  };

  if (loading) {
    return (
      <header className="bg-blue-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <a href={getRoute('/')} className="text-xl font-bold text-gray-900">
                PollaClub
              </a>
            </div>
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </header>
    );
  }

  if (!user) {
    return (
      <header className="bg-blue-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <a href={getRoute('/')} className="text-xl font-bold text-gray-900">
                PollaClub
              </a>
            </div>
            <div>
              <a
                href={getRoute('/login')}
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Iniciar Sesión
              </a>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-blue-100 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <a href={getRoute('/groups')} className="text-xl font-bold text-gray-900">
              PollaClub
            </a>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-700">
              <span className="font-medium">
                Bienvenido, {userData?.email || user.displayName || 'Usuario'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
