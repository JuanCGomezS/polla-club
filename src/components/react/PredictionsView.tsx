import { useEffect, useState } from 'react';
import { getGroup } from '../../lib/groups';
import { getMatchesByCompetition, filterUpcomingMatches, filterLiveMatches, filterFinishedMatches } from '../../lib/matches';
import { getCurrentUser } from '../../lib/auth';
import type { Group, Match } from '../../lib/types';

interface PredictionsViewProps {
  groupId: string;
}

export default function PredictionsView({ groupId }: PredictionsViewProps) {
  const [group, setGroup] = useState<Group | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = async () => {
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

      const matchesData = await getMatchesByCompetition(groupData.competitionId);
      setGroup(groupData);
      setMatches(matchesData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando partidos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-100 border border-red-400 text-red-700 rounded">
        <p>{error}</p>
      </div>
    );
  }

  const upcomingMatches = filterUpcomingMatches(matches);
  const liveMatches = filterLiveMatches(matches);
  const finishedMatches = filterFinishedMatches(matches);

  return (
    <div className="space-y-8">
      {upcomingMatches.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Próximos Partidos</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingMatches.map((match) => (
              <div key={match.id} className="p-4 bg-white border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-500">
                    {match.scheduledTime?.toDate?.()?.toLocaleDateString?.('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">{match.round}</span>
                </div>
                <div className="text-center my-4">
                  <div className="font-semibold text-lg">{match.team1}</div>
                  <div className="text-gray-400 my-1">vs</div>
                  <div className="font-semibold text-lg">{match.team2}</div>
                </div>
                <p className="text-sm text-gray-600 text-center">Próximamente podrás hacer tu pronóstico</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {liveMatches.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Partidos en Curso</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {liveMatches.map((match) => (
              <div key={match.id} className="p-4 bg-white border border-green-200 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-500">
                    {match.scheduledTime?.toDate?.()?.toLocaleDateString?.('es-ES', {
                      day: 'numeric',
                      month: 'short'
                    })}
                  </span>
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded animate-pulse">EN VIVO</span>
                </div>
                <div className="text-center my-4">
                  <div className="font-semibold text-lg">{match.team1}</div>
                  {match.result && (
                    <div className="text-2xl font-bold my-2">
                      {match.result.team1Score} - {match.result.team2Score}
                    </div>
                  )}
                  <div className="font-semibold text-lg">{match.team2}</div>
                </div>
                <p className="text-sm text-gray-600 text-center">Ver pronósticos del grupo</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {finishedMatches.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Partidos Finalizados</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {finishedMatches.map((match) => (
              <div key={match.id} className="p-4 bg-white border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-500">
                    {match.scheduledTime?.toDate?.()?.toLocaleDateString?.('es-ES', {
                      day: 'numeric',
                      month: 'short'
                    })}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded">Finalizado</span>
                </div>
                <div className="text-center my-4">
                  <div className="font-semibold text-lg">{match.team1}</div>
                  {match.result && (
                    <div className="text-2xl font-bold my-2">
                      {match.result.team1Score} - {match.result.team2Score}
                    </div>
                  )}
                  <div className="font-semibold text-lg">{match.team2}</div>
                </div>
                <p className="text-sm text-gray-600 text-center">Ver tabla de pronósticos</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {upcomingMatches.length === 0 && liveMatches.length === 0 && finishedMatches.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No hay partidos disponibles para esta competición.</p>
        </div>
      )}
    </div>
  );
}
