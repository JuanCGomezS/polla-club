import { useEffect, useRef, useState } from 'react';
import { getGroup } from '../../lib/groups';
import { getMatchesByCompetition, filterUpcomingMatches, filterLiveMatches, filterFinishedMatches } from '../../lib/matches';
import { getCurrentUser } from '../../lib/auth';
import { getUserPredictions, savePrediction, getUserPrediction } from '../../lib/predictions';
import type { Group, Match, Prediction } from '../../lib/types';
import MatchCard from './MatchCard';
import BonusPredictionsForm from './BonusPredictionsForm';

export type PredictionsSubTab = 'live' | 'upcoming' | 'finished' | 'bonus';

interface PredictionsViewProps {
  groupId: string;
  group?: Group;
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

  const loadUserPredictions = async (_matchesData: Match[], _groupData: Group) => {
    const user = getCurrentUser();
    if (!user) return;
    const all = await getUserPredictions(groupId, user.uid);
    const byMatch: Record<string, Prediction> = {};
    all.forEach((p) => { byMatch[p.matchId] = p; });
    setUserPredictions(byMatch);
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

  const defaultSubTab: PredictionsSubTab =
    liveMatches.length > 0 ? 'live' : upcomingMatches.length > 0 ? 'upcoming' : finishedMatches.length > 0 ? 'finished' : 'bonus';
  const [subTab, setSubTab] = useState<PredictionsSubTab>('upcoming');
  const initialDefaultSet = useRef(false);

  useEffect(() => {
    if (matches.length > 0 && !initialDefaultSet.current) {
      initialDefaultSet.current = true;
      setSubTab(defaultSubTab);
    }
  }, [matches.length, defaultSubTab]);

  useEffect(() => {
    setSubTab((current) => {
      if (current === 'live' && liveMatches.length === 0) return defaultSubTab;
      if (current === 'upcoming' && upcomingMatches.length === 0) return defaultSubTab;
      if (current === 'finished' && finishedMatches.length === 0) return defaultSubTab;
      return current;
    });
  }, [liveMatches.length, upcomingMatches.length, finishedMatches.length, defaultSubTab]);

  const subTabs: { id: PredictionsSubTab; label: string; count?: number }[] = [
    ...(liveMatches.length > 0 ? [{ id: 'live' as const, label: 'Partidos en vivo', count: liveMatches.length }] : []),
    { id: 'upcoming', label: 'Próximos partidos', count: upcomingMatches.length },
    { id: 'finished', label: 'Partidos finalizados', count: finishedMatches.length },
    { id: 'bonus', label: 'Pronósticos bonus' },
  ];

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1 border-b border-gray-200 pb-2">
        {subTabs.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg transition ${
              subTab === id
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {label}
            {count != null && count > 0 && (
              <span className="ml-1.5 text-gray-500 font-normal">({count})</span>
            )}
          </button>
        ))}
      </nav>

      {subTab === 'live' && (
        <section>
          {liveMatches.length > 0 ? (
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
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No hay partidos en vivo.</p>
            </div>
          )}
        </section>
      )}

      {subTab === 'upcoming' && (
        <section>
          {upcomingMatches.length > 0 ? (
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
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No hay próximos partidos.</p>
            </div>
          )}
        </section>
      )}

      {subTab === 'finished' && (
        <section>
          {finishedMatches.length > 0 ? (
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
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No hay partidos finalizados.</p>
            </div>
          )}
        </section>
      )}

      {subTab === 'bonus' && <BonusPredictionsForm groupId={groupId} group={group} />}
    </div>
  );
}
