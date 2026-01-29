import { useEffect, useState } from 'react';
import { getGroup } from '../../lib/groups';
import { getMatchesByCompetition, filterUpcomingMatches, filterLiveMatches, filterFinishedMatches } from '../../lib/matches';
import { getCurrentUser } from '../../lib/auth';
import { getUserPrediction, savePrediction } from '../../lib/predictions';
import type { Group, Match, Prediction } from '../../lib/types';
import MatchCard from './MatchCard';

interface PredictionsViewProps {
  groupId: string;
  group?: Group; // Opcional: si viene del padre, no necesita cargarlo
}

export default function PredictionsView({ groupId, group: groupProp }: PredictionsViewProps) {
  const [group, setGroup] = useState<Group | null>(groupProp || null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(!groupProp); // Si ya viene el grupo, no mostrar loading
  const [error, setError] = useState('');
  const [userPredictions, setUserPredictions] = useState<Record<string, Prediction>>({});
  const [savingPrediction, setSavingPrediction] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [groupId, groupProp?.id]);

  const loadData = async () => {
    try {
      if (groupProp) {
        setGroup(groupProp);
        const matchesData = await getMatchesByCompetition(groupProp.competitionId);
        setMatches(matchesData);
        await loadUserPredictions(matchesData, groupProp);
        setLoading(false);
        return;
      }

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
      await loadUserPredictions(matchesData, groupData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadUserPredictions = async (matchesData: Match[], groupData: Group) => {
    const user = getCurrentUser();
    if (!user) return;

    const scheduledMatches = matchesData.filter((m) => m.status === 'scheduled');
    const predictionPromises = scheduledMatches.map((match) =>
      getUserPrediction(groupId, user.uid, match.id).then((p) => (p ? { matchId: match.id, prediction: p } : null))
    );
    const results = await Promise.all(predictionPromises);
    const predictions: Record<string, Prediction> = {};
    results.forEach((r) => {
      if (r) predictions[r.matchId] = r.prediction;
    });

    const otherMatches = matchesData.filter((m) => m.status !== 'scheduled');
    if (otherMatches.length > 0) {
      const otherResults = await Promise.all(
        otherMatches.map((match) =>
          getUserPrediction(groupId, user.uid, match.id).then((p) => (p ? { matchId: match.id, prediction: p } : null))
        )
      );
      otherResults.forEach((r) => {
        if (r) predictions[r.matchId] = r.prediction;
      });
    }

    setUserPredictions(predictions);
  };

  const handleSavePrediction = async (matchId: string, team1Score: number, team2Score: number) => {
    const user = getCurrentUser();
    if (!user || !group) return;

    setSavingPrediction(matchId);
    try {
      await savePrediction(groupId, user.uid, matchId, team1Score, team2Score);
      
      const prediction = await getUserPrediction(groupId, user.uid, matchId);
      if (prediction) {
        setUserPredictions((prev) => ({ ...prev, [matchId]: prediction }));
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al guardar pronóstico');
    } finally {
      setSavingPrediction(null);
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

  if (!group) {
    return (
      <div className="p-6 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
        <p>No se pudo cargar el grupo.</p>
      </div>
    );
  }

  const upcomingMatches = filterUpcomingMatches(matches);
  const liveMatches = filterLiveMatches(matches);
  const finishedMatches = filterFinishedMatches(matches);

  return (
    <div className="space-y-6">
      {liveMatches.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Partidos en Curso</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {liveMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                groupId={groupId}
                group={group!}
                userPrediction={userPredictions[match.id]}
                onSavePrediction={handleSavePrediction}
                isSaving={savingPrediction === match.id}
                canEdit={false}
              />
            ))}
          </div>
        </section>
      )}

      {upcomingMatches.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Proximos Partidos</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {upcomingMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                groupId={groupId}
                group={group!}
                userPrediction={userPredictions[match.id]}
                onSavePrediction={handleSavePrediction}
                isSaving={savingPrediction === match.id}
                canEdit={true}
              />
            ))}
          </div>
        </section>
      )}

      {finishedMatches.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Partidos Finalizados</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {finishedMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                groupId={groupId}
                group={group!}
                userPrediction={userPredictions[match.id]}
                onSavePrediction={handleSavePrediction}
                isSaving={false}
                canEdit={false}
              />
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
