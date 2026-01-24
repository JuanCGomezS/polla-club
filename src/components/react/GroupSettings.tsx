import { useEffect, useState } from 'react';
import { getGroup, isGroupAdmin } from '../../lib/groups';
import { getCurrentUser } from '../../lib/auth';
import { getRoute } from '../../lib/utils';
import type { Group } from '../../lib/types';

interface GroupSettingsProps {
  groupId: string;
}

export default function GroupSettings({ groupId }: GroupSettingsProps) {
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  const loadGroup = async () => {
    try {
      const user = getCurrentUser();
      if (!user) {
        setError('No hay usuario autenticado');
        setLoading(false);
        return;
      }

      const groupData = await getGroup(groupId);
      if (!groupData) {
        setError('Grupo no encontrado');
        setLoading(false);
        return;
      }

      if (!isGroupAdmin(groupData, user.uid)) {
        setError('No tienes permiso para ver la configuraci?n de este grupo');
        setLoading(false);
        return;
      }

      setGroup(groupData);
      setUserIsAdmin(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar grupo');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando configuraci?n...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-100 border border-red-400 text-red-700 rounded">
        <p>{error}</p>
        <a href={getRoute(`/groups/dashboard?groupId=${groupId}&tab=predictions`)} className="mt-4 inline-block text-blue-600 hover:text-blue-800">
          Volver al dashboard
        </a>
      </div>
    );
  }

  if (!group || !userIsAdmin) return null;

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Reglas de Puntaje</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-700">Marcador Exacto</span>
            <span className="font-semibold text-gray-900">{group.settings.pointsExactScore} puntos</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-700">Acertar Ganador</span>
            <span className="font-semibold text-gray-900">{group.settings.pointsWinner} puntos</span>
          </div>
          {group.settings.pointsGoalDifference != null && (
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-700">Diferencia de Goles</span>
              <span className="font-semibold text-gray-900">{group.settings.pointsGoalDifference} puntos</span>
            </div>
          )}
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Las reglas de puntaje no se pueden modificar despu?s de crear el grupo.
        </p>
      </section>

      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Estado del Grupo</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-700">
              El grupo est? actualmente{' '}
              <span className="font-semibold">{group.isActive ? 'activo' : 'inactivo'}</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {group.isActive
                ? 'Los participantes pueden hacer pron?sticos y ver resultados.'
                : 'El grupo est? pausado.'}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Participantes</h2>
        <p className="text-gray-700 mb-4">
          Total de participantes: <span className="font-semibold">{group.participants.length}</span>
        </p>
      </section>
    </div>
  );
}
