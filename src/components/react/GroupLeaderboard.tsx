import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { batchGetUsers, getCurrentUser } from '../../lib/auth';
import { calculateUserTotalPoints, calculatePredictionPoints } from '../../lib/points';
import PointsHistoryModal from './PointsHistoryModal';
import type { Group, Match, Prediction, User as UserType } from '../../lib/types';
import type { GroupLeaderboardEntry } from '../../lib/points';
import type { BonusPrediction } from '../../lib/types';

function getInitial(nameOrEmail: string): string {
  const s = (nameOrEmail || 'U').trim();
  return s[0].toUpperCase();
}

interface GroupLeaderboardProps {
  groupId: string;
  group: Group;
}

interface FinishedMatchesData {
  ids: Set<string>;
  map: Map<string, Match>;
}

export default function GroupLeaderboard({ groupId, group }: GroupLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<GroupLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [finishedMatches, setFinishedMatches] = useState<FinishedMatchesData>({ ids: new Set(), map: new Map() });
  const [usersMap, setUsersMap] = useState<Map<string, UserType>>(new Map());
  const [selectedEntry, setSelectedEntry] = useState<GroupLeaderboardEntry | null>(null);
  const [predictionsByUser, setPredictionsByUser] = useState<Map<string, Prediction[]>>(new Map());
  const [bonusByUser, setBonusByUser] = useState<Map<string, BonusPrediction>>(new Map());

  const allUserIds = useMemo(
    () => [...new Set([...group.participants, group.adminUid])],
    [group.participants, group.adminUid]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLoading(true);
      setError('');

      try {
        const usersPromise = batchGetUsers(allUserIds);
        const matchesPromise = getDocs(
          query(
            collection(db, 'competitions', group.competitionId, 'matches'),
            where('status', '==', 'finished')
          )
        );
        const predictionsPromise = getDocs(collection(db, 'groups', groupId, 'predictions'));
        const bonusPromise = getDocs(collection(db, 'groups', groupId, 'bonusPredictions'));

        const [resolvedUsersMap, matchesSnapshot, predictionsSnapshot, bonusSnapshot] = await Promise.all([
          usersPromise,
          matchesPromise,
          predictionsPromise,
          bonusPromise
        ]);

        if (cancelled) return;

        const finishedMap = new Map<string, Match>();
        matchesSnapshot.forEach((doc) => {
          const match = { id: doc.id, ...doc.data() } as Match;
          finishedMap.set(match.id, match);
        });

        const finishedIds = new Set(finishedMap.keys());
        const nextPredictionsByUser = new Map<string, Prediction[]>();
        predictionsSnapshot.forEach((doc) => {
          const prediction = { id: doc.id, ...doc.data() } as Prediction;
          if (!finishedIds.has(prediction.matchId)) return;

          const match = finishedMap.get(prediction.matchId);
          if (!prediction.points && match?.result) {
            const calculated = calculatePredictionPoints(prediction, match.result, group.settings);
            prediction.points = calculated.points;
            prediction.pointsBreakdown = calculated.breakdown;
          }

          const userId = prediction.userId;
          if (!nextPredictionsByUser.has(userId)) nextPredictionsByUser.set(userId, []);
          nextPredictionsByUser.get(userId)!.push(prediction);
        });

        const nextBonusByUser = new Map<string, BonusPrediction>();
        bonusSnapshot.forEach((doc) => {
          const bonus = { id: doc.id, ...doc.data() } as BonusPrediction;
          if (bonus.userId != null) {
            nextBonusByUser.set(bonus.userId, bonus);
          }
        });

        const entries: GroupLeaderboardEntry[] = allUserIds.map((userId) => {
          const user = resolvedUsersMap.get(userId);
          const userName = user?.displayName ?? `Usuario ${userId.substring(0, 8)}...`;
          const userPredictions = nextPredictionsByUser.get(userId) ?? [];
          const matchPoints = calculateUserTotalPoints(userPredictions);
          const bonusPoints = nextBonusByUser.get(userId)?.points ?? 0;

          return {
            userId,
            userName,
            totalPoints: matchPoints + bonusPoints,
            predictionsCount: 0,
            rank: 0
          };
        });

        entries.sort((a, b) =>
          b.totalPoints !== a.totalPoints
            ? b.totalPoints - a.totalPoints
            : a.userName.localeCompare(b.userName)
        );
        entries.forEach((entry, index) => {
          entry.rank = index + 1;
        });

        setUsersMap(resolvedUsersMap);
        setFinishedMatches({ ids: finishedIds, map: finishedMap });
        setPredictionsByUser(nextPredictionsByUser);
        setBonusByUser(nextBonusByUser);
        setLeaderboard(entries);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar tabla general');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [groupId, group.competitionId, allUserIds.join(','), group.settings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--pc-accent)] mx-auto" />
          <p className="mt-4 text-[color:var(--pc-muted)]">Cargando tabla de posiciones...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl border border-red-500/60 bg-red-900/40 text-red-100">
        <p>{error}</p>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-12 rounded-xl border border-dashed border-[color:var(--pc-main-dark)]/60 bg-[color:var(--pc-surface)]/60">
        <p className="text-[color:var(--pc-muted)]">No hay participantes en este grupo.</p>
      </div>
    );
  }

  const currentUserId = getCurrentUser()?.uid;

  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--pc-main-dark)]/60 bg-[color:var(--pc-surface)]/80 shadow-sm">
      <table className="min-w-full divide-y divide-[color:var(--pc-main-dark)]/60">
        <thead className="bg-[color:var(--pc-main-dark)]/60">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--pc-muted)] uppercase tracking-wider">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--pc-muted)] uppercase tracking-wider">
              Participante
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-[color:var(--pc-muted)] uppercase tracking-wider">
              Puntos Totales
            </th>
          </tr>
        </thead>
        <tbody className="bg-[color:var(--pc-surface)] divide-y divide-[color:var(--pc-main-dark)]/40">
          {leaderboard.map((entry) => {
            const isCurrentUser = currentUserId === entry.userId;
            
            return (
              <tr
                key={entry.userId}
                className={`${
                  isCurrentUser
                    ? 'bg-[color:var(--pc-main)]/20'
                    : entry.rank === 1
                      ? 'bg-[color:var(--pc-accent)]/10'
                      : entry.rank <= 3
                        ? 'bg-white/5'
                        : ''
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[color:var(--pc-text-on-dark)]">
                  {entry.rank === 1 && '🥇'}
                  {entry.rank === 2 && '🥈'}
                  {entry.rank === 3 && '🥉'}
                  {entry.rank > 3 && entry.rank}
                </td>
                <td className={`px-4 py-3 whitespace-nowrap text-sm ${isCurrentUser ? 'font-bold text-[color:var(--pc-text-on-dark)]' : 'text-[color:var(--pc-text-on-dark)]'}`}>
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full overflow-hidden bg-[color:var(--pc-main-dark)]/60 text-[color:var(--pc-muted)] font-semibold text-sm">
                      {(() => {
                        const user = usersMap.get(entry.userId);
                        if (user?.avatarUrl) {
                          return (
                            <img
                              src={user.avatarUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          );
                        }
                        return getInitial(entry.userName);
                      })()}
                    </span>
                    <span>{entry.userName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                  <button
                    type="button"
                    onClick={() => setSelectedEntry(entry)}
                    className="inline-flex items-center gap-1.5 text-[color:var(--pc-accent)] hover:text-[color:var(--pc-accent-dark)] focus:outline-none focus:ring-2 focus:ring-[color:var(--pc-accent)] focus:ring-offset-1 rounded"
                    title="Ver historial de puntos"
                  >
                    <span className={`font-bold text-lg ${entry.totalPoints > 0 ? 'text-[color:var(--pc-accent)]' : 'text-[color:var(--pc-muted)]'}`}>
                      {entry.totalPoints}
                    </span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selectedEntry && (
        <PointsHistoryModal
          isOpen={!!selectedEntry}
          onClose={() => setSelectedEntry(null)}
          userName={selectedEntry.userName}
          avatarUrl={usersMap.get(selectedEntry.userId)?.avatarUrl}
          predictions={predictionsByUser.get(selectedEntry.userId) ?? []}
          bonus={bonusByUser.get(selectedEntry.userId)}
          matchesMap={finishedMatches.map}
          competitionId={group.competitionId}
        />
      )}
    </div>
  );
}
