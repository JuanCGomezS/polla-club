import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createGroup } from '../../lib/groups';
import { canUserCreateGroups } from '../../lib/groups';
import { getCompetitions } from '../../lib/competitions';
import { getCurrentUser } from '../../lib/auth';
import { getRoute } from '../../lib/utils';
import type { Competition, Group } from '../../lib/types';

export default function CreateGroupForm() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [canCreate, setCanCreate] = useState(false);
  
  const [formData, setFormData] = useState({
    competitionId: '',
    name: '',
    pointsExactScore: 5,
    pointsWinner: 2,
    pointsGoalDifference: 1
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = getCurrentUser();
      if (!user) {
        setError('No hay usuario autenticado');
        setLoading(false);
        return;
      }

      const [competitionsData, hasPermission] = await Promise.all([
        getCompetitions(),
        canUserCreateGroups(user.uid)
      ]);

      if (!hasPermission) {
        setError('No tienes permiso para crear grupos');
        setLoading(false);
        return;
      }

      setCompetitions(competitionsData);
      setCanCreate(true);
      
      // Seleccionar la primera competición por defecto
      if (competitionsData.length > 0) {
        setFormData(prev => ({ ...prev, competitionId: competitionsData[0].id }));
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const user = getCurrentUser();
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }

      // Verificar permiso nuevamente
      const hasPermission = await canUserCreateGroups(user.uid);
      if (!hasPermission) {
        throw new Error('No tienes permiso para crear grupos');
      }

      const settings: Group['settings'] = {
        pointsExactScore: formData.pointsExactScore,
        pointsWinner: formData.pointsWinner,
        pointsGoalDifference: formData.pointsGoalDifference > 0 ? formData.pointsGoalDifference : undefined
      };

      const { groupId } = await createGroup(
        formData.competitionId,
        formData.name,
        user.uid,
        settings
      );

      // Redirigir al grupo creado
      window.location.href = getRoute(`/groups/${groupId}`);
    } catch (err: any) {
      setError(err.message || 'Error al crear grupo');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6 bg-red-100 border border-red-400 text-red-700 rounded">
        <p>No tienes permiso para crear grupos.</p>
      </div>
    );
  }

  if (competitions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
        <p>No hay competiciones disponibles. Contacta al administrador.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Crear Nuevo Grupo</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md">
        <div>
          <label htmlFor="competitionId" className="block text-sm font-medium text-gray-700 mb-1">
            Competición *
          </label>
          <select
            id="competitionId"
            value={formData.competitionId}
            onChange={(e) => setFormData(prev => ({ ...prev, competitionId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Selecciona una competición</option>
            {competitions.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del Grupo *
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ej: Amigos del trabajo"
            required
            minLength={3}
            maxLength={50}
          />
        </div>

        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuración de Puntos</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="pointsExactScore" className="block text-sm font-medium text-gray-700 mb-1">
                Puntos por Marcador Exacto *
              </label>
              <input
                type="number"
                id="pointsExactScore"
                value={formData.pointsExactScore}
                onChange={(e) => setFormData(prev => ({ ...prev, pointsExactScore: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="20"
                required
              />
              <p className="mt-1 text-xs text-gray-500">Puntos por acertar el resultado exacto (ej: 2-1)</p>
            </div>

            <div>
              <label htmlFor="pointsWinner" className="block text-sm font-medium text-gray-700 mb-1">
                Puntos por Acertar Ganador *
              </label>
              <input
                type="number"
                id="pointsWinner"
                value={formData.pointsWinner}
                onChange={(e) => setFormData(prev => ({ ...prev, pointsWinner: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="10"
                required
              />
              <p className="mt-1 text-xs text-gray-500">Puntos por acertar quién gana (sin acertar marcador)</p>
            </div>

            <div>
              <label htmlFor="pointsGoalDifference" className="block text-sm font-medium text-gray-700 mb-1">
                Puntos por Acertar Diferencia de Goles (Opcional)
              </label>
              <input
                type="number"
                id="pointsGoalDifference"
                value={formData.pointsGoalDifference}
                onChange={(e) => setFormData(prev => ({ ...prev, pointsGoalDifference: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                max="5"
              />
              <p className="mt-1 text-xs text-gray-500">Puntos adicionales por acertar la diferencia de goles (0 para desactivar)</p>
            </div>
          </div>
        </div>

        <div className="flex space-x-4 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creando...' : 'Crear Grupo'}
          </button>
          <a
            href={getRoute('/groups')}
            className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 text-center"
          >
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}
