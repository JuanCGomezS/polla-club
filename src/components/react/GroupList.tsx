import { useEffect, useState } from 'react';
import { getUserGroups, canUserCreateGroups } from '../../lib/groups';
import { getCurrentUser } from '../../lib/auth';
import { getRoute } from '../../lib/utils';
import type { Group } from '../../lib/types';

export default function GroupList() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const user = getCurrentUser();
      if (!user) {
        setError('No hay usuario autenticado');
        setLoading(false);
        return;
      }

      // Verificar permiso de creación y cargar grupos en paralelo
      const [userGroups, hasPermission] = await Promise.all([
        getUserGroups(user.uid),
        canUserCreateGroups(user.uid)
      ]);

      setGroups(userGroups);
      setCanCreate(hasPermission);
    } catch (err: any) {
      setError(err.message || 'Error al cargar grupos');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando grupos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6 bg-red-100 border border-red-400 text-red-700 rounded">
        <p>{error}</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6">
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No tienes grupos aún</h2>
          <p className="text-gray-600 mb-6">
            {canCreate
              ? 'Crea un grupo o únete a uno existente usando un código'
              : 'Únete a un grupo existente usando un código'}
          </p>
          <div className="space-x-4">
            {canCreate && (
              <a
                href={getRoute('/groups/create')}
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
              >
                Crear Grupo
              </a>
            )}
            <a
              href={getRoute('/groups/join')}
              className="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition"
            >
              Unirse a Grupo
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-8 p-6">
      <h1 className="text-3xl font-bold text-gray-900 my-4">Mis Grupos</h1>
      <div className="flex justify-end items-center mb-6 space-x-2">
        {canCreate && (
          <a
            href={getRoute('/groups/create')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
          >
            Crear Grupo
          </a>
        )}
        <a
          href={getRoute('/groups/join')}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition text-sm"
        >
          Unirse
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <a
            key={group.id}
            href={getRoute(`/groups/dashboard?groupId=${group.id}&tab=predictions`)}
            className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-lg transition cursor-pointer"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-semibold text-gray-900">{group.name}</h3>
              {group.isActive ? (
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                  Activo
                </span>
              ) : (
                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                  Inactivo
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-2">Código: <span className="font-mono font-semibold">{group.code}</span></p>
            <p className="text-sm text-gray-600">
              {group.participants.length} participante{group.participants.length !== 1 ? 's' : ''}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
